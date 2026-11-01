"""
align_pipeline.py
-----------------
Aerosense AI — Spatial-Temporal Alignment & Master Dataset Builder.

Workflow:
  1. Load CPCB ground PM2.5  (hourly, per station)
  2. Load satellite AOD+HCHO (daily, per grid pixel)
  3. Load ERA5 weather vars   (6-hourly, per grid pixel)
  4. Load FIRMS fire stats    (daily, per station)
  5. Nearest-neighbour spatial alignment of satellite & ERA5 pixels → station coords
  6. Temporal resampling / forward-fill (satellite → hourly)
  7. Feature normalisation (Z-score)
  8. Sanity checks & QA cloud-masking
  9. Output: output/master_aligned_dataset.csv

Data Contract
-------------
Required final columns (see DATA_CONTRACT dict below):
  station_id | city | lat | lon | timestamp
  pm25                          [µg/m³]
  aod_550nm                     [dimensionless]
  hcho_trop_col                 [mol/m²]
  cloud_fraction                [0–1]
  t2m_K                         [K]
  rh_pct                        [%]
  u10_ms                        [m/s]
  v10_ms                        [m/s]
  blh_m                         [m]
  fire_count_50km               [count]
  fire_dist_min_km              [km]
  pm25_norm | aod_norm | hcho_norm | t2m_norm | rh_norm | u10_norm | v10_norm | blh_norm
  qa_flag                       [GOOD | SUSPECT | CLOUDY]
  source_pm25 | source_sat | source_era5 | source_fire
"""

import logging
import os
import sys
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

# Ensure scripts/ is importable
SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

from fetch_cpcb      import fetch_pm25
from fetch_satellite import fetch_satellite
from fetch_era5      import fetch_era5
from fetch_firms     import fetch_firms

warnings.filterwarnings("ignore", category=FutureWarning)

log = logging.getLogger("align_pipeline")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(name)s — %(message)s",
)

# ---------------------------------------------------------------------------
# Data contract — required output columns and types
# ---------------------------------------------------------------------------
DATA_CONTRACT = {
    "station_id":      "object",
    "city":            "object",
    "lat":             "float64",
    "lon":             "float64",
    "timestamp":       "datetime64[ns, UTC]",
    "pm25":            "float64",
    "aod_550nm":       "float64",
    "hcho_trop_col":   "float64",
    "cloud_fraction":  "float64",
    "t2m_K":           "float64",
    "rh_pct":          "float64",
    "u10_ms":          "float64",
    "v10_ms":          "float64",
    "blh_m":           "float64",
    "fire_count_50km": "int64",
    "fire_dist_min_km":"float64",
    "pm25_norm":       "float64",
    "aod_norm":        "float64",
    "hcho_norm":       "float64",
    "t2m_norm":        "float64",
    "rh_norm":         "float64",
    "u10_norm":        "float64",
    "v10_norm":        "float64",
    "blh_norm":        "float64",
    "qa_flag":         "object",
    "source_pm25":     "object",
    "source_sat":      "object",
    "source_era5":     "object",
    "source_fire":     "object",
}

OUTPUT_DIR  = Path(__file__).resolve().parents[1] / "output"
OUTPUT_FILE = OUTPUT_DIR / "master_aligned_dataset.csv"


# ---------------------------------------------------------------------------
# Step 1 – Nearest-neighbour spatial alignment (raster → station coords)
# ---------------------------------------------------------------------------

def _spatial_align(
    station_df: pd.DataFrame,
    grid_df: pd.DataFrame,
    grid_lat_col: str = "lat",
    grid_lon_col: str = "lon",
    max_dist_deg: float = 0.5,
) -> pd.DataFrame:
    """
    For each station, find the nearest grid pixel and attach its attributes.

    Uses a cKDTree in (lat, lon) degree space — adequate for India's extent
    (cosine correction not critical at sub-0.5° distances).

    Parameters
    ----------
    station_df   : must have 'lat', 'lon' columns
    grid_df      : must have grid_lat_col, grid_lon_col + feature columns
    max_dist_deg : reject matches further than this threshold

    Returns
    -------
    station_df with nearest-pixel features appended (suffix '_grid' on conflicts)
    """
    # Build KDTree from unique grid pixel coordinates
    grid_coords = grid_df[[grid_lat_col, grid_lon_col]].drop_duplicates().values
    tree = cKDTree(grid_coords)

    station_coords = station_df[["lat", "lon"]].values
    dists, idxs    = tree.query(station_coords, k=1, workers=-1)

    # Mask stations that are too far from any pixel
    valid_mask = dists <= max_dist_deg
    n_invalid  = (~valid_mask).sum()
    if n_invalid > 0:
        log.warning("%d station-rows exceed max spatial distance (%.2f°) — will be NaN.",
                    n_invalid, max_dist_deg)

    # Map nearest pixel coords back to full grid_df rows
    nearest_lat = grid_coords[idxs, 0]
    nearest_lon = grid_coords[idxs, 1]
    nearest_lat[~valid_mask] = np.nan
    nearest_lon[~valid_mask] = np.nan

    station_df = station_df.copy()
    station_df["_nn_lat"] = nearest_lat
    station_df["_nn_lon"] = nearest_lon

    return station_df


def _merge_grid_features(
    station_df: pd.DataFrame,
    grid_df: pd.DataFrame,
    nn_lat_col: str = "_nn_lat",
    nn_lon_col: str = "_nn_lon",
    on_date_col: str = "date",
    feature_cols: list = None,
    suffix: str = "",
) -> pd.DataFrame:
    """
    Merge nearest-pixel grid features into station_df by (lat, lon, date).
    """
    grid_key_df = grid_df.copy()
    grid_key_df["_key_lat"] = grid_key_df["lat"].round(4)
    grid_key_df["_key_lon"] = grid_key_df["lon"].round(4)

    station_df["_key_lat"] = station_df[nn_lat_col].round(4)
    station_df["_key_lon"] = station_df[nn_lon_col].round(4)

    cols_to_use = ["_key_lat", "_key_lon", on_date_col] + (feature_cols or [])
    grid_key_df = grid_key_df[cols_to_use].copy()

    if suffix:
        grid_key_df = grid_key_df.rename(
            columns={c: c + suffix for c in feature_cols or []}
        )

    merged = station_df.merge(
        grid_key_df,
        on=["_key_lat", "_key_lon", on_date_col],
        how="left",
    )
    merged.drop(columns=["_key_lat", "_key_lon"], inplace=True)
    return merged


# ---------------------------------------------------------------------------
# Step 2 – Temporal resampling: daily satellite → hourly
# ---------------------------------------------------------------------------

def _broadcast_daily_to_hourly(
    hourly_df: pd.DataFrame,
    daily_df: pd.DataFrame,
    join_cols: list,
    feature_cols: list,
) -> pd.DataFrame:
    """
    Add a 'date' key to hourly_df, then left-merge daily_df features.
    Effectively forward-fills the daily value across all hours of that day.
    """
    hourly_df = hourly_df.copy()
    hourly_df["_date_key"] = hourly_df["timestamp"].dt.date.astype(str)
    daily_df  = daily_df.copy()
    daily_df["_date_key"]  = daily_df["date"].astype(str) if "date" in daily_df else \
                              daily_df["timestamp"].dt.date.astype(str)

    merge_on = join_cols + ["_date_key"]
    cols_to_keep = merge_on + feature_cols
    daily_sub = daily_df[[c for c in cols_to_keep if c in daily_df.columns]].copy()
    daily_sub.drop_duplicates(subset=merge_on, inplace=True)

    merged = hourly_df.merge(daily_sub, on=merge_on, how="left")
    merged.drop(columns=["_date_key"], errors="ignore", inplace=True)
    return merged


# ---------------------------------------------------------------------------
# Step 3 – Z-score normalisation
# ---------------------------------------------------------------------------

def _zscore_normalise(
    df: pd.DataFrame,
    cols: list,
    suffix: str = "_norm",
) -> pd.DataFrame:
    """Add Z-score normalised columns; clip to [-5, 5] for robustness."""
    for col in cols:
        if col not in df.columns:
            df[col + suffix] = np.nan
            continue
        mu  = df[col].mean(skipna=True)
        std = df[col].std(skipna=True)
        if std < 1e-9:
            df[col + suffix] = 0.0
        else:
            df[col + suffix] = ((df[col] - mu) / std).clip(-5, 5)
    return df


# ---------------------------------------------------------------------------
# Step 4 – QA / sanity checks
# ---------------------------------------------------------------------------

def _sanity_check(df: pd.DataFrame) -> pd.DataFrame:
    """
    Physical range checks and completeness assessment.
    Sets qa_flag column:
      GOOD    — all key fields present and within physical bounds
      SUSPECT — PM2.5 or AOD out of plausible range
      CLOUDY  — cloud_fraction >= 0.3 (satellite data masked)
      MISSING — critical field(s) absent
    """
    flags = pd.Series(["GOOD"] * len(df), index=df.index)

    # Cloud masking: apply first (overrides GOOD)
    if "cloud_fraction" in df.columns:
        cloudy_mask = df["cloud_fraction"] >= 0.3
        flags[cloudy_mask] = "CLOUDY"

    # Physical bounds
    if "pm25" in df.columns:
        suspect_pm25 = (df["pm25"] < 0) | (df["pm25"] > 1000)
        flags[suspect_pm25] = "SUSPECT"

    if "aod_550nm" in df.columns:
        suspect_aod = df["aod_550nm"].notna() & ((df["aod_550nm"] < 0) | (df["aod_550nm"] > 5))
        flags[suspect_aod] = "SUSPECT"

    if "t2m_K" in df.columns:
        suspect_t = df["t2m_K"].notna() & ((df["t2m_K"] < 220) | (df["t2m_K"] > 340))
        flags[suspect_t] = "SUSPECT"

    if "rh_pct" in df.columns:
        suspect_rh = df["rh_pct"].notna() & ((df["rh_pct"] < 0) | (df["rh_pct"] > 100))
        flags[suspect_rh] = "SUSPECT"

    # Missing critical fields
    critical = ["pm25", "lat", "lon", "timestamp"]
    for col in critical:
        if col in df.columns:
            missing_mask = df[col].isna()
            flags[missing_mask] = "MISSING"

    df["qa_flag"] = flags

    # Summary
    counts = flags.value_counts().to_dict()
    log.info("QA summary: %s", counts)

    # Warn if > 30% records are non-GOOD
    non_good = len(df) - counts.get("GOOD", 0)
    if non_good / len(df) > 0.30:
        log.warning("⚠️  %.1f%% of records are non-GOOD — review input data quality.",
                    100 * non_good / len(df))

    return df


def _missing_value_report(df: pd.DataFrame) -> None:
    """Log a concise missing-value report."""
    null_counts = df.isnull().sum()
    null_pct    = 100 * null_counts / len(df)
    report = null_pct[null_pct > 0].round(1)
    if report.empty:
        log.info("✅  No missing values detected.")
    else:
        log.warning("Missing value summary (%%  null):\n%s", report.to_string())


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_pipeline(
    days: int = 7,
    freq: str = "1h",
    force_synthetic: bool = True,
    output_path: Path = OUTPUT_FILE,
) -> pd.DataFrame:
    """
    Execute the full end-to-end alignment pipeline.

    Parameters
    ----------
    days            : historical window in days
    freq            : PM2.5 / ERA5 sub-daily frequency
    force_synthetic : use synthetic generators (default True for offline dev)
    output_path     : destination CSV path

    Returns
    -------
    master_df : aligned, normalised, QA-flagged DataFrame
    """
    now      = datetime.now(timezone.utc)
    start_dt = now - timedelta(days=days)

    log.info("=" * 60)
    log.info("Aerosense AI — Alignment Pipeline")
    log.info("Window: %s → %s", start_dt.date(), now.date())
    log.info("=" * 60)

    # ------------------------------------------------------------------ #
    # 1. Ingest all data sources
    # ------------------------------------------------------------------ #
    log.info("[1/6] Fetching CPCB PM2.5 …")
    pm25_df = fetch_pm25(start=start_dt, end=now, freq=freq,
                         force_synthetic=force_synthetic)

    log.info("[2/6] Fetching satellite AOD + HCHO …")
    sat_df = fetch_satellite(start=start_dt, end=now,
                             force_synthetic=force_synthetic)

    log.info("[3/6] Fetching ERA5 weather variables …")
    era5_df = fetch_era5(start=start_dt, end=now, freq="6h",
                         force_synthetic=force_synthetic)

    log.info("[4/6] Fetching NASA FIRMS fire anomalies …")
    firms_df = fetch_firms(start=start_dt, end=now,
                           force_synthetic=force_synthetic)

    # ------------------------------------------------------------------ #
    # 2. Prepare date keys
    # ------------------------------------------------------------------ #
    pm25_df["timestamp"]  = pd.to_datetime(pm25_df["timestamp"], utc=True)
    sat_df["timestamp"]   = pd.to_datetime(sat_df["timestamp"],  utc=True)
    era5_df["timestamp"]  = pd.to_datetime(era5_df["timestamp"], utc=True)
    firms_df["date"]      = pd.to_datetime(firms_df["date"]).dt.date.astype(str)

    pm25_df["_date"] = pm25_df["timestamp"].dt.date.astype(str)
    sat_df["_date"]  = sat_df["timestamp"].dt.date.astype(str)
    era5_df["_date"] = era5_df["timestamp"].dt.date.astype(str)

    # ------------------------------------------------------------------ #
    # 3. Spatially align satellite → ground stations
    # ------------------------------------------------------------------ #
    log.info("[5/6] Spatial alignment …")

    # Get unique station locations
    stations = pm25_df[["station_id", "city", "lat", "lon"]].drop_duplicates()

    # Align satellite pixels to station coords (nearest-neighbour)
    sat_day_avg = (
        sat_df.groupby(["lat", "lon", "_date"])[
            ["aod_550nm", "hcho_trop_col", "cloud_fraction"]
        ].mean().reset_index()
    )
    sat_day_avg = sat_day_avg.rename(columns={"_date": "date"})

    # Align ERA5 pixels to station coords (nearest-neighbour, then daily avg)
    era5_day_avg = (
        era5_df.groupby(["lat", "lon", "_date"])[
            ["t2m_K", "rh_pct", "u10_ms", "v10_ms", "blh_m"]
        ].mean().reset_index()
    )
    era5_day_avg = era5_day_avg.rename(columns={"_date": "date"})

    # Find nearest satellite pixel per station
    sat_coords     = sat_day_avg[["lat", "lon"]].drop_duplicates().values
    era5_coords    = era5_day_avg[["lat", "lon"]].drop_duplicates().values
    station_coords = stations[["lat", "lon"]].values

    sat_tree  = cKDTree(sat_coords)
    era5_tree = cKDTree(era5_coords)

    _, sat_nn_idx  = sat_tree.query(station_coords,  k=1)
    _, era5_nn_idx = era5_tree.query(station_coords, k=1)

    stations = stations.copy()
    stations["sat_nn_lat"]  = sat_coords[sat_nn_idx, 0]
    stations["sat_nn_lon"]  = sat_coords[sat_nn_idx, 1]
    stations["era5_nn_lat"] = era5_coords[era5_nn_idx, 0]
    stations["era5_nn_lon"] = era5_coords[era5_nn_idx, 1]

    # ------------------------------------------------------------------ #
    # 4. Build master hourly DataFrame
    # ------------------------------------------------------------------ #
    master = pm25_df.copy()
    master["_date"] = master["timestamp"].dt.date.astype(str)

    # Merge station NN coords
    master = master.merge(
        stations[["station_id", "sat_nn_lat", "sat_nn_lon",
                  "era5_nn_lat", "era5_nn_lon"]],
        on="station_id", how="left",
    )

    # ---- Merge satellite (daily → hourly broadcast) ----
    sat_day_avg["_key_sat_lat"] = sat_day_avg["lat"].round(4)
    sat_day_avg["_key_sat_lon"] = sat_day_avg["lon"].round(4)
    master["_key_sat_lat"] = master["sat_nn_lat"].round(4)
    master["_key_sat_lon"] = master["sat_nn_lon"].round(4)

    master = master.merge(
        sat_day_avg[["_key_sat_lat", "_key_sat_lon", "date",
                     "aod_550nm", "hcho_trop_col", "cloud_fraction",]].rename(
            columns={"date": "_date"}
        ),
        on=["_key_sat_lat", "_key_sat_lon", "_date"],
        how="left",
    )

    # ---- Merge ERA5 (daily avg → hourly broadcast) ----
    era5_day_avg["_key_era5_lat"] = era5_day_avg["lat"].round(4)
    era5_day_avg["_key_era5_lon"] = era5_day_avg["lon"].round(4)
    master["_key_era5_lat"] = master["era5_nn_lat"].round(4)
    master["_key_era5_lon"] = master["era5_nn_lon"].round(4)

    master = master.merge(
        era5_day_avg[["_key_era5_lat", "_key_era5_lon", "date",
                      "t2m_K", "rh_pct", "u10_ms", "v10_ms", "blh_m"]].rename(
            columns={"date": "_date"}
        ),
        on=["_key_era5_lat", "_key_era5_lon", "_date"],
        how="left",
    )

    # ---- Merge FIRMS fire stats (daily per station) ----
    firms_df_sub = firms_df[["station_id", "date",
                              "fire_count_50km", "fire_dist_min_km",
                              "nearest_fire_lat", "nearest_fire_lon",
                              "source"]].copy()
    firms_df_sub = firms_df_sub.rename(columns={"date": "_date", "source": "source_fire"})

    master = master.merge(firms_df_sub, on=["station_id", "_date"], how="left")

    # ------------------------------------------------------------------ #
    # 5. Source provenance columns
    # ------------------------------------------------------------------ #
    master["source_pm25"] = master["source"]    # from CPCB fetch
    master["source_sat"]  = "SYNTHETIC_MAIAC+S5P"
    master["source_era5"] = "SYNTHETIC_ERA5"
    master["source_fire"] = master["source_fire"].fillna("SYNTHETIC_FIRMS")

    # ------------------------------------------------------------------ #
    # 6. Normalise features (Z-score)
    # ------------------------------------------------------------------ #
    NORM_COLS = ["pm25", "aod_550nm", "hcho_trop_col",
                 "t2m_K", "rh_pct", "u10_ms", "v10_ms", "blh_m"]
    NORM_NAMES = {c: c.replace("_550nm", "").replace("_trop_col", "").replace("_K", "") + "_norm"
                  for c in NORM_COLS}
    # Simpler: explicit mapping
    NORM_MAP = {
        "pm25":         "pm25_norm",
        "aod_550nm":    "aod_norm",
        "hcho_trop_col":"hcho_norm",
        "t2m_K":        "t2m_norm",
        "rh_pct":       "rh_norm",
        "u10_ms":       "u10_norm",
        "v10_ms":       "v10_norm",
        "blh_m":        "blh_norm",
    }
    for src_col, dst_col in NORM_MAP.items():
        if src_col in master.columns:
            mu  = master[src_col].mean(skipna=True)
            std = master[src_col].std(skipna=True)
            if std < 1e-9:
                master[dst_col] = 0.0
            else:
                master[dst_col] = ((master[src_col] - mu) / std).clip(-5, 5)
        else:
            master[dst_col] = np.nan

    # ------------------------------------------------------------------ #
    # 7. QA / sanity checks
    # ------------------------------------------------------------------ #
    log.info("[6/6] Running QA checks …")
    master = _sanity_check(master)
    _missing_value_report(master)

    # ------------------------------------------------------------------ #
    # 8. Select & order final columns per data contract
    # ------------------------------------------------------------------ #
    final_cols = list(DATA_CONTRACT.keys())
    for col in final_cols:
        if col not in master.columns:
            master[col] = np.nan if DATA_CONTRACT[col] != "object" else None

    master = master[final_cols].copy()

    # Cast types
    master["fire_count_50km"] = master["fire_count_50km"].fillna(0).astype("int64")
    master["timestamp"] = pd.to_datetime(master["timestamp"], utc=True)

    # ------------------------------------------------------------------ #
    # 9. Persist output
    # ------------------------------------------------------------------ #
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    master.to_csv(output_path, index=False)
    log.info("✅  Master dataset saved → %s  (%d rows × %d cols)",
             output_path, len(master), len(master.columns))

    return master


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Run Aerosense AI end-to-end alignment pipeline."
    )
    parser.add_argument("--days",      type=int,  default=7,
                        help="Historical window in days")
    parser.add_argument("--freq",      type=str,  default="1h",
                        help="PM2.5 temporal frequency")
    parser.add_argument("--synthetic", action="store_true", default=True,
                        help="Force synthetic generators (offline mode)")
    parser.add_argument("--out",       type=str,  default=str(OUTPUT_FILE),
                        help="Output CSV path")
    args = parser.parse_args()

    df = run_pipeline(
        days=args.days,
        freq=args.freq,
        force_synthetic=args.synthetic,
        output_path=Path(args.out),
    )
    print(f"\n{'='*60}")
    print(f"Final dataset: {df.shape[0]} rows × {df.shape[1]} cols")
    print(df.dtypes)
    print(df.head(5).to_string())

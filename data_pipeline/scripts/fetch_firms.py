"""
fetch_firms.py
--------------
Aerosense AI — NASA FIRMS (Fire Information for Resource Management System) ingestion.

Pulls active fire / thermal anomaly data from the NASA FIRMS NRT API (MODIS + VIIRS).
For each ground station, computes:
  • fire_count_50km  — number of fire pixels within a 50 km radius
  • fire_dist_min_km — distance to the nearest fire pixel [km]

Falls back to a spatially realistic synthetic fire anomaly generator when the API
is unreachable (no API key, network error, etc.).

Output columns per station-date row:
  station_id | city | lat | lon | date | fire_count_50km | fire_dist_min_km
  nearest_fire_lat | nearest_fire_lon | source
"""

import logging
import math
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import pandas as pd
import requests

log = logging.getLogger("fetch_firms")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(name)s — %(message)s",
)

# ---------------------------------------------------------------------------
# Ground station registry (must match fetch_cpcb.py)
# ---------------------------------------------------------------------------
STATION_REGISTRY = [
    ("DL_ANAND_VIHAR",  "Delhi NCR",  28.6469, 77.3152),
    ("DL_PUNJABI_BAGH", "Delhi NCR",  28.6663, 77.1338),
    ("DL_RK_PURAM",     "Delhi NCR",  28.5641, 77.1845),
    ("MU_BANDRA",       "Mumbai",     19.0548, 72.8402),
    ("MU_WORLI",        "Mumbai",     19.0118, 72.8154),
    ("KA_KIDWAI",       "Kanpur",     26.4499, 80.3319),
    ("PA_BAILEY",       "Patna",      25.6093, 85.1376),
    ("BN_BTM",          "Bengaluru",  12.9165, 77.6101),
    ("BN_HEBBAL",       "Bengaluru",  13.0358, 77.5970),
]

# ---------------------------------------------------------------------------
# NASA FIRMS NRT settings
# ---------------------------------------------------------------------------
FIRMS_BASE   = "https://firms.modaps.eosdis.nasa.gov/api/country"
FIRMS_RADIUS = 50     # km
EARTH_R_KM   = 6371.0
TIMEOUT      = 20


# ---------------------------------------------------------------------------
# Haversine distance
# ---------------------------------------------------------------------------

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi        = math.radians(lat2 - lat1)
    dlambda     = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2)
    return 2 * EARTH_R_KM * math.asin(math.sqrt(a))


def _haversine_vectorised(
    slat: float, slon: float,
    flats: np.ndarray, flons: np.ndarray,
) -> np.ndarray:
    """Vectorised haversine for many fire-point distances at once."""
    phi1   = math.radians(slat)
    phi2   = np.radians(flats)
    dphi   = np.radians(flats - slat)
    dlam   = np.radians(flons - slon)
    a = (np.sin(dphi / 2) ** 2
         + math.cos(phi1) * np.cos(phi2) * np.sin(dlam / 2) ** 2)
    return 2 * EARTH_R_KM * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


# ---------------------------------------------------------------------------
# Live FIRMS fetch
# ---------------------------------------------------------------------------

def _fetch_firms_live(date: datetime, api_key: Optional[str] = None) -> Optional[pd.DataFrame]:
    """
    Download active fire CSV from NASA FIRMS for India.

    Requires a FIRMS MAP_KEY. Set env var FIRMS_MAP_KEY or pass api_key.
    Returns DataFrame with columns: latitude, longitude, acq_date, confidence.
    """
    key = api_key or os.environ.get("FIRMS_MAP_KEY")
    if not key:
        log.warning("FIRMS_MAP_KEY not set — skipping live fetch.")
        return None

    try:
        # FIRMS CSV endpoint — VIIRS SNPP 375m, last 7 days, country=IND
        url = (
            f"{FIRMS_BASE}/csv/{key}/VIIRS_SNPP_NRT/IND/7/"
            f"{date.strftime('%Y-%m-%d')}"
        )
        log.info("FIRMS request: %s", url)
        resp = requests.get(url, timeout=TIMEOUT)
        resp.raise_for_status()

        from io import StringIO
        df = pd.read_csv(StringIO(resp.text))
        if df.empty or "latitude" not in df.columns:
            log.warning("FIRMS returned empty or malformed CSV.")
            return None

        log.info("FIRMS live: %d fire pixels.", len(df))
        return df[["latitude", "longitude", "acq_date", "confidence"]].copy()

    except Exception as exc:
        log.warning("FIRMS live fetch error: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Synthetic fire anomaly generator
# ---------------------------------------------------------------------------

# Known crop-burning / fire corridors in India
_FIRE_CORRIDORS = {
    "Punjab–Haryana":   {"lat": (29.8, 31.5), "lon": (74.0, 77.0), "oct_nov_boost": 8.0},
    "UP–Bihar":         {"lat": (25.5, 27.5), "lon": (80.0, 86.0), "oct_nov_boost": 4.0},
    "Uttarakhand":      {"lat": (29.0, 31.0), "lon": (78.0, 80.5), "oct_nov_boost": 2.0},
    "Odisha":           {"lat": (19.0, 22.0), "lon": (82.0, 87.0), "oct_nov_boost": 1.5},
    "Andhra–Telangana": {"lat": (15.0, 19.0), "lon": (77.0, 82.0), "oct_nov_boost": 1.2},
}


def _generate_synthetic_firms(
    dates: pd.DatetimeIndex,
    rng: np.random.Generator,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Generate synthetic fire pixel locations per date, then compute
    per-station fire statistics (count within 50 km, nearest distance).

    Returns
    -------
    fire_df   : raw fire pixel DataFrame  (lat, lon, acq_date, confidence)
    station_df: per-station statistics DataFrame
    """
    fire_rows = []

    for date in dates:
        month = date.month
        # Number of fire pixels — much higher Oct–Nov (crop burning season)
        if month in (10, 11):
            n_base = 600
        elif month in (3, 4, 5):
            n_base = 250    # forest fire season
        elif month in (6, 7, 8):
            n_base = 40     # monsoon suppresses fire
        else:
            n_base = 120

        for corridor, cfg in _FIRE_CORRIDORS.items():
            boost  = cfg["oct_nov_boost"] if month in (10, 11) else 1.0
            n_fire = int(rng.poisson(n_base * boost * 0.15))

            lats = rng.uniform(cfg["lat"][0], cfg["lat"][1], n_fire)
            lons = rng.uniform(cfg["lon"][0], cfg["lon"][1], n_fire)
            confs = rng.choice(["nominal", "high"], size=n_fire, p=[0.4, 0.6])

            for la, lo, conf in zip(lats, lons, confs):
                fire_rows.append({
                    "latitude":  round(float(la), 4),
                    "longitude": round(float(lo), 4),
                    "acq_date":  date.strftime("%Y-%m-%d"),
                    "confidence": conf,
                    "source":    "SYNTHETIC_FIRMS",
                })

    fire_df = pd.DataFrame(fire_rows)
    log.info("Synthetic FIRMS: %d fire pixels across %d dates.",
             len(fire_df), len(dates))
    return fire_df


def _compute_station_fire_stats(
    fire_df: pd.DataFrame,
    dates: pd.DatetimeIndex,
    source_label: str = "SYNTHETIC_FIRMS",
) -> pd.DataFrame:
    """
    For each (station, date) pair, compute:
      fire_count_50km    — fire pixels within 50 km
      fire_dist_min_km   — distance to nearest fire pixel
      nearest_fire_lat/lon
    """
    rows = []

    for date in dates:
        date_str = date.strftime("%Y-%m-%d")
        day_fires = fire_df[fire_df["acq_date"] == date_str]
        fire_lats = day_fires["latitude"].values
        fire_lons = day_fires["longitude"].values

        for station_id, city, slat, slon in STATION_REGISTRY:
            if len(fire_lats) == 0:
                rows.append({
                    "station_id":       station_id,
                    "city":             city,
                    "lat":              slat,
                    "lon":              slon,
                    "date":             date_str,
                    "fire_count_50km":  0,
                    "fire_dist_min_km": np.nan,
                    "nearest_fire_lat": np.nan,
                    "nearest_fire_lon": np.nan,
                    "source":           source_label,
                })
                continue

            dists = _haversine_vectorised(slat, slon, fire_lats, fire_lons)
            within_mask  = dists <= FIRMS_RADIUS
            count_50km   = int(within_mask.sum())
            min_dist_idx = int(np.argmin(dists))

            rows.append({
                "station_id":       station_id,
                "city":             city,
                "lat":              slat,
                "lon":              slon,
                "date":             date_str,
                "fire_count_50km":  count_50km,
                "fire_dist_min_km": round(float(dists[min_dist_idx]), 2),
                "nearest_fire_lat": round(float(fire_lats[min_dist_idx]), 4),
                "nearest_fire_lon": round(float(fire_lons[min_dist_idx]), 4),
                "source":           source_label,
            })

    df = pd.DataFrame(rows)
    log.info("Fire station stats: %d records.", len(df))
    return df


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_firms(
    start: Optional[datetime] = None,
    end:   Optional[datetime] = None,
    api_key: Optional[str] = None,
    force_synthetic: bool = False,
) -> pd.DataFrame:
    """
    Main entry-point — returns per-station fire anomaly statistics.

    Parameters
    ----------
    start           : window start (UTC)
    end             : window end (UTC)
    api_key         : NASA FIRMS MAP_KEY (optional; also reads FIRMS_MAP_KEY env var)
    force_synthetic : skip live FIRMS fetch

    Returns
    -------
    pd.DataFrame with fire proximity statistics per station per day
    """
    now = datetime.now(timezone.utc)
    if end is None:
        end = now
    if start is None:
        start = end - timedelta(days=7)

    dates = pd.date_range(start.date(), end.date(), freq="D", tz="UTC")
    rng   = np.random.default_rng(seed=2024)

    if not force_synthetic:
        fire_df = _fetch_firms_live(end, api_key=api_key)
        if fire_df is not None and not fire_df.empty:
            return _compute_station_fire_stats(fire_df, dates, source_label="LIVE_FIRMS")
        log.warning("FIRMS live fetch unavailable — using synthetic generator.")

    fire_df = _generate_synthetic_firms(dates, rng)
    return _compute_station_fire_stats(fire_df, dates)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse, os

    parser = argparse.ArgumentParser(description="Fetch/generate NASA FIRMS fire data.")
    parser.add_argument("--days",      type=int, default=7)
    parser.add_argument("--synthetic", action="store_true")
    parser.add_argument("--out",       type=str, default=None)
    args = parser.parse_args()

    end_dt   = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=args.days)

    df = fetch_firms(start=start_dt, end=end_dt, force_synthetic=args.synthetic)
    print(df.head(15).to_string())
    print(f"\nShape: {df.shape}")

    if args.out:
        os.makedirs(os.path.dirname(args.out), exist_ok=True)
        df.to_csv(args.out, index=False)
        print(f"Saved → {args.out}")

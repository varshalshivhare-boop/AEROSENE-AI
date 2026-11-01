"""
fetch_satellite.py
------------------
Aerosense AI — Satellite data extraction:
  • MODIS/VIIRS Aerosol Optical Depth (AOD at 550 nm)
  • Sentinel-5P TROPOMI — Tropospheric HCHO column [mol/m²]

Attempts to pull data from NASA LAADS DAAC (MODIS) and ESA Copernicus Data Space
(Sentinel-5P). Falls back to spatially correlated synthetic fields when APIs are
unavailable.

Output columns per record:
  lat | lon | timestamp | aod_550nm | hcho_trop_col | cloud_fraction
  qa_aod | qa_hcho | source_aod | source_hcho
"""

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import numpy as np
import pandas as pd
import requests

log = logging.getLogger("fetch_satellite")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(name)s — %(message)s",
)

# ---------------------------------------------------------------------------
# Target grid — city-centred bounding boxes at 0.1° resolution
# ---------------------------------------------------------------------------
CITY_GRIDS = {
    "Delhi NCR":  {"lat_range": (28.40, 28.85), "lon_range": (76.90, 77.50)},
    "Mumbai":     {"lat_range": (18.87, 19.28), "lon_range": (72.75, 73.00)},
    "Kanpur":     {"lat_range": (26.30, 26.60), "lon_range": (80.15, 80.55)},
    "Patna":      {"lat_range": (25.50, 25.75), "lon_range": (85.00, 85.30)},
    "Bengaluru":  {"lat_range": (12.80, 13.15), "lon_range": (77.45, 77.75)},
}

GRID_RES = 0.1   # degrees

# NASA LAADS DAAC (MCD19A2 — MAIAC AOD)
LAADS_BASE = "https://ladsweb.modaps.eosdis.nasa.gov/api/v2"
# Copernicus Sentinel-5P
COPERNICUS_BASE = "https://catalogue.dataspace.copernicus.eu/odata/v1"

TIMEOUT = 20


# ---------------------------------------------------------------------------
# Helper: build pixel grid for a city
# ---------------------------------------------------------------------------

def _city_pixel_coords(city: str) -> Tuple[np.ndarray, np.ndarray]:
    cfg = CITY_GRIDS[city]
    lats = np.arange(cfg["lat_range"][0], cfg["lat_range"][1] + GRID_RES, GRID_RES)
    lons = np.arange(cfg["lon_range"][0], cfg["lon_range"][1] + GRID_RES, GRID_RES)
    lon_grid, lat_grid = np.meshgrid(lons, lats)
    return lat_grid.ravel(), lon_grid.ravel()


# ---------------------------------------------------------------------------
# Live AOD fetch — NASA LAADS DAAC (simplified endpoint)
# ---------------------------------------------------------------------------

def _fetch_aod_live(date: datetime) -> Optional[pd.DataFrame]:
    """Try LAADS DAAC for MAIAC AOD product."""
    try:
        url = f"{LAADS_BASE}/files"
        params = {
            "products": "MCD19A2",
            "collection": "61",
            "dateRanges": date.strftime("%Y-%m-%d,%Y-%m-%d"),
            "areaOfInterest": "bbox[68,6,98,38]",   # India bounding box
            "fields": "fileURL",
        }
        resp = requests.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None
        # Full download + HDF parsing is complex; return None to trigger synthetic
        log.info("LAADS DAAC: %d files found — full download not implemented in demo.", len(data))
        return None
    except Exception as exc:
        log.warning("LAADS DAAC AOD fetch error: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Live HCHO fetch — Copernicus Sentinel-5P
# ---------------------------------------------------------------------------

def _fetch_hcho_live(date: datetime) -> Optional[pd.DataFrame]:
    """Try Copernicus Open Access Hub for Sentinel-5P HCHO product."""
    try:
        # OData query for S5P TROPOMI HCHO Level-2 products
        query = (
            f"{COPERNICUS_BASE}/Products?"
            f"$filter=Collection/Name eq 'SENTINEL-5P' and "
            f"Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' and "
            f"att/OData.CSC.StringAttribute/Value eq 'L2__HCHO__') and "
            f"ContentDate/Start gt {date.strftime('%Y-%m-%dT00:00:00.000Z')} and "
            f"ContentDate/Start lt {date.strftime('%Y-%m-%dT23:59:59.000Z')}"
            f"&$count=True&$top=5"
        )
        resp = requests.get(query, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        count = data.get("@odata.count", 0)
        log.info("Copernicus Sentinel-5P HCHO: %d products found.", count)
        # Actual NetCDF download requires authentication; trigger synthetic fallback
        return None
    except Exception as exc:
        log.warning("Copernicus HCHO fetch error: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Synthetic satellite field generator
# ---------------------------------------------------------------------------

def _gaussian_plume(lats: np.ndarray, lons: np.ndarray,
                    center_lat: float, center_lon: float,
                    amplitude: float, sigma_deg: float) -> np.ndarray:
    """Simple 2-D Gaussian field centred on a pollution hotspot."""
    dlat = lats - center_lat
    dlon = lons - center_lon
    dist2 = dlat**2 + dlon**2
    return amplitude * np.exp(-dist2 / (2 * sigma_deg**2))


def _generate_synthetic_satellite(
    dates: pd.DatetimeIndex,
    rng: np.random.Generator,
) -> pd.DataFrame:
    """
    Produce synthetic AOD and HCHO grids for all cities and requested dates.
    Uses spatially correlated Gaussian plumes + seasonal/diurnal modulation.
    Cloud masking is applied at ~20% random pixel rate.
    """
    rows = []

    # City hotspot parameters
    city_params = {
        "Delhi NCR":  {"center": (28.6469, 77.3152), "aod_base": 0.72, "hcho_base": 8.5e-4},
        "Mumbai":     {"center": (19.0760, 72.8777), "aod_base": 0.38, "hcho_base": 4.2e-4},
        "Kanpur":     {"center": (26.4499, 80.3319), "aod_base": 0.81, "hcho_base": 9.1e-4},
        "Patna":      {"center": (25.5941, 85.1376), "aod_base": 0.75, "hcho_base": 7.8e-4},
        "Bengaluru":  {"center": (12.9716, 77.5946), "aod_base": 0.22, "hcho_base": 3.1e-4},
    }

    for date in dates:
        month = date.month
        # Seasonal AOD modulation — pre-monsoon dust, post-monsoon haze
        if month in (3, 4, 5):
            seasonal_aod = 1.3
        elif month in (6, 7, 8, 9):
            seasonal_aod = 0.55   # monsoon washout
        elif month in (10, 11, 12, 1, 2):
            seasonal_aod = 1.5
        else:
            seasonal_aod = 1.0

        for city, params in city_params.items():
            clat, clon = params["center"]
            lats, lons = _city_pixel_coords(city)
            n_pix = len(lats)

            # Gaussian AOD plume
            aod = _gaussian_plume(lats, lons, clat, clon,
                                   params["aod_base"] * seasonal_aod, 0.15)
            aod += rng.normal(0, 0.02, n_pix)
            aod = np.clip(aod, 0.01, 5.0)

            # HCHO plume (slightly wider spread, correlated with AOD)
            hcho = _gaussian_plume(lats, lons, clat, clon,
                                    params["hcho_base"] * seasonal_aod, 0.20)
            hcho += rng.normal(0, params["hcho_base"] * 0.05, n_pix)
            hcho = np.clip(hcho, 1e-6, 5e-3)

            # Cloud fraction — beta distribution [0,1]
            cloud_frac = rng.beta(1.5, 5.0, n_pix)

            # QA flags: cloud fraction < 0.3 → GOOD, else CLOUDY (masked)
            qa_aod  = np.where(cloud_frac < 0.3, "GOOD", "CLOUDY")
            qa_hcho = np.where(cloud_frac < 0.3, "GOOD", "CLOUDY")

            # Apply cloud masking (NaN out cloudy pixels)
            aod_masked  = np.where(cloud_frac < 0.3, aod,  np.nan)
            hcho_masked = np.where(cloud_frac < 0.3, hcho, np.nan)

            for i in range(n_pix):
                rows.append({
                    "lat":           round(float(lats[i]), 4),
                    "lon":           round(float(lons[i]), 4),
                    "city":          city,
                    "timestamp":     date,
                    "aod_550nm":     round(float(aod_masked[i]),  4) if not math.isnan(float(aod_masked[i]))  else None,
                    "hcho_trop_col": round(float(hcho_masked[i]), 6) if not math.isnan(float(hcho_masked[i])) else None,
                    "cloud_fraction":round(float(cloud_frac[i]),  3),
                    "qa_aod":        str(qa_aod[i]),
                    "qa_hcho":       str(qa_hcho[i]),
                    "source_aod":    "SYNTHETIC_MAIAC",
                    "source_hcho":   "SYNTHETIC_S5P",
                })

    df = pd.DataFrame(rows)
    log.info("Synthetic satellite: %d pixel records across %d dates.",
             len(df), len(dates))
    return df


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_satellite(
    start: Optional[datetime] = None,
    end:   Optional[datetime] = None,
    daily: bool = True,
    force_synthetic: bool = False,
) -> pd.DataFrame:
    """
    Main entry-point — returns merged AOD + HCHO pixel DataFrame.

    Parameters
    ----------
    start           : start datetime (UTC); defaults to 7 days ago
    end             : end datetime (UTC);   defaults to now
    daily           : if True, one snapshot per calendar day (satellite cadence)
    force_synthetic : skip live fetch

    Returns
    -------
    pd.DataFrame with satellite pixel records
    """
    now = datetime.now(timezone.utc)
    if end is None:
        end = now
    if start is None:
        start = end - timedelta(days=7)

    dates = pd.date_range(start.date(), end.date(), freq="D", tz="UTC")
    rng   = np.random.default_rng(seed=7)

    if not force_synthetic:
        # Try live for the first date; fall back if it fails
        df_live_aod  = _fetch_aod_live(start)
        df_live_hcho = _fetch_hcho_live(start)
        if df_live_aod is not None and df_live_hcho is not None:
            # Merge live products (omitted in demo — would require reprojection)
            pass
        log.warning("Satellite live fetch unavailable — using synthetic generator.")

    return _generate_synthetic_satellite(dates, rng)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse, os

    parser = argparse.ArgumentParser(description="Fetch/generate satellite AOD+HCHO.")
    parser.add_argument("--days",      type=int, default=7)
    parser.add_argument("--synthetic", action="store_true")
    parser.add_argument("--out",       type=str, default=None)
    args = parser.parse_args()

    end_dt   = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=args.days)

    df = fetch_satellite(start=start_dt, end=end_dt, force_synthetic=args.synthetic)
    print(df.head(10).to_string())
    print(f"\nShape: {df.shape}")

    if args.out:
        os.makedirs(os.path.dirname(args.out), exist_ok=True)
        df.to_csv(args.out, index=False)
        print(f"Saved → {args.out}")

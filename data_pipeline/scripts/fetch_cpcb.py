"""
fetch_cpcb.py
-------------
Aerosense AI — Ground-level PM2.5 ingestion from CPCB (Central Pollution Control Board).

Attempts to fetch live data from the CPCB Open Data API. On failure (network error,
rate-limit, bad response), automatically falls back to a physics-informed synthetic
generator that produces continuous, realistic PM2.5 readings for 5 major Indian cities.

Output columns (per row):
  station_id | city | lat | lon | timestamp | pm25 | qa_flag | source
"""

import logging
import hashlib
import math
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import pandas as pd
import requests

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(name)s — %(message)s",
)
log = logging.getLogger("fetch_cpcb")

# ---------------------------------------------------------------------------
# Station registry — India's major air-quality monitoring cities
# ---------------------------------------------------------------------------
STATION_REGISTRY = [
    # (station_id, city, lat, lon, baseline_pm25)
    ("DL_ANAND_VIHAR",  "Delhi NCR",  28.6469, 77.3152, 145.0),
    ("DL_PUNJABI_BAGH", "Delhi NCR",  28.6663, 77.1338, 138.0),
    ("DL_RK_PURAM",     "Delhi NCR",  28.5641, 77.1845, 120.0),
    ("MU_BANDRA",       "Mumbai",     19.0548, 72.8402,  55.0),
    ("MU_WORLI",        "Mumbai",     19.0118, 72.8154,  62.0),
    ("KA_KIDWAI",       "Kanpur",     26.4499, 80.3319, 160.0),
    ("PA_BAILEY",       "Patna",      25.6093, 85.1376, 150.0),
    ("BN_BTM",          "Bengaluru",  12.9165, 77.6101,  42.0),
    ("BN_HEBBAL",       "Bengaluru",  13.0358, 77.5970,  48.0),
]

# ---------------------------------------------------------------------------
# CPCB API settings (public endpoint — subject to availability)
# ---------------------------------------------------------------------------
CPCB_API_URL = "https://airquality.cpcb.gov.in/caaqms/getAllStationData"
CPCB_TIMEOUT = 15   # seconds
CPCB_RETRIES = 2


# ---------------------------------------------------------------------------
# Live fetch
# ---------------------------------------------------------------------------

def _fetch_cpcb_live(start: datetime, end: datetime) -> Optional[pd.DataFrame]:
    """
    Try to pull PM2.5 data from CPCB for the requested time window.
    Returns a DataFrame on success, None on any failure.
    """
    params = {
        "state": "ALL",
        "city": "ALL",
        "fromDate": start.strftime("%Y-%m-%d"),
        "toDate": end.strftime("%Y-%m-%d"),
    }
    headers = {"User-Agent": "AerosenseAI/1.0 (research@aerosense.ai)"}

    for attempt in range(1, CPCB_RETRIES + 1):
        try:
            log.info("CPCB API attempt %d/%d …", attempt, CPCB_RETRIES)
            resp = requests.get(
                CPCB_API_URL, params=params, headers=headers,
                timeout=CPCB_TIMEOUT
            )
            resp.raise_for_status()
            data = resp.json()

            if not data or "stations" not in data:
                log.warning("CPCB response missing 'stations' key — skipping.")
                return None

            rows = []
            for station in data["stations"]:
                pm25_val = station.get("parameters", {}).get("PM2.5", {}).get("avg")
                if pm25_val is None:
                    continue
                rows.append({
                    "station_id": station.get("stationId", "UNKNOWN"),
                    "city":       station.get("city", "UNKNOWN"),
                    "lat":        float(station.get("latitude", 0)),
                    "lon":        float(station.get("longitude", 0)),
                    "timestamp":  pd.to_datetime(station.get("lastUpdate")),
                    "pm25":       float(pm25_val),
                    "qa_flag":    "LIVE",
                    "source":     "CPCB_API",
                })

            if not rows:
                log.warning("CPCB returned 0 usable PM2.5 rows.")
                return None

            df = pd.DataFrame(rows)
            log.info("CPCB live fetch: %d records.", len(df))
            return df

        except requests.RequestException as exc:
            log.warning("CPCB request error (attempt %d): %s", attempt, exc)
            if attempt < CPCB_RETRIES:
                time.sleep(2 ** attempt)

    return None


# ---------------------------------------------------------------------------
# Physics-informed synthetic generator
# ---------------------------------------------------------------------------

def _diurnal_factor(hour: int) -> float:
    """
    Double-peak diurnal profile typical of South Asian traffic + cooking cycles.
    Morning peak ~08:00, evening peak ~20:00.
    """
    return (
        1.0
        + 0.35 * math.exp(-((hour - 8) ** 2) / 8.0)
        + 0.45 * math.exp(-((hour - 20) ** 2) / 8.0)
    )


def _seasonal_factor(month: int) -> float:
    """Winter (Nov–Feb) PM2.5 spike due to crop burning + fog trapping."""
    if month in (11, 12, 1, 2):
        return 1.6
    if month in (3, 4):
        return 1.1
    if month in (6, 7, 8, 9):
        return 0.7   # monsoon washout
    return 1.0


def _generate_synthetic(
    start: datetime,
    end: datetime,
    freq: str = "1h",
) -> pd.DataFrame:
    """
    Produce synthetic PM2.5 readings for every station in STATION_REGISTRY
    at the specified frequency within [start, end].
    """
    rng = np.random.default_rng(seed=42)
    timestamps = pd.date_range(start, end, freq=freq, tz="UTC")

    rows = []
    for station_id, city, lat, lon, baseline in STATION_REGISTRY:
        # Persistent random-walk component (AR-1)
        ar_noise = np.cumsum(rng.normal(0, 2.5, len(timestamps)))
        ar_noise -= ar_noise.mean()   # zero-mean drift

        for i, ts in enumerate(timestamps):
            hour  = ts.hour
            month = ts.month
            diurnal  = _diurnal_factor(hour)
            seasonal = _seasonal_factor(month)

            # Gaussian measurement noise
            noise = rng.normal(0, baseline * 0.04)

            pm25 = max(
                2.0,
                baseline * diurnal * seasonal + ar_noise[i] + noise,
            )

            # QA flag: GOOD if plausible range, SUSPECT if extreme
            qa = "GOOD" if 2.0 <= pm25 <= 500.0 else "SUSPECT"

            rows.append({
                "station_id": station_id,
                "city":       city,
                "lat":        lat,
                "lon":        lon,
                "timestamp":  ts,
                "pm25":       round(pm25, 2),
                "qa_flag":    qa,
                "source":     "SYNTHETIC",
            })

    df = pd.DataFrame(rows)
    df = df.sort_values(["timestamp", "station_id"]).reset_index(drop=True)
    log.info("Synthetic generator: %d records across %d stations.",
             len(df), len(STATION_REGISTRY))
    return df


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_pm25(
    start: Optional[datetime] = None,
    end:   Optional[datetime] = None,
    freq:  str = "1h",
    force_synthetic: bool = False,
) -> pd.DataFrame:
    """
    Main entry-point.

    Parameters
    ----------
    start           : window start (UTC); defaults to 7 days ago
    end             : window end (UTC);   defaults to now
    freq            : synthetic time frequency string (e.g. '1h', '3h')
    force_synthetic : skip live fetch and use generator directly

    Returns
    -------
    pd.DataFrame with columns:
        station_id, city, lat, lon, timestamp, pm25, qa_flag, source
    """
    now = datetime.now(timezone.utc)
    if end is None:
        end = now
    if start is None:
        start = end - timedelta(days=7)

    if not force_synthetic:
        df = _fetch_cpcb_live(start, end)
        if df is not None:
            return df
        log.warning("Live CPCB fetch failed — falling back to synthetic generator.")

    return _generate_synthetic(start, end, freq=freq)


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse, os, sys

    parser = argparse.ArgumentParser(description="Fetch / generate CPCB PM2.5 data.")
    parser.add_argument("--days",      type=int,   default=7,   help="Days to go back")
    parser.add_argument("--freq",      type=str,   default="1h",help="Synthetic freq (e.g. 1h, 3h)")
    parser.add_argument("--synthetic", action="store_true",      help="Force synthetic mode")
    parser.add_argument("--out",       type=str,   default=None, help="Output CSV path")
    args = parser.parse_args()

    end_dt   = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=args.days)

    df = fetch_pm25(start=start_dt, end=end_dt,
                    freq=args.freq, force_synthetic=args.synthetic)

    print(df.head(10).to_string())
    print(f"\nShape: {df.shape}")

    if args.out:
        os.makedirs(os.path.dirname(args.out), exist_ok=True)
        df.to_csv(args.out, index=False)
        print(f"Saved → {args.out}")

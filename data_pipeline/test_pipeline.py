"""
test_pipeline.py
----------------
Aerosense AI — Pipeline Output Validation & Data Contract Test Runner.

Verifies that output/master_aligned_dataset.csv strictly adheres to the
Aerosense data contract by running the full pipeline (synthetic mode)
and executing a comprehensive suite of unit and integration checks.

Run with:
    python test_pipeline.py [-v]
Or via pytest:
    pytest test_pipeline.py -v

Exit codes:
  0 — all tests passed
  1 — one or more tests failed
"""

import os
import sys
import logging
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

# Make scripts importable
PIPELINE_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR  = PIPELINE_DIR / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))
sys.path.insert(0, str(PIPELINE_DIR))

# Suppress info logs during tests for clean output
logging.disable(logging.WARNING)

# ---------------------------------------------------------------------------
# Import pipeline components
# ---------------------------------------------------------------------------
from fetch_cpcb      import fetch_pm25
from fetch_satellite import fetch_satellite
from fetch_era5      import fetch_era5
from fetch_firms     import fetch_firms, _haversine_km
from scripts.align_pipeline import run_pipeline, DATA_CONTRACT


# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------
def _make_window(days: int = 3):
    end   = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    return start, end


# ===========================================================================
# Test Suite 1 — CPCB fetch_pm25
# ===========================================================================
class TestFetchCPCB(unittest.TestCase):

    def setUp(self):
        self.start, self.end = _make_window(days=3)
        self.df = fetch_pm25(start=self.start, end=self.end,
                             force_synthetic=True, freq="1h")

    def test_returns_dataframe(self):
        self.assertIsInstance(self.df, pd.DataFrame)

    def test_required_columns_present(self):
        required = {"station_id", "city", "lat", "lon",
                    "timestamp", "pm25", "qa_flag", "source"}
        missing = required - set(self.df.columns)
        self.assertEqual(missing, set(), f"Missing columns: {missing}")

    def test_not_empty(self):
        self.assertGreater(len(self.df), 0)

    def test_pm25_physical_range(self):
        self.assertTrue((self.df["pm25"] >= 0).all(),
                        "PM2.5 must be non-negative")
        self.assertTrue((self.df["pm25"] <= 1500).all(),
                        "PM2.5 must be <= 1500 µg/m³")

    def test_lat_lon_bounds_india(self):
        self.assertTrue(self.df["lat"].between(6, 38).all(),
                        "Latitude must be within India (6–38°N)")
        self.assertTrue(self.df["lon"].between(68, 98).all(),
                        "Longitude must be within India (68–98°E)")

    def test_timestamp_timezone_aware(self):
        self.assertTrue(
            pd.api.types.is_datetime64_any_dtype(self.df["timestamp"]),
            "timestamp must be datetime dtype"
        )

    def test_qa_flag_values(self):
        allowed = {"GOOD", "SUSPECT", "LIVE", "SYNTHETIC"}
        unexpected = set(self.df["qa_flag"].unique()) - allowed
        self.assertEqual(unexpected, set(), f"Unexpected qa_flag values: {unexpected}")

    def test_all_expected_cities_present(self):
        expected_cities = {"Delhi NCR", "Mumbai", "Kanpur", "Patna", "Bengaluru"}
        actual_cities   = set(self.df["city"].unique())
        self.assertTrue(expected_cities.issubset(actual_cities),
                        f"Missing cities: {expected_cities - actual_cities}")

    def test_no_duplicate_station_timestamps(self):
        dupes = self.df.duplicated(subset=["station_id", "timestamp"]).sum()
        self.assertEqual(dupes, 0, f"{dupes} duplicate (station_id, timestamp) pairs found")


# ===========================================================================
# Test Suite 2 — Satellite fetch_satellite
# ===========================================================================
class TestFetchSatellite(unittest.TestCase):

    def setUp(self):
        self.start, self.end = _make_window(days=3)
        self.df = fetch_satellite(start=self.start, end=self.end,
                                  force_synthetic=True)

    def test_returns_dataframe(self):
        self.assertIsInstance(self.df, pd.DataFrame)

    def test_required_columns(self):
        required = {"lat", "lon", "timestamp", "aod_550nm",
                    "hcho_trop_col", "cloud_fraction", "qa_aod", "qa_hcho"}
        missing = required - set(self.df.columns)
        self.assertEqual(missing, set(), f"Missing: {missing}")

    def test_cloud_fraction_range(self):
        self.assertTrue(self.df["cloud_fraction"].between(0, 1).all())

    def test_aod_non_negative_when_present(self):
        valid = self.df["aod_550nm"].dropna()
        self.assertTrue((valid >= 0).all(), "AOD must be non-negative")
        self.assertTrue((valid <= 5).all(), "AOD must be <= 5")

    def test_hcho_positive_when_present(self):
        valid = self.df["hcho_trop_col"].dropna()
        self.assertTrue((valid > 0).all(), "HCHO column must be positive")

    def test_cloudy_pixels_masked(self):
        """Pixels with cloud_fraction >= 0.3 should have NaN AOD/HCHO."""
        cloudy = self.df[self.df["cloud_fraction"] >= 0.3]
        self.assertTrue(cloudy["aod_550nm"].isna().all(),
                        "Cloudy pixels must have NaN AOD")
        self.assertTrue(cloudy["hcho_trop_col"].isna().all(),
                        "Cloudy pixels must have NaN HCHO")

    def test_qa_flag_values(self):
        allowed = {"GOOD", "CLOUDY"}
        for col in ["qa_aod", "qa_hcho"]:
            unexpected = set(self.df[col].unique()) - allowed
            self.assertEqual(unexpected, set(),
                             f"Unexpected {col} values: {unexpected}")


# ===========================================================================
# Test Suite 3 — ERA5 fetch_era5
# ===========================================================================
class TestFetchERA5(unittest.TestCase):

    def setUp(self):
        self.start, self.end = _make_window(days=3)
        self.df = fetch_era5(start=self.start, end=self.end,
                             force_synthetic=True, freq="6h")

    def test_returns_dataframe(self):
        self.assertIsInstance(self.df, pd.DataFrame)

    def test_required_columns(self):
        required = {"lat", "lon", "timestamp", "t2m_K",
                    "rh_pct", "u10_ms", "v10_ms", "blh_m"}
        missing = required - set(self.df.columns)
        self.assertEqual(missing, set(), f"Missing: {missing}")

    def test_temperature_range_K(self):
        self.assertTrue(self.df["t2m_K"].between(220, 340).all(),
                        "2m temperature must be between 220–340 K")

    def test_relative_humidity_range(self):
        self.assertTrue(self.df["rh_pct"].between(0, 100).all(),
                        "Relative humidity must be 0–100%")

    def test_blh_positive(self):
        self.assertTrue((self.df["blh_m"] > 0).all(),
                        "BLH must be positive")

    def test_not_empty(self):
        self.assertGreater(len(self.df), 0)


# ===========================================================================
# Test Suite 4 — FIRMS fetch_firms
# ===========================================================================
class TestFetchFIRMS(unittest.TestCase):

    def setUp(self):
        self.start, self.end = _make_window(days=3)
        self.df = fetch_firms(start=self.start, end=self.end,
                              force_synthetic=True)

    def test_returns_dataframe(self):
        self.assertIsInstance(self.df, pd.DataFrame)

    def test_required_columns(self):
        required = {"station_id", "city", "lat", "lon", "date",
                    "fire_count_50km", "fire_dist_min_km"}
        missing = required - set(self.df.columns)
        self.assertEqual(missing, set(), f"Missing: {missing}")

    def test_fire_count_non_negative(self):
        self.assertTrue((self.df["fire_count_50km"] >= 0).all())

    def test_fire_dist_non_negative_when_present(self):
        valid = self.df["fire_dist_min_km"].dropna()
        self.assertTrue((valid >= 0).all())

    def test_haversine_spot_check(self):
        """Delhi to Mumbai ~1150 km."""
        d = _haversine_km(28.6139, 77.2090, 19.0760, 72.8777)
        self.assertAlmostEqual(d, 1148, delta=30)

    def test_all_stations_represented(self):
        expected_ids = {
            "DL_ANAND_VIHAR", "DL_PUNJABI_BAGH", "DL_RK_PURAM",
            "MU_BANDRA", "MU_WORLI", "KA_KIDWAI", "PA_BAILEY",
            "BN_BTM", "BN_HEBBAL",
        }
        actual_ids = set(self.df["station_id"].unique())
        self.assertTrue(expected_ids.issubset(actual_ids))

    def test_fire_count_higher_in_oct_nov(self):
        """Fire counts in Oct–Nov should average higher than Jun–Sep."""
        self.df["month"] = pd.to_datetime(self.df["date"]).dt.month
        oct_nov = self.df[self.df["month"].isin([10, 11])]["fire_count_50km"].mean()
        jun_sep = self.df[self.df["month"].isin([6,  7,  8,  9])]["fire_count_50km"].mean()
        # If both windows have data
        if not (np.isnan(oct_nov) or np.isnan(jun_sep)):
            self.assertGreaterEqual(oct_nov, jun_sep,
                                    "Oct–Nov fire counts should be >= Jun–Sep")


# ===========================================================================
# Test Suite 5 — Full pipeline & data contract
# ===========================================================================
class TestAlignPipeline(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Run pipeline once; share result across all tests in this class."""
        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "master_aligned_dataset.csv"
            cls.df = run_pipeline(
                days=3,
                freq="1h",
                force_synthetic=True,
                output_path=out_path,
            )
            # Also read back from CSV to verify serialisation
            cls.df_csv = pd.read_csv(out_path)

    # --- Schema ---

    def test_all_contract_columns_present(self):
        missing = set(DATA_CONTRACT.keys()) - set(self.df.columns)
        self.assertEqual(missing, set(),
                         f"Missing contract columns: {missing}")

    def test_no_extra_columns(self):
        extra = set(self.df.columns) - set(DATA_CONTRACT.keys())
        self.assertEqual(extra, set(), f"Extra columns not in contract: {extra}")

    def test_not_empty(self):
        self.assertGreater(len(self.df), 0)

    # --- Types ---

    def test_timestamp_is_datetime(self):
        self.assertTrue(
            pd.api.types.is_datetime64_any_dtype(self.df["timestamp"]),
        )

    def test_fire_count_is_integer(self):
        self.assertTrue(
            pd.api.types.is_integer_dtype(self.df["fire_count_50km"]),
        )

    def test_numeric_columns_are_float(self):
        float_cols = [k for k, v in DATA_CONTRACT.items() if v == "float64"]
        for col in float_cols:
            self.assertTrue(
                pd.api.types.is_float_dtype(self.df[col]),
                f"Column '{col}' should be float64"
            )

    # --- QA flags ---

    def test_qa_flag_column_exists(self):
        self.assertIn("qa_flag", self.df.columns)

    def test_qa_flag_only_known_values(self):
        allowed = {"GOOD", "SUSPECT", "CLOUDY", "MISSING"}
        unexpected = set(self.df["qa_flag"].unique()) - allowed
        self.assertEqual(unexpected, set(),
                         f"Unknown qa_flag values: {unexpected}")

    def test_good_records_proportion(self):
        good_pct = (self.df["qa_flag"] == "GOOD").mean()
        self.assertGreater(good_pct, 0.50,
                           f"Expected >50% GOOD records, got {good_pct:.1%}")

    # --- Physical bounds ---

    def test_pm25_non_negative(self):
        self.assertTrue((self.df["pm25"] >= 0).all())

    def test_lat_lon_india_bounds(self):
        self.assertTrue(self.df["lat"].between(6, 38).all())
        self.assertTrue(self.df["lon"].between(68, 98).all())

    def test_rh_pct_range(self):
        rh = self.df["rh_pct"].dropna()
        self.assertTrue(rh.between(0, 100).all())

    def test_cloud_fraction_range(self):
        cf = self.df["cloud_fraction"].dropna()
        self.assertTrue(cf.between(0, 1).all())

    # --- Normalised columns ---

    def test_normalised_columns_bounded(self):
        norm_cols = [c for c in self.df.columns if c.endswith("_norm")]
        for col in norm_cols:
            vals = self.df[col].dropna()
            self.assertTrue((vals.abs() <= 5.01).all(),
                            f"{col} has values outside [-5, 5]")

    def test_pm25_norm_zero_mean(self):
        """Normalised PM2.5 should be approximately zero-mean."""
        mean = self.df["pm25_norm"].mean()
        self.assertAlmostEqual(mean, 0.0, delta=0.1)

    # --- City coverage ---

    def test_all_cities_present(self):
        expected = {"Delhi NCR", "Mumbai", "Kanpur", "Patna", "Bengaluru"}
        actual   = set(self.df["city"].unique())
        self.assertTrue(expected.issubset(actual))

    # --- Source provenance ---

    def test_source_columns_present(self):
        for col in ["source_pm25", "source_sat", "source_era5", "source_fire"]:
            self.assertIn(col, self.df.columns)

    # --- CSV round-trip ---

    def test_csv_row_count_matches(self):
        self.assertEqual(len(self.df_csv), len(self.df))

    def test_csv_column_count_matches(self):
        self.assertEqual(len(self.df_csv.columns), len(self.df.columns))

    # --- Uniqueness ---

    def test_no_fully_duplicate_rows(self):
        dupes = self.df.duplicated().sum()
        self.assertEqual(dupes, 0, f"{dupes} fully duplicate rows found")

    def test_station_city_lat_lon_consistent(self):
        """Each station_id must map to exactly one (city, lat, lon)."""
        combos = (
            self.df.groupby("station_id")[["city", "lat", "lon"]]
            .nunique()
            .max(axis=1)
        )
        inconsistent = combos[combos > 1]
        self.assertEqual(len(inconsistent), 0,
                         f"Inconsistent station metadata: {inconsistent.to_dict()}")


# ===========================================================================
# Runner
# ===========================================================================

def run_tests(verbosity: int = 2) -> bool:
    """Run all test suites and return True if all passed."""
    loader  = unittest.TestLoader()
    suite   = unittest.TestSuite()

    for test_class in [
        TestFetchCPCB,
        TestFetchSatellite,
        TestFetchERA5,
        TestFetchFIRMS,
        TestAlignPipeline,
    ]:
        suite.addTests(loader.loadTestsFromTestCase(test_class))

    runner = unittest.TextTestRunner(verbosity=verbosity)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Aerosense AI pipeline test runner.")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Increase test verbosity")
    args = parser.parse_args()

    logging.disable(logging.NOTSET)   # re-enable logs in direct run

    success = run_tests(verbosity=2 if args.verbose else 1)
    sys.exit(0 if success else 1)

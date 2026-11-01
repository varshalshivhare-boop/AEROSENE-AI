"""Pytest suite for Sentinel-5P HCHO Spatial Anomaly Detection.

Validates statistical z-scores, localized percentiles, elevated observation
flagging (> 2.0 sigma), severity classifications, and edge cases.
"""

import math
import numpy as np
import pandas as pd
import pytest

from src.hcho_hotspots import (
    HCHOSpatialAnomalyDetector,
    detect_hcho_anomalies,
    haversine_distance_km,
)


class TestHaversineDistance:
    """Tests for geospatial distance calculation."""

    def test_zero_distance_same_point(self):
        dist = haversine_distance_km(28.6139, 77.2090, 28.6139, 77.2090)
        assert dist == pytest.approx(0.0, abs=1e-5)

    def test_known_distance(self):
        # Delhi (28.6139, 77.2090) to Agra (27.1767, 78.0081) is approx 180-200 km
        dist = haversine_distance_km(28.6139, 77.2090, 27.1767, 78.0081)
        assert 170.0 < dist < 210.0


class TestHCHOAnomalyDetector:
    """Tests for the HCHOSpatialAnomalyDetector class."""

    @pytest.fixture
    def sample_scene_data(self):
        """Creates synthetic Sentinel-5P HCHO observations over northern India."""
        return pd.DataFrame(
            [
                # Baseline background cluster around Punjab/Haryana
                {"lat": 30.5, "lon": 75.5, "hcho": 4.5e-4, "baseline_mean": 4.0e-4, "baseline_std": 0.5e-4},
                {"lat": 30.6, "lon": 75.6, "hcho": 4.2e-4, "baseline_mean": 4.0e-4, "baseline_std": 0.5e-4},
                {"lat": 30.4, "lon": 75.4, "hcho": 3.9e-4, "baseline_mean": 4.0e-4, "baseline_std": 0.5e-4},
                {"lat": 30.5, "lon": 75.7, "hcho": 4.1e-4, "baseline_mean": 4.0e-4, "baseline_std": 0.5e-4},
                # Moderate elevated point (> 2.0 sigma) -> 4.0 + 2.4 * 0.5 = 5.2e-4
                {"lat": 30.7, "lon": 75.8, "hcho": 5.3e-4, "baseline_mean": 4.0e-4, "baseline_std": 0.5e-4},
                # Severe spike (> 4.0 sigma) -> 4.0 + 4.5 * 0.5 = 6.25e-4
                {"lat": 30.8, "lon": 75.9, "hcho": 6.5e-4, "baseline_mean": 4.0e-4, "baseline_std": 0.5e-4},
            ]
        )

    def test_sigma_threshold_flagging(self, sample_scene_data):
        detector = HCHOSpatialAnomalyDetector(sigma_threshold=2.0)
        res = detector.detect_anomalies(sample_scene_data)

        # Baseline background points should have z-score <= 2.0 and is_elevated == False
        bg_rows = res.iloc[:4]
        for _, row in bg_rows.iterrows():
            assert row["z_score"] <= 2.0
            assert row["is_elevated"] == False
            assert row["severity"] == "NORMAL"

        # Moderate point (5.3e-4): z = (5.3 - 4.0) / 0.5 = 2.6
        mod_row = res.iloc[4]
        assert mod_row["z_score"] == pytest.approx(2.6, abs=0.1)
        assert mod_row["is_elevated"] == True
        assert mod_row["severity"] == "MODERATE_ANOMALY"

        # Extreme spike (6.5e-4): z = (6.5 - 4.0) / 0.5 = 5.0
        spike_row = res.iloc[5]
        assert spike_row["z_score"] == pytest.approx(5.0, abs=0.1)
        assert spike_row["is_elevated"] == True
        assert spike_row["severity"] == "EXTREME_ANOMALY"

    def test_localized_percentile_calculation(self, sample_scene_data):
        detector = HCHOSpatialAnomalyDetector(spatial_radius_km=100.0)
        res = detector.detect_anomalies(sample_scene_data)

        # Extreme point should rank at 100% percentile
        spike_row = res.iloc[5]
        assert spike_row["localized_percentile"] == 100.0

        # Lowest point should rank lowest
        lowest_row = res.iloc[2]
        assert lowest_row["localized_percentile"] <= 20.0

    def test_convenience_function(self, sample_scene_data):
        res = detect_hcho_anomalies(sample_scene_data, sigma_threshold=2.0)
        assert "is_elevated" in res.columns
        assert "z_score" in res.columns
        assert res["is_elevated"].sum() == 2


class TestHCHOEdgeCases:
    """Tests for edge cases in HCHO anomaly detection."""

    def test_empty_dataframe(self):
        detector = HCHOSpatialAnomalyDetector()
        res = detector.detect_anomalies(pd.DataFrame())
        assert res.empty
        assert "z_score" in res.columns
        assert "is_elevated" in res.columns

    def test_zero_standard_deviation_handled_gracefully(self):
        # When all points have 0 standard deviation, division by zero must not crash
        data = pd.DataFrame(
            [
                {"lat": 25.0, "lon": 80.0, "hcho": 2.0, "baseline_mean": 2.0, "baseline_std": 0.0},
                {"lat": 25.1, "lon": 80.1, "hcho": 3.5, "baseline_mean": 2.0, "baseline_std": 0.0},
            ]
        )
        detector = HCHOSpatialAnomalyDetector()
        res = detector.detect_anomalies(data)

        # Point with value == mean should get z = 0.0
        assert res.iloc[0]["z_score"] == 0.0
        assert res.iloc[0]["is_elevated"] == False

        # Point with value > mean and std = 0 is safely flagged without crashing
        assert res.iloc[1]["z_score"] == 999.0
        assert res.iloc[1]["is_elevated"] == True

    def test_negative_hcho_sensor_noise_handled(self):
        # Satellite noise occasionally produces small negative columns
        data = pd.DataFrame(
            [
                {"lat": 15.0, "lon": 70.0, "hcho": -0.5e-4, "baseline_mean": 1.0e-4, "baseline_std": 0.5e-4},
                {"lat": 15.1, "lon": 70.1, "hcho": 1.0e-4, "baseline_mean": 1.0e-4, "baseline_std": 0.5e-4},
            ]
        )
        detector = HCHOSpatialAnomalyDetector()
        res = detector.detect_anomalies(data)

        assert not res.empty
        assert res.iloc[0]["z_score"] < 0.0
        assert res.iloc[0]["is_elevated"] == False

    def test_missing_required_columns_raises_key_error(self):
        detector = HCHOSpatialAnomalyDetector()
        bad_data = pd.DataFrame([{"invalid_col": 123}])
        with pytest.raises(KeyError):
            detector.detect_anomalies(bad_data)

    def test_invalid_parameters_raise_value_error(self):
        with pytest.raises(ValueError):
            HCHOSpatialAnomalyDetector(sigma_threshold=-1.0)

        with pytest.raises(ValueError):
            HCHOSpatialAnomalyDetector(percentile_threshold=150.0)

    def test_high_anomaly_severity_and_baseline_fallback(self):
        # 3.0 < z <= 4.0 should be HIGH_ANOMALY
        data = [
            {"lat": 28.0, "lon": 77.0, "hcho": 1.0, "baseline_mean": 1.0, "baseline_std": 0.2},
            {"lat": 28.1, "lon": 77.1, "hcho": 1.7, "baseline_mean": 1.0, "baseline_std": 0.2},  # z = 3.5 -> HIGH_ANOMALY
        ]
        detector = HCHOSpatialAnomalyDetector()
        res = detector.detect_anomalies(data)
        assert res.iloc[1]["severity"] == "HIGH_ANOMALY"

        # Test fallback when baseline_mean and baseline_std columns are omitted
        raw_data = pd.DataFrame(
            [
                {"lat": 28.0, "lon": 77.0, "hcho": 2.0},
                {"lat": 28.1, "lon": 77.1, "hcho": 2.5},
                {"lat": 28.2, "lon": 77.2, "hcho": 10.0},
            ]
        )
        res_fallback = detector.detect_anomalies(raw_data)
        assert "baseline_mean" in res_fallback.columns
        assert "baseline_std" in res_fallback.columns
        assert "z_score" in res_fallback.columns


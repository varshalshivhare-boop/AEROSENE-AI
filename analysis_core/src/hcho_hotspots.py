"""Sentinel-5P HCHO Spatial Anomaly Detection.

This module implements spatial anomaly detection for tropospheric formaldehyde (HCHO)
vertical column density observations from the Sentinel-5P TROPOMI instrument.
It utilizes dual statistical criteria:
1. Parametric statistical Z-score against seasonal / climatological baseline (flagging > 2.0 sigma).
2. Localized spatial empirical percentiles relative to geographic neighborhoods.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from scipy import stats


def haversine_distance_km(
    lat1: Union[float, np.ndarray],
    lon1: Union[float, np.ndarray],
    lat2: Union[float, np.ndarray],
    lon2: Union[float, np.ndarray],
) -> Union[float, np.ndarray]:
    """Calculates the great-circle distance between points on Earth in kilometers.

    Args:
        lat1: Latitude of point 1 in degrees.
        lon1: Longitude of point 1 in degrees.
        lat2: Latitude of point 2 in degrees.
        lon2: Longitude of point 2 in degrees.

    Returns:
        Distance in kilometers.
    """
    phi1 = np.radians(lat1)
    phi2 = np.radians(lat2)
    delta_phi = np.radians(lat2 - lat1)
    delta_lambda = np.radians(lon2 - lon1)

    a = np.sin(delta_phi / 2.0) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(delta_lambda / 2.0) ** 2
    # Numerical stability clamp to [0, 1]
    a = np.clip(a, 0.0, 1.0)
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    radius_earth_km = 6371.0088
    return radius_earth_km * c


class HCHOSpatialAnomalyDetector:
    """Spatial anomaly detector for Sentinel-5P Formaldehyde (HCHO) observations.

    Combines seasonal baseline z-scoring with localized spatial percentile analysis
    to detect elevated VOC / biomass burning / industrial emission plumes.
    """

    def __init__(
        self,
        sigma_threshold: float = 2.0,
        percentile_threshold: float = 95.0,
        spatial_radius_km: float = 50.0,
        min_neighborhood_size: int = 3,
    ) -> None:
        """Initializes the HCHO anomaly detector.

        Args:
            sigma_threshold: Z-score cutoff for elevated observations (> 2.0 sigma).
            percentile_threshold: Localized empirical percentile cutoff (default 95.0%).
            spatial_radius_km: Radius in km for evaluating localized spatial neighborhood.
            min_neighborhood_size: Minimum number of spatial neighbors needed for localized stats.
        """
        if sigma_threshold <= 0:
            raise ValueError(f"sigma_threshold must be positive, got {sigma_threshold}")
        if not (0.0 < percentile_threshold <= 100.0):
            raise ValueError(f"percentile_threshold must be in (0, 100], got {percentile_threshold}")

        self.sigma_threshold = float(sigma_threshold)
        self.percentile_threshold = float(percentile_threshold)
        self.spatial_radius_km = float(spatial_radius_km)
        self.min_neighborhood_size = int(min_neighborhood_size)

    def _classify_severity(self, z_score: float) -> str:
        """Classifies anomaly severity based on sigma level."""
        if math.isnan(z_score) or z_score <= self.sigma_threshold:
            return "NORMAL"
        elif z_score <= 3.0:
            return "MODERATE_ANOMALY"
        elif z_score <= 4.0:
            return "HIGH_ANOMALY"
        else:
            return "EXTREME_ANOMALY"

    def compute_z_scores(
        self,
        values: np.ndarray,
        baseline_means: np.ndarray,
        baseline_stds: np.ndarray,
    ) -> np.ndarray:
        """Computes statistical z-scores relative to baseline mean and standard deviation.

        Handles edge cases such as zero variance without division by zero.

        Args:
            values: Observed HCHO column densities.
            baseline_means: Climatological/seasonal baseline means.
            baseline_stds: Baseline standard deviations.

        Returns:
            Array of computed z-scores.
        """
        z_scores = np.zeros_like(values, dtype=float)
        zero_std_mask = (baseline_stds <= 1e-12) | np.isnan(baseline_stds)

        # Standard case: positive variance
        valid_mask = (~zero_std_mask) & (~np.isnan(values)) & (~np.isnan(baseline_means))
        z_scores[valid_mask] = (values[valid_mask] - baseline_means[valid_mask]) / baseline_stds[valid_mask]

        # Zero variance case: if value exceeds mean, mark anomaly, else 0
        diff = values - baseline_means
        z_scores[zero_std_mask & (diff > 1e-12)] = 999.0
        z_scores[zero_std_mask & (diff <= 1e-12)] = 0.0

        return z_scores

    def compute_localized_percentiles(
        self,
        lats: np.ndarray,
        lons: np.ndarray,
        values: np.ndarray,
    ) -> np.ndarray:
        """Computes empirical localized spatial percentiles for each observation.

        For each observation, evaluates the empirical rank within its spatial
        neighborhood defined by `spatial_radius_km`. If fewer than `min_neighborhood_size`
        points exist in neighborhood, falls back to the dataset-wide empirical percentile.

        Args:
            lats: Array of latitudes in degrees.
            lons: Array of longitudes in degrees.
            values: Array of observed HCHO column values.

        Returns:
            Array of localized percentiles (0.0 to 100.0).
        """
        n = len(values)
        if n == 0:
            return np.array([], dtype=float)

        percentiles = np.zeros(n, dtype=float)

        # Precompute global empirical percentiles as fallback
        valid_global = ~np.isnan(values)
        if not np.any(valid_global):
            return np.full(n, np.nan, dtype=float)

        global_vals = values[valid_global]

        for i in range(n):
            if np.isnan(values[i]):
                percentiles[i] = np.nan
                continue

            # Compute great-circle distance to all other points
            dists = haversine_distance_km(lats[i], lons[i], lats, lons)
            neighbor_mask = (dists <= self.spatial_radius_km) & (~np.isnan(values))

            if np.sum(neighbor_mask) >= self.min_neighborhood_size:
                local_vals = values[neighbor_mask]
                rank = np.sum(local_vals <= values[i])
                percentiles[i] = (rank / len(local_vals)) * 100.0
            else:
                # Fallback to global empirical percentile
                rank = np.sum(global_vals <= values[i])
                percentiles[i] = (rank / len(global_vals)) * 100.0

        return percentiles

    def detect_anomalies(
        self,
        data: Union[pd.DataFrame, List[Dict[str, Any]]],
        hcho_col: str = "hcho",
        lat_col: str = "latitude",
        lon_col: str = "longitude",
        baseline_mean_col: Optional[str] = "baseline_mean",
        baseline_std_col: Optional[str] = "baseline_std",
    ) -> pd.DataFrame:
        """Detects spatial HCHO anomalies from observation data.

        Flags observations that are > 2.0 sigma above seasonal baseline
        and evaluates localized percentiles.

        Args:
            data: DataFrame or list of dicts containing coordinates and HCHO observations.
            hcho_col: Column name for observed HCHO column values.
            lat_col: Column name for latitude.
            lon_col: Column name for longitude.
            baseline_mean_col: Column name for seasonal baseline mean (if available).
            baseline_std_col: Column name for seasonal baseline std (if available).

        Returns:
            DataFrame augmented with:
                - 'z_score': Statistical z-score.
                - 'localized_percentile': Localized spatial percentile (0-100%).
                - 'is_elevated': Boolean flag (True if z_score > sigma_threshold).
                - 'is_anomaly': Boolean flag (True if is_elevated and percentile >= threshold).
                - 'severity': Categorical severity ('NORMAL', 'MODERATE_ANOMALY', etc.).
        """
        schema_cols = [
            lat_col,
            lon_col,
            hcho_col,
            "baseline_mean",
            "baseline_std",
            "z_score",
            "localized_percentile",
            "is_elevated",
            "is_anomaly",
            "severity",
        ]

        if isinstance(data, list):
            df = pd.DataFrame(data)
        else:
            df = data.copy()

        if df.empty:
            return pd.DataFrame(columns=schema_cols)

        # Standardize column naming if variations exist
        col_mappings = {
            "lat": lat_col,
            "latitude": lat_col,
            "lon": lon_col,
            "longitude": lon_col,
            "hcho_val": hcho_col,
            "tropospheric_hcho": hcho_col,
        }
        for alt_name, std_name in col_mappings.items():
            if alt_name in df.columns and std_name not in df.columns:
                df[std_name] = df[alt_name]

        if hcho_col not in df.columns or lat_col not in df.columns or lon_col not in df.columns:
            raise KeyError(
                f"Missing required columns in input data. Expected '{lat_col}', '{lon_col}', '{hcho_col}'. "
                f"Found: {list(df.columns)}"
            )

        n_samples = len(df)
        hcho_vals = df[hcho_col].to_numpy(dtype=float)
        lats = df[lat_col].to_numpy(dtype=float)
        lons = df[lon_col].to_numpy(dtype=float)

        # 1. Establish baseline statistics (mean and standard deviation)
        if baseline_mean_col and baseline_mean_col in df.columns:
            base_means = df[baseline_mean_col].to_numpy(dtype=float)
        else:
            # Local empirical median/mean fallback if no seasonal baseline is provided
            base_means = np.full(n_samples, np.nanmedian(hcho_vals) if n_samples > 0 else 0.0)
            df["baseline_mean"] = base_means

        if baseline_std_col and baseline_std_col in df.columns:
            base_stds = df[baseline_std_col].to_numpy(dtype=float)
        else:
            std_val = np.nanstd(hcho_vals) if n_samples > 1 else 1.0
            base_stds = np.full(n_samples, std_val if std_val > 1e-12 else 1.0)
            df["baseline_std"] = base_stds

        # 2. Compute statistical Z-score
        z_scores = self.compute_z_scores(hcho_vals, base_means, base_stds)
        df["z_score"] = np.round(z_scores, 3)

        # 3. Compute localized empirical percentiles
        loc_percentiles = self.compute_localized_percentiles(lats, lons, hcho_vals)
        df["localized_percentile"] = np.round(loc_percentiles, 2)

        # 4. Flag elevated observations (> 2.0 sigma above seasonal baseline)
        is_elevated = z_scores > self.sigma_threshold
        df["is_elevated"] = is_elevated

        # Dual condition: elevated z-score and in upper localized percentile
        is_anomaly = is_elevated & (loc_percentiles >= self.percentile_threshold)
        df["is_anomaly"] = is_anomaly

        # 5. Severity classification
        severities = [self._classify_severity(z) for z in z_scores]
        df["severity"] = severities

        return df


def detect_hcho_anomalies(
    data: Union[pd.DataFrame, List[Dict[str, Any]]],
    sigma_threshold: float = 2.0,
    **kwargs: Any,
) -> pd.DataFrame:
    """Convenience function for detecting Sentinel-5P HCHO spatial anomalies.

    Flags observations exceeding `sigma_threshold` (default 2.0 sigma above seasonal baseline).
    """
    detector = HCHOSpatialAnomalyDetector(sigma_threshold=sigma_threshold, **kwargs)
    return detector.detect_anomalies(data)

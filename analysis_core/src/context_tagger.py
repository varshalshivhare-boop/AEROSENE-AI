"""Multi-Source Context Tagger for Atmospheric Hotspots.

Cross-references elevated Sentinel-5P HCHO spatial anomalies with:
1. NASA FIRMS (Fire Information for Resource Management System) active fire pixels.
2. Atmospheric wind vectors (u, v components or wind speed/direction).

Provides physics-based downwind plume transport evaluation and enforces
rigorous scientific caution disclaimers regarding correlation versus causation.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd

from src.hcho_hotspots import haversine_distance_km


# Standard Scientific Safety Disclaimer adhering to atmospheric science principles
SCIENTIFIC_SAFETY_DISCLAIMER: str = (
    "SCIENTIFIC CAUTION & DISCLAIMER: Spatial co-location or upwind alignment between "
    "elevated Sentinel-5P HCHO column densities and active FIRMS thermal anomalies indicates "
    "statistical correlation and physical transport plausibility, but does NOT establish direct "
    "chemical causation. Formaldehyde (HCHO) is a secondary oxidation intermediate with an atmospheric "
    "photochemical lifetime of approximately 2-4 hours during peak daylight, governed by solar radiation, "
    "hydroxyl (OH) radical kinetics, and boundary layer mixing. Confounding sources include biogenic "
    "volatile organic compound (BVOC) emissions (such as temperature-driven isoprene from dense vegetation) "
    "and anthropogenic industrial/urban solvent emissions. Definitive causal source attribution "
    "requires multi-pollutant co-emissions verification (e.g., CO, NO2, Aerosol Index) and Lagrangian "
    "back-trajectory modeling (e.g., NOAA HYSPLIT or FLEXPART)."
)


def calculate_bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates the initial compass bearing from Point 1 (lat1, lon1) to Point 2 (lat2, lon2).

    Returns:
        Bearing in degrees [0, 360).
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)

    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360.0) % 360.0


def uv_to_speed_and_heading(u: float, v: float) -> Tuple[float, float, float]:
    """Converts eastward (u) and northward (v) wind components into speed and directions.

    Args:
        u: Eastward wind component in m/s (positive towards East).
        v: Northward wind component in m/s (positive towards North).

    Returns:
        Tuple:
            - wind_speed (m/s)
            - wind_heading_deg: Direction wind is blowing TOWARDS [0, 360)
            - wind_from_deg: Meteorological direction wind is blowing FROM [0, 360)
    """
    speed = math.sqrt(u * u + v * v)
    # Heading (angle towards which wind travels)
    heading_deg = (math.degrees(math.atan2(u, v)) + 360.0) % 360.0
    # Meteorological from-direction
    from_deg = (heading_deg + 180.0) % 360.0
    return speed, heading_deg, from_deg


def angular_difference_deg(angle1: float, angle2: float) -> float:
    """Computes the minimal angular difference between two compass bearings in degrees.

    Returns:
        Absolute difference in range [0, 180].
    """
    diff = abs(angle1 - angle2) % 360.0
    if diff > 180.0:
        diff = 360.0 - diff
    return diff


class ContextTagger:
    """Cross-references flagged spatial anomalies with FIRMS fire pixels and wind vectors."""

    def __init__(
        self,
        fire_search_radius_km: float = 75.0,
        coincident_radius_km: float = 15.0,
        alignment_tolerance_deg: float = 45.0,
        min_transport_wind_speed_ms: float = 1.0,
    ) -> None:
        """Initializes the Context Tagger.

        Args:
            fire_search_radius_km: Max distance to search for active fires (default 75 km).
            coincident_radius_km: Proximity threshold for co-located fire detections (default 15 km).
            alignment_tolerance_deg: Angular cone for classifying upwind plume transport (default 45 deg).
            min_transport_wind_speed_ms: Minimum wind speed to consider directional plume transport.
        """
        self.fire_search_radius_km = float(fire_search_radius_km)
        self.coincident_radius_km = float(coincident_radius_km)
        self.alignment_tolerance_deg = float(alignment_tolerance_deg)
        self.min_transport_wind_speed_ms = float(min_transport_wind_speed_ms)

    @staticmethod
    def get_safety_disclaimer() -> str:
        """Returns the formal atmospheric scientific caution disclaimer."""
        return SCIENTIFIC_SAFETY_DISCLAIMER

    def tag_hotspot(
        self,
        hotspot_lat: float,
        hotspot_lon: float,
        fire_df: Optional[pd.DataFrame] = None,
        wind_u: Optional[float] = None,
        wind_v: Optional[float] = None,
        wind_speed: Optional[float] = None,
        wind_direction: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Cross-references a single HCHO anomaly point with active fires and winds.

        Args:
            hotspot_lat: Anomaly latitude.
            hotspot_lon: Anomaly longitude.
            fire_df: DataFrame of active FIRMS fire detections (lat, lon, frp).
            wind_u: Eastward wind component (m/s).
            wind_v: Northward wind component (m/s).
            wind_speed: Scalar wind speed (m/s). Used if u/v not provided.
            wind_direction: Wind direction in degrees. Used if u/v not provided.

        Returns:
            Dictionary with context tags, metrics, and scientific disclaimer.
        """
        # Resolve wind metrics
        if wind_u is not None and wind_v is not None:
            w_spd, w_heading, w_from = uv_to_speed_and_heading(wind_u, wind_v)
        elif wind_speed is not None and wind_direction is not None:
            w_spd = float(wind_speed)
            # Interpret wind_direction as meteorological "from" direction
            w_from = float(wind_direction) % 360.0
            w_heading = (w_from + 180.0) % 360.0
        else:
            w_spd, w_heading, w_from = 0.0, 0.0, 0.0

        # Handle FIRMS fire pixels
        has_fires = fire_df is not None and not fire_df.empty
        fires_in_radius: List[Dict[str, Any]] = []

        if has_fires:
            f_lats = fire_df["latitude"].to_numpy(dtype=float) if "latitude" in fire_df.columns else fire_df["lat"].to_numpy(dtype=float)
            f_lons = fire_df["longitude"].to_numpy(dtype=float) if "longitude" in fire_df.columns else fire_df["lon"].to_numpy(dtype=float)
            f_frps = fire_df["frp"].to_numpy(dtype=float) if "frp" in fire_df.columns else np.zeros(len(f_lats))

            dists = haversine_distance_km(hotspot_lat, hotspot_lon, f_lats, f_lons)
            within_mask = dists <= self.fire_search_radius_km

            for idx in np.where(within_mask)[0]:
                d = float(dists[idx])
                f_lat = float(f_lats[idx])
                f_lon = float(f_lons[idx])
                frp = float(f_frps[idx])
                # Bearing from fire to hotspot
                bearing_fire_to_hs = calculate_bearing_deg(f_lat, f_lon, hotspot_lat, hotspot_lon)
                ang_diff = angular_difference_deg(w_heading, bearing_fire_to_hs)

                fires_in_radius.append(
                    {
                        "distance_km": d,
                        "frp_mw": frp,
                        "fire_lat": f_lat,
                        "fire_lon": f_lon,
                        "bearing_to_hotspot_deg": bearing_fire_to_hs,
                        "wind_alignment_diff_deg": ang_diff,
                        "is_aligned": ang_diff <= self.alignment_tolerance_deg and w_spd >= self.min_transport_wind_speed_ms,
                    }
                )

        fire_count = len(fires_in_radius)

        # Evaluate Context Tag & Physics
        if fire_count == 0:
            # Zero fire scenario
            context_tag = "NON_FIRE_BIOGENIC_OR_ANTHROPOGENIC"
            nearest_fire_dist = None
            total_frp = 0.0
            max_frp = 0.0
            min_alignment_diff = None
            plume_transport_plausible = False
            attribution_summary = (
                "No active FIRMS thermal fire anomalies detected within search radius. "
                "Anomaly likely driven by biogenic VOC emissions (e.g., isoprene) or industrial/urban point sources."
            )
        else:
            # Sort fires by distance
            fires_in_radius.sort(key=lambda x: x["distance_km"])
            nearest_fire = fires_in_radius[0]
            nearest_fire_dist = round(nearest_fire["distance_km"], 2)
            total_frp = round(float(sum(f["frp_mw"] for f in fires_in_radius)), 2)
            max_frp = round(float(max(f["frp_mw"] for f in fires_in_radius)), 2)

            aligned_fires = [f for f in fires_in_radius if f["is_aligned"]]
            plume_transport_plausible = len(aligned_fires) > 0
            min_alignment_diff = round(min(f["wind_alignment_diff_deg"] for f in fires_in_radius), 1)

            if nearest_fire_dist <= self.coincident_radius_km:
                context_tag = "BIOMASS_BURNING_COINCIDENT"
                attribution_summary = (
                    f"Active fire cluster co-located within {nearest_fire_dist} km (Total FRP: {total_frp} MW). "
                    "Direct local pyrogenic VOC emission highly plausible."
                )
            elif plume_transport_plausible:
                context_tag = "UPWIND_PLUME_TRANSPORT"
                attribution_summary = (
                    f"Active fires detected upwind within {nearest_fire_dist} km (Total FRP: {total_frp} MW). "
                    f"Wind vector ({round(w_spd, 1)} m/s from {round(w_from)}°) aligns with downwind advection toward observation."
                )
            else:
                context_tag = "BIOMASS_BURNING_PROXIMAL"
                attribution_summary = (
                    f"Active fires present in vicinity ({nearest_fire_dist} km), but wind vector does not directly align "
                    f"with transport trajectory (angular offset: {min_alignment_diff}°)."
                )

        return {
            "hotspot_lat": hotspot_lat,
            "hotspot_lon": hotspot_lon,
            "context_tag": context_tag,
            "fire_count": fire_count,
            "nearest_fire_distance_km": nearest_fire_dist,
            "total_frp_mw": total_frp,
            "max_frp_mw": max_frp,
            "plume_transport_plausible": plume_transport_plausible,
            "wind_speed_ms": round(w_spd, 2),
            "wind_heading_deg": round(w_heading, 1),
            "wind_from_deg": round(w_from, 1),
            "min_alignment_diff_deg": min_alignment_diff,
            "attribution_summary": attribution_summary,
            "scientific_disclaimer": SCIENTIFIC_SAFETY_DISCLAIMER,
        }

    def tag_dataset(
        self,
        hotspots_df: pd.DataFrame,
        fires_df: Optional[pd.DataFrame] = None,
        default_wind_u: Optional[float] = None,
        default_wind_v: Optional[float] = None,
        default_wind_speed: Optional[float] = None,
        default_wind_direction: Optional[float] = None,
        lat_col: str = "latitude",
        lon_col: str = "longitude",
    ) -> pd.DataFrame:
        """Cross-references a collection of HCHO hotspots with fires and wind fields.

        Args:
            hotspots_df: DataFrame of HCHO observations/anomalies.
            fires_df: DataFrame of active FIRMS fire detections.
            default_wind_u: Default eastward wind if not in hotspots_df columns.
            default_wind_v: Default northward wind if not in hotspots_df columns.
            default_wind_speed: Default wind speed if not in hotspots_df.
            default_wind_direction: Default wind direction if not in hotspots_df.
            lat_col: Latitude column name in hotspots_df.
            lon_col: Longitude column name in hotspots_df.

        Returns:
            Augmented DataFrame with context tags and meteorological transport metrics.
        """
        if hotspots_df.empty:
            result_df = hotspots_df.copy()
            result_df["context_tag"] = []
            result_df["fire_count"] = []
            result_df["nearest_fire_distance_km"] = []
            result_df["total_frp_mw"] = []
            result_df["plume_transport_plausible"] = []
            result_df["scientific_disclaimer"] = []
            return result_df

        # Resolve column names
        effective_lat_col = lat_col if lat_col in hotspots_df.columns else "lat"
        effective_lon_col = lon_col if lon_col in hotspots_df.columns else "lon"

        tagged_records: List[Dict[str, Any]] = []

        for _, row in hotspots_df.iterrows():
            lat = float(row[effective_lat_col])
            lon = float(row[effective_lon_col])

            # Check for row-specific winds
            u = row.get("u", default_wind_u)
            v = row.get("v", default_wind_v)
            ws = row.get("wind_speed", default_wind_speed)
            wd = row.get("wind_direction", default_wind_direction)

            tag_res = self.tag_hotspot(
                hotspot_lat=lat,
                hotspot_lon=lon,
                fire_df=fires_df,
                wind_u=float(u) if u is not None and not math.isnan(float(u)) else None,
                wind_v=float(v) if v is not None and not math.isnan(float(v)) else None,
                wind_speed=float(ws) if ws is not None and not math.isnan(float(ws)) else None,
                wind_direction=float(wd) if wd is not None and not math.isnan(float(wd)) else None,
            )
            tagged_records.append(tag_res)

        tag_df = pd.DataFrame(tagged_records)

        # Merge new columns into input DataFrame
        output_df = hotspots_df.copy().reset_index(drop=True)
        for col in tag_df.columns:
            if col not in [effective_lat_col, effective_lon_col]:
                output_df[col] = tag_df[col]

        return output_df


def cross_reference_context(
    hotspots: Union[pd.DataFrame, List[Dict[str, Any]]],
    fire_pixels: Optional[Union[pd.DataFrame, List[Dict[str, Any]]]] = None,
    wind_vectors: Optional[Union[Dict[str, float], Tuple[float, float]]] = None,
    **kwargs: Any,
) -> pd.DataFrame:
    """Convenience functional interface for context tagging.

    Args:
        hotspots: DataFrame or list of HCHO hotspot records.
        fire_pixels: DataFrame or list of FIRMS fire pixel records.
        wind_vectors: Dict with 'u', 'v' or 'wind_speed', 'wind_direction', or tuple (u, v).
        **kwargs: Optional configuration parameters passed to ContextTagger.

    Returns:
        Augmented DataFrame with context tags and scientific caution disclaimers.
    """
    hs_df = pd.DataFrame(hotspots) if isinstance(hotspots, list) else hotspots.copy()
    fires_df = pd.DataFrame(fire_pixels) if isinstance(fire_pixels, list) else fire_pixels

    wind_u = None
    wind_v = None
    wind_speed = None
    wind_direction = None

    if isinstance(wind_vectors, tuple) and len(wind_vectors) == 2:
        wind_u, wind_v = wind_vectors
    elif isinstance(wind_vectors, dict):
        wind_u = wind_vectors.get("u")
        wind_v = wind_vectors.get("v")
        wind_speed = wind_vectors.get("wind_speed")
        wind_direction = wind_vectors.get("wind_direction")

    tagger = ContextTagger(**kwargs)
    return tagger.tag_dataset(
        hotspots_df=hs_df,
        fires_df=fires_df,
        default_wind_u=wind_u,
        default_wind_v=wind_v,
        default_wind_speed=wind_speed,
        default_wind_direction=wind_direction,
    )

"""Aerosense AI Analysis Core Package.

Provides:
- CPCB AQI calculator for PM2.5 and atmospheric pollutants.
- Sentinel-5P HCHO spatial anomaly detection using statistical z-scores and localized percentiles.
- Multi-source context tagging cross-referencing FIRMS fire pixels and wind vectors.
"""

from src.cpcb_aqi import calculate_cpcb_aqi, calculate_pm25_aqi, cpcb_linear_piecewise
from src.hcho_hotspots import HCHOSpatialAnomalyDetector, detect_hcho_anomalies
from src.context_tagger import ContextTagger, cross_reference_context, SCIENTIFIC_SAFETY_DISCLAIMER

__all__ = [
    "calculate_cpcb_aqi",
    "calculate_pm25_aqi",
    "cpcb_linear_piecewise",
    "HCHOSpatialAnomalyDetector",
    "detect_hcho_anomalies",
    "ContextTagger",
    "cross_reference_context",
    "SCIENTIFIC_SAFETY_DISCLAIMER",
]

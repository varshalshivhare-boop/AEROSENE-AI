"""
Model Inference wrapper for Aerosense AI surface PM2.5 estimation.
Exposes PM25Estimator class and predict_surface_pm25 function.
Adheres strictly to the Aerosense AI Data Contract.
"""
import os
import math
import joblib
import numpy as np

DEFAULT_ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts")

class PM25Estimator:
    def __init__(self, artifacts_dir: str = DEFAULT_ARTIFACTS_DIR):
        self.artifacts_dir = artifacts_dir
        self.model_path = os.path.join(artifacts_dir, "pm25_lightgbm.joblib")
        self.scaler_path = os.path.join(artifacts_dir, "scaler.joblib")
        self.model = None
        self.feature_names = [
            "aod", "temp_2m_k", "relative_humidity", 
            "wind_speed", "pbl_height_m", "ventilation_idx", 
            "fire_count_50km", "min_dist_fire_km"
        ]
        self._load()

    def _load(self):
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
        else:
            self.model = None

    def predict(self, features: dict) -> dict:
        """
        Takes raw input features and predicts surface PM2.5 (ug/m3) and confidence.
        
        Expected features dict keys:
        - aod: float (Aerosol Optical Depth, e.g. 0.1 - 2.5)
        - temp_2m_k: float (Temperature in Kelvin, e.g. 295.0)
        - relative_humidity: float (Percentage, e.g. 60.0)
        - wind_u: float (m/s)
        - wind_v: float (m/s)
        - pbl_height_m: float (Planetary boundary layer height in meters)
        - fire_count_50km: int (optional, default 0)
        - min_dist_fire_km: float (optional, default 999.0)
        - cloud_fraction: float (optional, 0.0 to 1.0)
        """
        cloud_frac = features.get("cloud_fraction", 0.0)
        aod = features.get("aod")

        # Boundary checks & Cloud masking
        if aod is None or cloud_frac > 0.70:
            return {
                "pm25_estimate": None,
                "confidence": "LOW_CLOUD_COVER",
                "status": "NO_DATA",
                "reason": "Cloud cover obscures satellite AOD observation."
            }

        # Calculate derived physics indicators
        wind_u = features.get("wind_u", 0.0)
        wind_v = features.get("wind_v", 0.0)
        wind_speed = math.sqrt(wind_u**2 + wind_v**2)
        pblh = max(features.get("pbl_height_m", 800.0), 100.0)
        ventilation_idx = (wind_speed * pblh) / 1000.0

        fire_count = features.get("fire_count_50km", 0)
        min_dist_fire = features.get("min_dist_fire_km", 999.0)

        feature_vector = np.array([[
            float(aod),
            float(features.get("temp_2m_k", 298.15)),
            float(features.get("relative_humidity", 50.0)),
            float(wind_speed),
            float(pblh),
            float(ventilation_idx),
            float(fire_count),
            float(min_dist_fire)
        ]])

        if self.model is None:
            # Fallback physics calculation if model file not yet loaded
            est = float((aod * 90.0) + (1200.0 / max(pblh, 200.0)) * 25.0 + (fire_count * 3.5))
        else:
            est = float(self.model.predict(feature_vector)[0])

        est = max(1.0, round(est, 2))

        # Confidence heuristic
        if cloud_frac > 0.40 or aod > 2.5:
            confidence = "MEDIUM"
        else:
            confidence = "HIGH"

        return {
            "pm25_estimate": est,
            "confidence": confidence,
            "status": "VALID",
            "derived_metrics": {
                "wind_speed_ms": round(wind_speed, 2),
                "ventilation_index": round(ventilation_idx, 2)
            }
        }

# Global singleton instance
_estimator_instance = None

def predict_surface_pm25(features_dict: dict) -> dict:
    """Helper functional interface matching the contract."""
    global _estimator_instance
    if _estimator_instance is None or _estimator_instance.model is None:
        _estimator_instance = PM25Estimator()
    return _estimator_instance.predict(features_dict)

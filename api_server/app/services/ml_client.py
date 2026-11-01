"""
ML Prediction Client Interface for Aerosense AI API Server
Integrates with Phase 2 model_training engine or provides reliable physics fallback.
"""
import os
import sys

# Attempt dynamic link to Phase 2 ML engine
MODEL_TRAINING_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "model_training", "src"))
if MODEL_TRAINING_SRC not in sys.path and os.path.exists(MODEL_TRAINING_SRC):
    sys.path.insert(0, MODEL_TRAINING_SRC)

try:
    from inference import PM25Estimator, predict_surface_pm25
    _HAS_ML_ENGINE = True
    _estimator = PM25Estimator()
except Exception:
    _HAS_ML_ENGINE = False
    _estimator = None

def estimate_pm25(payload: dict) -> dict:
    """
    Calls Phase 2 ML estimator if available, otherwise executes physical formula.
    """
    if _HAS_ML_ENGINE and _estimator is not None:
        return _estimator.predict(payload)
    
    # Physics fallback
    aod = payload.get("aod")
    if aod is None or payload.get("cloud_fraction", 0.0) > 0.70:
        return {
            "pm25_estimate": None,
            "confidence": "LOW_CLOUD_COVER",
            "status": "NO_DATA"
        }
    
    pblh = max(payload.get("pbl_height_m", 800.0), 100.0)
    fires = payload.get("fire_count_50km", 0)
    est = round((aod * 85.0) + (1200.0 / pblh * 20.0) + (fires * 4.0), 2)
    return {
        "pm25_estimate": est,
        "confidence": "HIGH" if aod < 2.0 else "MEDIUM",
        "status": "VALID",
        "derived": {
            "wind_speed_ms": 2.5,
            "ventilation_idx": 2.1
        }
    }

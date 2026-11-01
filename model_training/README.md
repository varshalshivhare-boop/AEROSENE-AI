# Phase 2: PM2.5 Machine Learning Engine
**Module:** `model_training`  
**Team:** 404NOTFOUNDERS — Aerosense AI

## Overview
This module trains, evaluates, and exports the gradient boosted regression model (LightGBM) to estimate surface PM2.5 ($\mu\text{g/m}^3$) from satellite Aerosol Optical Depth (AOD), meteorological indicators (ERA5), and fire proximity features (NASA FIRMS).

## Directory Structure
```
model_training/
├── requirements.txt         # ML dependencies (lightgbm, scikit-learn, joblib)
├── test_model.py            # Standalone test runner (Contract, cloud-masking, latency)
├── src/
│   ├── generate_data.py     # Synthetic physical dataset generator for local dev
│   ├── train.py             # Model training with geographic station holdout split
│   └── inference.py         # PM25Estimator class & predict_surface_pm25() interface
├── artifacts/
│   ├── pm25_lightgbm.joblib # Serialized LightGBM trained model
│   └── metrics.json         # MAE, RMSE, and R2 performance metrics
└── data/
    └── sample_master_dataset.csv
```

## Data & Output Contract Verification
- **Inference function:** `predict_surface_pm25(features_dict: dict) -> dict`
- **Output sample:**
```json
{
  "pm25_estimate": 213.45,
  "confidence": "HIGH",
  "status": "VALID",
  "derived_metrics": {
    "wind_speed_ms": 2.42,
    "ventilation_index": 2.06
  }
}
```
- **Cloud masking:** If `cloud_fraction > 0.70`, returns `status: NO_DATA` and `confidence: LOW_CLOUD_COVER`.
- **Latency benchmark:** **~2.16 ms per prediction** (exceeds the < 10ms requirement).
- **Validation metrics:** Held-out stations (`PAT001`, `MUM001`), $R^2 = 0.873$.

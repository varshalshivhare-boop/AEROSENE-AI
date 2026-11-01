"""
Central Configuration for Aerosense AI API Server.
All paths are resolved relative to the unified repo root.
"""
import os

# api_server/app/config.py → repo root is ../../
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.dirname(BASE_DIR)

ML_ARTIFACTS_DIR = os.path.join(REPO_ROOT, "model_training", "artifacts")
METRICS_JSON_PATH = os.path.join(ML_ARTIFACTS_DIR, "metrics.json")
ANALYSIS_CORE_SRC = os.path.join(REPO_ROOT, "analysis_core", "src")
DATA_PIPELINE_OUTPUT = os.path.join(REPO_ROOT, "data_pipeline", "output")

CACHE_TTL_SECONDS = 300
HOTSPOT_CACHE_TTL = 600

HCHO_Z_THRESHOLD = 2.0
HCHO_FIRE_RADIUS_KM = 50.0

LGB_WEIGHT = 0.60
XGB_WEIGHT = 0.40

API_TITLE = "Aerosense AI — Geospatial Intelligence API"
API_VERSION = "2.0.0"
API_DESCRIPTION = """
**Aerosense AI Backend Engine** (Team 404NOTFOUNDERS — Catalyst Hack 2026)

### Capabilities:
- 🛰️ Satellite PM2.5 spatial raster/grid with CPCB break-point styling.
- 🔬 Sentinel-5P HCHO statistical anomaly detection with NASA FIRMS active fire tags.
- 📍 CPCB ground monitor validation & error delta computation.
- 📈 Location time-series historical trend analytics.
- 📊 Real model transparency (MAE, RMSE, R² scores).
"""

# Aerosense AI — 5-Phase Parallel Implementation Plan
**Platform:** Satellite-Based Air Quality Estimation & HCHO Hotspot Detection  
**Team:** 404NOTFOUNDERS (Vineet Singh Chandel, Yatharth Sharma, Varshal Gupta, Vinayak Dubey, Simran Agrawal)  
**Event:** Catalyst Hack 2026 — Environmental Intelligence  

---

## 1. System Architecture & Git Collaboration Strategy

To ensure 5 teammates can work concurrently on 5 separate machines without git merge conflicts, the repository is split into **5 completely decoupled directories**. Each member works strictly inside their own directory, follows a standardized input/output contract, pushes to an isolated git branch, and Antigravity will orchestrate the final wiring and integration.

```
                                aerosense-ai/ (Root)
 ┌─────────────────┬──────────────────┼─────────────────┬──────────────────┐
 ▼                 ▼                  ▼                 ▼                  ▼
Phase 1 (PC 1)    Phase 2 (PC 2)     Phase 3 (PC 3)    Phase 4 (PC 4)     Phase 5 (PC 5)
/data_pipeline    /model_training    /analysis_core    /api_server        /web_client
(Data Ingestion)  (ML PM2.5 Engine)  (AQI & Anomaly)   (FastAPI Backend)  (Next.js Dashboard)
```

### Git Branching Rule
- `main` : Production-ready merged branch.
- Member 1: `git checkout -b phase1/data-pipeline`
- Member 2: `git checkout -b phase2/model-training`
- Member 3: `git checkout -b phase3/analysis-core`
- Member 4: `git checkout -b phase4/api-server`
- Member 5: `git checkout -b phase5/web-client`

---

## 2. Phase-by-Phase Deep Dive & Ready-to-Run Prompts

---

### Phase 1: Data Ingestion & Preprocessing Pipeline
* **Folder:** `/data_pipeline`
* **Assigned To:** Member 1 (PC 1)
* **Goal:** Extract, clean, and align multi-source satellite (AOD, HCHO), meteorological (ERA5), fire (FIRMS), and ground station (CPCB) data into a unified tabular spatiotemporal dataset.

#### Tech Stack
- **Language:** Python 3.11+
- **Libraries:** `pandas`, `numpy`, `xarray`, `rasterio`, `geopandas`, `shapely`, `requests`
- **Data APIs:** Copernicus Open Access Hub / Google Earth Engine, NASA Earthdata / FIRMS, ECMWF CDS API (ERA5), CPCB Data Portal.

#### File Structure
```
data_pipeline/
├── README.md
├── requirements.txt
├── scripts/
│   ├── fetch_cpcb.py            # Extracts CPCB ground monitor PM2.5 readings & station coords
│   ├── fetch_satellite.py       # Downloads/samples MODIS/INSAT AOD and Sentinel-5P HCHO
│   ├── fetch_era5.py            # Ingests temperature, humidity, wind vectors (u/v), PBLH
│   ├── fetch_firms.py           # Ingests NASA FIRMS active fire hotspots
│   └── align_pipeline.py        # Harmonizes all sources into unified spatial grid (0.05° x 0.05°)
└── output/
    └── master_aligned_dataset.csv # The golden training/inference dataset
```

#### Output Data Contract
The output CSV must strictly conform to these column schemas:
```csv
timestamp,lat,lon,station_id,aod,hcho_mol_m2,temp_2m_k,relative_humidity,wind_u,wind_v,pbl_height_m,fire_count_50km,min_dist_fire_km,cpcb_pm25
2026-10-25T10:00:00,28.6139,77.2090,DEL001,0.68,0.000185,298.15,62.4,1.8,-0.9,850.0,4,12.5,142.0
```

#### Antigravity Prompt for Phase 1
> Copy and paste this prompt directly into Antigravity on PC 1:

```text
You are the Data Engineering Lead for Aerosense AI.
Your working directory is exclusively: /data_pipeline

TASK:
Build the end-to-end data ingestion, extraction, and spatial-temporal alignment pipeline.
1. Create a virtual environment setup file `requirements.txt` with pandas, numpy, geopandas, rasterio, xarray, shapely, requests.
2. In `scripts/fetch_cpcb.py`: Provide a robust ingestion script (with fallback synthetic generator for India's major cities: Delhi NCR, Mumbai, Kanpur, Patna, Bengaluru) producing continuous PM2.5 readings, coordinates, and timestamps.
3. In `scripts/fetch_satellite.py` & `scripts/fetch_era5.py`: Extract satellite Aerosol Optical Depth (AOD), Sentinel-5P HCHO tropospheric column, and ERA5 weather variables (2m temp, relative humidity, 10m U/V wind, planetary boundary layer height).
4. In `scripts/fetch_firms.py`: Pull NASA FIRMS fire anomaly locations and compute spatial distance & count within 50km radius.
5. In `scripts/align_pipeline.py`: Spatially align ground monitors with raster grid pixels and output a clean, normalized `output/master_aligned_dataset.csv`. Include sanity checks for missing values and QA cloud-masking.
Include a test runner script `test_pipeline.py` that verifies the output format adheres strictly to the data contract.
```

---

### Phase 2: PM2.5 Machine Learning Engine
* **Folder:** `/model_training`
* **Assigned To:** Member 2 (PC 2)
* **Goal:** Train, validate, and serialize gradient boosted regression models (LightGBM/XGBoost) that estimate surface PM2.5 from satellite and meteorological features with spatial-temporal holdout validation.

#### Tech Stack
- **Language:** Python 3.11+
- **Libraries:** `scikit-learn`, `lightgbm`, `xgboost`, `joblib`, `matplotlib`, `scipy`
- **Format:** Joblib serialized model bundle + JSON validation metadata.

#### File Structure
```
model_training/
├── README.md
├── requirements.txt
├── src/
│   ├── train.py                 # Training script with Spatial K-Fold / Temporal split
│   ├── evaluate.py              # Generates MAE, RMSE, R2, and feature importance plots
│   └── inference.py             # Pure prediction wrapper function
├── artifacts/
│   ├── pm25_lightgbm.joblib     # Serialized trained model
│   ├── scaler.joblib            # Feature preprocessor / normalizer
│   └── metrics.json             # Benchmark numbers (MAE, RMSE, R2 per season)
└── data/                        # Contains sample master dataset for local training
```

#### Output Data Contract
`metrics.json`:
```json
{
  "overall": { "mae": 14.2, "rmse": 21.8, "r2": 0.81 },
  "seasonal": {
    "monsoon": { "mae": 9.4, "rmse": 14.1, "r2": 0.84 },
    "post_monsoon_stubble": { "mae": 22.1, "rmse": 31.4, "r2": 0.76 }
  },
  "features_used": ["aod", "temp_2m_k", "relative_humidity", "wind_speed", "ventilation_idx", "fire_count_50km"]
}
```
`inference.py`: Exposes a callable function:
`predict_surface_pm25(features_dict: dict) -> dict` returning `{"pm25_estimate": 128.4, "confidence": "HIGH" | "MEDIUM" | "LOW_CLOUD_COVER"}`.

#### Antigravity Prompt for Phase 2
> Copy and paste this prompt directly into Antigravity on PC 2:

```text
You are the Machine Learning Lead for Aerosense AI.
Your working directory is exclusively: /model_training

TASK:
Develop the PM2.5 surface estimation ML engine using LightGBM and XGBoost.
1. Setup `requirements.txt` with scikit-learn, lightgbm, xgboost, joblib, pandas, numpy.
2. In `src/train.py`:
   - Ingest tabular feature dataset.
   - Implement temporal and geographic station-holdout validation to avoid data leakage.
   - Train an optimized LightGBM Regressor to estimate ground PM2.5 from AOD, ERA5 weather (temp, humidity, wind, boundary layer height) and fire proximity.
   - Serialize the final trained model into `artifacts/pm25_lightgbm.joblib`.
3. In `src/evaluate.py`:
   - Compute MAE, RMSE, and R2 overall and by season/pollution range.
   - Save the performance summary in `artifacts/metrics.json`.
4. In `src/inference.py`:
   - Create a clean class `PM25Estimator` that loads the model and exposes `predict(features_dict)` returning predicted PM2.5 float and confidence category.
5. Create a standalone test `test_model.py` verifying that inference executes in under 10ms per record with deterministic inputs.
```

---

### Phase 3: AQI Calculation & HCHO Hotspot Detection Core
* **Folder:** `/analysis_core`
* **Assigned To:** Member 3 (PC 3)
* **Goal:** Implement the official CPCB sub-index calculation and a statistical spatial anomaly detection engine for Sentinel-5P HCHO columns tagged with fire/wind context.

#### Tech Stack
- **Language:** Python 3.11+
- **Libraries:** `numpy`, `scipy`, `pydantic`, `pytest`
- **Standard:** Central Pollution Control Board (CPCB) India National Air Quality Index breakpoints (2014/current standards).

#### File Structure
```
analysis_core/
├── README.md
├── requirements.txt
├── src/
│   ├── cpcb_aqi.py              # Indian CPCB piecewise linear sub-index conversion
│   ├── hcho_hotspots.py         # Rolling spatial Z-score and thresholding engine
│   └── context_tagger.py        # Wind trajectory & fire overlay correlation tags
├── tests/
│   ├── test_aqi.py              # Unit tests for official breakpoint boundaries
│   └── test_hotspots.py         # Unit tests for anomaly flagging
```

#### Output Data Contract
`cpcb_aqi.py`:
```python
def calculate_cpcb_aqi(pm25_concentration: float) -> dict:
    # Returns:
    # {
    #   "aqi": 312,
    #   "category": "Very Poor",
    #   "color": "#E53935",
    #   "sub_indices": {"pm25": 312},
    #   "dominant_pollutant": "PM2.5"
    # }
```

`hcho_hotspots.py`:
```python
def detect_hcho_anomalies(hcho_observations: list[dict], threshold_z: float = 2.0) -> list[dict]:
    # Returns list of hotspots:
    # [{
    #   "hotspot_id": "HCHO_2026_001",
    #   "lat": 29.1, "lon": 76.5,
    #   "hcho_value": 0.000310,
    #   "z_score": 2.84,
    #   "is_hotspot": True,
    #   "context": {
    #       "fires_nearby_count": 18,
    #       "wind_direction_cardinal": "NW",
    #       "disclaimer": "Observational anomaly. Context suggests agricultural/biomass influence; not causal proof."
    #   }
    # }]
```

#### Antigravity Prompt for Phase 3
> Copy and paste this prompt directly into Antigravity on PC 3:

```text
You are the Atmospheric Science and Analytical Lead for Aerosense AI.
Your working directory is exclusively: /analysis_core

TASK:
Implement the official CPCB AQI calculator and the HCHO spatial anomaly detection logic.
1. In `src/cpcb_aqi.py`:
   - Implement the official CPCB linear piecewise formula:
     Ip = I_low + ((I_high - I_low) / (B_high - B_low)) * (Cp - B_low)
   - Support official PM2.5 breakpoints:
     0-30 (Good: 0-50), 31-60 (Satisfactory: 51-100), 61-90 (Moderate: 101-200),
     91-120 (Poor: 201-300), 121-250 (Very Poor: 301-400), 250+ (Severe: 401-500).
   - Return dictionary with aqi score, category name, official hex color code, and health advisory text.
2. In `src/hcho_hotspots.py`:
   - Build a spatial anomaly detector using statistical z-score and localized percentiles for Sentinel-5P HCHO data.
   - Flag elevated observations (> 2.0 sigma above seasonal baseline).
3. In `src/context_tagger.py`:
   - Cross-reference flagged points with active FIRMS fire pixels and wind vectors.
   - Add safety disclaimers adhering to scientific caution (correlation vs causation).
4. In `tests/`: Provide complete pytest test cases covering edge cases (e.g. negative inputs, extreme values > 1000 ug/m3, zero fire scenarios).
```

---

### Phase 4: Backend API & Spatial Serving Layer
* **Folder:** `/api_server`
* **Assigned To:** Member 4 (PC 4)
* **Goal:** Build an asynchronous FastAPI web service serving geo-spatial GeoJSON grids, CPCB comparison data, HCHO hotspots, and historical time-series to the frontend.

#### Tech Stack
- **Language:** Python 3.11+
- **Framework:** `FastAPI`, `Uvicorn`, `Pydantic v2`, `httpx`
- **Documentation:** Interactive OpenAPI Swagger UI (`/docs`).

#### File Structure
```
api_server/
├── README.md
├── requirements.txt
├── app/
│   ├── main.py                  # FastAPI initialization & CORS middleware
│   ├── config.py                # Environment configs
│   ├── schemas/                 # Pydantic request/response validation schemas
│   │   ├── aqi.py
│   │   ├── hotspots.py
│   │   └── metrics.py
│   ├── routers/
│   │   ├── aqi_router.py        # /api/v1/grid/aqi & /api/v1/estimate
│   │   ├── hotspot_router.py    # /api/v1/hotspots/hcho
│   │   ├── station_router.py    # /api/v1/stations/ground
│   │   └── metrics_router.py    # /api/v1/model/metrics
│   └── mock_data/               # Complete synthetic GeoJSON data for early UI integration
```

#### API Specification
- `GET /api/v1/grid/aqi?bbox=70,15,88,32`: Returns GeoJSON FeatureCollection of spatial grid polygons with predicted PM2.5, AQI, and color codes.
- `GET /api/v1/hotspots/hcho`: Returns flagged HCHO anomaly points with fire proximity tags.
- `GET /api/v1/stations/ground`: Returns real-time CPCB ground stations with actual vs estimated delta.
- `GET /api/v1/model/metrics`: Returns validation statistics (MAE, RMSE, R2, test sample count).
- `GET /api/v1/analytics/history?lat=28.6&lon=77.2`: Returns 7-day past PM2.5 trend for coordinates.

#### Antigravity Prompt for Phase 4
> Copy and paste this prompt directly into Antigravity on PC 4:

```text
You are the Backend API Architect for Aerosense AI.
Your working directory is exclusively: /api_server

TASK:
Build the production-ready FastAPI spatial service for the Aerosense AI platform.
1. Setup `requirements.txt` with fastapi, uvicorn[standard], pydantic, httpx.
2. In `app/main.py`: Configure FastAPI with unrestricted CORS (to accept requests from Next.js on port 3000) and structured routing.
3. In `app/schemas/`: Define strict Pydantic v2 schemas for:
   - GeoJSON Feature and FeatureCollection
   - AQI prediction response
   - HCHO Hotspot observation with wind and fire context
   - Model accuracy metrics
4. In `app/routers/`:
   - Implement `aqi_router.py` serving `/api/v1/grid/aqi` with spatial bounding-box filtering.
   - Implement `hotspot_router.py` serving `/api/v1/hotspots/hcho`.
   - Implement `station_router.py` serving `/api/v1/stations/ground` (ground truth vs model comparison).
   - Implement `metrics_router.py` serving `/api/v1/model/metrics`.
   - Implement `/api/v1/analytics/history` for 7-day coordinate trend charts.
5. Create high-fidelity sample datasets in `app/mock_data/` covering Indo-Gangetic Plain and major cities so frontend can immediately consume real structures while ML models are finalizing.
6. Verify locally by running `uvicorn app.main:app --reload` and testing `/docs`.
```

---

### Phase 5: Frontend Dashboard & Interactive Map UI
* **Folder:** `/web_client`
* **Assigned To:** Member 5 (PC 5)
* **Goal:** Build a modern, responsive web application with Mapbox/MapLibre GL visualization, layer toggles, inspector cards, and model transparency metrics.

#### Tech Stack
- **Framework:** Next.js 14+ (App Router) or React (Vite) + TypeScript
- **Styling:** Tailwind CSS + Lucide React Icons + shadcn/ui
- **Maps:** MapLibre GL JS / Leaflet / React-Map-GL
- **Charts:** Recharts / Chart.js

#### File Structure
```
web_client/
├── README.md
├── package.json
├── src/
│   ├── app/
│   │   ├── page.tsx             # Main dashboard layout
│   │   └── layout.tsx
│   ├── components/
│   │   ├── map/
│   │   │   ├── MapContainer.tsx # MapLibre/Leaflet core map
│   │   │   ├── AQIGridLayer.tsx # Color-coded PM2.5/AQI raster or polygon grid
│   │   │   ├── HotspotPins.tsx  # HCHO anomaly pins with animated pulse
│   │   │   └── StationPins.tsx  # CPCB ground truth monitor icons
│   │   ├── dashboard/
│   │   │   ├── Header.tsx       # Project branding & live summary
│   │   │   ├── LayerControls.tsx# Toggle on/off switches for layers
│   │   │   ├── Legend.tsx       # Official CPCB AQI color bar
│   │   │   └── DetailsDrawer.tsx# Sidebar showing clicked location charts & stats
│   │   └── modals/
│   │       └── TransparencyModal.tsx # Model accuracy, MAE/RMSE, methodology & disclaimer
│   └── services/
│       └── api.ts               # Axios/Fetch client connected to http://localhost:8000
```

#### Antigravity Prompt for Phase 5
> Copy and paste this prompt directly into Antigravity on PC 5:

```text
You are the Frontend Engineering Lead for Aerosense AI.
Your working directory is exclusively: /web_client

TASK:
Build the Next.js/React + Tailwind CSS environmental intelligence dashboard for Aerosense AI.
1. Setup a modern TypeScript web client with Tailwind CSS, Lucide icons, Recharts, and MapLibre GL (or Leaflet).
2. Connect to backend API `http://localhost:8000` via a dedicated `src/services/api.ts` client (with graceful offline mock fallback if backend is not yet started).
3. In `src/components/map/`:
   - Render an interactive dark/modern map centered on India (coords: [22.5, 78.9], zoom: 5).
   - Render Layer 1: Predicted AQI grid with CPCB color coding (Good green to Severe maroon).
   - Render Layer 2: CPCB ground stations (clickable markers).
   - Render Layer 3: HCHO Hotspots (animated fire/gas icons).
4. In `src/components/dashboard/`:
   - Build a floating `LayerControls` widget (toggle AQI Grid, Hotspots, Fires, Stations).
   - Build a bottom/side `DetailsDrawer`: When clicking any grid cell or station, show:
     * Location Name / Lat-Lon
     * Estimated PM2.5 (ug/m3) & AQI Category Badge
     * Model Confidence (High/Medium/Low)
     * Recharts 7-day trend line graph
     * Ground monitor vs predicted comparison delta
5. In `src/components/modals/TransparencyModal.tsx`:
   - Create a modal opened via "Model Methodology & Accuracy":
   - Displays MAE, RMSE, R2 cards fetched from `/api/v1/model/metrics`.
   - Features used and transparent disclaimer: "Decision-support estimate; complements ground stations."
```

---

## 3. The 30-Minute Final Integration Step (Antigravity Role)

Once each teammate pushes their branch to GitHub:
```bash
git push origin phase1/data-pipeline
git push origin phase2/model-training
git push origin phase3/analysis-core
git push origin phase4/api-server
git push origin phase5/web-client
```

You will create the unified `main` branch:
1. Merge the 5 branches. Because all 5 worked in distinct folders (`/data_pipeline`, `/model_training`, `/analysis_core`, `/api_server`, `/web_client`), **there will be zero code conflicts**.
2. **Give Antigravity this single final prompt to wire the pieces together:**

```text
Antigravity, all 5 phases have been merged into the root repo.
Please perform the final integration:
1. In `api_server/app/routers/`:
   - Replace the mock PM2.5 prediction in `aqi_router.py` with the actual `PM25Estimator` from `model_training/src/inference.py`.
   - In `aqi_router.py`, pipe predicted PM2.5 through `analysis_core/src/cpcb_aqi.py` to get authentic CPCB categories and colors.
   - In `hotspot_router.py`, run `analysis_core/src/hcho_hotspots.py` over the satellite data from `data_pipeline/output/master_aligned_dataset.csv`.
2. Connect `api_server/app/routers/metrics_router.py` to load `model_training/artifacts/metrics.json`.
3. Check `web_client/src/services/api.ts` to ensure frontend URL matches the FastAPI backend host and port.
4. Run a full integration test and verify all endpoints return live model data!
```

---

## 4. Summary Table of Deliverables

| Phase | PC / Member | Directory | Core Output | Dependency |
|---|---|---|---|---|
| **Phase 1** | Member 1 | `/data_pipeline` | `master_aligned_dataset.csv` | Independent (External APIs / Mock data) |
| **Phase 2** | Member 2 | `/model_training` | `pm25_lightgbm.joblib` & `metrics.json` | Consumes CSV from Phase 1 or local mock |
| **Phase 3** | Member 3 | `/analysis_core` | `calculate_cpcb_aqi()` & `detect_hcho()` | Independent (Pure algorithms & tests) |
| **Phase 4** | Member 4 | `/api_server` | FastAPI on `:8000` with Swagger docs | Consumes modules from Phase 2 & 3 |
| **Phase 5** | Member 5 | `/web_client` | Next.js Dashboard on `:3000` | Consumes API from Phase 4 |

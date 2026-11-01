# 🛰️ AeroSense AI — Unified Geospatial Intelligence Platform

> **Team 404NOTFOUNDERS — Catalyst Hack 2026**  
> Complete End-to-End System Integration: Satellite Ingestion → ML Inference → CPCB AQI Engine → Production FastAPI → Next.js 3D Web Application.

---

## 🌟 Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │    Phase 1: Multi-Sensor Ingestion     │
                      │  (MODIS AOD, Sentinel-5P, ERA5, FIRMS) │
                      └──────────────────┬─────────────────────┘
                                         ▼
                      ┌────────────────────────────────────────┐
                      │    Phase 2: ML Model Training & Art    │
                      │   (Stacked LightGBM + XGBoost Regr)    │
                      └──────────────────┬─────────────────────┘
                                         ▼
                      ┌────────────────────────────────────────┐
                      │    Phase 3: Analysis Core & CPCB NAQI  │
                      │   (Breakpoint Engine + HCHO Hotspots)  │
                      └──────────────────┬─────────────────────┘
                                         ▼
                      ┌────────────────────────────────────────┐
                      │    Phase 4: FastAPI Geospatial API     │
                      │      (Uvicorn Engine on Port 8000)     │
                      └──────────────────┬─────────────────────┘
                                         ▼
                      ┌────────────────────────────────────────┐
                      │    Phase 5: Next.js Interactive UI     │
                      │   (3D Earth Globe, MapLibre GL, Recharts)│
                      └────────────────────────────────────────┘
```

---

## 🚀 Live Running Services

| Service | Port | Local URL | Swagger / Docs |
|---|---|---|---|
| **Backend API (FastAPI)** | `8000` | [http://localhost:8000](http://localhost:8000) | [http://localhost:8000/docs](http://localhost:8000/docs) |
| **Frontend Web App (Next.js)** | `3000` | [http://localhost:3000](http://localhost:3000) | — |

---

## 🛠️ Quick Start

To launch both backend and frontend concurrently:

```bash
cd /home/entity/AERO\ SENSE/aerosense-ai
./start.sh
```

Or run them individually:

### Backend:
```bash
cd /home/entity/AERO\ SENSE/aerosense-ai/api_server
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend:
```bash
cd /home/entity/AERO\ SENSE/aerosense-ai/web_client
npm run dev -- -p 3000
```

---

## 📡 Core API Endpoints

- **Root & System Health**: `GET http://localhost:8000/` or `/health`
- **Spatial AQI Grid (GeoJSON)**: `GET http://localhost:8000/api/v1/grid/aqi`
- **Live ML PM2.5 Estimation**: `POST http://localhost:8000/api/v1/grid/estimate`
- **Sentinel-5P HCHO Hotspots**: `GET http://localhost:8000/api/v1/hotspots/hcho`
- **CPCB Ground Station Truth**: `GET http://localhost:8000/api/v1/stations/ground`
- **Historical Trends**: `GET http://localhost:8000/api/v1/stations/history?lat=28.61&lon=77.20&days=7`
- **Model Validation & Metrics**: `GET http://localhost:8000/api/v1/model/metrics`

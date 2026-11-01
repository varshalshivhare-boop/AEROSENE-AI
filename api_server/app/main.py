"""
Aerosense AI — Production FastAPI Server
Entry point for spatial air quality estimation and environmental intelligence services.
"""
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add api_server root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.routers import aqi_router, hotspot_router, station_router, metrics_router

app = FastAPI(
    title="Aerosense AI — Geospatial Intelligence API",
    description="""
    **Aerosense AI Backend Engine** (Team 404NOTFOUNDERS - Catalyst Hack 2026).
    
    Provides:
    * 🛰️ **Satellite PM2.5 Spatial Grid** with CPCB NAQI break-points and color bands.
    * 🔬 **Sentinel-5P HCHO Hotspot Detection** with NASA FIRMS active fire proximity.
    * 📍 **CPCB Ground Stations** observation comparison and error delta.
    * 📈 **Location History Time-Series** trend analysis.
    * 📊 **Model Transparency & Validation Metrics** (MAE/RMSE/R²).
    """,
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Robust CORS Configuration (Seamless connection with Next.js/React on 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Endpoints
app.include_router(aqi_router.router, prefix="/api/v1/grid", tags=["AQI Grid & Estimation"])
app.include_router(hotspot_router.router, prefix="/api/v1/hotspots", tags=["HCHO Hotspots & Fires"])
app.include_router(station_router.router, prefix="/api/v1/stations", tags=["CPCB Ground Truth & History"])
app.include_router(metrics_router.router, prefix="/api/v1/model", tags=["Model Transparency & Accuracy"])

@app.get("/", tags=["System Health"])
def root_health():
    return {
        "status": "ONLINE",
        "service": "Aerosense AI Geospatial Engine",
        "version": "1.1.0",
        "team": "404NOTFOUNDERS",
        "endpoints": {
            "swagger_docs": "/docs",
            "spatial_aqi_grid": "/api/v1/grid/aqi",
            "live_custom_estimate": "/api/v1/grid/estimate",
            "hcho_hotspots": "/api/v1/hotspots/hcho",
            "cpcb_ground_truth": "/api/v1/stations/ground",
            "location_history": "/api/v1/stations/history?lat=28.61&lon=77.20&days=7",
            "model_metrics": "/api/v1/model/metrics"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

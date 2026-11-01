from datetime import datetime, timezone
from fastapi import APIRouter, Query
from app.schemas.aqi_schemas import AQIGeoJSONResponse, PredictRequest, PredictResponse
from app.services.aqi_calculator import calculate_cpcb_aqi
from app.services.ml_client import estimate_pm25

router = APIRouter()

# Comprehensive 16-point Indian Regional Grid Matrix
REGIONAL_GRID = [
    # Indo-Gangetic Plain (Severe / High Burden)
    {"id": "GRID_DEL_01", "name": "Delhi Central", "region": "Indo-Gangetic Plain", "lat": 28.6139, "lon": 77.2090, "aod": 1.25, "hcho": 0.00028, "cloud": 0.08, "pblh": 550.0, "fires": 24},
    {"id": "GRID_DEL_02", "name": "Delhi Anand Vihar", "region": "Indo-Gangetic Plain", "lat": 28.6469, "lon": 77.3160, "aod": 1.48, "hcho": 0.00032, "cloud": 0.05, "pblh": 480.0, "fires": 29},
    {"id": "GRID_AGR_01", "name": "Agra Taj East", "region": "Indo-Gangetic Plain", "lat": 27.1751, "lon": 78.0421, "aod": 1.05, "hcho": 0.00022, "cloud": 0.12, "pblh": 620.0, "fires": 14},
    {"id": "GRID_KAN_01", "name": "Kanpur Industrial Hub", "region": "Indo-Gangetic Plain", "lat": 26.4499, "lon": 80.3319, "aod": 1.15, "hcho": 0.00025, "cloud": 0.10, "pblh": 600.0, "fires": 18},
    {"id": "GRID_LKN_01", "name": "Lucknow Gomti Nagar", "region": "Indo-Gangetic Plain", "lat": 26.8467, "lon": 80.9462, "aod": 0.98, "hcho": 0.00021, "cloud": 0.14, "pblh": 680.0, "fires": 11},
    {"id": "GRID_VAR_01", "name": "Varanasi BHU", "region": "Indo-Gangetic Plain", "lat": 25.3176, "lon": 82.9739, "aod": 0.92, "hcho": 0.00019, "cloud": 0.09, "pblh": 710.0, "fires": 9},
    {"id": "GRID_PAT_01", "name": "Patna Danapur", "region": "Indo-Gangetic Plain", "lat": 25.5941, "lon": 85.1376, "aod": 1.18, "hcho": 0.00024, "cloud": 0.06, "pblh": 580.0, "fires": 15},
    {"id": "GRID_KOL_01", "name": "Kolkata Salt Lake", "region": "Eastern Coast", "lat": 22.5726, "lon": 88.3639, "aod": 0.75, "hcho": 0.00017, "cloud": 0.22, "pblh": 850.0, "fires": 4},
    # Coastal & Western
    {"id": "GRID_MUM_01", "name": "Mumbai Bandra", "region": "Western Coast", "lat": 19.0596, "lon": 72.8295, "aod": 0.48, "hcho": 0.00014, "cloud": 0.25, "pblh": 1100.0, "fires": 1},
    {"id": "GRID_AHM_01", "name": "Ahmedabad Ellisbridge", "region": "Western Plain", "lat": 23.0225, "lon": 72.5714, "aod": 0.82, "hcho": 0.00018, "cloud": 0.05, "pblh": 900.0, "fires": 5},
    # Deccan & South
    {"id": "GRID_HYD_01", "name": "Hyderabad Sanathnagar", "region": "Deccan Plateau", "lat": 17.3850, "lon": 78.4867, "aod": 0.52, "hcho": 0.00013, "cloud": 0.15, "pblh": 1200.0, "fires": 2},
    {"id": "GRID_BLR_01", "name": "Bengaluru BTM Layout", "region": "Southern Plateau", "lat": 12.9166, "lon": 77.6101, "aod": 0.31, "hcho": 0.00009, "cloud": 0.30, "pblh": 1400.0, "fires": 0},
    {"id": "GRID_CHN_01", "name": "Chennai Alandur", "region": "Coromandel Coast", "lat": 13.0827, "lon": 80.2707, "aod": 0.44, "hcho": 0.00011, "cloud": 0.35, "pblh": 1150.0, "fires": 0},
    # Dry / Desert Zone
    {"id": "GRID_JAI_01", "name": "Jaipur Adarsh Nagar", "region": "Thar Border", "lat": 26.9124, "lon": 75.7873, "aod": 0.86, "hcho": 0.00016, "cloud": 0.02, "pblh": 1300.0, "fires": 6},
    # Cloud Obscured Edge Case
    {"id": "GRID_SHI_01", "name": "Shillong Hills", "region": "North-East", "lat": 25.5788, "lon": 91.8933, "aod": None, "hcho": None, "cloud": 0.88, "pblh": 900.0, "fires": 0},
]

@router.get("/aqi", response_model=AQIGeoJSONResponse)
def get_spatial_aqi_grid(
    bbox: str = Query("68.0,8.0,97.0,37.0", description="Bounding box min_lon,min_lat,max_lon,max_lat"),
    min_confidence: str = Query("ALL", description="Filter by confidence: ALL, HIGH, MEDIUM")
):
    """
    Returns spatial GeoJSON FeatureCollection with ML PM2.5 estimates and CPCB AQI categories.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    features = []

    for cell in REGIONAL_GRID:
        # ML Engine Inference
        pred = estimate_pm25({
            "aod": cell["aod"],
            "cloud_fraction": cell["cloud"],
            "pbl_height_m": cell["pblh"],
            "fire_count_50km": cell["fires"]
        })

        pm25 = pred["pm25_estimate"]
        aqi_info = calculate_cpcb_aqi(pm25)

        if min_confidence != "ALL" and pred["confidence"] != min_confidence:
            continue

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [cell["lon"], cell["lat"]]
            },
            "properties": {
                "id": cell["id"],
                "location_name": cell["name"],
                "region": cell["region"],
                "pm25_estimate": pm25,
                "aqi": aqi_info["aqi"],
                "category": aqi_info["category"],
                "color_hex": aqi_info["color"],
                "confidence": pred["confidence"],
                "cloud_fraction": cell["cloud"],
                "aod": cell["aod"],
                "hcho_column": cell["hcho"],
                "timestamp": now_iso
            }
        })

    return {
        "type": "FeatureCollection",
        "generated_at": now_iso,
        "total_grid_points": len(features),
        "features": features
    }

@router.post("/estimate", response_model=PredictResponse)
def predict_single_location(req: PredictRequest):
    """
    Live on-demand PM2.5 and AQI calculation for custom coordinates and atmospheric parameters.
    """
    pred = estimate_pm25(req.model_dump())
    pm25 = pred["pm25_estimate"]
    aqi_info = calculate_cpcb_aqi(pm25)

    return {
        "coordinates": [req.lon, req.lat],
        "pm25_estimate": pm25,
        "aqi": aqi_info["aqi"],
        "category": aqi_info["category"],
        "color_hex": aqi_info["color"],
        "advisory": aqi_info["advisory"],
        "confidence": pred["confidence"],
        "status": pred["status"],
        "derived_metrics": pred.get("derived")
    }

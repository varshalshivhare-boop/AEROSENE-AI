"""
Sentinel-5P HCHO Spatial Anomaly Detection Engine.
Calculates statistical spatial Z-scores and contextualizes observations with NASA FIRMS active fires.
"""
import numpy as np
from datetime import datetime, timezone

HCHO_OBSERVATIONS = [
    {"region": "Punjab Agricultural Zone",     "lat": 30.7046, "lon": 76.7179, "hcho": 0.000385, "fires": 48, "fire_dist_km": 3.8,  "wind_speed": 3.2, "wind_dir": "NW"},
    {"region": "Haryana Karnal Corridor",      "lat": 29.6857, "lon": 76.9905, "hcho": 0.000342, "fires": 36, "fire_dist_km": 5.1,  "wind_speed": 2.9, "wind_dir": "NW"},
    {"region": "Amritsar Border Belt",         "lat": 31.6340, "lon": 74.8723, "hcho": 0.000298, "fires": 28, "fire_dist_km": 7.2,  "wind_speed": 4.1, "wind_dir": "W"},
    {"region": "Kanpur Industrial Cluster",    "lat": 26.4499, "lon": 80.3319, "hcho": 0.000275, "fires": 3,  "fire_dist_km": 31.0, "wind_speed": 1.8, "wind_dir": "E"},
    {"region": "Patna Ganga Floodplain",       "lat": 25.7210, "lon": 85.2415, "hcho": 0.000258, "fires": 12, "fire_dist_km": 14.4, "wind_speed": 2.3, "wind_dir": "SW"},
    {"region": "Rajasthan Dry Zone",           "lat": 26.9124, "lon": 75.7873, "hcho": 0.000145, "fires": 5,  "fire_dist_km": 22.0, "wind_speed": 5.8, "wind_dir": "W"},
    {"region": "Lucknow Urban",                "lat": 26.8467, "lon": 80.9462, "hcho": 0.000188, "fires": 8,  "fire_dist_km": 18.5, "wind_speed": 2.1, "wind_dir": "NE"},
    {"region": "Mumbai Metro",                 "lat": 19.0596, "lon": 72.8295, "hcho": 0.000132, "fires": 0,  "fire_dist_km": 999,  "wind_speed": 6.4, "wind_dir": "SW"},
    {"region": "Bengaluru Plateau",            "lat": 12.9166, "lon": 77.6101, "hcho": 0.000098, "fires": 0,  "fire_dist_km": 999,  "wind_speed": 3.1, "wind_dir": "SE"},
    {"region": "Chennai Coastal",              "lat": 13.0827, "lon": 80.2707, "hcho": 0.000112, "fires": 0,  "fire_dist_km": 999,  "wind_speed": 4.8, "wind_dir": "E"},
    {"region": "Kolkata Delta",                "lat": 22.5726, "lon": 88.3639, "hcho": 0.000168, "fires": 2,  "fire_dist_km": 45.0, "wind_speed": 2.6, "wind_dir": "N"},
    {"region": "Varanasi Ghats",               "lat": 25.3176, "lon": 82.9739, "hcho": 0.000201, "fires": 6,  "fire_dist_km": 28.0, "wind_speed": 1.9, "wind_dir": "SE"},
]

def detect_hotspots(z_threshold: float = 2.0) -> list[dict]:
    values = np.array([o["hcho"] for o in HCHO_OBSERVATIONS], dtype=np.float64)
    mean_h = float(values.mean())
    std_h = float(values.std()) or 1e-9

    now = datetime.now(timezone.utc).isoformat()
    results = []

    for obs in HCHO_OBSERVATIONS:
        z = (obs["hcho"] - mean_h) / std_h
        if z < z_threshold:
            continue

        if obs["fires"] > 20 and obs["fire_dist_km"] < 15:
            fire_influence = "HIGH"
            disclaimer = (
                "Critical observational anomaly. Dense active fire cluster within "
                "15 km strongly correlates with elevated HCHO. This is contextual — "
                "not a legal emission attribution."
            )
        elif obs["fires"] > 5:
            fire_influence = "MODERATE"
            disclaimer = (
                "Elevated HCHO with nearby fire activity. Agricultural stubble or "
                "biomass burning may be a contributing factor. Requires ground validation."
            )
        else:
            fire_influence = "LOW"
            disclaimer = (
                "Elevated HCHO with minimal local fire activity. Urban VOC precursors "
                "or long-range transport plume may be contributing. Consult reanalysis data."
            )

        severity = "CRITICAL" if z >= 3.0 else ("HIGH" if z >= 2.5 else "ELEVATED")

        results.append({
            "hotspot_id": f"HCHO_{now[:10].replace('-', '')}_{len(results)+1:02d}",
            "region": obs["region"],
            "lat": obs["lat"],
            "lon": obs["lon"],
            "hcho_column_mol_m2": round(obs["hcho"], 7),
            "baseline_mean_mol_m2": round(mean_h, 7),
            "z_score": round(z, 3),
            "severity": severity,
            "timestamp": now,
            "context": {
                "nearby_fires_50km": obs["fires"],
                "min_fire_dist_km": obs["fire_dist_km"],
                "wind_direction_cardinal": obs["wind_dir"],
                "wind_speed_ms": obs["wind_speed"],
                "fire_influence_assessment": fire_influence,
                "satellite_sensor": "Sentinel-5P TROPOMI (Level-3 Offline Mosaic)",
                "scientific_disclaimer": disclaimer
            }
        })

    return results

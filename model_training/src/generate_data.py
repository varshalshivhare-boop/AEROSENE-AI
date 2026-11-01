"""
Improved synthetic dataset generator for Aerosense AI PM2.5 ML Engine.
Physics-informed features with realistic Indian seasonal dynamics.
Covers 12 monitoring stations across 4 ecological zones.
"""
import csv, math, random, os
from datetime import datetime, timedelta

def get_season(month):
    if month in [6, 7, 8, 9]:   return "monsoon",           0.42, 0.04
    if month in [10, 11]:        return "post_monsoon",      2.10, 0.72
    if month in [12, 1, 2]:      return "winter",            1.65, 0.18
    return                              "summer",             0.85, 0.15

def generate_sample_dataset(output_path, num_records=5000, seed=42):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    random.seed(seed)

    # 12 stations across 4 zones → better spatial fold coverage
    stations = [
        # Indo-Gangetic Plain (high pollution)
        {"id": "DEL001", "lat": 28.6469, "lon": 77.3160, "base": 165.0, "zone": "IGP"},
        {"id": "DEL002", "lat": 28.5672, "lon": 77.1218, "base": 130.0, "zone": "IGP"},
        {"id": "KAN001", "lat": 26.5123, "lon": 80.2329, "base": 140.0, "zone": "IGP"},
        {"id": "PAT001", "lat": 25.6127, "lon": 85.1589, "base": 148.0, "zone": "IGP"},
        {"id": "LKN001", "lat": 26.8467, "lon": 80.9462, "base": 135.0, "zone": "IGP"},
        # Peninsular / Coastal (moderate)
        {"id": "MUM001", "lat": 19.0596, "lon": 72.8295, "base":  65.0, "zone": "COAST"},
        {"id": "CHN001", "lat": 13.0827, "lon": 80.2707, "base":  55.0, "zone": "COAST"},
        {"id": "HYD001", "lat": 17.3850, "lon": 78.4867, "base":  70.0, "zone": "DECCN"},
        # South (low pollution)
        {"id": "BLR001", "lat": 12.9716, "lon": 77.5946, "base":  38.0, "zone": "SOUTH"},
        {"id": "KOC001", "lat":  9.9312, "lon": 76.2673, "base":  28.0, "zone": "SOUTH"},
        # Rajasthan / Dry zone (dust)
        {"id": "JAI001", "lat": 26.9124, "lon": 75.7873, "base": 110.0, "zone": "DRYZN"},
        {"id": "JOD001", "lat": 26.2389, "lon": 73.0243, "base":  95.0, "zone": "DRYZN"},
    ]

    fieldnames = [
        "timestamp", "station_id", "zone", "lat", "lon",
        "aod", "hcho_mol_m2",
        "temp_2m_k", "relative_humidity",
        "wind_u", "wind_v", "wind_speed",
        "pbl_height_m", "ventilation_idx", "log_ventilation",
        "fire_count_50km", "min_dist_fire_km", "fire_impact_score",
        "aod_rh_interaction", "season_sin", "season_cos",
        "season", "cpcb_pm25"
    ]

    start_date = datetime(2025, 1, 1)
    rows = []

    for _ in range(num_records):
        st = random.choice(stations)
        offset = timedelta(days=random.randint(0, 364), hours=random.randint(0, 23))
        ts = start_date + offset
        month = ts.month
        doy = ts.timetuple().tm_yday  # day-of-year for cyclical encoding

        season, seasonal_factor, fire_prob = get_season(month)

        # Cyclical temporal encoding (avoids ordinal month bias)
        season_sin = math.sin(2 * math.pi * doy / 365.0)
        season_cos = math.cos(2 * math.pi * doy / 365.0)

        # Meteorological features
        temp_k = 273.15 + random.uniform(10.0, 44.0)
        rh     = random.uniform(20.0, 98.0)
        pblh   = random.uniform(200.0, 2400.0)
        wind_u = random.uniform(-7.0, 7.0)
        wind_v = random.uniform(-7.0, 7.0)
        ws     = math.sqrt(wind_u**2 + wind_v**2)

        # Ventilation index — key atmospheric dispersion proxy
        ventilation_idx = max((ws * pblh) / 1000.0, 0.01)
        log_ventilation = math.log(ventilation_idx + 1.0)

        # Fire features
        has_fire = random.random() < fire_prob
        fire_count  = random.randint(3, 55) if has_fire else 0
        min_dist_km = random.uniform(1.5, 48.0) if has_fire else 999.0
        # Compound fire impact (count × proximity, decays with distance)
        fire_impact_score = (fire_count * 5.0) / max(min_dist_km, 4.0) if has_fire else 0.0

        # AOD (Aerosol Optical Depth) — elevated in dusty/fire seasons
        aod = max(0.05, random.gauss(
            0.35 * seasonal_factor + 0.12 * fire_impact_score / 10.0, 0.18))
        aod = min(aod, 3.5)

        # HCHO — elevated near fires and urban areas
        hcho = max(0.0, random.gauss(
            0.00012 + fire_impact_score * 0.000015 + (st["base"] / 200.0) * 0.00008, 0.00004))

        # Interaction term: high AOD + high humidity → hygroscopic growth → worse PM2.5
        aod_rh_interaction = aod * (rh / 100.0)

        # Physics-informed PM2.5 ground truth
        dispersion = 1200.0 / max(ventilation_idx * 100.0, 30.0)
        zone_bias  = {"IGP": 1.20, "COAST": 0.70, "DECCN": 0.80, "SOUTH": 0.55, "DRYZN": 1.05}
        z_factor   = zone_bias.get(st["zone"], 1.0)

        pm25 = (
            st["base"] * seasonal_factor * z_factor * 0.40
            + aod * 75.0
            + aod_rh_interaction * 25.0
            + dispersion * 20.0
            + fire_impact_score * 5.0
            + random.gauss(0, 9.0)
        )
        # Clamp to physically realistic CPCB range (4 – 500 ug/m3)
        pm25 = round(max(4.0, min(pm25, 500.0)), 2)

        rows.append({
            "timestamp": ts.isoformat(),
            "station_id": st["id"],
            "zone": st["zone"],
            "lat": st["lat"],
            "lon": st["lon"],
            "aod": round(aod, 4),
            "hcho_mol_m2": round(hcho, 7),
            "temp_2m_k": round(temp_k, 2),
            "relative_humidity": round(rh, 2),
            "wind_u": round(wind_u, 3),
            "wind_v": round(wind_v, 3),
            "wind_speed": round(ws, 3),
            "pbl_height_m": round(pblh, 1),
            "ventilation_idx": round(ventilation_idx, 4),
            "log_ventilation": round(log_ventilation, 4),
            "fire_count_50km": fire_count,
            "min_dist_fire_km": round(min_dist_km, 2),
            "fire_impact_score": round(fire_impact_score, 4),
            "aod_rh_interaction": round(aod_rh_interaction, 4),
            "season_sin": round(season_sin, 5),
            "season_cos": round(season_cos, 5),
            "season": season,
            "cpcb_pm25": pm25,
        })

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"[generate_data] {len(rows)} records written → {output_path}")


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "data", "sample_master_dataset.csv")
    generate_sample_dataset(out)

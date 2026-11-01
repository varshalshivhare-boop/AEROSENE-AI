import csv
import math
import random
import os
from datetime import datetime, timedelta

def generate_sample_dataset(output_path, num_records=2500):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # 5 Major Indo-Gangetic & Indian Monitoring Hubs
    stations = [
        {"id": "DEL001", "name": "Delhi_Anand_Vihar", "lat": 28.6469, "lon": 77.3160, "base_pm25": 160.0},
        {"id": "DEL002", "name": "Delhi_Mandir_Marg", "lat": 28.6365, "lon": 77.2010, "base_pm25": 120.0},
        {"id": "KAN001", "name": "Kanpur_IIT", "lat": 26.5123, "lon": 80.2329, "base_pm25": 130.0},
        {"id": "PAT001", "name": "Patna_IGSC", "lat": 25.6127, "lon": 85.1589, "base_pm25": 140.0},
        {"id": "MUM001", "name": "Mumbai_Bandra", "lat": 19.0596, "lon": 72.8295, "base_pm25": 65.0},
        {"id": "BLR001", "name": "Bengaluru_BTM", "lat": 12.9166, "lon": 77.6101, "base_pm25": 38.0},
    ]

    fieldnames = [
        "timestamp", "station_id", "lat", "lon", 
        "aod", "temp_2m_k", "relative_humidity", 
        "wind_u", "wind_v", "pbl_height_m", 
        "fire_count_50km", "min_dist_fire_km", 
        "season", "cpcb_pm25"
    ]

    start_date = datetime(2026, 1, 1)
    random.seed(42)

    rows = []
    for i in range(num_records):
        st = random.choice(stations)
        date_offset = timedelta(days=random.randint(0, 300), hours=random.randint(0, 23))
        curr_time = start_date + date_offset
        month = curr_time.month

        # Determine season
        if month in [7, 8, 9]:
            season = "monsoon"
            seasonal_factor = 0.45
            fire_prob = 0.05
        elif month in [10, 11]:
            season = "post_monsoon_stubble"
            seasonal_factor = 1.85
            fire_prob = 0.70
        elif month in [12, 1, 2]:
            season = "winter"
            seasonal_factor = 1.50
            fire_prob = 0.25
        else:
            season = "summer"
            seasonal_factor = 0.90
            fire_prob = 0.20

        # Physical realistic synthetic feature distributions
        temp_k = 273.15 + random.uniform(12.0, 42.0)
        rh = random.uniform(25.0, 95.0)
        pblh = random.uniform(300.0, 2200.0) # Low PBLH traps pollutants
        wind_u = random.uniform(-6.0, 6.0)
        wind_v = random.uniform(-6.0, 6.0)
        wind_speed = math.sqrt(wind_u**2 + wind_v**2)

        has_fires = random.random() < fire_prob
        if has_fires:
            fire_count_50km = random.randint(3, 45)
            min_dist_fire_km = random.uniform(2.0, 48.0)
        else:
            fire_count_50km = 0
            min_dist_fire_km = 999.0

        # Ground truth PM2.5 calculation based on atmospheric physics
        # High AOD -> High PM2.5, Low PBLH -> High PM2.5, Stubble fires -> High PM2.5
        aod = random.uniform(0.12, 1.45) * seasonal_factor
        
        ventilation = max(pblh * max(wind_speed, 0.5), 200.0)
        dispersion_factor = 1500.0 / ventilation

        fire_impact = (fire_count_50km * 4.2) / max(min_dist_fire_km, 5.0)

        true_pm25 = (
            (st["base_pm25"] * seasonal_factor * 0.5) +
            (aod * 95.0) +
            (dispersion_factor * 35.0) +
            (fire_impact * 8.0) +
            (rh * 0.25) +
            random.gauss(0, 8.0)
        )
        true_pm25 = max(5.0, round(true_pm25, 2))

        rows.append({
            "timestamp": curr_time.isoformat(),
            "station_id": st["id"],
            "lat": st["lat"],
            "lon": st["lon"],
            "aod": round(aod, 4),
            "temp_2m_k": round(temp_k, 2),
            "relative_humidity": round(rh, 2),
            "wind_u": round(wind_u, 2),
            "wind_v": round(wind_v, 2),
            "pbl_height_m": round(pblh, 1),
            "fire_count_50km": fire_count_50km,
            "min_dist_fire_km": round(min_dist_fire_km, 2),
            "season": season,
            "cpcb_pm25": true_pm25
        })

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Dataset successfully created with {len(rows)} samples at: {output_path}")

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "data", "sample_master_dataset.csv")
    generate_sample_dataset(out)

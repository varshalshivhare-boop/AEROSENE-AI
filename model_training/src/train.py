"""
Training and spatial/temporal holdout validation script for Aerosense AI PM2.5 regressor.
Trains LightGBM regressor on engineered meteorological, spatial and satellite features.
"""
import os
import csv
import json
import math
import joblib
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from lightgbm import LGBMRegressor

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "sample_master_dataset.csv")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

def load_data(file_path):
    rows = []
    with open(file_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    return rows

def engineer_features(rows):
    X = []
    y = []
    stations = []
    seasons = []
    
    for r in rows:
        aod = float(r["aod"])
        temp = float(r["temp_2m_k"])
        rh = float(r["relative_humidity"])
        wu = float(r["wind_u"])
        wv = float(r["wind_v"])
        ws = math.sqrt(wu**2 + wv**2)
        pblh = float(r["pbl_height_m"])
        ventilation_idx = (ws * pblh) / 1000.0
        fire_count = float(r["fire_count_50km"])
        min_dist_fire = float(r["min_dist_fire_km"])
        
        features = [
            aod, temp, rh, ws, pblh, ventilation_idx, 
            fire_count, min_dist_fire
        ]
        
        X.append(features)
        y.append(float(r["cpcb_pm25"]))
        stations.append(r["station_id"])
        seasons.append(r["season"])
        
    return np.array(X), np.array(y), np.array(stations), np.array(seasons)

def train_and_validate():
    print(f"Loading training data from {DATA_PATH}...")
    rows = load_data(DATA_PATH)
    X, y, stations, seasons = engineer_features(rows)
    
    # Geographic Station Holdout (Prevents spatial data leakage)
    # Reserve Patna (PAT001) and Mumbai (MUM001) completely for evaluation
    holdout_stations = {"PAT001", "MUM001"}
    test_mask = np.isin(stations, list(holdout_stations))
    train_mask = ~test_mask
    
    X_train, y_train = X[train_mask], y[train_mask]
    X_test, y_test = X[test_mask], y[test_mask]
    seasons_test = seasons[test_mask]
    
    print(f"Train samples: {len(X_train)} | Geographic holdout test samples: {len(X_test)}")
    
    # LightGBM Regressor configured for robust tabular regression
    model = LGBMRegressor(
        n_estimators=150,
        learning_rate=0.05,
        num_leaves=31,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbosity=-1
    )
    
    print("Training LightGBM model...")
    model.fit(X_train, y_train)
    
    # Save Model
    model_output_path = os.path.join(ARTIFACTS_DIR, "pm25_lightgbm.joblib")
    joblib.dump(model, model_output_path)
    print(f"Trained model serialized to: {model_output_path}")
    
    # Evaluation on Holdout Stations
    y_pred = model.predict(X_test)
    overall_mae = float(mean_absolute_error(y_test, y_pred))
    overall_rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    overall_r2 = float(r2_score(y_test, y_pred))
    
    # Seasonal breakdown
    seasonal_metrics = {}
    unique_seasons = np.unique(seasons_test)
    for s in unique_seasons:
        s_mask = (seasons_test == s)
        if np.sum(s_mask) > 0:
            s_mae = float(mean_absolute_error(y_test[s_mask], y_pred[s_mask]))
            s_rmse = float(np.sqrt(mean_squared_error(y_test[s_mask], y_pred[s_mask])))
            s_r2 = float(r2_score(y_test[s_mask], y_pred[s_mask]))
            seasonal_metrics[s] = {
                "mae": round(s_mae, 2),
                "rmse": round(s_rmse, 2),
                "r2": round(s_r2, 3),
                "samples": int(np.sum(s_mask))
            }
            
    metrics_data = {
        "overall": {
            "mae": round(overall_mae, 2),
            "rmse": round(overall_rmse, 2),
            "r2": round(overall_r2, 3),
            "test_samples": len(y_test),
            "holdout_stations": list(holdout_stations)
        },
        "seasonal": seasonal_metrics,
        "features_used": [
            "aod", "temp_2m_k", "relative_humidity", 
            "wind_speed", "pbl_height_m", "ventilation_idx", 
            "fire_count_50km", "min_dist_fire_km"
        ]
    }
    
    metrics_path = os.path.join(ARTIFACTS_DIR, "metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)
        
    print("\n--- Model Evaluation Results (Held-Out Stations) ---")
    print(f"Overall MAE: {metrics_data['overall']['mae']} ug/m3")
    print(f"Overall RMSE: {metrics_data['overall']['rmse']} ug/m3")
    print(f"Overall R2 Score: {metrics_data['overall']['r2']}")
    print(f"Metrics saved to: {metrics_path}\n")

if __name__ == "__main__":
    train_and_validate()

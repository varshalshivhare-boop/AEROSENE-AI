"""
Aerosense AI — Phase 2: Model Evaluation & Diagnostics
-------------------------------------------------------
Generates:
  • Residual plot (Predicted vs Actual)
  • Feature importance bar chart
  • Season-wise and zone-wise metric tables (printed + saved to metrics.json)
"""
import os, sys, json, csv, math
import numpy as np
import matplotlib
matplotlib.use("Agg")   # headless — no display required
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib

BASE_DIR      = os.path.dirname(os.path.dirname(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
DATA_PATH     = os.path.join(BASE_DIR, "data", "sample_master_dataset.csv")
PLOTS_DIR     = os.path.join(BASE_DIR, "artifacts", "plots")
os.makedirs(PLOTS_DIR, exist_ok=True)

FEATURE_COLS = [
    "aod", "hcho_mol_m2",
    "temp_2m_k", "relative_humidity",
    "wind_speed", "pbl_height_m",
    "ventilation_idx", "log_ventilation",
    "fire_count_50km", "min_dist_fire_km", "fire_impact_score",
    "aod_rh_interaction", "season_sin", "season_cos",
]

CPCB_PALETTE = {
    "monsoon":       "#4CAF50",
    "post_monsoon":  "#FF9800",
    "winter":        "#2196F3",
    "summer":        "#FF5722",
}


def load_data():
    rows = []
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)
    X, y, groups, seasons = [], [], [], []
    for r in rows:
        X.append([float(r[c]) for c in FEATURE_COLS])
        y.append(float(r["cpcb_pm25"]))
        groups.append(r["zone"])
        seasons.append(r["season"])
    return (np.array(X, dtype=np.float32), np.array(y),
            np.array(groups), np.array(seasons))


def compute_metrics(y_true, y_pred):
    return {
        "mae":  round(float(mean_absolute_error(y_true, y_pred)), 2),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 2),
        "r2":   round(float(r2_score(y_true, y_pred)), 3),
        "samples": int(len(y_true)),
    }


def blend(lgb, xgb, X, w=0.60):
    return w * lgb.predict(X) + (1 - w) * xgb.predict(X)


def plot_residuals(y_true, y_pred, seasons, path):
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    fig.suptitle("Aerosense AI — PM2.5 Ensemble Residual Diagnostics", fontsize=13, fontweight="bold")

    # Scatter: Predicted vs Actual (coloured by season)
    ax = axes[0]
    unique_seasons = np.unique(seasons)
    for s in unique_seasons:
        m = seasons == s
        ax.scatter(y_true[m], y_pred[m], alpha=0.35, s=10,
                   color=CPCB_PALETTE.get(s, "#9C27B0"), label=s)

    lims = [0, max(y_true.max(), y_pred.max()) * 1.05]
    ax.plot(lims, lims, "k--", linewidth=1.0, label="Perfect fit")
    ax.set_xlim(lims); ax.set_ylim(lims)
    ax.set_xlabel("Actual PM2.5 (μg/m³)"); ax.set_ylabel("Predicted PM2.5 (μg/m³)")
    ax.set_title("Predicted vs Actual")
    ax.legend(markerscale=2.5, fontsize=8)
    r2 = round(float(r2_score(y_true, y_pred)), 3)
    ax.annotate(f"R² = {r2}", xy=(0.05, 0.92), xycoords="axes fraction",
                fontsize=10, fontweight="bold", color="#D32F2F")

    # Residual distribution histogram
    residuals = y_pred - y_true
    ax2 = axes[1]
    ax2.hist(residuals, bins=50, color="#1976D2", edgecolor="white", alpha=0.85)
    ax2.axvline(0, color="red", linewidth=1.5, linestyle="--")
    ax2.axvline(residuals.mean(), color="orange", linewidth=1.5, linestyle="-",
                label=f"Mean={residuals.mean():.1f}")
    ax2.set_xlabel("Residual (Predicted − Actual) μg/m³")
    ax2.set_ylabel("Count")
    ax2.set_title("Residual Distribution")
    ax2.legend(fontsize=9)

    plt.tight_layout()
    plt.savefig(path, dpi=120, bbox_inches="tight")
    plt.close()
    print(f"[evaluate] Residual plot saved → {path}")


def plot_feature_importance(lgb_model, path):
    fi  = lgb_model.feature_importances_
    tot = fi.sum() or 1.0
    pct = fi / tot * 100.0
    order = np.argsort(pct)
    names  = [FEATURE_COLS[i] for i in order]
    values = pct[order]

    fig, ax = plt.subplots(figsize=(8, 6))
    bars = ax.barh(names, values, color="#00897B", edgecolor="white")
    ax.bar_label(bars, fmt="%.1f%%", padding=3, fontsize=8)
    ax.set_xlabel("Feature Importance (% gain)")
    ax.set_title("LightGBM Feature Importance — Aerosense AI PM2.5 Model", fontsize=11, fontweight="bold")
    ax.set_xlim(0, values.max() * 1.18)
    plt.tight_layout()
    plt.savefig(path, dpi=120, bbox_inches="tight")
    plt.close()
    print(f"[evaluate] Feature importance plot saved → {path}")


def run_evaluation():
    print(f"\n{'='*60}")
    print("  Aerosense AI — Phase 2: Evaluation & Diagnostics")
    print(f"{'='*60}\n")

    lgb_path = os.path.join(ARTIFACTS_DIR, "pm25_lightgbm.joblib")
    xgb_path = os.path.join(ARTIFACTS_DIR, "pm25_xgboost.joblib")

    if not os.path.exists(lgb_path):
        print("[evaluate] ERROR: Model not found. Run `train.py` first.")
        sys.exit(1)

    lgb_model = joblib.load(lgb_path)
    xgb_model = joblib.load(xgb_path) if os.path.exists(xgb_path) else None
    print("[evaluate] Models loaded.")

    X, y, groups, seasons = load_data()
    if xgb_model:
        preds = blend(lgb_model, xgb_model, X)
    else:
        preds = lgb_model.predict(X)

    # Overall metrics
    overall = compute_metrics(y, preds)
    print(f"\n[evaluate] Overall (full dataset, ensemble predictions):")
    print(f"  MAE  : {overall['mae']} ug/m3")
    print(f"  RMSE : {overall['rmse']} ug/m3")
    print(f"  R²   : {overall['r2']}")

    # Seasonal breakdown
    print(f"\n[evaluate] Seasonal Breakdown:")
    seasonal = {}
    for s in np.unique(seasons):
        m = seasons == s
        sm = compute_metrics(y[m], preds[m])
        seasonal[s] = sm
        print(f"  {s:<22}  MAE={sm['mae']:.1f}  RMSE={sm['rmse']:.1f}  R²={sm['r2']:.3f}  n={sm['samples']}")

    # Zone breakdown
    print(f"\n[evaluate] Zone Breakdown:")
    zone_m = {}
    for z in np.unique(groups):
        m = groups == z
        zm = compute_metrics(y[m], preds[m])
        zone_m[z] = zm
        print(f"  {z:<8}  MAE={zm['mae']:.1f}  RMSE={zm['rmse']:.1f}  R²={zm['r2']:.3f}  n={zm['samples']}")

    # Update metrics.json with evaluation diagnostics
    metrics_path = os.path.join(ARTIFACTS_DIR, "metrics.json")
    existing = {}
    if os.path.exists(metrics_path):
        with open(metrics_path, "r", encoding="utf-8") as f:
            existing = json.load(f)

    existing["evaluation_on_full_train"] = {
        "note": "Diagnostic only — not a generalisation estimate. Use CV metrics for that.",
        "overall": overall,
        "seasonal": seasonal,
        "zone": zone_m,
    }
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2)
    print(f"\n[evaluate] metrics.json updated → {metrics_path}")

    # Plots
    plot_residuals(y, preds, seasons,
                   os.path.join(PLOTS_DIR, "residuals.png"))
    plot_feature_importance(lgb_model,
                            os.path.join(PLOTS_DIR, "feature_importance.png"))

    print(f"\n{'='*60}")
    print("  EVALUATION COMPLETE")
    print(f"  Plots saved in: {PLOTS_DIR}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    run_evaluation()

"""
Aerosense AI — Phase 2: Improved Inference Engine
---------------------------------------------------
PM25Estimator supports:
  • Single-record and batch prediction
  • Automatic feature derivation from raw inputs
  • Cloud-masking guard (returns NO_DATA for heavy cloud cover)
  • Confidence scoring based on cloud fraction & AOD reliability
  • Lazy-loading of model artifacts (first call initializes)
"""
import os, math, json
import numpy as np
import joblib

BASE_DIR      = os.path.dirname(os.path.dirname(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")

# Matches train.py FEATURE_COLS exactly
FEATURE_COLS = [
    "aod", "hcho_mol_m2",
    "temp_2m_k", "relative_humidity",
    "wind_speed", "pbl_height_m",
    "ventilation_idx", "log_ventilation",
    "fire_count_50km", "min_dist_fire_km", "fire_impact_score",
    "aod_rh_interaction", "season_sin", "season_cos",
]

LGB_WEIGHT = 0.60
XGB_WEIGHT = 0.40


class PM25Estimator:
    """
    Lazy-loading ensemble estimator for surface PM2.5.

    Usage:
        est = PM25Estimator()
        result = est.predict({
            "aod": 0.85, "temp_2m_k": 302.0, "relative_humidity": 55.0,
            "wind_u": 2.1, "wind_v": -1.2, "pbl_height_m": 850.0,
            "fire_count_50km": 12, "min_dist_fire_km": 14.5,
            "cloud_fraction": 0.1
        })
        batch_results = est.predict_batch([dict1, dict2, ...])
    """

    def __init__(self, artifacts_dir: str = ARTIFACTS_DIR):
        self.artifacts_dir = artifacts_dir
        self._lgb = None
        self._xgb = None
        self._metrics = None

    # ── Lazy model loading ──────────────────────────────────────
    def _load(self):
        lgb_path = os.path.join(self.artifacts_dir, "pm25_lightgbm.joblib")
        xgb_path = os.path.join(self.artifacts_dir, "pm25_xgboost.joblib")
        self._lgb = joblib.load(lgb_path) if os.path.exists(lgb_path) else None
        self._xgb = joblib.load(xgb_path) if os.path.exists(xgb_path) else None

    @property
    def lgb(self):
        if self._lgb is None:
            self._load()
        return self._lgb

    @property
    def xgb(self):
        if self._xgb is None:
            self._load()
        return self._xgb

    # ── Internal: derive all engineered features from raw inputs ─
    @staticmethod
    def _derive_features(raw: dict) -> dict | None:
        """
        Returns full feature dict from raw inputs, or None if cloud-masked.
        """
        cloud_frac = float(raw.get("cloud_fraction", 0.0))
        aod        = raw.get("aod")

        # Cloud masking — satellite AOD unreliable above 70% cloud cover
        if aod is None or cloud_frac > 0.70:
            return None

        aod  = float(aod)
        rh   = float(raw.get("relative_humidity", 55.0))
        temp = float(raw.get("temp_2m_k", 298.15))
        pblh = max(float(raw.get("pbl_height_m", 800.0)), 50.0)

        wu = float(raw.get("wind_u", 0.0))
        wv = float(raw.get("wind_v", 0.0))
        ws = math.sqrt(wu**2 + wv**2)

        ventilation_idx = max((ws * pblh) / 1000.0, 0.01)
        log_ventilation = math.log(ventilation_idx + 1.0)

        fire_count  = float(raw.get("fire_count_50km", 0))
        min_dist_km = float(raw.get("min_dist_fire_km", 999.0))
        fire_impact = (fire_count * 5.0) / max(min_dist_km, 4.0) if fire_count > 0 else 0.0

        hcho             = float(raw.get("hcho_mol_m2", 0.00012))
        aod_rh_inter     = aod * (rh / 100.0)

        # Cyclical temporal encoding
        doy        = int(raw.get("day_of_year", 180))
        season_sin = math.sin(2 * math.pi * doy / 365.0)
        season_cos = math.cos(2 * math.pi * doy / 365.0)

        return {
            "aod": aod,
            "hcho_mol_m2": hcho,
            "temp_2m_k": temp,
            "relative_humidity": rh,
            "wind_speed": ws,
            "pbl_height_m": pblh,
            "ventilation_idx": ventilation_idx,
            "log_ventilation": log_ventilation,
            "fire_count_50km": fire_count,
            "min_dist_fire_km": min_dist_km,
            "fire_impact_score": fire_impact,
            "aod_rh_interaction": aod_rh_inter,
            "season_sin": season_sin,
            "season_cos": season_cos,
            # extras for response
            "_cloud_frac": cloud_frac,
            "_wind_speed": ws,
            "_ventilation_idx": ventilation_idx,
        }

    @staticmethod
    def _confidence(cloud_frac: float, aod: float) -> str:
        if cloud_frac > 0.40 or aod > 2.0:
            return "MEDIUM"
        return "HIGH"

    def _run_models(self, feature_vec: np.ndarray) -> float:
        """Ensemble inference: blend LGB + XGB or fall back to physics."""
        lgb_pred = float(self.lgb.predict(feature_vec)[0]) if self.lgb else None
        xgb_pred = float(self.xgb.predict(feature_vec)[0]) if self.xgb else None

        if lgb_pred is not None and xgb_pred is not None:
            return LGB_WEIGHT * lgb_pred + XGB_WEIGHT * xgb_pred
        if lgb_pred is not None:
            return lgb_pred
        if xgb_pred is not None:
            return xgb_pred

        # Physics fallback (no model artifacts yet)
        aod  = feature_vec[0, 0]
        pblh = feature_vec[0, 5]
        fire = feature_vec[0, 10]
        return float(aod * 90.0 + 1200.0 / max(pblh, 200.0) * 25.0 + fire * 6.0)

    # ── Public API ──────────────────────────────────────────────
    def predict(self, raw_features: dict) -> dict:
        """Single-record prediction."""
        derived = self._derive_features(raw_features)

        if derived is None:
            return {
                "pm25_estimate": None,
                "confidence": "LOW_CLOUD_COVER",
                "status": "NO_DATA",
                "reason": "Cloud cover > 70% — satellite AOD unreliable.",
            }

        cloud_frac = derived.pop("_cloud_frac")
        ws         = derived.pop("_wind_speed")
        vent       = derived.pop("_ventilation_idx")

        fvec  = np.array([[derived[c] for c in FEATURE_COLS]], dtype=np.float32)
        est   = max(1.0, round(self._run_models(fvec), 2))
        conf  = self._confidence(cloud_frac, derived["aod"])

        return {
            "pm25_estimate": est,
            "confidence": conf,
            "status": "VALID",
            "derived": {
                "wind_speed_ms":    round(ws,   2),
                "ventilation_idx":  round(vent, 2),
                "fire_impact_score": round(derived["fire_impact_score"], 2),
            },
        }

    def predict_batch(self, records: list[dict]) -> list[dict]:
        """Vectorised batch prediction. Returns one result dict per record."""
        results, valid_idxs, fvecs, extras = [], [], [], []

        for i, raw in enumerate(records):
            derived = self._derive_features(raw)
            if derived is None:
                results.append({
                    "index": i,
                    "pm25_estimate": None,
                    "confidence": "LOW_CLOUD_COVER",
                    "status": "NO_DATA",
                })
            else:
                cloud_frac = derived.pop("_cloud_frac")
                ws         = derived.pop("_wind_speed")
                vent       = derived.pop("_ventilation_idx")
                extras.append((cloud_frac, ws, vent, derived))
                fvecs.append([derived[c] for c in FEATURE_COLS])
                valid_idxs.append(i)
                results.append(None)  # placeholder

        if fvecs:
            batch_arr = np.array(fvecs, dtype=np.float32)
            lgb_preds = self.lgb.predict(batch_arr) if self.lgb else np.zeros(len(fvecs))
            xgb_preds = self.xgb.predict(batch_arr) if self.xgb else np.zeros(len(fvecs))
            blended   = LGB_WEIGHT * lgb_preds + XGB_WEIGHT * xgb_preds

            for rank, i in enumerate(valid_idxs):
                cloud_frac, ws, vent, derived = extras[rank]
                est  = max(1.0, round(float(blended[rank]), 2))
                conf = self._confidence(cloud_frac, derived["aod"])
                results[i] = {
                    "index": i,
                    "pm25_estimate": est,
                    "confidence": conf,
                    "status": "VALID",
                    "derived": {
                        "wind_speed_ms":    round(ws,   2),
                        "ventilation_idx":  round(vent, 2),
                        "fire_impact_score": round(derived["fire_impact_score"], 2),
                    },
                }

        return results

    def load_metrics(self) -> dict:
        """Return saved validation metrics from artifacts/metrics.json."""
        path = os.path.join(self.artifacts_dir, "metrics.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}


# ── Functional interface (matches data contract) ────────────────────────────
_instance: PM25Estimator | None = None

def predict_surface_pm25(features_dict: dict) -> dict:
    """Stateless functional wrapper. Matches Phase 2 data contract."""
    global _instance
    if _instance is None:
        _instance = PM25Estimator()
    return _instance.predict(features_dict)

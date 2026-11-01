"""
CPCB Breakpoint Calculation & Health Advisory Engine
Bridges Phase 4 API to the authentic Phase 3 analysis_core/src/cpcb_aqi.py implementation.
Falls back to built-in breakpoints if Phase 3 module is not available.
"""
import os
import sys

# ── Dynamic link to Phase 3 analysis_core ───────────────────────
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ANALYSIS_CORE_SRC = os.path.join(_REPO_ROOT, "analysis_core", "src")

if ANALYSIS_CORE_SRC not in sys.path and os.path.exists(ANALYSIS_CORE_SRC):
    sys.path.insert(0, ANALYSIS_CORE_SRC)

try:
    from cpcb_aqi import calculate_pm25_aqi as _authentic_pm25_aqi
    _HAS_ANALYSIS_CORE = True
    print(f"✅ CPCB AQI (Phase 3) loaded from {ANALYSIS_CORE_SRC}")
except Exception as e:
    print(f"⚠ Phase 3 cpcb_aqi unavailable ({e}). Using built-in breakpoints.")
    _HAS_ANALYSIS_CORE = False


# Built-in fallback breakpoints (same as Phase 4 original)
PM25_BREAKPOINTS = [
    {"b_low": 0.0,   "b_high": 30.0,  "i_low": 0,   "i_high": 50,  "cat": "Good",          "color": "#00E400", "advisory": "Air quality is considered satisfactory, and air pollution poses little or no risk."},
    {"b_low": 30.1,  "b_high": 60.0,  "i_low": 51,  "i_high": 100, "cat": "Satisfactory",  "color": "#92D050", "advisory": "Minor breathing discomfort to sensitive people."},
    {"b_low": 60.1,  "b_high": 90.0,  "i_low": 101, "i_high": 200, "cat": "Moderate",      "color": "#FFFF00", "advisory": "Breathing discomfort to the people with lungs, asthma and heart diseases."},
    {"b_low": 90.1,  "b_high": 120.0, "i_low": 201, "i_high": 300, "cat": "Poor",          "color": "#FF7E00", "advisory": "Breathing discomfort to most people on prolonged exposure."},
    {"b_low": 120.1, "b_high": 250.0, "i_low": 301, "i_high": 400, "cat": "Very Poor",     "color": "#FF0000", "advisory": "Respiratory illness on prolonged exposure."},
    {"b_low": 250.1, "b_high": 500.0, "i_low": 401, "i_high": 500, "cat": "Severe",        "color": "#7E0023", "advisory": "Affects healthy people and seriously impacts those with existing diseases."},
]

def _fallback_aqi(pm25: float | None) -> dict:
    """Built-in fallback calculator."""
    if pm25 is None or pm25 < 0:
        return {
            "aqi": None,
            "category": "Unavailable",
            "color": "#9E9E9E",
            "advisory": "Sensor obscured by cloud cover or missing observations."
        }

    concentration = min(float(pm25), 500.0)

    for bp in PM25_BREAKPOINTS:
        if bp["b_low"] <= concentration <= bp["b_high"]:
            aqi = ((bp["i_high"] - bp["i_low"]) / (bp["b_high"] - bp["b_low"])) * (concentration - bp["b_low"]) + bp["i_low"]
            aqi = int(round(aqi))
            return {
                "aqi": aqi,
                "category": bp["cat"],
                "color": bp["color"],
                "advisory": bp["advisory"]
            }

    return {
        "aqi": 500,
        "category": "Severe+",
        "color": "#4A0014",
        "advisory": "Emergency air quality conditions."
    }


def calculate_cpcb_aqi(pm25: float | None) -> dict:
    """
    Delegates to authentic Phase 3 CPCB AQI calculator if available,
    otherwise falls back to built-in breakpoints.
    """
    if pm25 is None or pm25 < 0:
        return {
            "aqi": None,
            "category": "Unavailable",
            "color": "#9E9E9E",
            "advisory": "Sensor obscured by cloud cover or missing observations."
        }

    if _HAS_ANALYSIS_CORE:
        try:
            result = _authentic_pm25_aqi(float(pm25))
            return {
                "aqi": result["aqi"],
                "category": result["category"],
                "color": result["hex_color"],
                "advisory": result["health_advisory"]
            }
        except Exception:
            pass

    return _fallback_aqi(pm25)

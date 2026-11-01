"""CPCB Air Quality Index (AQI) Calculator.

This module implements the official Central Pollution Control Board (CPCB) India
National Air Quality Index (NAQI) linear piecewise formula and breakpoints
defined in the CPCB NAQI Technical Guidelines (2014).

Piecewise Linear Formula:
    Ip = I_low + ((I_high - I_low) / (B_high - B_low)) * (Cp - B_low)

Where:
    Cp     = Measured pollutant concentration
    B_low  = Lower concentration breakpoint enclosing Cp
    B_high = Upper concentration breakpoint enclosing Cp
    I_low  = Sub-index value corresponding to B_low
    I_high = Sub-index value corresponding to B_high
    Ip     = Pollutant sub-index (AQI score)
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple, Union



# Official CPCB PM2.5 Breakpoints:
# Each tuple: (B_low, B_high, I_low, I_high, category, hex_color, health_advisory)
# 0-30 (Good: 0-50), 31-60 (Satisfactory: 51-100), 61-90 (Moderate: 101-200),
# 91-120 (Poor: 201-300), 121-250 (Very Poor: 301-400), 250+ (Severe: 401-500)
PM25_BREAKPOINTS: List[Tuple[float, float, float, float, str, str, str]] = [
    (
        0.0,
        30.0,
        0.0,
        50.0,
        "Good",
        "#00B050",
        "Minimal impact.",
    ),
    (
        31.0,
        60.0,
        51.0,
        100.0,
        "Satisfactory",
        "#92D050",
        "Minor breathing discomfort to sensitive people.",
    ),
    (
        61.0,
        90.0,
        101.0,
        200.0,
        "Moderate",
        "#FFFF00",
        "Breathing discomfort to people with lungs, asthma and heart diseases.",
    ),
    (
        91.0,
        120.0,
        201.0,
        300.0,
        "Poor",
        "#FF9900",
        "Breathing discomfort to most people on prolonged exposure.",
    ),
    (
        121.0,
        250.0,
        301.0,
        400.0,
        "Very Poor",
        "#FF0000",
        "Respiratory illness on prolonged exposure.",
    ),
    (
        250.0,
        500.0,
        401.0,
        500.0,
        "Severe",
        "#800000",
        "Affects healthy people and seriously impacts those with existing cardiorespiratory conditions.",
    ),
]

# Standard CPCB Color Scheme Mapping
AQI_COLORS: Dict[str, str] = {
    "Good": "#00B050",
    "Satisfactory": "#92D050",
    "Moderate": "#FFFF00",
    "Poor": "#FF9900",
    "Very Poor": "#FF0000",
    "Severe": "#800000",
}

# Standard CPCB Health Advisories
AQI_ADVISORIES: Dict[str, str] = {
    "Good": "Minimal impact.",
    "Satisfactory": "Minor breathing discomfort to sensitive people.",
    "Moderate": "Breathing discomfort to people with lungs, asthma and heart diseases.",
    "Poor": "Breathing discomfort to most people on prolonged exposure.",
    "Very Poor": "Respiratory illness on prolonged exposure.",
    "Severe": "Affects healthy people and seriously impacts those with existing cardiorespiratory conditions.",
}


def cpcb_linear_piecewise(
    cp: float,
    b_low: float,
    b_high: float,
    i_low: float,
    i_high: float,
) -> float:
    """Computes the CPCB sub-index using linear piecewise interpolation.

    Formula:
        Ip = I_low + ((I_high - I_low) / (B_high - B_low)) * (Cp - B_low)

    Args:
        cp: Pollutant concentration.
        b_low: Lower concentration breakpoint.
        b_high: Upper concentration breakpoint.
        i_low: Lower sub-index value.
        i_high: Upper sub-index value.

    Returns:
        Interpolated sub-index as a float.
    """
    if b_high == b_low:
        return float(i_low)
    return i_low + ((i_high - i_low) / (b_high - b_low)) * (cp - b_low)


def calculate_pm25_aqi(
    cp: Union[int, float],
    clamp_extreme: bool = True,
    severe_b_high: float = 500.0,
) -> Dict[str, Any]:
    """Calculates official CPCB AQI for PM2.5 (24-hour average in ug/m3).

    Official PM2.5 Breakpoints:
        0 - 30   -> Good (0 - 50)
        31 - 60  -> Satisfactory (51 - 100)
        61 - 90  -> Moderate (101 - 200)
        91 - 120 -> Poor (201 - 300)
        121 - 250 -> Very Poor (301 - 400)
        250+     -> Severe (401 - 500)

    Args:
        cp: PM2.5 concentration in ug/m3.
        clamp_extreme: If True (default), caps AQI at 500 for extreme concentrations
            exceeding severe threshold, per CPCB standard reporting.
            If False, extrapolates linear formula beyond 500.
        severe_b_high: Upper concentration bound for the Severe bracket (default 500 ug/m3).

    Returns:
        Dictionary containing:
            - 'aqi': Integer AQI score.
            - 'aqi_score': Alias for 'aqi'.
            - 'category': AQI category name (e.g. 'Good', 'Severe').
            - 'category_name': Alias for 'category'.
            - 'hex_color': Official CPCB hex color code (e.g. '#00B050').
            - 'color_code': Alias for 'hex_color'.
            - 'health_advisory': Official health advisory text.
            - 'advisory_text': Alias for 'health_advisory'.
            - 'concentration': Input concentration.
            - 'breakpoints': Tuple (B_low, B_high, I_low, I_high) used.

    Raises:
        TypeError: If cp is not a real number.
        ValueError: If cp is negative or NaN/Infinite.
    """
    if isinstance(cp, bool) or not isinstance(cp, (int, float)):
        raise TypeError(f"PM2.5 concentration must be a numeric value, got {type(cp).__name__}: {cp}")

    if math.isnan(cp) or math.isinf(cp):
        raise ValueError(f"PM2.5 concentration cannot be NaN or Infinite: {cp}")

    if cp < 0:
        raise ValueError(f"PM2.5 concentration cannot be negative: {cp} ug/m3")

    cp_float = float(cp)

    # 1. Good: 0 - 30
    if cp_float <= 30.0:
        b_low, b_high, i_low, i_high = 0.0, 30.0, 0.0, 50.0
        category = "Good"
    # 2. Satisfactory: 30 < cp <= 60 (official bracket covers 31-60)
    elif cp_float <= 60.0:
        b_low, b_high, i_low, i_high = 30.0 if cp_float <= 31.0 else 31.0, 60.0, 51.0, 100.0
        # If between 30 and 31, bridge smoothly from 30 to 60 or use standard (31, 60)
        b_low = 31.0
        i_low = 51.0
        # If cp is strictly between 30 and 31, CPCB linear scaling treats B_low as 30 for continuity
        if cp_float < 31.0:
            b_low = 30.0
            i_low = 50.0
        category = "Satisfactory"
    # 3. Moderate: 60 < cp <= 90 (official bracket 61-90)
    elif cp_float <= 90.0:
        b_low = 61.0
        i_low = 101.0
        if cp_float < 61.0:
            b_low = 60.0
            i_low = 100.0
        b_high = 90.0
        i_high = 200.0
        category = "Moderate"
    # 4. Poor: 90 < cp <= 120 (official bracket 91-120)
    elif cp_float <= 120.0:
        b_low = 91.0
        i_low = 201.0
        if cp_float < 91.0:
            b_low = 90.0
            i_low = 200.0
        b_high = 120.0
        i_high = 300.0
        category = "Poor"
    # 5. Very Poor: 120 < cp <= 250 (official bracket 121-250)
    elif cp_float <= 250.0:
        b_low = 121.0
        i_low = 301.0
        if cp_float < 121.0:
            b_low = 120.0
            i_low = 300.0
        b_high = 250.0
        i_high = 400.0
        category = "Very Poor"
    # 6. Severe: 250+ (official bracket 250+)
    else:
        b_low = 250.0
        b_high = max(severe_b_high, 251.0)
        i_low = 401.0
        i_high = 500.0
        category = "Severe"

    # Compute piecewise linear sub-index
    raw_subindex = cpcb_linear_piecewise(cp_float, b_low, b_high, i_low, i_high)

    # For severe concentrations exceeding B_high (e.g. extreme values > 500 or > 1000 ug/m3)
    if cp_float >= severe_b_high:
        if clamp_extreme:
            aqi_score = 500
        else:
            aqi_score = int(round(raw_subindex))
    else:
        aqi_score = int(round(raw_subindex))

    # In CPCB, AQI is capped at 500 if clamping is enabled
    if clamp_extreme and aqi_score > 500:
        aqi_score = 500

    hex_color = AQI_COLORS[category]
    health_advisory = AQI_ADVISORIES[category]

    return {
        "aqi": aqi_score,
        "aqi_score": aqi_score,
        "category": category,
        "category_name": category,
        "hex_color": hex_color,
        "color_code": hex_color,
        "health_advisory": health_advisory,
        "advisory_text": health_advisory,
        "concentration": cp_float,
        "breakpoints": (b_low, b_high, i_low, i_high),
    }


def calculate_cpcb_aqi(
    pollutant: str,
    concentration: Union[int, float],
    **kwargs: Any,
) -> Dict[str, Any]:
    """General dispatcher for CPCB AQI calculation by pollutant name.

    Args:
        pollutant: Pollutant identifier (e.g. 'PM2.5', 'pm25').
        concentration: Measured 24-hr concentration.
        **kwargs: Optional keyword arguments passed to pollutant calculator.

    Returns:
        AQI result dictionary.
    """
    clean_pollutant = pollutant.strip().upper().replace(" ", "").replace(".", "")
    if clean_pollutant in ("PM25", "PM2_5"):
        return calculate_pm25_aqi(concentration, **kwargs)
    raise NotImplementedError(
        f"Pollutant '{pollutant}' is not currently configured. Supported: 'PM2.5'"
    )

"""Pytest suite for CPCB AQI Calculator.

Validates official CPCB piecewise linear formula, PM2.5 breakpoints,
dictionary return structure, hex colors, health advisories, and edge cases
(e.g., negative inputs, extreme values > 1000 ug/m3).
"""

import math
import pytest

from src.cpcb_aqi import (
    AQI_ADVISORIES,
    AQI_COLORS,
    PM25_BREAKPOINTS,
    calculate_cpcb_aqi,
    calculate_pm25_aqi,
    cpcb_linear_piecewise,
)


class TestCPCBFormula:
    """Tests for the mathematical piecewise linear formula."""

    def test_linear_piecewise_formula_direct(self):
        # Ip = I_low + ((I_high - I_low) / (B_high - B_low)) * (Cp - B_low)
        # Good bracket: B_low=0, B_high=30, I_low=0, I_high=50
        # For Cp=15, expected Ip = 0 + (50 / 30) * 15 = 25.0
        assert cpcb_linear_piecewise(15.0, 0.0, 30.0, 0.0, 50.0) == pytest.approx(25.0)

        # Satisfactory bracket: B_low=31, B_high=60, I_low=51, I_high=100
        # For Cp=45.5: 51 + ((100-51) / (60-31)) * (45.5-31) = 51 + (49/29) * 14.5 = 75.5
        assert cpcb_linear_piecewise(45.5, 31.0, 60.0, 51.0, 100.0) == pytest.approx(75.5)

    def test_linear_piecewise_equal_bounds(self):
        # Prevent division by zero if bounds are equal
        assert cpcb_linear_piecewise(50.0, 50.0, 50.0, 100.0, 100.0) == 100.0


class TestPM25Breakpoints:
    """Tests for all 6 official CPCB PM2.5 categories and breakpoints."""

    def test_good_category_and_bounds(self):
        # 0 - 30 -> Good (0 - 50)
        res_0 = calculate_pm25_aqi(0)
        assert res_0["aqi"] == 0
        assert res_0["category"] == "Good"
        assert res_0["hex_color"] == "#00B050"
        assert res_0["health_advisory"] == "Minimal impact."

        res_15 = calculate_pm25_aqi(15)
        assert res_15["aqi"] == 25
        assert res_15["category"] == "Good"

        res_30 = calculate_pm25_aqi(30)
        assert res_30["aqi"] == 50
        assert res_30["category"] == "Good"

    def test_satisfactory_category_and_bounds(self):
        # 31 - 60 -> Satisfactory (51 - 100)
        res_31 = calculate_pm25_aqi(31)
        assert res_31["aqi"] == 51
        assert res_31["category"] == "Satisfactory"
        assert res_31["hex_color"] == "#92D050"
        assert "Minor breathing discomfort" in res_31["health_advisory"]

        res_60 = calculate_pm25_aqi(60)
        assert res_60["aqi"] == 100
        assert res_60["category"] == "Satisfactory"

    def test_moderate_category_and_bounds(self):
        # 61 - 90 -> Moderate (101 - 200)
        res_61 = calculate_pm25_aqi(61)
        assert res_61["aqi"] == 101
        assert res_61["category"] == "Moderate"
        assert res_61["hex_color"] == "#FFFF00"
        assert "lungs, asthma" in res_61["health_advisory"]

        res_90 = calculate_pm25_aqi(90)
        assert res_90["aqi"] == 200
        assert res_90["category"] == "Moderate"

    def test_poor_category_and_bounds(self):
        # 91 - 120 -> Poor (201 - 300)
        res_91 = calculate_pm25_aqi(91)
        assert res_91["aqi"] == 201
        assert res_91["category"] == "Poor"
        assert res_91["hex_color"] == "#FF9900"
        assert "prolonged exposure" in res_91["health_advisory"]

        res_120 = calculate_pm25_aqi(120)
        assert res_120["aqi"] == 300
        assert res_120["category"] == "Poor"

    def test_very_poor_category_and_bounds(self):
        # 121 - 250 -> Very Poor (301 - 400)
        res_121 = calculate_pm25_aqi(121)
        assert res_121["aqi"] == 301
        assert res_121["category"] == "Very Poor"
        assert res_121["hex_color"] == "#FF0000"
        assert "Respiratory illness" in res_121["health_advisory"]

        res_250 = calculate_pm25_aqi(250)
        assert res_250["aqi"] == 400
        assert res_250["category"] == "Very Poor"

    def test_severe_category_and_bounds(self):
        # 250+ -> Severe (401 - 500)
        res_251 = calculate_pm25_aqi(251)
        assert res_251["aqi"] >= 401
        assert res_251["category"] == "Severe"
        assert res_251["hex_color"] == "#800000"
        assert "existing cardiorespiratory" in res_251["health_advisory"]

        res_375 = calculate_pm25_aqi(375)
        assert res_375["category"] == "Severe"
        assert 401 <= res_375["aqi"] <= 500


class TestReturnStructureAndAliases:
    """Tests the return dictionary structure and key aliases."""

    def test_required_dictionary_keys(self):
        res = calculate_pm25_aqi(75)

        # Standard keys and aliases
        assert "aqi" in res and "aqi_score" in res
        assert "category" in res and "category_name" in res
        assert "hex_color" in res and "color_code" in res
        assert "health_advisory" in res and "advisory_text" in res

        assert res["aqi"] == res["aqi_score"]
        assert res["category"] == res["category_name"]
        assert res["hex_color"] == res["color_code"]
        assert res["health_advisory"] == res["advisory_text"]

    def test_general_dispatcher(self):
        res = calculate_cpcb_aqi("PM2.5", 45)
        assert res["category"] == "Satisfactory"

        res_lower = calculate_cpcb_aqi("pm25", 80)
        assert res_lower["category"] == "Moderate"

        with pytest.raises(NotImplementedError):
            calculate_cpcb_aqi("UNSUPPORTED_POLLUTANT", 50)


class TestEdgeCases:
    """Tests for edge cases including negative inputs, extreme values > 1000 ug/m3, etc."""

    def test_negative_concentration_raises_value_error(self):
        with pytest.raises(ValueError, match="cannot be negative"):
            calculate_pm25_aqi(-1)

        with pytest.raises(ValueError, match="cannot be negative"):
            calculate_pm25_aqi(-50.5)

    def test_non_numeric_and_nan_inputs(self):
        with pytest.raises(TypeError):
            calculate_pm25_aqi("invalid")

        with pytest.raises(TypeError):
            calculate_pm25_aqi(None)

        with pytest.raises(TypeError):
            calculate_pm25_aqi(True)

        with pytest.raises(ValueError):
            calculate_pm25_aqi(float("nan"))

        with pytest.raises(ValueError):
            calculate_pm25_aqi(float("inf"))

    def test_extreme_values_greater_than_1000_clamped(self):
        # Standard CPCB scale caps at 500
        res_500 = calculate_pm25_aqi(500)
        assert res_500["aqi"] == 500
        assert res_500["category"] == "Severe"

        res_800 = calculate_pm25_aqi(800)
        assert res_800["aqi"] == 500
        assert res_800["category"] == "Severe"

        res_1000 = calculate_pm25_aqi(1000)
        assert res_1000["aqi"] == 500
        assert res_1000["category"] == "Severe"
        assert res_1000["hex_color"] == "#800000"

        res_1500 = calculate_pm25_aqi(1500)
        assert res_1500["aqi"] == 500
        assert res_1500["category"] == "Severe"

    def test_extreme_values_unclamped_extrapolation(self):
        # Optional unclamped mode for advanced scientific modeling
        res_unclamped = calculate_pm25_aqi(1000, clamp_extreme=False)
        assert res_unclamped["category"] == "Severe"
        assert res_unclamped["aqi"] > 500

    def test_boundary_transitions(self):
        # 30.5 should smoothly bridge into Satisfactory
        res_30_5 = calculate_pm25_aqi(30.5)
        assert res_30_5["category"] == "Satisfactory"

        # 60.5 into Moderate
        res_60_5 = calculate_pm25_aqi(60.5)
        assert res_60_5["category"] == "Moderate"

        # 90.5 into Poor
        res_90_5 = calculate_pm25_aqi(90.5)
        assert res_90_5["category"] == "Poor"

        # 120.5 into Very Poor
        res_120_5 = calculate_pm25_aqi(120.5)
        assert res_120_5["category"] == "Very Poor"

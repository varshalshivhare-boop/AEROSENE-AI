"""Pytest suite for Multi-Source Context Tagger.

Validates cross-referencing of HCHO hotspots with active FIRMS fire pixels,
wind vector transport alignment, zero fire scenarios, and scientific safety disclaimers.
"""

import math
import numpy as np
import pandas as pd
import pytest

from src.context_tagger import (
    SCIENTIFIC_SAFETY_DISCLAIMER,
    ContextTagger,
    angular_difference_deg,
    calculate_bearing_deg,
    cross_reference_context,
    uv_to_speed_and_heading,
)


class TestAtmosphericVectorMath:
    """Tests for vector trigonometry and meteorological conversions."""

    def test_uv_to_speed_and_heading(self):
        # Pure eastward wind (u = 5.0, v = 0.0) -> blowing toward East (heading = 90 deg)
        speed, heading, from_deg = uv_to_speed_and_heading(5.0, 0.0)
        assert speed == pytest.approx(5.0)
        assert heading == pytest.approx(90.0)
        # In meteorological terms, wind is blowing FROM the West (270 deg)
        assert from_deg == pytest.approx(270.0)

        # Pure northward wind (u = 0.0, v = 4.0) -> blowing toward North (heading = 0 deg)
        speed, heading, from_deg = uv_to_speed_and_heading(0.0, 4.0)
        assert speed == pytest.approx(4.0)
        assert heading == pytest.approx(0.0)
        assert from_deg == pytest.approx(180.0)

    def test_bearing_calculation(self):
        # Point A to Point B directly north
        bearing = calculate_bearing_deg(28.0, 77.0, 29.0, 77.0)
        assert bearing == pytest.approx(0.0, abs=0.5)

        # Point A to Point B directly east
        bearing_east = calculate_bearing_deg(28.0, 77.0, 28.0, 78.0)
        assert bearing_east == pytest.approx(90.0, abs=1.0)

    def test_angular_difference(self):
        assert angular_difference_deg(10.0, 30.0) == 20.0
        assert angular_difference_deg(350.0, 10.0) == 20.0
        assert angular_difference_deg(0.0, 180.0) == 180.0


class TestContextTaggerScenarios:
    """Tests for FIRMS fire pixel and wind vector cross-referencing."""

    @pytest.fixture
    def tagger(self):
        return ContextTagger(
            fire_search_radius_km=75.0,
            coincident_radius_km=15.0,
            alignment_tolerance_deg=45.0,
            min_transport_wind_speed_ms=1.0,
        )

    def test_zero_fire_scenario(self, tagger):
        """Edge Case: Zero fire scenario (no fires in region or empty FIRMS)."""
        hotspot_lat = 30.5
        hotspot_lon = 75.5

        # Empty DataFrame
        res_empty = tagger.tag_hotspot(
            hotspot_lat, hotspot_lon, fire_df=pd.DataFrame(), wind_u=3.0, wind_v=0.0
        )
        assert res_empty["fire_count"] == 0
        assert res_empty["context_tag"] == "NON_FIRE_BIOGENIC_OR_ANTHROPOGENIC"
        assert res_empty["nearest_fire_distance_km"] is None
        assert res_empty["total_frp_mw"] == 0.0
        assert res_empty["plume_transport_plausible"] is False
        assert "No active FIRMS" in res_empty["attribution_summary"]

        # None passed for fires
        res_none = tagger.tag_hotspot(
            hotspot_lat, hotspot_lon, fire_df=None, wind_u=3.0, wind_v=0.0
        )
        assert res_none["fire_count"] == 0
        assert res_none["context_tag"] == "NON_FIRE_BIOGENIC_OR_ANTHROPOGENIC"

    def test_coincident_fire_scenario(self, tagger):
        """Active fire detected within 15 km -> BIOMASS_BURNING_COINCIDENT."""
        hotspot_lat = 30.5
        hotspot_lon = 75.5

        # Fire 5 km away
        fire_df = pd.DataFrame([{"lat": 30.54, "lon": 75.5, "frp": 120.0}])
        res = tagger.tag_hotspot(hotspot_lat, hotspot_lon, fire_df=fire_df, wind_u=2.0, wind_v=1.0)

        assert res["fire_count"] == 1
        assert res["nearest_fire_distance_km"] < 15.0
        assert res["context_tag"] == "BIOMASS_BURNING_COINCIDENT"
        assert res["total_frp_mw"] == 120.0

    def test_upwind_plume_transport_scenario(self, tagger):
        """Fire is upwind (west of hotspot) and westerly wind blows toward hotspot."""
        # Hotspot at (30.0, 75.5)
        hotspot_lat = 30.0
        hotspot_lon = 75.5

        # Fire at (30.0, 75.1), approx 38 km to the west
        fire_df = pd.DataFrame([{"lat": 30.0, "lon": 75.1, "frp": 250.0}])

        # Westerly wind blowing toward East: u = 4.0 m/s, v = 0.0 m/s (heading = 90 deg)
        res = tagger.tag_hotspot(hotspot_lat, hotspot_lon, fire_df=fire_df, wind_u=4.0, wind_v=0.0)

        assert res["fire_count"] == 1
        assert 15.0 < res["nearest_fire_distance_km"] <= 75.0
        assert res["plume_transport_plausible"] is True
        assert res["context_tag"] == "UPWIND_PLUME_TRANSPORT"
        assert res["min_alignment_diff_deg"] <= 10.0

    def test_proximal_fire_with_opposing_wind(self, tagger):
        """Fire is nearby (40 km), but wind is blowing AWAY from the hotspot."""
        hotspot_lat = 30.0
        hotspot_lon = 75.5

        # Fire at (30.0, 75.1) to the west
        fire_df = pd.DataFrame([{"lat": 30.0, "lon": 75.1, "frp": 180.0}])

        # Easterly wind blowing toward West (u = -4.0, v = 0.0 -> heading = 270 deg)
        res = tagger.tag_hotspot(hotspot_lat, hotspot_lon, fire_df=fire_df, wind_u=-4.0, wind_v=0.0)

        assert res["fire_count"] == 1
        assert res["context_tag"] == "BIOMASS_BURNING_PROXIMAL"
        assert res["plume_transport_plausible"] is False
        assert res["min_alignment_diff_deg"] > 100.0

    def test_distant_fire_outside_radius(self, tagger):
        """Fire is beyond the 75 km search radius -> behaves as zero fire in radius."""
        hotspot_lat = 30.0
        hotspot_lon = 75.0

        # Fire > 150 km away
        fire_df = pd.DataFrame([{"lat": 31.5, "lon": 75.0, "frp": 500.0}])
        res = tagger.tag_hotspot(hotspot_lat, hotspot_lon, fire_df=fire_df, wind_u=2.0, wind_v=2.0)

        assert res["fire_count"] == 0
        assert res["context_tag"] == "NON_FIRE_BIOGENIC_OR_ANTHROPOGENIC"


class TestScientificCautionDisclaimers:
    """Verifies compliance with atmospheric scientific caution (correlation vs causation)."""

    def test_disclaimer_content_and_rigor(self):
        disclaimer = ContextTagger.get_safety_disclaimer()

        # Must explicitly mention correlation vs causation
        assert "correlation" in disclaimer.lower()
        assert "causation" in disclaimer.lower()

        # Must address secondary photochemical lifetime and kinetics
        assert "photochemical lifetime" in disclaimer.lower() or "oxidation" in disclaimer.lower()

        # Must mention biogenic VOCs or isoprene confounding factor
        assert "isoprene" in disclaimer.lower() or "bvoc" in disclaimer.lower()

        # Must mention need for trajectory modeling (e.g. HYSPLIT) or multi-pollutant co-emissions
        assert "hysplit" in disclaimer.lower() or "trajectory" in disclaimer.lower()

    def test_disclaimer_present_in_every_tagged_hotspot(self):
        tagger = ContextTagger()
        res = tagger.tag_hotspot(25.0, 80.0, fire_df=None)
        assert "scientific_disclaimer" in res
        assert res["scientific_disclaimer"] == SCIENTIFIC_SAFETY_DISCLAIMER


class TestDatasetTaggingPipeline:
    """Tests batch dataset context tagging and convenience function."""

    def test_tag_dataset_integration(self):
        hotspots = pd.DataFrame(
            [
                {"lat": 29.5, "lon": 76.0, "hcho": 6.0e-4, "z_score": 3.2, "is_elevated": True},
                {"lat": 28.5, "lon": 77.0, "hcho": 5.8e-4, "z_score": 2.8, "is_elevated": True},
            ]
        )
        fires = pd.DataFrame(
            [
                {"lat": 29.52, "lon": 76.01, "frp": 80.0},  # Near first hotspot
            ]
        )

        res_df = cross_reference_context(
            hotspots=hotspots,
            fire_pixels=fires,
            wind_vectors={"u": 2.0, "v": 1.0},
        )

        assert len(res_df) == 2
        assert "context_tag" in res_df.columns
        assert "scientific_disclaimer" in res_df.columns
        assert res_df.iloc[0]["context_tag"] == "BIOMASS_BURNING_COINCIDENT"
        assert res_df.iloc[1]["context_tag"] == "NON_FIRE_BIOGENIC_OR_ANTHROPOGENIC"

    def test_tag_empty_dataset(self):
        tagger = ContextTagger()
        empty_res = tagger.tag_dataset(pd.DataFrame())
        assert empty_res.empty
        assert "context_tag" in empty_res.columns

    def test_scalar_wind_inputs_and_tuple_vector(self):
        tagger = ContextTagger()
        res_scalar = tagger.tag_hotspot(
            hotspot_lat=28.0,
            hotspot_lon=77.0,
            fire_df=None,
            wind_speed=5.0,
            wind_direction=180.0,
        )
        assert res_scalar["wind_speed_ms"] == 5.0
        assert res_scalar["wind_from_deg"] == 180.0
        assert res_scalar["wind_heading_deg"] == 0.0

        # Tuple wind vector in cross_reference_context
        res_tuple = cross_reference_context(
            hotspots=[{"lat": 28.0, "lon": 77.0}],
            fire_pixels=None,
            wind_vectors=(3.0, 4.0),
        )
        assert res_tuple.iloc[0]["wind_speed_ms"] == 5.0


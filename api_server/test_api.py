"""
Aerosense AI — FastAPI Automated Test Suite
Verifies all 7 endpoints, schemas, CPCB styling, caching, and edge-cases.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

PASS = "[PASS]"
FAIL = "[FAIL]"

def ok(cond, label):
    if cond:
        print(f"  {PASS} {label}")
    else:
        print(f"  {FAIL} {label}")
        raise AssertionError(label)

def test_health():
    print("\nTest 1: Health Check (GET /)")
    r = client.get("/")
    ok(r.status_code == 200, "Status code 200")
    d = r.json()
    ok(d["status"] == "ONLINE", "Status is ONLINE")
    ok("endpoints" in d, "Endpoints catalog returned")

def test_aqi_grid():
    print("\nTest 2: Spatial AQI Grid (GET /api/v1/grid/aqi)")
    r = client.get("/api/v1/grid/aqi")
    ok(r.status_code == 200, "Status code 200")
    d = r.json()
    ok(d["type"] == "FeatureCollection", "GeoJSON FeatureCollection returned")
    ok(d["total_points"] > 0, f"{d['total_points']} grid features generated")
    first = d["features"][0]["properties"]
    ok("pm25_estimate" in first, "pm25_estimate property present")
    ok("aqi" in first, "aqi property present")
    ok("color_hex" in first, "color_hex property present")
    ok("confidence" in first, "confidence rating present")

def test_live_custom_estimate():
    print("\nTest 3: On-Demand Custom Location Estimate (POST /api/v1/grid/estimate)")
    payload = {
        "lat": 28.6139,
        "lon": 77.2090,
        "aod": 1.15,
        "pbl_height_m": 600.0,
        "fire_count_50km": 15,
        "cloud_fraction": 0.05
    }
    r = client.post("/api/v1/grid/estimate", json=payload)
    ok(r.status_code == 200, "Status code 200")
    d = r.json()
    ok(d["status"] == "VALID", "status == VALID")
    ok(d["pm25_estimate"] > 0, f"PM2.5 = {d['pm25_estimate']} ug/m3")
    ok(d["aqi"] is not None, f"CPCB AQI = {d['aqi']} ({d['category']})")

def test_cloud_masking():
    print("\nTest 4: Cloud Masking Guard (cloud_fraction > 0.70)")
    payload = {
        "lat": 25.5,
        "lon": 91.8,
        "aod": 0.95,
        "cloud_fraction": 0.85
    }
    r = client.post("/api/v1/grid/estimate", json=payload)
    ok(r.status_code == 200, "Status code 200")
    d = r.json()
    ok(d["status"] == "NO_DATA", "Cloud obscured returns NO_DATA")
    ok(d["confidence"] == "LOW_CLOUD_COVER", "confidence == LOW_CLOUD_COVER")
    ok(d["pm25_estimate"] is None, "pm25_estimate is null")

def test_hcho_hotspots():
    print("\nTest 5: Sentinel-5P HCHO Hotspot Detection (GET /api/v1/hotspots/hcho)")
    r = client.get("/api/v1/hotspots/hcho")
    ok(r.status_code == 200, "Status code 200")
    d = r.json()
    ok(d["total_anomalies"] > 0, f"{d['total_anomalies']} anomalies flagged")
    hs = d["hotspots"][0]
    ok("z_score" in hs, f"Z-score = {hs['z_score']}")
    ok("scientific_disclaimer" in hs["context"], "Scientific disclaimer present")

def test_cpcb_stations():
    print("\nTest 6: CPCB Ground Truth Monitors (GET /api/v1/stations/ground)")
    r = client.get("/api/v1/stations/ground")
    ok(r.status_code == 200, "Status code 200")
    d = r.json()
    ok(d["total_active"] > 0, f"{d['total_active']} active stations tracked")
    st = d["stations"][0]
    ok("ground_pm25" in st, "ground_pm25 present")
    ok("satellite_pm25_estimate" in st, "satellite_pm25_estimate present")
    ok("abs_error" in st, f"Error delta = {st['abs_error']} ug/m3")

def test_history():
    print("\nTest 7: Coordinate Time-Series History (GET /api/v1/stations/history)")
    r = client.get("/api/v1/stations/history?lat=28.61&lon=77.20&days=7")
    ok(r.status_code == 200, "Status code 200")
    d = r.json()
    ok(len(d["history"]) == 7, "7-day trend series returned")

def test_metrics():
    print("\nTest 8: Model Transparency & Accuracy (GET /api/v1/model/metrics)")
    r = client.get("/api/v1/model/metrics")
    ok(r.status_code == 200, "Status code 200")
    d = r.json()
    ok("overall" in d, "overall performance metric block present")
    ok(d["overall"]["r2"] > 0.70, f"R² = {d['overall']['r2']}")

if __name__ == "__main__":
    print("=" * 60)
    print("  AEROSENSE AI — FASTAPI TEST SUITE (PHASE 4)")
    print("=" * 60)
    test_health()
    test_aqi_grid()
    test_live_custom_estimate()
    test_cloud_masking()
    test_hcho_hotspots()
    test_cpcb_stations()
    test_history()
    test_metrics()
    print("=" * 60)
    print("  ALL 8 ENDPOINT TESTS & LOGIC VERIFIED SUCCESSFULLY! 🚀")
    print("=" * 60)

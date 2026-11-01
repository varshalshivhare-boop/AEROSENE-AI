"""
Standalone test suite for Aerosense AI PM2.5 Machine Learning Engine.
Tests model loading, latency (< 10ms per prediction), and boundary conditions.
"""
import time
import os
import sys

# Ensure src is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
from inference import PM25Estimator, predict_surface_pm25

def run_tests():
    print("==================================================")
    print("Testing Aerosense AI ML Inference Engine (Phase 2)")
    print("==================================================")

    estimator = PM25Estimator()

    # Test 1: Deterministic Baseline Prediction
    sample_input = {
        "aod": 0.85,
        "temp_2m_k": 301.15,
        "relative_humidity": 55.0,
        "wind_u": 2.1,
        "wind_v": -1.2,
        "pbl_height_m": 850.0,
        "fire_count_50km": 12,
        "min_dist_fire_km": 14.5,
        "cloud_fraction": 0.10
    }

    res = estimator.predict(sample_input)
    print(f"Test 1 - Sample Prediction: {res}")
    assert res["status"] == "VALID", f"Expected VALID status, got {res['status']}"
    assert res["pm25_estimate"] > 0, "PM2.5 estimate must be positive"
    assert res["confidence"] in ["HIGH", "MEDIUM"], f"Unexpected confidence {res['confidence']}"
    print("✓ Test 1 Passed: Valid structured output contract verified.")

    # Test 2: Cloud Masking Edge Case
    cloudy_input = {
        "aod": 0.95,
        "cloud_fraction": 0.85
    }
    res_cloud = estimator.predict(cloudy_input)
    print(f"Test 2 - Cloud Masked Input: {res_cloud}")
    assert res_cloud["status"] == "NO_DATA", "Must return NO_DATA when cloud obscured"
    assert res_cloud["confidence"] == "LOW_CLOUD_COVER"
    print("✓ Test 2 Passed: Cloud masking and low confidence handling verified.")

    # Test 3: Inference Latency Benchmark (< 10ms per record)
    iterations = 200
    start_time = time.perf_counter()
    for _ in range(iterations):
        _ = estimator.predict(sample_input)
    total_time = time.perf_counter() - start_time
    latency_ms = (total_time / iterations) * 1000.0

    print(f"Test 3 - Benchmark: Average latency over {iterations} runs: {latency_ms:.3f} ms / prediction")
    assert latency_ms < 10.0, f"Latency {latency_ms:.2f}ms exceeded 10ms threshold"
    print("✓ Test 3 Passed: Sub-10ms execution requirement fulfilled.")

    # Test 4: Functional Interface Test
    func_res = predict_surface_pm25(sample_input)
    assert func_res["status"] == "VALID"
    print("✓ Test 4 Passed: Global predict_surface_pm25() contract verified.")

    print("\nALL PHASE 2 MACHINE LEARNING TESTS PASSED SUCCESSFULLY! 🚀")

if __name__ == "__main__":
    run_tests()

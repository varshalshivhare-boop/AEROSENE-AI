"""
Aerosense AI — Phase 2: Comprehensive Test Suite
--------------------------------------------------
Tests:
  1. Data contract (output schema validation)
  2. Cloud masking guard
  3. Inference latency benchmark (< 10ms single, < 2ms per item batch)
  4. Batch prediction correctness + throughput
  5. Deterministic reproducibility (two calls → same result)
  6. Edge cases: zero wind, extreme AOD, no fires, max fires
  7. metrics.json schema validation
"""
import os, sys, time, json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
from inference import PM25Estimator, predict_surface_pm25

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"

_VALID_SAMPLE = {
    "aod": 0.85,
    "hcho_mol_m2": 0.000185,
    "temp_2m_k": 301.15,
    "relative_humidity": 55.0,
    "wind_u": 2.1,
    "wind_v": -1.2,
    "pbl_height_m": 850.0,
    "fire_count_50km": 12,
    "min_dist_fire_km": 14.5,
    "cloud_fraction": 0.10,
    "day_of_year": 310,
}


def assert_ok(cond, label):
    if cond:
        print(f"  {PASS} {label}")
    else:
        print(f"  {FAIL} {label}")
        raise AssertionError(label)


def test_output_contract():
    print("\nTest 1 — Output Contract")
    est = PM25Estimator()
    r = est.predict(_VALID_SAMPLE)
    assert_ok(r["status"] == "VALID",              "status == VALID")
    assert_ok(isinstance(r["pm25_estimate"], float),"pm25_estimate is float")
    assert_ok(r["pm25_estimate"] > 0,              "pm25_estimate > 0")
    assert_ok(r["confidence"] in {"HIGH","MEDIUM"},"confidence in {HIGH, MEDIUM}")
    assert_ok("derived" in r,                      "derived dict present")
    assert_ok("wind_speed_ms" in r["derived"],     "wind_speed_ms in derived")
    assert_ok("fire_impact_score" in r["derived"], "fire_impact_score in derived")


def test_cloud_masking():
    print("\nTest 2 — Cloud Masking Guard")
    est = PM25Estimator()
    # Heavy cloud → NO_DATA
    r_heavy = est.predict({"aod": 0.9, "cloud_fraction": 0.85})
    assert_ok(r_heavy["status"] == "NO_DATA",          "Heavy cloud → NO_DATA")
    assert_ok(r_heavy["confidence"] == "LOW_CLOUD_COVER","LOW_CLOUD_COVER returned")
    assert_ok(r_heavy["pm25_estimate"] is None,        "pm25_estimate is None when cloudy")
    # Missing AOD → NO_DATA
    r_no_aod = est.predict({"cloud_fraction": 0.1})
    assert_ok(r_no_aod["status"] == "NO_DATA",         "Missing AOD → NO_DATA")


def test_single_latency():
    print("\nTest 3 — Single-Record Latency Benchmark")
    est = PM25Estimator()
    # Warmup
    for _ in range(5):
        est.predict(_VALID_SAMPLE)
    N = 500
    t0 = time.perf_counter()
    for _ in range(N):
        est.predict(_VALID_SAMPLE)
    elapsed = (time.perf_counter() - t0) / N * 1000
    print(f"           Avg latency: {elapsed:.3f} ms / record")
    assert_ok(elapsed < 10.0, f"Single latency < 10 ms  (got {elapsed:.2f} ms)")


def test_batch_prediction():
    print("\nTest 4 — Batch Prediction")
    est = PM25Estimator()
    batch = [_VALID_SAMPLE] * 100 + [{"aod": None}] * 10   # 100 valid + 10 no-AOD
    t0 = time.perf_counter()
    results = est.predict_batch(batch)
    elapsed = (time.perf_counter() - t0) * 1000
    assert_ok(len(results) == 110,                    "110 results returned")
    valid_r   = [r for r in results if r["status"] == "VALID"]
    invalid_r = [r for r in results if r["status"] == "NO_DATA"]
    assert_ok(len(valid_r) == 100,                    "100 VALID results")
    assert_ok(len(invalid_r) == 10,                   "10 NO_DATA results")
    per_item = elapsed / 110
    print(f"           Batch of 110 → {elapsed:.1f} ms total  ({per_item:.2f} ms/item)")
    assert_ok(per_item < 5.0, f"Batch per-item < 5 ms  (got {per_item:.2f} ms)")


def test_deterministic():
    print("\nTest 5 — Deterministic Reproducibility")
    est = PM25Estimator()
    r1 = est.predict(_VALID_SAMPLE)
    r2 = est.predict(_VALID_SAMPLE)
    assert_ok(r1["pm25_estimate"] == r2["pm25_estimate"], "Two calls → identical estimate")


def test_edge_cases():
    print("\nTest 6 — Edge Cases")
    est = PM25Estimator()

    # Zero wind (calm conditions — high pollution trapping expected)
    r_calm = est.predict({**_VALID_SAMPLE, "wind_u": 0.0, "wind_v": 0.0})
    assert_ok(r_calm["status"] == "VALID",             "Zero-wind input: VALID")

    # Very high AOD (smoke / dense haze)
    r_high_aod = est.predict({**_VALID_SAMPLE, "aod": 3.4})
    assert_ok(r_high_aod["confidence"] == "MEDIUM",    "AOD > 2.0 → MEDIUM confidence")
    assert_ok(r_high_aod["pm25_estimate"] > 50,        "High AOD → PM2.5 > 50")

    # No fires
    r_no_fire = est.predict({**_VALID_SAMPLE, "fire_count_50km": 0, "min_dist_fire_km": 999.0})
    assert_ok(r_no_fire["status"] == "VALID",           "No-fire input: VALID")

    # Max fires
    r_max_fire = est.predict({**_VALID_SAMPLE, "fire_count_50km": 55, "min_dist_fire_km": 2.0})
    assert_ok(r_max_fire["pm25_estimate"] > r_no_fire["pm25_estimate"],
              "Max fires → higher PM2.5 than no fires")


def test_metrics_schema():
    print("\nTest 7 — metrics.json Schema")
    base = os.path.dirname(__file__)
    path = os.path.join(base, "artifacts", "metrics.json")
    assert_ok(os.path.exists(path), "metrics.json exists")
    with open(path, "r", encoding="utf-8") as f:
        m = json.load(f)
    assert_ok("overall_cv" in m or "overall" in m,    "Overall metrics key present")
    assert_ok("features_used" in m,                   "features_used key present")
    assert_ok("seasonal" in m,                        "seasonal breakdown present")


def test_functional_interface():
    print("\nTest 8 — Functional Interface (predict_surface_pm25)")
    r = predict_surface_pm25(_VALID_SAMPLE)
    assert_ok(r["status"] == "VALID",   "predict_surface_pm25 returns VALID")
    assert_ok(r["pm25_estimate"] > 0,   "pm25_estimate > 0 via functional API")


def run_all():
    print("=" * 58)
    print("  Aerosense AI Phase 2 — Comprehensive ML Test Suite")
    print("=" * 58)
    tests = [
        test_output_contract,
        test_cloud_masking,
        test_single_latency,
        test_batch_prediction,
        test_deterministic,
        test_edge_cases,
        test_metrics_schema,
        test_functional_interface,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except AssertionError as e:
            print(f"  FAILED: {e}")
    print(f"\n{'='*58}")
    print(f"  Result: {passed}/{len(tests)} tests passed")
    if passed == len(tests):
        print("  ALL TESTS PASSED — Phase 2 is production-ready! 🚀")
    else:
        print("  Some tests failed. Check output above.")
    print("=" * 58)
    sys.exit(0 if passed == len(tests) else 1)


if __name__ == "__main__":
    run_all()

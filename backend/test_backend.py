"""
Automated Verification Script for Stage 3 Backend Setup.
Tests FastAPI app instantiation, routing, root endpoint, health checks,
and database query connectivity using TestClient (httpx).
"""

import sys
from fastapi.testclient import TestClient
from app.main import app
from app.database import check_database_connection

client = TestClient(app)

def test_stage3_backend():
    print("=" * 70)
    print("  SMARTRETAIL AI - Stage 3 Backend Verification Suite")
    print("=" * 70)

    # Test 1: Root endpoint GET /
    print("Test 1: GET / (Root Endpoint)...")
    res1 = client.get("/")
    assert res1.status_code == 200, f"Expected 200, got {res1.status_code}"
    data1 = res1.json()
    print(f"  [OK] Status: {res1.status_code} | System: '{data1.get('system')}'")
    print(f"  [OK] Database Dialect: {data1.get('database_dialect')} | Tables: {data1.get('tables_registered')}")

    # Test 2: Quick ping GET /health
    print("\nTest 2: GET /health (Liveness Probe)...")
    res2 = client.get("/health")
    assert res2.status_code == 200
    print(f"  [OK] Status: {res2.status_code} | Response: {res2.json()}")

    # Test 3: API v1 Health GET /api/v1/health
    print("\nTest 3: GET /api/v1/health (API v1 Health Check)...")
    res3 = client.get("/api/v1/health")
    assert res3.status_code == 200
    data3 = res3.json()
    print(f"  [OK] Status: {res3.status_code} | App Status: '{data3.get('status')}' | Env: '{data3.get('environment')}'")

    # Test 4: Database Diagnostic GET /api/v1/health/db
    print("\nTest 4: GET /api/v1/health/db (Live Database Query & Latency)...")
    res4 = client.get("/api/v1/health/db")
    assert res4.status_code == 200
    data4 = res4.json()
    print(f"  [OK] Status: {res4.status_code}")
    print(f"  [OK] DB Status: '{data4.get('status')}'")
    print(f"  [OK] Query Latency: {data4.get('query_latency_ms')} ms")
    print(f"  [OK] Tables Found in DB ({data4.get('tables_count')}): {data4.get('tables')}")

    print("\n" + "-" * 70)
    print("ALL STAGE 3 BACKEND TESTS PASSED SUCCESSFULLY!")
    print("-" * 70)

if __name__ == "__main__":
    test_stage3_backend()

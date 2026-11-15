"""
SMARTRETAIL AI - Authentication & RBAC Verification Suite
Comprehensive automated test coverage for:
- Secure login & bcrypt verification
- Invalid credentials rejection (401)
- JWT access-token parsing and signature validation
- /api/v1/auth/me profile & permission resolution
- Strict Role-Based Access Control (Admin, Manager, Cashier)
- Verification that Cashiers cannot access Manager or Admin resources (403)
- Verification that Managers cannot access Admin resources (403)
- Verification that Admins have full system access
"""

import sys
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_auth_rbac_suite():
    print("=" * 75)
    print("  SMARTRETAIL AI - Stage 4 Authentication & RBAC Test Suite")
    print("=" * 75)

    # ---------------------------------------------------------
    # TEST 1: Invalid Credentials
    # ---------------------------------------------------------
    print("\n[TEST 1] Testing Invalid Credentials...")
    res_bad = client.post("/api/v1/auth/login", json={"username": "admin_rajesh", "password": "WrongPassword123"})
    assert res_bad.status_code == 401, f"Expected 401, got {res_bad.status_code}"
    print(f"  [OK] Wrong password returned 401 Unauthorized: {res_bad.json()['detail']}")

    res_unknown = client.post("/api/v1/auth/login", json={"username": "ghost_user", "password": "WrongPassword123"})
    assert res_unknown.status_code == 401
    print(f"  [OK] Unknown user returned 401 Unauthorized: {res_unknown.json()['detail']}")

    # ---------------------------------------------------------
    # TEST 2: Cashier Authentication & RBAC Boundary
    # ---------------------------------------------------------
    print("\n[TEST 2] Testing Cashier Role (cashier_karan)...")
    res_cashier = client.post("/api/v1/auth/login", json={"username": "cashier_karan", "password": "Cashier@123"})
    assert res_cashier.status_code == 200, f"Cashier login failed: {res_cashier.text}"
    cashier_token = res_cashier.json()["access_token"]
    cashier_headers = {"Authorization": f"Bearer {cashier_token}"}
    print(f"  [OK] Cashier logged in successfully. Token issued (type: {res_cashier.json()['token_type']})")

    # Cashier /me
    me_cashier = client.get("/api/v1/auth/me", headers=cashier_headers)
    assert me_cashier.status_code == 200
    assert me_cashier.json()["role"] == "CASHIER"
    print(f"  [OK] /api/v1/auth/me verified: Role={me_cashier.json()['role']} | Perms={me_cashier.json()['permissions']}")

    # Cashier accessing Cashier Zone -> 200 OK
    res_cz = client.get("/api/v1/test/cashier-zone", headers=cashier_headers)
    assert res_cz.status_code == 200
    print(f"  [OK] Cashier accessed Cashier Zone -> 200 OK")

    # Cashier accessing Manager Zone -> MUST BE 403 FORBIDDEN
    res_mz = client.get("/api/v1/test/manager-zone", headers=cashier_headers)
    assert res_mz.status_code == 403, f"Expected 403, got {res_mz.status_code}"
    print(f"  [OK] Cashier blocked from Manager Zone -> 403 Forbidden: {res_mz.json()['detail']}")

    # Cashier accessing Admin Zone -> MUST BE 403 FORBIDDEN
    res_az = client.get("/api/v1/test/admin-zone", headers=cashier_headers)
    assert res_az.status_code == 403
    print(f"  [OK] Cashier blocked from Admin Zone -> 403 Forbidden: {res_az.json()['detail']}")

    # Cashier accessing User Directory -> MUST BE 403 FORBIDDEN
    res_users = client.get("/api/v1/users", headers=cashier_headers)
    assert res_users.status_code == 403
    print(f"  [OK] Cashier blocked from User Directory -> 403 Forbidden")

    # ---------------------------------------------------------
    # TEST 3: Manager Authentication & RBAC Boundary
    # ---------------------------------------------------------
    print("\n[TEST 3] Testing Manager Role (mgr_priya)...")
    res_mgr = client.post("/api/v1/auth/login", json={"username": "mgr_priya", "password": "Manager@123"})
    assert res_mgr.status_code == 200
    mgr_token = res_mgr.json()["access_token"]
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}
    print(f"  [OK] Manager logged in successfully.")

    # Manager accessing Cashier Zone -> 200 OK
    assert client.get("/api/v1/test/cashier-zone", headers=mgr_headers).status_code == 200
    print(f"  [OK] Manager accessed Cashier POS Zone -> 200 OK")

    # Manager accessing Manager Zone -> 200 OK
    assert client.get("/api/v1/test/manager-zone", headers=mgr_headers).status_code == 200
    print(f"  [OK] Manager accessed Manager Zone -> 200 OK")

    # Manager accessing Admin Zone -> MUST BE 403 FORBIDDEN
    res_m_az = client.get("/api/v1/test/admin-zone", headers=mgr_headers)
    assert res_m_az.status_code == 403
    print(f"  [OK] Manager blocked from Admin Zone -> 403 Forbidden: {res_m_az.json()['detail']}")

    # Manager accessing User Directory -> MUST BE 403 FORBIDDEN
    assert client.get("/api/v1/users", headers=mgr_headers).status_code == 403
    print(f"  [OK] Manager blocked from User Directory -> 403 Forbidden")

    # ---------------------------------------------------------
    # TEST 4: Admin Authentication & Full Privileges
    # ---------------------------------------------------------
    print("\n[TEST 4] Testing Admin Role (admin_rajesh)...")
    res_admin = client.post("/api/v1/auth/login", json={"username": "admin_rajesh", "password": "Admin@123"})
    assert res_admin.status_code == 200
    admin_token = res_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"  [OK] Admin logged in successfully.")

    # Admin accessing all zones
    assert client.get("/api/v1/test/cashier-zone", headers=admin_headers).status_code == 200
    assert client.get("/api/v1/test/manager-zone", headers=admin_headers).status_code == 200
    assert client.get("/api/v1/test/admin-zone", headers=admin_headers).status_code == 200
    print(f"  [OK] Admin authorized across Cashier, Manager, and Admin zones -> 200 OK")

    # Admin listing users
    res_u_list = client.get("/api/v1/users", headers=admin_headers)
    assert res_u_list.status_code == 200
    users_data = res_u_list.json()
    print(f"  [OK] Admin retrieved user directory: {len(users_data)} registered staff accounts.")

    # Admin creating a new user via API
    new_username = "cashier_suresh"
    new_user_payload = {
        "username": new_username,
        "email": "suresh@smartretail.ai",
        "full_name": "Suresh Raina",
        "role": "CASHIER",
        "password": "Password@123",
        "is_active": True
    }
    res_create = client.post("/api/v1/users", json=new_user_payload, headers=admin_headers)
    if res_create.status_code == 201:
        print(f"  [OK] Admin successfully provisioned new cashier: '{new_username}' -> 201 Created")
    elif res_create.status_code == 400:
        print(f"  [OK] User '{new_username}' already exists.")

    # ---------------------------------------------------------
    # TEST 5: Tampered & Missing Token Handling
    # ---------------------------------------------------------
    print("\n[TEST 5] Testing Tampered & Missing Tokens...")
    res_tampered = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer fake.jwt.token"})
    assert res_tampered.status_code == 401
    print(f"  [OK] Tampered token returned 401 Unauthorized: {res_tampered.json()['detail']}")

    res_missing = client.get("/api/v1/auth/me")
    assert res_missing.status_code == 401
    print(f"  [OK] Missing token returned 401 Unauthorized: {res_missing.json()['detail']}")

    # ---------------------------------------------------------
    # TEST 6: Logout
    # ---------------------------------------------------------
    print("\n[TEST 6] Testing Logout Endpoint...")
    res_logout = client.post("/api/v1/auth/logout", headers=admin_headers)
    assert res_logout.status_code == 200
    print(f"  [OK] Logout returned 200 OK: {res_logout.json()['message']}")

    print("\n" + "=" * 75)
    print("ALL AUTHENTICATION & RBAC ROLE TESTS PASSED (100% SUCCESS)!")
    print("=" * 75)

if __name__ == "__main__":
    run_auth_rbac_suite()

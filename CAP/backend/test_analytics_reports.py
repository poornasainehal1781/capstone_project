"""
SMARTRETAIL AI - Stage 7 Dashboard, Sales Reports & Analytics Verification Suite
Automated Verification for:
1. Dashboard KPIs (revenue, completed orders, products, low stock, customers, top SKUs, recent sales).
2. Sales Analytics time-series (daily, weekly, monthly, category share, tender split).
3. Inventory Analytics (valuations, low stock, out of stock, replenishment radar, stock movements).
4. Executive Reports Summary (date-range filtering, purchases, revenue, product-wise sales).
5. CSV Reports Export (sales, inventory, purchases).
6. ReportLab PDF Reports Export (summary, sales, inventory).
7. Error handling for invalid date ranges (400 Bad Request).
8. Role-Based Access Control (Cashier blocked with 403 from managerial reports; Manager/Admin authorized).
"""

import sys
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.sale import Sale
from app.models.product import Product
from app.models.customer import Customer
from app.models.purchase import Purchase

client = TestClient(app)

def run_analytics_reports_suite():
    print("=" * 80)
    print("  SMARTRETAIL AI - Stage 7 Dashboard, Sales Reports & Analytics Test Suite")
    print("=" * 80)

    # -------------------------------------------------------------
    # 0. Authenticate Manager & Cashier
    # -------------------------------------------------------------
    print("\n[PHASE 0] Authenticating Manager & Cashier sessions...")
    res_mgr = client.post("/api/v1/auth/login", json={"username": "mgr_priya", "password": "Manager@123"})
    assert res_mgr.status_code == 200, f"Manager login failed: {res_mgr.text}"
    mgr_token = res_mgr.json()["access_token"]
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}
    print("  [OK] Manager 'mgr_priya' authenticated.")

    res_cashier = client.post("/api/v1/auth/login", json={"username": "cashier_karan", "password": "Cashier@123"})
    assert res_cashier.status_code == 200
    cashier_token = res_cashier.json()["access_token"]
    cashier_headers = {"Authorization": f"Bearer {cashier_token}"}
    print("  [OK] Cashier 'cashier_karan' authenticated.")

    # -------------------------------------------------------------
    # 1. Main Dashboard Verification
    # -------------------------------------------------------------
    print("\n[TEST 1] Testing Main Dashboard Endpoint (GET /api/v1/analytics/dashboard)...")
    res_dash = client.get("/api/v1/analytics/dashboard", headers=mgr_headers)
    assert res_dash.status_code == 200, f"Dashboard failed: {res_dash.text}"
    d = res_dash.json()

    # Query DB to cross-check numbers
    db = SessionLocal()
    try:
        expected_completed_orders = db.query(Sale).filter(Sale.status == "COMPLETED").count()
        expected_products_count = db.query(Product).count()
        expected_customers_count = db.query(Customer).count()
    finally:
        db.close()

    assert d["completed_orders_count"] == expected_completed_orders
    assert d["total_products"] == expected_products_count
    assert d["total_customers"] == expected_customers_count
    assert Decimal(str(d["total_sales_revenue"])) > 0
    assert len(d["top_selling_products"]) > 0
    assert len(d["recent_sales"]) > 0
    assert len(d["category_revenue_share"]) > 0

    print(f"  [OK] Total Revenue Verified : Rs. {d['total_sales_revenue']}")
    print(f"  [OK] Completed Orders Count : {d['completed_orders_count']} orders (DB Verified)")
    print(f"  [OK] Total Catalog Products : {d['total_products']} SKUs (DB Verified)")
    print(f"  [OK] Low Stock Alert Items  : {d['low_stock_count']} SKUs")
    print(f"  [OK] Registered Customers   : {d['total_customers']} profiles (DB Verified)")
    print(f"  [OK] Today's Revenue        : Rs. {d['today_revenue']} ({d['today_orders_count']} orders)")
    print(f"  [OK] Top Selling Product #1 : {d['top_selling_products'][0]['product_name']} ({d['top_selling_products'][0]['units_sold']} units)")
    print(f"  [OK] Category Breakdown     : {len(d['category_revenue_share'])} departments audited")

    # -------------------------------------------------------------
    # 2. Sales Analytics Time-Series & Trends
    # -------------------------------------------------------------
    print("\n[TEST 2] Testing Sales Analytics Endpoint (GET /api/v1/analytics/sales)...")
    res_sales = client.get("/api/v1/analytics/sales?period=last_30_days", headers=mgr_headers)
    assert res_sales.status_code == 200
    sa = res_sales.json()

    assert len(sa["daily_sales"]) >= 28, f"Expected at least 28 daily data points, got {len(sa['daily_sales'])}"
    assert len(sa["weekly_sales"]) > 0
    assert len(sa["monthly_sales"]) > 0
    assert len(sa["category_sales"]) > 0
    assert len(sa["best_selling_products"]) > 0
    assert len(sa["payment_methods"]) > 0

    print(f"  [OK] Daily Series Points    : {len(sa['daily_sales'])} days plotted")
    print(f"  [OK] Weekly Series Points   : {len(sa['weekly_sales'])} weeks plotted")
    print(f"  [OK] Monthly Series Points  : {len(sa['monthly_sales'])} months plotted")
    print(f"  [OK] Payment Methods Split  : {[m['method'] + ': ' + m['percentage'] for m in sa['payment_methods']]}")

    # -------------------------------------------------------------
    # 3. Inventory Analytics, Valuations & Replenishment
    # -------------------------------------------------------------
    print("\n[TEST 3] Testing Inventory Analytics Endpoint (GET /api/v1/analytics/inventory)...")
    res_inv = client.get("/api/v1/analytics/inventory", headers=mgr_headers)
    assert res_inv.status_code == 200
    ia = res_inv.json()

    assert ia["total_products"] > 0
    assert ia["total_stock_units"] > 0
    assert Decimal(str(ia["inventory_valuation_cost"])) > 0
    assert Decimal(str(ia["inventory_valuation_mrp"])) > Decimal(str(ia["inventory_valuation_cost"]))
    assert len(ia["recent_stock_movements"]) > 0

    print(f"  [OK] Total Stock Units      : {ia['total_stock_units']} units on shelf")
    print(f"  [OK] Cost Valuation         : Rs. {ia['inventory_valuation_cost']}")
    print(f"  [OK] Retail MRP Valuation   : Rs. {ia['inventory_valuation_mrp']}")
    print(f"  [OK] Replenishment Radar    : {len(ia['replenishment_needed'])} suggested reorders")
    print(f"  [OK] Stock Movement Ledger  : {len(ia['recent_stock_movements'])} audit records verified")

    # -------------------------------------------------------------
    # 4. Executive Reports Summary & Date Filtering
    # -------------------------------------------------------------
    print("\n[TEST 4] Testing Executive Report Summary (GET /api/v1/reports/summary)...")
    for filter_range in ["today", "last_7_days", "last_30_days", "month_to_date"]:
        res_rep = client.get(f"/api/v1/reports/summary?date_range={filter_range}", headers=mgr_headers)
        assert res_rep.status_code == 200, f"Filter {filter_range} failed: {res_rep.text}"
        rep = res_rep.json()
        print(f"  [OK] Filter [{filter_range:<14}] -> Revenue: Rs. {rep['revenue_summary']['net_revenue']:>9} | Orders: {rep['revenue_summary']['completed_orders']:>2} | POs: {rep['purchase_summary']['total_orders']}")

    # Custom range validation error (from_date > to_date)
    res_invalid_date = client.get("/api/v1/reports/summary?date_range=custom&from_date=2026-12-31&to_date=2026-01-01", headers=mgr_headers)
    assert res_invalid_date.status_code == 400
    print(f"  [OK] Invalid date range correctly rejected with 400: {res_invalid_date.json()['detail']}")

    # -------------------------------------------------------------
    # 5. CSV Reports Export
    # -------------------------------------------------------------
    print("\n[TEST 5] Testing CSV Export Endpoints (GET /api/v1/reports/export/csv)...")
    for r_type in ["sales", "inventory", "purchases"]:
        res_csv = client.get(f"/api/v1/reports/export/csv?report_type={r_type}", headers=mgr_headers)
        assert res_csv.status_code == 200
        assert res_csv.headers["content-type"] == "text/csv; charset=utf-8"
        lines = res_csv.text.strip().split("\n")
        assert len(lines) >= 2, f"CSV {r_type} has no data rows"
        print(f"  [OK] CSV Export [{r_type:<10}] : {len(lines)} rows generated | Header: {lines[0][:50]}...")

    # -------------------------------------------------------------
    # 6. PDF Reports Export
    # -------------------------------------------------------------
    print("\n[TEST 6] Testing PDF Export Endpoints (GET /api/v1/reports/export/pdf)...")
    for r_type in ["summary", "sales", "inventory"]:
        res_pdf = client.get(f"/api/v1/reports/export/pdf?report_type={r_type}", headers=mgr_headers)
        assert res_pdf.status_code == 200
        assert res_pdf.headers["content-type"] == "application/pdf"
        assert res_pdf.content.startswith(b"%PDF"), f"PDF {r_type} does not have valid %PDF header"
        print(f"  [OK] PDF Export [{r_type:<10}] : {len(res_pdf.content)} bytes generated (%PDF verified)")

    # -------------------------------------------------------------
    # 7. Role-Based Access Control (RBAC)
    # -------------------------------------------------------------
    print("\n[TEST 7] Testing RBAC: Cashier access restrictions...")
    # Cashier accessing reports summary -> MUST BE 403 FORBIDDEN
    res_c_summary = client.get("/api/v1/reports/summary", headers=cashier_headers)
    assert res_c_summary.status_code == 403, f"Expected 403, got {res_c_summary.status_code}"
    print(f"  [OK] Cashier blocked from Executive Reports -> 403 Forbidden: {res_c_summary.json()['detail']}")

    # Cashier accessing CSV export -> MUST BE 403 FORBIDDEN
    res_c_csv = client.get("/api/v1/reports/export/csv?report_type=sales", headers=cashier_headers)
    assert res_c_csv.status_code == 403
    print(f"  [OK] Cashier blocked from CSV Data Export -> 403 Forbidden")

    # Cashier accessing PDF report export -> MUST BE 403 FORBIDDEN
    res_c_pdf = client.get("/api/v1/reports/export/pdf?report_type=summary", headers=cashier_headers)
    assert res_c_pdf.status_code == 403
    print(f"  [OK] Cashier blocked from PDF Executive Export -> 403 Forbidden")

    print("\n" + "=" * 80)
    print("ALL STAGE 7 DASHBOARD, SALES REPORTS & ANALYTICS TESTS PASSED (100% SUCCESS)!")
    print("=" * 80)

if __name__ == "__main__":
    run_analytics_reports_suite()


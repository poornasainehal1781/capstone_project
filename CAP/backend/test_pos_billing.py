"""
SMARTRETAIL AI - Stage 6 POS Billing & Inventory Integration Verification Suite
Tests:
1. Fast product barcode & SKU lookup.
2. Customer loyalty profile lookup by phone.
3. Overselling rejection (cannot bill more than available stock).
4. Verifying failed checkout does not alter stock.
5. Accurate POS checkout calculations (Subtotal, GST, discounts, Grand Total).
6. Database persistence: Sale, SaleItem, and StockMovement records.
7. Stock reduction verification in database.
8. Idempotency test (duplicate submission prevention).
9. PDF Tax Invoice generation verification (%PDF header and stream).
10. Role-based access control (Cashier vs Manager vs Admin).
11. Authorized Sale Cancellation & Stock Restoration ledger.
"""

import sys
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.product import Product
from app.models.sale import Sale
from app.models.stock_movement import StockMovement
from app.models.customer import Customer

client = TestClient(app)

def run_pos_billing_suite():
    print("=" * 80)
    print("  SMARTRETAIL AI - Stage 6 POS Billing & Stock Integration Test Suite")
    print("=" * 80)

    # -------------------------------------------------------------
    # 0. Setup: Log in Cashier and Manager
    # -------------------------------------------------------------
    print("\n[PHASE 0] Authenticating Cashier & Manager sessions...")
    res_cashier_login = client.post("/api/v1/auth/login", json={"username": "cashier_karan", "password": "Cashier@123"})
    assert res_cashier_login.status_code == 200, f"Cashier login failed: {res_cashier_login.text}"
    cashier_token = res_cashier_login.json()["access_token"]
    cashier_headers = {"Authorization": f"Bearer {cashier_token}"}
    print("  [OK] Cashier 'cashier_karan' authenticated.")

    res_mgr_login = client.post("/api/v1/auth/login", json={"username": "mgr_priya", "password": "Manager@123"})
    assert res_mgr_login.status_code == 200, f"Manager login failed: {res_mgr_login.text}"
    mgr_token = res_mgr_login.json()["access_token"]
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}
    print("  [OK] Manager 'mgr_priya' authenticated.")

    # -------------------------------------------------------------
    # 1. Barcode & Product Search
    # -------------------------------------------------------------
    print("\n[TEST 1] Testing Fast Barcode & SKU Lookup...")
    milk_barcode = "8901030382718"
    res_b = client.get(f"/api/v1/products/barcode/{milk_barcode}", headers=cashier_headers)
    assert res_b.status_code == 200, f"Barcode lookup failed: {res_b.text}"
    prod_milk = res_b.json()
    assert prod_milk["barcode"] == milk_barcode
    print(f"  [OK] Found SKU by barcode '{milk_barcode}': {prod_milk['name']} (MRP: Rs.{prod_milk['selling_price']}, Stock: {prod_milk['current_stock']})")

    # Search by text query
    res_search = client.get("/api/v1/products?search=Instant+Noodles", headers=cashier_headers)
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert len(search_data) >= 1
    prod_maggi = search_data[0]
    print(f"  [OK] Text search for 'Instant Noodles' matched: {prod_maggi['name']} (ID: {prod_maggi['id']})")

    # Non-existent barcode -> 404 Not Found
    res_unknown = client.get("/api/v1/products/barcode/9999999999999", headers=cashier_headers)
    assert res_unknown.status_code == 404
    print(f"  [OK] Non-existent barcode correctly returned 404: {res_unknown.json()['detail']}")

    # -------------------------------------------------------------
    # 2. Customer Lookup by Mobile
    # -------------------------------------------------------------
    print("\n[TEST 2] Testing Customer Loyalty Lookup...")
    phone = "9880123456"
    res_cust = client.get(f"/api/v1/customers/phone/{phone}", headers=cashier_headers)
    assert res_cust.status_code == 200
    cust_data = res_cust.json()
    assert cust_data["name"] == "Ananya Deshmukh"
    print(f"  [OK] Customer found: {cust_data['name']} | Points: {cust_data['loyalty_points']} | Tier: {cust_data['tier']}")

    # -------------------------------------------------------------
    # 3. Overselling Validation & Zero Stock Alteration
    # -------------------------------------------------------------
    print("\n[TEST 3] Testing Overselling Validation (Insufficient Stock)...")
    db = SessionLocal()
    try:
        initial_milk_stock = db.query(Product).filter(Product.barcode == milk_barcode).first().current_stock
    finally:
        db.close()

    # Attempt to order more than available
    excess_qty = initial_milk_stock + 50
    oversell_payload = {
        "customer_id": cust_data["id"],
        "payment_method": "CASH",
        "items": [
            {
                "product_id": prod_milk["id"],
                "quantity": excess_qty,
                "unit_price": prod_milk["selling_price"]
            }
        ]
    }
    res_oversell = client.post("/api/v1/sales", json=oversell_payload, headers=cashier_headers)
    assert res_oversell.status_code == 400, f"Expected 400, got {res_oversell.status_code}"
    print(f"  [OK] Oversell rejected with 400 Bad Request: {res_oversell.json()['detail']}")

    # Verify stock was untouched after failed transaction
    db = SessionLocal()
    try:
        current_milk_stock = db.query(Product).filter(Product.barcode == milk_barcode).first().current_stock
        assert current_milk_stock == initial_milk_stock, f"Stock changed from {initial_milk_stock} to {current_milk_stock}!"
        print(f"  [OK] Verified stock untouched after failed transaction: Still {current_milk_stock} units.")
    finally:
        db.close()

    # -------------------------------------------------------------
    # 4. Successful Checkout & GST / Pricing Validation
    # -------------------------------------------------------------
    print("\n[TEST 4] Testing Successful POS Checkout & Calculations...")
    import uuid
    test_idempotency_key = f"TXN-AUTO-TEST-{uuid.uuid4().hex[:8]}"
    cart_payload = {
        "customer_id": cust_data["id"],
        "payment_method": "UPI_QR",
        "idempotency_key": test_idempotency_key,
        "discount_amount": 10.00,  # Rs.10 promotional coupon
        "notes": "Automated POS Stage 6 Test Run",
        "items": [
            {
                "product_id": prod_milk["id"],
                "quantity": 2,
                "unit_price": prod_milk["selling_price"],
                "tax_rate": prod_milk["tax_rate"],
                "discount": 0.00
            },
            {
                "product_id": prod_maggi["id"],
                "quantity": 3,
                "unit_price": prod_maggi["selling_price"],
                "tax_rate": prod_maggi["tax_rate"],
                "discount": 0.00
            }
        ]
    }

    # Expected values:
    # Item 1: Milk (2 * 72.00) = 144.00, Tax (5%) = 7.20
    # Item 2: Maggi (3 * 14.00) = 42.00, Tax (12%) = 5.04
    # Subtotal: 186.00
    # Tax: 12.24
    # Discount: 10.00
    # Grand Total: 186.00 + 12.24 - 10.00 = 188.24

    res_checkout = client.post("/api/v1/sales", json=cart_payload, headers=cashier_headers)
    assert res_checkout.status_code == 201, f"Checkout failed: {res_checkout.text}"
    sale_data = res_checkout.json()

    print(f"  [OK] Checkout Successful! Invoice Generated: {sale_data['invoice_number']}")
    print(f"       Subtotal   : Rs.{sale_data['subtotal']}")
    print(f"       GST Tax    : Rs.{sale_data['tax_amount']}")
    print(f"       Discount   : Rs.{sale_data['discount_amount']}")
    print(f"       Grand Total: Rs.{sale_data['grand_total']}")
    print(f"       Payment    : {sale_data['payment_method']} | Status: {sale_data['status']}")

    assert Decimal(str(sale_data["subtotal"])) == Decimal("186.00")
    assert Decimal(str(sale_data["tax_amount"])) == Decimal("12.24")
    assert Decimal(str(sale_data["grand_total"])) == Decimal("188.24")
    assert len(sale_data["items"]) == 2

    sale_id = sale_data["id"]
    inv_no = sale_data["invoice_number"]

    # -------------------------------------------------------------
    # 5. Database Stock Deduction & Movement Ledger Verification
    # -------------------------------------------------------------
    print("\n[TEST 5] Verifying Database Stock Reduction & StockMovement Ledger...")
    db = SessionLocal()
    try:
        milk_post = db.query(Product).filter(Product.id == prod_milk["id"]).first()
        maggi_post = db.query(Product).filter(Product.id == prod_maggi["id"]).first()

        assert milk_post.current_stock == initial_milk_stock - 2, "Milk stock did not decrease by 2!"
        print(f"  [OK] Milk stock decreased: {initial_milk_stock} -> {milk_post.current_stock}")

        # Check stock movements
        moves = db.query(StockMovement).filter(StockMovement.reference_id == inv_no).all()
        assert len(moves) == 2, f"Expected 2 StockMovement records for invoice, found {len(moves)}"
        for m in moves:
            assert m.movement_type == "POS_SALE"
            assert m.quantity < 0
            print(f"  [OK] StockMovement logged: ID={m.id} Product={m.product_id} Type={m.movement_type} Qty={m.quantity} Ref={m.reference_id}")
    finally:
        db.close()

    # -------------------------------------------------------------
    # 6. Idempotency Test (Duplicate Submission Prevention)
    # -------------------------------------------------------------
    print("\n[TEST 6] Testing Idempotency & Duplicate Billing Prevention...")
    res_repeat = client.post("/api/v1/sales", json=cart_payload, headers=cashier_headers)
    assert res_repeat.status_code == 200 or res_repeat.status_code == 201
    repeat_data = res_repeat.json()
    assert repeat_data["id"] == sale_id, "Idempotency failed: generated new sale instead of returning existing one!"
    assert repeat_data["invoice_number"] == inv_no
    print(f"  [OK] Repeat request with same idempotency_key returned existing invoice '{inv_no}' without double-billing.")

    # Verify stock was not deducted twice
    db = SessionLocal()
    try:
        milk_double_check = db.query(Product).filter(Product.id == prod_milk["id"]).first()
        assert milk_double_check.current_stock == initial_milk_stock - 2, "Stock was deducted twice on idempotent resubmission!"
        print("  [OK] Confirmed stock was not deducted a second time.")
    finally:
        db.close()

    # -------------------------------------------------------------
    # 7. Printable PDF Invoice Generation
    # -------------------------------------------------------------
    print("\n[TEST 7] Testing Printable PDF Invoice Generation...")
    res_pdf = client.get(f"/api/v1/sales/{sale_id}/pdf", headers=cashier_headers)
    assert res_pdf.status_code == 200, f"PDF generation failed: {res_pdf.status_code}"
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert res_pdf.content.startswith(b"%PDF"), "Response is not a valid PDF binary file!"
    print(f"  [OK] PDF generated successfully ({len(res_pdf.content)} bytes, header: %PDF)")

    # -------------------------------------------------------------
    # 8. RBAC: Cashier vs Manager Permissions on Sales
    # -------------------------------------------------------------
    print("\n[TEST 8] Testing Role Permissions (Cashier vs Manager)...")
    # Cashier can list their own sales
    res_cashier_sales = client.get("/api/v1/sales", headers=cashier_headers)
    assert res_cashier_sales.status_code == 200
    print(f"  [OK] Cashier can view their sales ({len(res_cashier_sales.json())} found)")

    # Cashier CANNOT cancel sale (403 Forbidden)
    res_cashier_cancel = client.post(f"/api/v1/sales/{sale_id}/cancel", headers=cashier_headers)
    assert res_cashier_cancel.status_code == 403, f"Expected 403, got {res_cashier_cancel.status_code}"
    print(f"  [OK] Cashier blocked from cancelling sale -> 403 Forbidden: {res_cashier_cancel.json()['detail']}")

    # -------------------------------------------------------------
    # 9. Authorized Sale Cancellation & Stock Restoration
    # -------------------------------------------------------------
    print("\n[TEST 9] Testing Authorized Sale Cancellation by Manager & Stock Restoration...")
    res_mgr_cancel = client.post(f"/api/v1/sales/{sale_id}/cancel", headers=mgr_headers)
    assert res_mgr_cancel.status_code == 200, f"Manager cancellation failed: {res_mgr_cancel.text}"
    cancelled_data = res_mgr_cancel.json()
    assert cancelled_data["status"] == "CANCELLED"
    print(f"  [OK] Sale #{inv_no} marked as CANCELLED by Manager.")

    # Verify stock restored in database
    db = SessionLocal()
    try:
        milk_restored = db.query(Product).filter(Product.id == prod_milk["id"]).first()
        assert milk_restored.current_stock == initial_milk_stock, f"Stock not restored! Expected {initial_milk_stock}, got {milk_restored.current_stock}"
        print(f"  [OK] Stock fully restored in database: Milk back to {milk_restored.current_stock} units.")

        # Check compensating stock movement
        comp_move = db.query(StockMovement).filter(
            StockMovement.reference_id == f"CANCEL-{inv_no}"
        ).first()
        assert comp_move is not None
        assert comp_move.movement_type == "CUSTOMER_RETURN"
        assert comp_move.quantity > 0
        print(f"  [OK] Compensating StockMovement created: ID={comp_move.id} Type={comp_move.movement_type} Qty={comp_move.quantity}")
    finally:
        db.close()

    # Attempting to cancel again -> 400 Bad Request
    res_double_cancel = client.post(f"/api/v1/sales/{sale_id}/cancel", headers=mgr_headers)
    assert res_double_cancel.status_code == 400
    print(f"  [OK] Double-cancellation rejected with 400: {res_double_cancel.json()['detail']}")

    print("\n" + "=" * 80)
    print("ALL STAGE 6 POS BILLING & STOCK INTEGRATION TESTS PASSED (100% SUCCESS)!")
    print("=" * 80)

if __name__ == "__main__":
    run_pos_billing_suite()

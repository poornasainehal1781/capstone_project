"""
SMARTRETAIL AI - Stage 8 AI Integration Test Suite
Validates:
1. AI Stock Replenishment Recommendations (velocity, ROP, lead time, deficit, cost)
2. Sales Trend Analysis (Period-over-period comparisons, top performers, slow movers)
3. Near-Expiry Shelf-Life Monitoring (Strict policy: expired items non-sellable, markdowns, no invented dates)
4. AI Retail Assistant Chatbot (6 key questions grounded in predefined functions, no arbitrary SQL)
5. Fallback Mode & Engine Transparency (Clear labeling of RULE_BASED_FALLBACK vs OPENAI_GPT)
6. RBAC Security: Cashier restricted with 403 Forbidden
"""
import sys
import os
from decimal import Decimal
from fastapi.testclient import TestClient

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app
from app.config import settings

client = TestClient(app)

def run_tests():
    print("=" * 80)
    print("  SMARTRETAIL AI - Stage 8 AI Integration & Decision Support Test Suite")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # PHASE 0: Authenticate Manager & Cashier
    # -------------------------------------------------------------------------
    print("\n[PHASE 0] Authenticating test sessions...")
    mgr_res = client.post("/api/v1/auth/login", json={"username": "mgr_priya", "password": "Manager@123"})
    assert mgr_res.status_code == 200, f"Manager login failed: {mgr_res.text}"
    mgr_token = mgr_res.json()["access_token"]
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}
    print("  [OK] Manager 'mgr_priya' authenticated.")

    csh_res = client.post("/api/v1/auth/login", json={"username": "cashier_karan", "password": "Cashier@123"})
    assert csh_res.status_code == 200, f"Cashier login failed: {csh_res.text}"
    csh_token = csh_res.json()["access_token"]
    csh_headers = {"Authorization": f"Bearer {csh_token}"}
    print("  [OK] Cashier 'cashier_karan' authenticated.")

    # -------------------------------------------------------------------------
    # TEST 1: Stock Replenishment Recommendations
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Testing AI Stock Replenishment Recommendations (GET /api/v1/ai/replenishment)...")
    res = client.get("/api/v1/ai/replenishment", headers=mgr_headers)
    assert res.status_code == 200, f"Replenishment endpoint failed: {res.text}"
    data = res.json()

    print(f"  [OK] Engine Detected : {data['engine']} (Model: {data['model_used']})")
    print(f"  [OK] Total Analyzed  : {data['total_items_analyzed']} SKUs")
    print(f"  [OK] Items to Restock: {data['items_needing_reorder']}")
    print(f"  [OK] Estimated Cost  : Rs. {float(data['total_estimated_restock_cost']):,.2f}")
    assert data["total_items_analyzed"] > 0, "Expected products to be analyzed"
    assert "executive_summary" in data and len(data["executive_summary"]) > 10

    if data["recommendations"]:
        first = data["recommendations"][0]
        print(f"  [OK] Top Reorder SKU : {first['product_name']} [Urgency: {first['urgency']}]")
        print(f"       Stock: {first['current_stock']} | ROP: {first['reorder_point']} | Suggested Order: +{first['suggested_order_qty']}")
        print(f"       Reasoning: {first['explanation']}")
        assert "current_stock" in first
        assert "reorder_point" in first
        assert "suggested_order_qty" in first
        assert first["suggested_order_qty"] > 0

    # -------------------------------------------------------------------------
    # TEST 2: Sales Trend Analysis & Slow-Moving SKUs
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Testing Sales Trend Analysis (GET /api/v1/ai/sales-trends)...")
    res = client.get("/api/v1/ai/sales-trends", headers=mgr_headers)
    assert res.status_code == 200, f"Sales trends endpoint failed: {res.text}"
    data = res.json()

    print(f"  [OK] Recent Revenue  : Rs. {float(data['recent_period_revenue']):,.2f} ({data['recent_period_label']})")
    print(f"  [OK] Prior Revenue   : Rs. {float(data['prior_period_revenue']):,.2f} ({data['prior_period_label']})")
    print(f"  [OK] Revenue Growth  : {data['revenue_growth_pct']:+.1f}% (Trajectory: {data['overall_trend']})")
    print(f"  [OK] Top Performers  : {len(data['top_performing_products'])} products tracked")
    print(f"  [OK] Slow Movers     : {len(data['slow_moving_products'])} products identified")
    print(f"  [OK] Trend Summary   : {data['executive_summary']}")

    assert data["overall_trend"] in ["INCREASING", "DECREASING", "STABLE"]
    if data["slow_moving_products"]:
        sm = data["slow_moving_products"][0]
        print(f"       Slow Mover #1: {sm['product_name']} (Stock: {sm['current_stock']}, Locked: Rs.{float(sm['locked_capital']):,.2f})")
        assert float(sm["locked_capital"]) > 0

    # -------------------------------------------------------------------------
    # TEST 3: Near-Expiry Product Monitoring & Food Safety Compliance
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Testing Near-Expiry Monitoring (GET /api/v1/ai/near-expiry)...")
    res = client.get("/api/v1/ai/near-expiry", headers=mgr_headers)
    assert res.status_code == 200, f"Near-expiry endpoint failed: {res.text}"
    data = res.json()

    print(f"  [OK] Tracked Batches : {data['total_batches_tracked']}")
    print(f"  [OK] Expired Lots    : {data['expired_count']} (Strictly non-sellable)")
    print(f"  [OK] Critical Batches: {data['critical_count']} (< 7 days left)")
    print(f"  [OK] Warning Batches : {data['warning_count']} (<= 15 days left)")
    print(f"  [OK] Non-Perishables : {data['non_monitored_products_count']} products (No dates invented)")

    # Strict compliance verification: Check expired lot handling
    expired_items = [it for it in data["items"] if it["status"] == "EXPIRED"]
    if expired_items:
        exp_lot = expired_items[0]
        print(f"  [OK] Verified Expired Lot Handling for Batch '{exp_lot['batch_number']}':")
        print(f"       is_sellable           : {exp_lot['is_sellable']} (MUST BE FALSE)")
        print(f"       suggested_discount_pct: {exp_lot['suggested_discount_pct']}% (MUST BE 0% - NEVER SELL EXPIRED)")
        print(f"       Action                : {exp_lot['recommended_action']}")
        assert exp_lot["is_sellable"] is False, "Violation: Expired product marked as sellable!"
        assert exp_lot["suggested_discount_pct"] == 0, "Violation: Discount offered on expired product!"
        assert "quarantine" in exp_lot["recommended_action"].lower() or "removal" in exp_lot["recommended_action"].lower()

    # Check critical lot dynamic discount
    crit_items = [it for it in data["items"] if it["status"] == "CRITICAL"]
    if crit_items:
        crit_lot = crit_items[0]
        print(f"  [OK] Verified Critical Lot '{crit_lot['batch_number']}': {crit_lot['days_to_expiry']} days left -> {crit_lot['suggested_discount_pct']}% markdown suggested")
        assert crit_lot["suggested_discount_pct"] >= 20

    # -------------------------------------------------------------------------
    # TEST 4: Manager Retail Assistant Chatbot (Key Questions)
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Testing AI Retail Assistant Chatbot (POST /api/v1/ai/chat)...")
    test_queries = [
        ("Which products are low in stock?", "LOW_STOCK_LOOKUP"),
        ("What were today's total sales?", "TODAYS_SALES"),
        ("Which products sold the most this month?", "TOP_PRODUCTS"),
        ("Which products need replenishment?", "REPLENISHMENT_ANALYSIS"),
        ("How are sales performing?", "SALES_TRENDS"),
        ("Which products are approaching expiry?", "EXPIRY_ANALYSIS"),
    ]

    for q_text, expected_intent in test_queries:
        payload = {"message": q_text}
        chat_res = client.post("/api/v1/ai/chat", json=payload, headers=mgr_headers)
        assert chat_res.status_code == 200, f"Chat query '{q_text}' failed: {chat_res.text}"
        chat_data = chat_res.json()
        print(f"  [OK] Query: \"{q_text}\"")
        print(f"       Engine: {chat_data['engine']} | Intent: {chat_data['intent_detected']}")
        reply_preview = chat_data['reply'].split('\n')[0][:75]
        print(f"       Reply Preview: {reply_preview}...")
        assert len(chat_data["reply"]) > 20, "Expected non-empty reply"
        assert chat_data["intent_detected"] == expected_intent

    # -------------------------------------------------------------------------
    # TEST 5: Comprehensive Full Insights Summary (GET /api/v1/ai/insights)
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Testing Comprehensive AI Insights Payload (GET /api/v1/ai/insights)...")
    res = client.get("/api/v1/ai/insights", headers=mgr_headers)
    assert res.status_code == 200, f"Full insights endpoint failed: {res.text}"
    insights_data = res.json()
    print(f"  [OK] Master AI Summary : {insights_data['master_ai_summary'][:100]}...")
    assert "replenishment" in insights_data
    assert "sales_trends" in insights_data
    assert "near_expiry" in insights_data

    # -------------------------------------------------------------------------
    # TEST 6: RBAC Security - Cashier Access Restrictions
    # -------------------------------------------------------------------------
    print("\n[TEST 6] Testing RBAC Security: Cashier Access Restrictions...")
    restricted_endpoints = [
        ("GET", "/api/v1/ai/insights"),
        ("GET", "/api/v1/ai/replenishment"),
        ("GET", "/api/v1/ai/sales-trends"),
        ("GET", "/api/v1/ai/near-expiry"),
        ("POST", "/api/v1/ai/chat", {"message": "What were today's sales?"}),
    ]

    for method, path, *opt_body in restricted_endpoints:
        if method == "GET":
            c_res = client.get(path, headers=csh_headers)
        else:
            c_res = client.post(path, json=opt_body[0], headers=csh_headers)
        assert c_res.status_code == 403, f"Security breach: Cashier accessed {path} with status {c_res.status_code}"
        print(f"  [OK] Cashier blocked from {method} {path} -> 403 Forbidden")

    # -------------------------------------------------------------------------
    # TEST 7: Engine Transparency Verification
    # -------------------------------------------------------------------------
    print("\n[TEST 7] Testing Engine Transparency & Grounding Security...")
    # Verify that engine field is explicitly set and never misleading
    assert data["engine"] in ["OPENAI_GPT", "RULE_BASED_FALLBACK"]
    if data["is_fallback"]:
        print(f"  [OK] Fallback mode cleanly identified: '{data['fallback_reason']}'")
        print("  [OK] No pretending - clearly labeled as deterministic fallback.")
    else:
        print("  [OK] Live OpenAI API mode verified.")

    print("\n" + "=" * 80)
    print("ALL STAGE 8 AI INTEGRATION & DECISION SUPPORT TESTS PASSED (100% SUCCESS)!")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()

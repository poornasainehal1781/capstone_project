import datetime
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from app.services.retail_analytics_grounding import (
    get_today_sales_grounding,
    get_low_stock_grounding,
    get_month_top_products_grounding,
    get_replenishment_grounding,
    get_sales_trends_grounding,
    get_near_expiry_grounding,
    get_store_grounding_context_for_ai
)

class RuleBasedDecisionEngine:
    """
    Deterministic Supermarket Decision Logic Engine.
    Operates independently of cloud LLMs when OPENAI_API_KEY is not configured or unreachable.
    Provides mathematically sound, explainable, and policy-compliant retail insights.
    """

    @classmethod
    def generate_replenishment_summary(cls, repl_data: Dict[str, Any]) -> str:
        count = repl_data["items_needing_reorder"]
        cost = repl_data["total_estimated_restock_cost"]
        if count == 0:
            return (
                "Inventory levels across all catalog categories are currently operating at healthy safety buffers. "
                "No immediate purchase orders required."
            )
        critical_items = [r["product_name"] for r in repl_data["recommendations"] if r["urgency"] == "CRITICAL"]
        crit_str = f" Critical stockouts: {', '.join(critical_items)}." if critical_items else ""
        return (
            f"Evaluated {repl_data['total_items_analyzed']} SKUs against 30-day velocity and supplier lead times. "
            f"{count} products are at or below Reorder Points (ROP) representing an estimated restock procurement of Rs. {cost:,.2f}.{crit_str}"
        )

    @classmethod
    def generate_sales_trends_summary(cls, trend_data: Dict[str, Any]) -> str:
        recent_rev = trend_data["recent_period_revenue"]
        prior_rev = trend_data["prior_period_revenue"]
        growth = trend_data["revenue_growth_pct"]
        trend = trend_data["overall_trend"]
        orders = trend_data["recent_orders"]
        slow_count = len(trend_data["slow_moving_products"])

        direction = "upward" if trend == "INCREASING" else "downward" if trend == "DECREASING" else "stable"
        return (
            f"Past 7-day revenue reached Rs. {recent_rev:,.2f} across {orders} transactions, showing a {direction} trajectory "
            f"({'+' if growth >= 0 else ''}{growth:.1f}% compared to Rs. {prior_rev:,.2f} in the prior week). "
            f"Identified {slow_count} slow-moving inventory lines requiring visual merchandising or promotional bundling."
        )

    @classmethod
    def answer_chat_query(cls, query: str, db: Session) -> Dict[str, Any]:
        """
        Deterministic intent router for manager-facing retail queries.
        Predefined, safe, parameterized data retrieval only.
        """
        q = query.lower().strip()

        # 1. Low stock / stockouts
        if (
            any(w in q for w in ["low stock", "low in stock", "low on stock", "out of stock", "shortage", "running low", "depleted", "stock low"])
            or ("low" in q and "stock" in q)
        ):
            data = get_low_stock_grounding(db)
            low_items = data["low_stock_items"]
            out_items = data["out_of_stock_items"]

            if not low_items and not out_items:
                reply = (
                    "**Stock Status: Healthy**\n\n"
                    "All products are currently stocked above their minimum safety thresholds. No shortages detected."
                )
            else:
                lines = []
                lines.append(f"Found **{len(out_items)} out-of-stock** and **{len(low_items)} low-stock** items:\n")
                if out_items:
                    lines.append("**Out of Stock (Zero Units):**")
                    for item in out_items[:5]:
                        lines.append(f"• **{item['name']}** (Barcode: `{item['barcode']}`) - Current: 0 {item['unit']} (ROP: {item['min_stock_level']})")
                if low_items:
                    lines.append("\n**Low Stock (Below Safety Level):**")
                    for item in low_items[:5]:
                        lines.append(f"• **{item['name']}** - Current: {item['current_stock']} {item['unit']} (Min: {item['min_stock_level']})")
                lines.append("\n*Recommendation: Open the AI Insights Restock tab to generate purchase orders.*")
                reply = "\n".join(lines)

            return {
                "reply": reply,
                "intent": "LOW_STOCK_LOOKUP",
                "grounding_data": data,
                "suggested_actions": [
                    {"label": "Review Replenishment", "target_page": "ai-insights", "action_type": "NAVIGATE"},
                    {"label": "Open Inventory", "target_page": "inventory", "action_type": "NAVIGATE"}
                ]
            }

        # 2. Today's sales / revenue
        if any(w in q for w in ["today", "today's", "sales today", "today sales", "revenue today", "daily revenue"]):
            data = get_today_sales_grounding(db)
            rev = data["total_revenue"]
            orders = data["total_orders"]
            aov = data["average_basket_value"]
            tenders = data["tender_distribution"]
            tender_str = ", ".join(f"{k}: {v}" for k, v in tenders.items()) if tenders else "No transactions yet"

            reply = (
                f"**Today's Store Performance ({data['date']}):**\n\n"
                f"• **Total Revenue:** Rs. {rev:,.2f}\n"
                f"• **Completed Orders:** {orders} transactions\n"
                f"• **Average Basket Value (AOV):** Rs. {aov:,.2f}\n"
                f"• **Tender Distribution:** {tender_str}\n\n"
                f"Real-time totals computed from PostgreSQL completed billing invoices."
            )
            return {
                "reply": reply,
                "intent": "TODAYS_SALES",
                "grounding_data": data,
                "suggested_actions": [
                    {"label": "View Sales Reports", "target_page": "reports", "action_type": "NAVIGATE"}
                ]
            }

        # 3. Best selling / top products
        if any(w in q for w in ["sold the most", "top selling", "best seller", "best selling", "popular", "top product"]):
            data = get_month_top_products_grounding(db, limit=5)
            if not data:
                reply = "No sales records found in the past 30 days to determine top selling products."
            else:
                lines = ["**Top 5 Best-Selling Products (Past 30 Days):**\n"]
                for idx, p in enumerate(data, start=1):
                    lines.append(
                        f"{idx}. **{p['product_name']}** ({p['category']})\n"
                        f"   • Units Sold: **{p['units_sold']}** | Total Revenue: **Rs. {p['total_revenue']:,.2f}**"
                    )
                reply = "\n".join(lines)

            return {
                "reply": reply,
                "intent": "TOP_PRODUCTS",
                "grounding_data": {"top_products": data},
                "suggested_actions": [
                    {"label": "Explore Analytics", "target_page": "dashboard", "action_type": "NAVIGATE"}
                ]
            }

        # 4. Replenishment / Restock
        if any(w in q for w in ["replenish", "replenishment", "reorder", "restock", "purchase order"]):
            data = get_replenishment_grounding(db)
            items = data["recommendations"]
            if not items:
                reply = "All products are stocked above reorder thresholds. No replenishment is needed today."
            else:
                lines = [
                    f"**Replenishment Needed for {len(items)} Items** (Est. Cost: Rs. {data['total_estimated_restock_cost']:,.2f}):\n"
                ]
                for r in items[:5]:
                    lines.append(
                        f"• **{r['product_name']}** [{r['urgency']}]\n"
                        f"  Stock: {r['current_stock']} | Velocity: {r['average_daily_sales']} units/day | "
                        f"Recommended Order: **+{r['suggested_order_qty']} units** (Rs. {r['estimated_cost']:,.2f})"
                    )
                lines.append("\n*Click below to auto-generate pre-filled Purchase Orders.*")
                reply = "\n".join(lines)

            return {
                "reply": reply,
                "intent": "REPLENISHMENT_ANALYSIS",
                "grounding_data": data,
                "suggested_actions": [
                    {"label": "Open Restock Center", "target_page": "ai-insights", "action_type": "NAVIGATE"},
                    {"label": "Create Purchase Order", "target_page": "purchases", "action_type": "NAVIGATE"}
                ]
            }

        # 5. Expiry / near expiry
        if any(w in q for w in ["expir", "expire", "expiry", "shelf life", "perish"]):
            data = get_near_expiry_grounding(db)
            items = data["items"]
            expired = data["expired_count"]
            critical = data["critical_count"]

            lines = ["**Batch Shelf-Life & Expiry Analysis:**\n"]
            if expired > 0:
                lines.append(
                    f"⚠️ **URGENT POLICY ALERT: {expired} batch(es) have EXPIRED!**\n"
                    f"*Strict supermarket safety rule: Expired goods MUST NEVER be sold.* "
                    f"Immediately quarantine from retail floor for vendor return or write-off.\n"
                )
            if critical > 0:
                lines.append(f"**Near-Expiry Critical Batches (< 7 Days Left):**")
                for item in [it for it in items if it["status"] == "CRITICAL"][:3]:
                    lines.append(
                        f"• **{item['product_name']}** (Batch `{item['batch_number']}`): "
                        f"Expires in **{item['days_to_expiry']} days** ({item['expiry_date']}) - "
                        f"Action: Apply 30% Dynamic Markdown"
                    )

            if expired == 0 and critical == 0:
                lines.append("No batches are currently expired or in critical expiry condition (< 7 days).")

            lines.append(f"\n*(Note: {data['non_monitored_products_count']} non-perishable SKUs have no active expiry lots.)*")
            reply = "\n".join(lines)

            return {
                "reply": reply,
                "intent": "EXPIRY_ANALYSIS",
                "grounding_data": data,
                "suggested_actions": [
                    {"label": "Open Expiry Radar", "target_page": "inventory", "action_type": "NAVIGATE"}
                ]
            }

        # 6. General sales performance / trends
        if any(w in q for w in ["perform", "trend", "sales", "revenue", "how are we doing"]):
            data = get_sales_trends_grounding(db)
            reply = (
                f"**Store Sales Performance Analysis:**\n\n"
                f"• **Past 7 Days:** Rs. {data['recent_period_revenue']:,.2f} ({data['recent_orders']} orders)\n"
                f"• **Prior 7 Days:** Rs. {data['prior_period_revenue']:,.2f} ({data['prior_orders']} orders)\n"
                f"• **Growth Trajectory:** {data['overall_trend']} ({'+' if data['revenue_growth_pct'] >= 0 else ''}{data['revenue_growth_pct']:.1f}%)\n\n"
                f"Top growing item: {data['top_performing_products'][0]['product_name'] if data['top_performing_products'] else 'N/A'}.\n"
                f"Slow-moving SKUs identified: {len(data['slow_moving_products'])} products."
            )
            return {
                "reply": reply,
                "intent": "SALES_TRENDS",
                "grounding_data": data,
                "suggested_actions": [
                    {"label": "Sales Reports", "target_page": "reports", "action_type": "NAVIGATE"}
                ]
            }

        # Default fallback
        ctx = get_store_grounding_context_for_ai(db)
        reply = (
            f"I analyzed current store operations from database records.\n\n"
            f"• **Today's Revenue:** Rs. {ctx['store_kpis']['today_revenue']:,.2f} ({ctx['store_kpis']['today_orders']} orders)\n"
            f"• **Weekly Sales Trend:** {ctx['store_kpis']['overall_sales_trend']} ({ctx['store_kpis']['growth_rate_pct']:+.1f}%)\n"
            f"• **Low Stock Alerts:** {ctx['low_stock_summary']['low_stock_count']} items below ROP\n"
            f"• **Near-Expiry Batches:** {len(ctx['near_expiry_batches'])} batches flagged\n\n"
            f"You can ask me specific questions like: 'Which products are low in stock?', 'What were today's total sales?', or 'Which products need replenishment?'"
        )
        return {
            "reply": reply,
            "intent": "GENERAL_SUMMARY",
            "grounding_data": ctx,
            "suggested_actions": [
                {"label": "AI Restock Center", "target_page": "ai-insights", "action_type": "NAVIGATE"},
                {"label": "Dashboard Overview", "target_page": "dashboard", "action_type": "NAVIGATE"}
            ]
        }

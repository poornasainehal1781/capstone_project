import datetime
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, and_

from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.models.category import Category
from app.models.supplier import Supplier
from app.models.purchase import Purchase, PurchaseItem
from app.models.batch import ProductBatch

def get_today_sales_grounding(db: Session) -> Dict[str, Any]:
    """
    Secure predefined function: Today's sales performance.
    Guarantees no raw SQL execution.
    """
    now = datetime.datetime.now()
    start_today = datetime.datetime(now.year, now.month, now.day, 0, 0, 0)
    end_today = start_today + datetime.timedelta(days=1)

    today_sales = (
        db.query(Sale)
        .filter(Sale.status == "COMPLETED", Sale.created_at >= start_today, Sale.created_at < end_today)
        .all()
    )

    revenue = sum(Decimal(str(s.grand_total)) for s in today_sales)
    order_count = len(today_sales)
    avg_order = (revenue / order_count) if order_count > 0 else Decimal("0.00")

    tenders = {}
    for s in today_sales:
        tenders[s.payment_method] = tenders.get(s.payment_method, 0) + 1

    return {
        "date": start_today.strftime("%Y-%m-%d"),
        "total_revenue": round(revenue, 2),
        "total_orders": order_count,
        "average_basket_value": round(avg_order, 2),
        "tender_distribution": tenders
    }

def get_low_stock_grounding(db: Session) -> Dict[str, Any]:
    """
    Secure predefined function: Items below reorder safety levels.
    """
    products = db.query(Product).order_by(Product.name.asc()).all()
    low_stock = []
    out_of_stock = []

    for p in products:
        cat_name = p.category.name if p.category else "General"
        if p.current_stock <= 0:
            out_of_stock.append({
                "product_id": p.id,
                "name": p.name,
                "barcode": p.barcode,
                "category": cat_name,
                "current_stock": p.current_stock,
                "min_stock_level": p.min_stock_level,
                "unit": p.unit
            })
        elif p.current_stock <= p.min_stock_level:
            low_stock.append({
                "product_id": p.id,
                "name": p.name,
                "barcode": p.barcode,
                "category": cat_name,
                "current_stock": p.current_stock,
                "min_stock_level": p.min_stock_level,
                "unit": p.unit
            })

    return {
        "total_products_checked": len(products),
        "low_stock_count": len(low_stock),
        "out_of_stock_count": len(out_of_stock),
        "low_stock_items": low_stock,
        "out_of_stock_items": out_of_stock
    }

def get_month_top_products_grounding(db: Session, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Secure predefined function: Best-selling items in the past 30 days.
    """
    now = datetime.datetime.now()
    start_30d = now - datetime.timedelta(days=30)

    rows = (
        db.query(
            Product.id,
            Product.name,
            Product.barcode,
            Category.name.label("category_name"),
            func.sum(SaleItem.quantity).label("units_sold"),
            func.sum(SaleItem.line_total).label("total_revenue")
        )
        .join(SaleItem, SaleItem.product_id == Product.id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .outerjoin(Category, Category.id == Product.category_id)
        .filter(Sale.status == "COMPLETED", Sale.created_at >= start_30d)
        .group_by(Product.id, Product.name, Product.barcode, Category.name)
        .order_by(desc("units_sold"))
        .limit(limit)
        .all()
    )

    return [
        {
            "product_id": r.id,
            "product_name": r.name,
            "barcode": r.barcode,
            "category": r.category_name or "General",
            "units_sold": int(r.units_sold or 0),
            "total_revenue": round(Decimal(str(r.total_revenue or "0.00")), 2)
        }
        for r in rows
    ]

def get_replenishment_grounding(db: Session) -> Dict[str, Any]:
    """
    Secure predefined function: Replenishment analytics.
    Calculates historical 30-day velocity, lead time, ROP, and deficit.
    """
    now = datetime.datetime.now()
    start_30d = now - datetime.timedelta(days=30)

    # 1. Sales velocity per product over 30 days
    sales_30d = (
        db.query(
            SaleItem.product_id,
            func.sum(SaleItem.quantity).label("units_sold")
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.status == "COMPLETED", Sale.created_at >= start_30d)
        .group_by(SaleItem.product_id)
        .all()
    )
    velocity_map = {row.product_id: (float(row.units_sold) / 30.0) for row in sales_30d}

    # 2. Supplier mapping
    suppliers = db.query(Supplier).all()
    default_supplier = suppliers[0].name if suppliers else "Authorized Regional Distributor"

    # 3. Product scan
    products = db.query(Product).order_by(Product.name.asc()).all()
    replenishment_items = []
    total_estimated_cost = Decimal("0.00")

    for p in products:
        daily_velocity = velocity_map.get(p.id, 0.0)
        lead_time = 3 if p.is_perishable else 5  # Perishables express 3 days, dry goods 5 days
        safety_stock = p.min_stock_level
        # Deterministic Reorder Point (ROP) = (Velocity * Lead Time) + Safety Stock
        rop = int((daily_velocity * lead_time) + safety_stock)
        rop = max(rop, p.min_stock_level)

        days_remaining = (p.current_stock / daily_velocity) if daily_velocity > 0.05 else 999.0

        needs_reorder = p.current_stock <= rop or p.current_stock <= p.min_stock_level

        if needs_reorder:
            # Reorder quantity targets 14 days of coverage + safety stock
            target_stock = int(daily_velocity * 14) + safety_stock
            order_qty = max(target_stock - p.current_stock, 10)
            est_cost = Decimal(order_qty) * Decimal(str(p.cost_price))
            total_estimated_cost += est_cost

            # Urgency
            if p.current_stock <= 0:
                urgency = "CRITICAL"
            elif days_remaining <= lead_time:
                urgency = "HIGH"
            elif p.current_stock <= p.min_stock_level:
                urgency = "MEDIUM"
            else:
                urgency = "LOW"

            # Explainable reasoning
            if daily_velocity > 0:
                reason = (
                    f"Average daily velocity is {daily_velocity:.1f} {p.unit}/day with {p.current_stock} {p.unit} remaining "
                    f"({days_remaining:.1f} days of inventory left). "
                    f"With a {lead_time}-day lead time, ROP is {rop} units. "
                    f"A recommended order of {order_qty} units covers 14 days of projected demand."
                )
            else:
                reason = (
                    f"Current stock of {p.current_stock} {p.unit} is at or below the safety threshold of {p.min_stock_level}. "
                    f"Recommended baseline restock of {order_qty} units to maintain shelf availability."
                )

            replenishment_items.append({
                "product_id": p.id,
                "product_name": p.name,
                "sku": p.sku or f"SKU-{p.id}",
                "barcode": p.barcode,
                "category_name": p.category.name if p.category else "General",
                "current_stock": p.current_stock,
                "min_stock_level": p.min_stock_level,
                "average_daily_sales": round(daily_velocity, 2),
                "days_of_stock_remaining": round(days_remaining, 1),
                "lead_time_days": lead_time,
                "reorder_point": rop,
                "suggested_order_qty": order_qty,
                "estimated_cost": round(est_cost, 2),
                "supplier_name": default_supplier,
                "urgency": urgency,
                "explanation": reason
            })

    # Sort by urgency: CRITICAL -> HIGH -> MEDIUM -> LOW
    urgency_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    replenishment_items.sort(key=lambda x: urgency_rank.get(x["urgency"], 4))

    return {
        "total_items_analyzed": len(products),
        "items_needing_reorder": len(replenishment_items),
        "total_estimated_restock_cost": round(total_estimated_cost, 2),
        "recommendations": replenishment_items
    }

def get_sales_trends_grounding(db: Session) -> Dict[str, Any]:
    """
    Secure predefined function: Period-over-period sales trends.
    Compares Past 7 Days vs Prior 7 Days using real sales records.
    """
    now = datetime.datetime.now()
    p1_start = now - datetime.timedelta(days=7)
    p2_start = now - datetime.timedelta(days=14)

    # Recent 7 days sales
    recent_sales = (
        db.query(Sale)
        .filter(Sale.status == "COMPLETED", Sale.created_at >= p1_start)
        .all()
    )
    recent_rev = sum(Decimal(str(s.grand_total)) for s in recent_sales)
    recent_orders = len(recent_sales)

    # Prior 7 days sales
    prior_sales = (
        db.query(Sale)
        .filter(Sale.status == "COMPLETED", Sale.created_at >= p2_start, Sale.created_at < p1_start)
        .all()
    )
    prior_rev = sum(Decimal(str(s.grand_total)) for s in prior_sales)
    prior_orders = len(prior_sales)

    # Growth rate
    if prior_rev > 0:
        growth_pct = float(((recent_rev - prior_rev) / prior_rev) * 100)
    else:
        growth_pct = 100.0 if recent_rev > 0 else 0.0

    if growth_pct > 5.0:
        trend_label = "INCREASING"
    elif growth_pct < -5.0:
        trend_label = "DECREASING"
    else:
        trend_label = "STABLE"

    # Top performing products with period comparison
    recent_items = (
        db.query(
            SaleItem.product_id,
            func.sum(SaleItem.quantity).label("units")
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.status == "COMPLETED", Sale.created_at >= p1_start)
        .group_by(SaleItem.product_id)
        .all()
    )
    recent_item_map = {r.product_id: int(r.units) for r in recent_items}

    prior_items = (
        db.query(
            SaleItem.product_id,
            func.sum(SaleItem.quantity).label("units")
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.status == "COMPLETED", Sale.created_at >= p2_start, Sale.created_at < p1_start)
        .group_by(SaleItem.product_id)
        .all()
    )
    prior_item_map = {r.product_id: int(r.units) for r in prior_items}

    products = db.query(Product).all()
    top_performers = []
    slow_moving = []

    for p in products:
        r_qty = recent_item_map.get(p.id, 0)
        p_qty = prior_item_map.get(p.id, 0)

        if p_qty > 0:
            item_growth = float(((r_qty - p_qty) / p_qty) * 100)
        else:
            item_growth = 100.0 if r_qty > 0 else 0.0

        item_trend = "INCREASING" if item_growth > 5 else "DECREASING" if item_growth < -5 else "STABLE"

        cat_name = p.category.name if p.category else "General"

        if r_qty > 0 or p_qty > 0:
            top_performers.append({
                "product_id": p.id,
                "product_name": p.name,
                "category_name": cat_name,
                "recent_period_units": r_qty,
                "prior_period_units": p_qty,
                "growth_rate_pct": round(item_growth, 1),
                "trend_direction": item_trend,
                "analysis": (
                    f"{p.name} sold {r_qty} units in the last 7 days compared to {p_qty} units in the prior 7 days "
                    f"({'+' if item_growth >= 0 else ''}{item_growth:.1f}% growth)."
                )
            })

        # Identify slow moving: current stock is substantial, but sold 0 or 1 in recent 7 days
        if p.current_stock >= 20 and r_qty <= 1:
            locked = Decimal(p.current_stock) * Decimal(str(p.cost_price))
            slow_moving.append({
                "product_id": p.id,
                "product_name": p.name,
                "category_name": cat_name,
                "current_stock": p.current_stock,
                "units_sold_30d": r_qty,
                "locked_capital": round(locked, 2),
                "days_without_sale": 7 if r_qty == 0 else 3,
                "recommendation": (
                    f"High inventory ({p.current_stock} units, locking ₹{locked:,.2f}) with low weekly movement. "
                    f"Consider visual merchandising front-row relocation, secondary display, or promotional bundling."
                )
            })

    top_performers.sort(key=lambda x: x["recent_period_units"], reverse=True)
    slow_moving.sort(key=lambda x: x["locked_capital"], reverse=True)

    return {
        "recent_period_label": "Past 7 Days",
        "prior_period_label": "Prior 7 Days",
        "recent_period_revenue": round(recent_rev, 2),
        "prior_period_revenue": round(prior_rev, 2),
        "revenue_growth_pct": round(growth_pct, 1),
        "overall_trend": trend_label,
        "recent_orders": recent_orders,
        "prior_orders": prior_orders,
        "top_performing_products": top_performers[:8],
        "slow_moving_products": slow_moving[:6]
    }

def get_near_expiry_grounding(db: Session) -> Dict[str, Any]:
    """
    Secure predefined function: Near-expiry and expired lot analysis.
    Strictly enforces:
    - Never recommend selling expired products.
    - Do not invent expiry dates when data is unavailable.
    """
    today = datetime.date.today()

    # Query real batches
    batches = db.query(ProductBatch).filter(ProductBatch.is_active == True).all()

    # Total products vs perishable products count
    all_products = db.query(Product).all()
    unmonitored_count = sum(1 for p in all_products if not p.batches and not p.is_perishable)

    items = []
    expired_count = 0
    critical_count = 0
    warning_count = 0

    for b in batches:
        product = b.product
        days_left = (b.expiry_date - today).days

        if days_left < 0:
            # EXPIRED! NEVER RECOMMEND SELLING EXPIRED GOODS
            status = "EXPIRED"
            is_sellable = False
            discount = 0
            expired_count += 1
            action = "IMMEDIATE PHYSICAL REMOVAL: Quarantine stock from retail floor for vendor return or disposal."
            explanation = (
                f"Batch {b.batch_number} expired {abs(days_left)} days ago on {b.expiry_date}. "
                f"Strict food safety and supermarket policy prohibits sale. "
                f"Quarantine {b.current_quantity} units immediately and process credit debit note."
            )
        elif days_left <= 7:
            status = "CRITICAL"
            is_sellable = True
            discount = 30
            critical_count += 1
            action = "Apply 30% Dynamic Markdown & FEFO Priority Display"
            explanation = (
                f"Only {days_left} days remaining until expiry ({b.expiry_date}). "
                f"Urgent 30% price markdown recommended to liquidate {b.current_quantity} units before expiration."
            )
        elif days_left <= 15:
            status = "WARNING"
            is_sellable = True
            discount = 15
            warning_count += 1
            action = "Apply 15% Clearance Markdown & End-Cap Feature"
            explanation = (
                f"Expires in {days_left} days on {b.expiry_date}. "
                f"Promote with 15% discount to accelerate sell-through velocity."
            )
        elif days_left <= 30:
            status = "ATTENTION"
            is_sellable = True
            discount = 0
            action = "Pause Inward Replenishment & Monitor FEFO Velocity"
            explanation = (
                f"Expires in {days_left} days ({b.expiry_date}). "
                f"Do not order new stock until this batch is liquidated."
            )
        else:
            status = "OPTIMAL"
            is_sellable = True
            discount = 0
            action = "Standard FEFO Shelf Rotation"
            explanation = f"Healthy shelf life ({days_left} days remaining until {b.expiry_date})."

        items.append({
            "batch_id": b.id,
            "product_id": b.product_id,
            "product_name": product.name if product else f"Product #{b.product_id}",
            "barcode": product.barcode if product else "N/A",
            "category_name": product.category.name if product and product.category else "General",
            "batch_number": b.batch_number,
            "expiry_date": b.expiry_date.strftime("%Y-%m-%d"),
            "days_to_expiry": days_left,
            "current_quantity": b.current_quantity,
            "status": status,
            "recommended_action": action,
            "suggested_discount_pct": discount,
            "is_sellable": is_sellable,
            "explanation": explanation
        })

    # Sort so EXPIRED and CRITICAL come first
    status_order = {"EXPIRED": 0, "CRITICAL": 1, "WARNING": 2, "ATTENTION": 3, "OPTIMAL": 4}
    items.sort(key=lambda x: status_order.get(x["status"], 5))

    return {
        "total_batches_tracked": len(batches),
        "expired_count": expired_count,
        "critical_count": critical_count,
        "warning_count": warning_count,
        "items": items,
        "non_monitored_products_count": unmonitored_count
    }

def get_store_grounding_context_for_ai(db: Session) -> Dict[str, Any]:
    """
    Predefined context aggregator providing sanitized facts for OpenAI or Rule Engine.
    Ensures ZERO SQL execution and ZERO sensitive credential/customer leakage.
    """
    today_sales = get_today_sales_grounding(db)
    low_stock = get_low_stock_grounding(db)
    top_products = get_month_top_products_grounding(db, limit=5)
    replenishment = get_replenishment_grounding(db)
    trends = get_sales_trends_grounding(db)
    expiry = get_near_expiry_grounding(db)

    return {
        "store_kpis": {
            "today_revenue": float(today_sales["total_revenue"]),
            "today_orders": today_sales["total_orders"],
            "recent_7d_revenue": float(trends["recent_period_revenue"]),
            "prior_7d_revenue": float(trends["prior_period_revenue"]),
            "growth_rate_pct": trends["revenue_growth_pct"],
            "overall_sales_trend": trends["overall_trend"]
        },
        "low_stock_summary": {
            "low_stock_count": low_stock["low_stock_count"],
            "out_of_stock_count": low_stock["out_of_stock_count"],
            "items_below_rop": [item["name"] for item in low_stock["low_stock_items"][:5]]
        },
        "top_selling_products": [
            f"{p['product_name']} ({p['units_sold']} units, ₹{p['total_revenue']})"
            for p in top_products
        ],
        "urgent_replenishment_items": [
            f"{r['product_name']}: stock={r['current_stock']}, reorder={r['suggested_order_qty']} ({r['urgency']})"
            for r in replenishment["recommendations"][:5]
        ],
        "near_expiry_batches": [
            f"{e['product_name']} (Batch {e['batch_number']}): {e['days_to_expiry']} days left -> {e['status']}"
            for e in expiry["items"] if e["status"] in ["EXPIRED", "CRITICAL", "WARNING"]
        ],
        "expired_batches_quarantined": expiry["expired_count"]
    }


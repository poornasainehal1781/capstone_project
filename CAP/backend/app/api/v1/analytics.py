import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_

from app.database import get_db
from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.models.category import Category
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.stock_movement import StockMovement
from app.schemas.analytics import (
    DashboardStatsResponse,
    SalesAnalyticsResponse,
    InventoryAnalyticsResponse,
    SaleSummaryItem,
    TopProductItem,
    CategoryShareItem,
    TimeSeriesPoint,
    PaymentMethodStat,
    ProductStockSummary,
    ReplenishmentSuggestion,
    StockMovementSummary
)
from app.api.deps import get_current_user, get_current_manager

router = APIRouter()

CATEGORY_COLORS = [
    "#10b981",  # Emerald
    "#3b82f6",  # Blue
    "#f59e0b",  # Amber
    "#8b5cf6",  # Purple
    "#ec4899",  # Pink
    "#06b6d4",  # Cyan
    "#f97316",  # Orange
]

@router.get(
    "/dashboard",
    response_model=DashboardStatsResponse,
    summary="Main Store Executive Dashboard KPIs",
    description="Calculates real-time metrics, revenue totals, top SKUs, and category share from PostgreSQL."
)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    local_today = datetime.datetime.now().date()
    utc_today = datetime.datetime.now(datetime.timezone.utc).date()
    start_of_today = datetime.datetime.combine(min(local_today, utc_today), datetime.time.min)

    # 1. Total Completed Sales & Orders Count
    completed_sales = db.query(Sale).filter(Sale.status == "COMPLETED")
    total_sales_revenue = db.query(func.sum(Sale.grand_total)).filter(Sale.status == "COMPLETED").scalar() or Decimal("0.00")
    completed_orders_count = completed_sales.count()

    # 2. Today's Revenue & Orders
    today_sales_query = completed_sales.filter(Sale.created_at >= start_of_today)
    today_revenue = db.query(func.sum(Sale.grand_total)).filter(
        Sale.status == "COMPLETED",
        Sale.created_at >= start_of_today
    ).scalar() or Decimal("0.00")
    today_orders_count = today_sales_query.count()

    avg_order_value = round(today_revenue / Decimal(today_orders_count), 2) if today_orders_count > 0 else (
        round(total_sales_revenue / Decimal(completed_orders_count), 2) if completed_orders_count > 0 else Decimal("0.00")
    )

    # 3. Product & Inventory Counts
    total_products = db.query(Product).count()
    low_stock_count = db.query(Product).filter(
        Product.current_stock <= Product.min_stock_level,
        Product.current_stock > 0
    ).count()
    out_of_stock_count = db.query(Product).filter(Product.current_stock <= 0).count()
    total_customers = db.query(Customer).count()

    # 4. Recent Sales (Latest 8)
    recent_sales_raw = db.query(Sale).order_by(Sale.created_at.desc()).limit(8).all()
    recent_sales = [
        SaleSummaryItem(
            id=s.id,
            invoice_number=s.invoice_number,
            customer_name=s.customer.name if s.customer else "Walk-in Retail",
            cashier_name=s.cashier.full_name if s.cashier else f"User #{s.cashier_id}",
            grand_total=Decimal(str(s.grand_total)),
            payment_method=s.payment_method,
            status=s.status,
            created_at=s.created_at
        )
        for s in recent_sales_raw
    ]

    # 5. Top-Selling Products (Aggregated by units sold)
    top_items_query = (
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
        .filter(Sale.status == "COMPLETED")
        .group_by(Product.id, Product.name, Product.barcode, Category.name)
        .order_by(desc("units_sold"))
        .limit(6)
        .all()
    )

    top_selling_products = [
        TopProductItem(
            product_id=row.id,
            product_name=row.name,
            barcode=row.barcode,
            category_name=row.category_name or "General",
            units_sold=int(row.units_sold or 0),
            total_revenue=Decimal(str(row.total_revenue or "0.00"))
        )
        for row in top_items_query
    ]

    # 6. Category Revenue Share
    cat_query = (
        db.query(
            Category.id,
            Category.name,
            func.sum(SaleItem.line_total).label("total_revenue"),
            func.sum(SaleItem.quantity).label("units_sold")
        )
        .join(Product, Product.category_id == Category.id)
        .join(SaleItem, SaleItem.product_id == Product.id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.status == "COMPLETED")
        .group_by(Category.id, Category.name)
        .order_by(desc("total_revenue"))
        .all()
    )

    category_revenue_share = []
    for idx, row in enumerate(cat_query):
        color = CATEGORY_COLORS[idx % len(CATEGORY_COLORS)]
        category_revenue_share.append(
            CategoryShareItem(
                category_id=row.id,
                category_name=row.name,
                total_revenue=Decimal(str(row.total_revenue or "0.00")),
                units_sold=int(row.units_sold or 0),
                color=color
            )
        )

    return DashboardStatsResponse(
        total_sales_revenue=Decimal(str(total_sales_revenue)),
        completed_orders_count=completed_orders_count,
        total_products=total_products,
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        total_customers=total_customers,
        today_revenue=Decimal(str(today_revenue)),
        today_orders_count=today_orders_count,
        avg_order_value=avg_order_value,
        recent_sales=recent_sales,
        top_selling_products=top_selling_products,
        category_revenue_share=category_revenue_share
    )

@router.get(
    "/sales",
    response_model=SalesAnalyticsResponse,
    summary="Detailed Sales Analytics & Recharts Series",
    description="Provides daily, weekly, and monthly time-series, tender distribution, and category breakdowns."
)
def get_sales_analytics(
    period: str = Query("last_30_days", description="today, last_7_days, last_30_days, custom"),
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    now = datetime.datetime.now()
    today_date = now.date()

    # Determine date range
    if period == "today":
        start_date = today_date
        end_date = today_date
    elif period == "last_7_days":
        start_date = today_date - datetime.timedelta(days=7)
        end_date = today_date
    elif period == "last_30_days":
        start_date = today_date - datetime.timedelta(days=30)
        end_date = today_date
    elif period == "custom" and from_date and to_date:
        try:
            start_date = datetime.datetime.strptime(from_date, "%Y-%m-%d").date()
            end_date = datetime.datetime.strptime(to_date, "%Y-%m-%d").date()
            if start_date > end_date:
                raise HTTPException(status_code=400, detail="from_date cannot be after to_date.")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")
    else:
        start_date = today_date - datetime.timedelta(days=30)
        end_date = today_date

    start_dt = datetime.datetime.combine(start_date, datetime.time.min)
    end_dt = datetime.datetime.combine(end_date, datetime.time.max)

    # Base query for period
    sales_in_period = db.query(Sale).filter(
        Sale.status == "COMPLETED",
        Sale.created_at >= start_dt,
        Sale.created_at <= end_dt
    ).all()

    total_revenue = sum((Decimal(str(s.grand_total)) for s in sales_in_period), Decimal("0.00"))
    total_orders = len(sales_in_period)

    # 1. Daily Sales series
    daily_buckets = {}
    curr = start_date
    while curr <= end_date:
        key = curr.strftime("%Y-%m-%d")
        label = curr.strftime("%d %b")
        daily_buckets[key] = {"label": label, "date": key, "revenue": Decimal("0.00"), "orders": 0}
        curr += datetime.timedelta(days=1)

    for s in sales_in_period:
        s_date_str = s.created_at.date().strftime("%Y-%m-%d")
        if s_date_str in daily_buckets:
            daily_buckets[s_date_str]["revenue"] += Decimal(str(s.grand_total))
            daily_buckets[s_date_str]["orders"] += 1

    daily_sales = [
        TimeSeriesPoint(
            label=v["label"],
            date=v["date"],
            revenue=round(v["revenue"], 2),
            orders=v["orders"]
        )
        for v in sorted(daily_buckets.values(), key=lambda x: x["date"])
    ]

    # 2. Weekly Sales series (past 8 weeks from database)
    eight_weeks_ago = today_date - datetime.timedelta(days=56)
    eight_weeks_dt = datetime.datetime.combine(eight_weeks_ago, datetime.time.min)
    all_recent_sales = db.query(Sale).filter(
        Sale.status == "COMPLETED",
        Sale.created_at >= eight_weeks_dt
    ).all()

    weekly_buckets = {}
    for s in all_recent_sales:
        # ISO calendar week
        year, week_num, _ = s.created_at.isocalendar()
        w_key = f"{year}-W{week_num:02d}"
        w_label = f"Wk {week_num}"
        if w_key not in weekly_buckets:
            weekly_buckets[w_key] = {"label": w_label, "date": w_key, "revenue": Decimal("0.00"), "orders": 0}
        weekly_buckets[w_key]["revenue"] += Decimal(str(s.grand_total))
        weekly_buckets[w_key]["orders"] += 1

    weekly_sales = [
        TimeSeriesPoint(
            label=v["label"],
            date=v["date"],
            revenue=round(v["revenue"], 2),
            orders=v["orders"]
        )
        for v in sorted(weekly_buckets.values(), key=lambda x: x["date"])
    ]

    # 3. Monthly Sales series (past 6 months)
    six_months_ago = today_date - datetime.timedelta(days=180)
    six_months_dt = datetime.datetime.combine(six_months_ago, datetime.time.min)
    six_month_sales = db.query(Sale).filter(
        Sale.status == "COMPLETED",
        Sale.created_at >= six_months_dt
    ).all()

    monthly_buckets = {}
    for s in six_month_sales:
        m_key = s.created_at.strftime("%Y-%m")
        m_label = s.created_at.strftime("%b %Y")
        if m_key not in monthly_buckets:
            monthly_buckets[m_key] = {"label": m_label, "date": m_key, "revenue": Decimal("0.00"), "orders": 0}
        monthly_buckets[m_key]["revenue"] += Decimal(str(s.grand_total))
        monthly_buckets[m_key]["orders"] += 1

    monthly_sales = [
        TimeSeriesPoint(
            label=v["label"],
            date=v["date"],
            revenue=round(v["revenue"], 2),
            orders=v["orders"]
        )
        for v in sorted(monthly_buckets.values(), key=lambda x: x["date"])
    ]

    # 4. Category-wise sales
    cat_query = (
        db.query(
            Category.id,
            Category.name,
            func.sum(SaleItem.line_total).label("total_revenue"),
            func.sum(SaleItem.quantity).label("units_sold")
        )
        .join(Product, Product.category_id == Category.id)
        .join(SaleItem, SaleItem.product_id == Product.id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.status == "COMPLETED", Sale.created_at >= start_dt, Sale.created_at <= end_dt)
        .group_by(Category.id, Category.name)
        .order_by(desc("total_revenue"))
        .all()
    )

    category_sales = []
    for idx, row in enumerate(cat_query):
        color = CATEGORY_COLORS[idx % len(CATEGORY_COLORS)]
        category_sales.append(
            CategoryShareItem(
                category_id=row.id,
                category_name=row.name,
                total_revenue=Decimal(str(row.total_revenue or "0.00")),
                units_sold=int(row.units_sold or 0),
                color=color
            )
        )

    # 5. Best-selling products in period
    top_prods_query = (
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
        .filter(Sale.status == "COMPLETED", Sale.created_at >= start_dt, Sale.created_at <= end_dt)
        .group_by(Product.id, Product.name, Product.barcode, Category.name)
        .order_by(desc("units_sold"))
        .limit(8)
        .all()
    )

    best_selling_products = [
        TopProductItem(
            product_id=row.id,
            product_name=row.name,
            barcode=row.barcode,
            category_name=row.category_name or "General",
            units_sold=int(row.units_sold or 0),
            total_revenue=Decimal(str(row.total_revenue or "0.00"))
        )
        for row in top_prods_query
    ]

    # 6. Payment methods breakdown
    tender_counts = {}
    for s in sales_in_period:
        m = s.payment_method
        if m not in tender_counts:
            tender_counts[m] = {"count": 0, "amount": Decimal("0.00")}
        tender_counts[m]["count"] += 1
        tender_counts[m]["amount"] += Decimal(str(s.grand_total))

    payment_methods = []
    for m, data in tender_counts.items():
        pct = f"{(data['amount'] / total_revenue * 100):.1f}%" if total_revenue > 0 else "0.0%"
        payment_methods.append(
            PaymentMethodStat(
                method=m,
                count=data["count"],
                total_amount=round(data["amount"], 2),
                percentage=pct
            )
        )

    return SalesAnalyticsResponse(
        period=period,
        from_date=start_date.strftime("%Y-%m-%d"),
        to_date=end_date.strftime("%Y-%m-%d"),
        total_revenue=round(total_revenue, 2),
        total_orders=total_orders,
        time_series=daily_sales,
        daily_sales=daily_sales,
        weekly_sales=weekly_sales,
        monthly_sales=monthly_sales,
        category_sales=category_sales,
        best_selling_products=best_selling_products,
        payment_methods=payment_methods
    )

@router.get(
    "/inventory",
    response_model=InventoryAnalyticsResponse,
    summary="Inventory Analytics, Valuation & Replenishment Radar",
    description="Returns current stock levels, low/out-of-stock items, replenishment suggestions, and movement audit trail."
)
def get_inventory_analytics(
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    products = db.query(Product).order_by(Product.name.asc()).all()

    total_products = len(products)
    total_stock_units = sum(p.current_stock for p in products)
    valuation_cost = sum(Decimal(p.current_stock) * Decimal(str(p.cost_price)) for p in products)
    valuation_mrp = sum(Decimal(p.current_stock) * Decimal(str(p.selling_price)) for p in products)

    low_stock_products = []
    out_of_stock_products = []
    optimal_count = 0
    replenishment_needed = []

    for p in products:
        cat_name = p.category.name if p.category else "General"
        if p.current_stock <= 0:
            item_summary = ProductStockSummary(
                id=p.id,
                name=p.name,
                barcode=p.barcode,
                category_name=cat_name,
                current_stock=p.current_stock,
                min_stock_level=p.min_stock_level,
                unit=p.unit,
                selling_price=p.selling_price,
                status="OUT_OF_STOCK"
            )
            out_of_stock_products.append(item_summary)

            # Replenishment suggestion
            target_reorder = max(p.min_stock_level * 2, 20)
            replenishment_needed.append(
                ReplenishmentSuggestion(
                    product_id=p.id,
                    product_name=p.name,
                    barcode=p.barcode,
                    category_name=cat_name,
                    current_stock=p.current_stock,
                    min_stock_level=p.min_stock_level,
                    suggested_reorder_qty=target_reorder,
                    supplier_name="Authorized FMCG Distributor",
                    urgency="CRITICAL",
                    estimated_cost=round(Decimal(target_reorder) * Decimal(str(p.cost_price)), 2)
                )
            )
        elif p.current_stock <= p.min_stock_level:
            item_summary = ProductStockSummary(
                id=p.id,
                name=p.name,
                barcode=p.barcode,
                category_name=cat_name,
                current_stock=p.current_stock,
                min_stock_level=p.min_stock_level,
                unit=p.unit,
                selling_price=p.selling_price,
                status="LOW_STOCK"
            )
            low_stock_products.append(item_summary)

            target_reorder = (p.min_stock_level * 2) - p.current_stock
            urgency = "HIGH" if p.current_stock <= (p.min_stock_level // 2) else "MEDIUM"
            replenishment_needed.append(
                ReplenishmentSuggestion(
                    product_id=p.id,
                    product_name=p.name,
                    barcode=p.barcode,
                    category_name=cat_name,
                    current_stock=p.current_stock,
                    min_stock_level=p.min_stock_level,
                    suggested_reorder_qty=target_reorder,
                    supplier_name="Authorized FMCG Distributor",
                    urgency=urgency,
                    estimated_cost=round(Decimal(target_reorder) * Decimal(str(p.cost_price)), 2)
                )
            )
        else:
            optimal_count += 1

    # Sort replenishment by urgency (CRITICAL -> HIGH -> MEDIUM)
    urgency_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
    replenishment_needed.sort(key=lambda x: urgency_order.get(x.urgency, 3))

    # Recent Stock Movements
    movements_raw = db.query(StockMovement).order_by(StockMovement.created_at.desc()).limit(15).all()
    recent_stock_movements = [
        StockMovementSummary(
            id=m.id,
            product_id=m.product_id,
            product_name=m.product.name if m.product else f"Product #{m.product_id}",
            barcode=m.product.barcode if m.product else "N/A",
            movement_type=m.movement_type,
            quantity=m.quantity,
            reference_id=m.reference_id,
            notes=m.notes,
            created_at=m.created_at
        )
        for m in movements_raw
    ]

    return InventoryAnalyticsResponse(
        total_products=total_products,
        total_stock_units=total_stock_units,
        inventory_valuation_cost=round(valuation_cost, 2),
        inventory_valuation_mrp=round(valuation_mrp, 2),
        low_stock_count=len(low_stock_products),
        out_of_stock_count=len(out_of_stock_products),
        optimal_stock_count=optimal_count,
        low_stock_products=low_stock_products,
        out_of_stock_products=out_of_stock_products,
        replenishment_needed=replenishment_needed,
        recent_stock_movements=recent_stock_movements
    )


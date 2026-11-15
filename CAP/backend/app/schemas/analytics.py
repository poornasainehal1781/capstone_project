from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import date, datetime
from app.schemas.common import BaseSchema

class SaleSummaryItem(BaseSchema):
    id: int
    invoice_number: str
    customer_name: Optional[str] = None
    cashier_name: Optional[str] = None
    grand_total: Decimal
    payment_method: str
    status: str
    created_at: datetime

class TopProductItem(BaseSchema):
    product_id: int
    product_name: str
    barcode: str
    category_name: Optional[str] = None
    units_sold: int
    total_revenue: Decimal

class CategoryShareItem(BaseSchema):
    category_id: int
    category_name: str
    total_revenue: Decimal
    units_sold: int
    color: Optional[str] = None

class TimeSeriesPoint(BaseSchema):
    label: str               # "2026-11-02", "Week 44", "Nov 2026", or "8 AM"
    date: Optional[str] = None
    revenue: Decimal
    orders: int

class PaymentMethodStat(BaseSchema):
    method: str
    count: int
    total_amount: Decimal
    percentage: str

class DashboardStatsResponse(BaseSchema):
    total_sales_revenue: Decimal
    completed_orders_count: int
    total_products: int
    low_stock_count: int
    out_of_stock_count: int
    total_customers: int
    today_revenue: Decimal
    today_orders_count: int
    avg_order_value: Decimal
    recent_sales: List[SaleSummaryItem]
    top_selling_products: List[TopProductItem]
    category_revenue_share: List[CategoryShareItem]

class SalesAnalyticsResponse(BaseSchema):
    period: str
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    total_revenue: Decimal
    total_orders: int
    time_series: List[TimeSeriesPoint]
    daily_sales: List[TimeSeriesPoint]
    weekly_sales: List[TimeSeriesPoint]
    monthly_sales: List[TimeSeriesPoint]
    category_sales: List[CategoryShareItem]
    best_selling_products: List[TopProductItem]
    payment_methods: List[PaymentMethodStat]

class ProductStockSummary(BaseSchema):
    id: int
    name: str
    barcode: str
    category_name: Optional[str] = None
    current_stock: int
    min_stock_level: int
    unit: str
    selling_price: Decimal
    status: str              # "OUT_OF_STOCK", "LOW_STOCK", "OPTIMAL"

class ReplenishmentSuggestion(BaseSchema):
    product_id: int
    product_name: str
    barcode: str
    category_name: Optional[str] = None
    current_stock: int
    min_stock_level: int
    suggested_reorder_qty: int
    supplier_name: Optional[str] = None
    urgency: str             # "CRITICAL", "HIGH", "MEDIUM"
    estimated_cost: Decimal

class StockMovementSummary(BaseSchema):
    id: int
    product_id: int
    product_name: str
    barcode: str
    movement_type: str
    quantity: int
    reference_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

class InventoryAnalyticsResponse(BaseSchema):
    total_products: int
    total_stock_units: int
    inventory_valuation_cost: Decimal
    inventory_valuation_mrp: Decimal
    low_stock_count: int
    out_of_stock_count: int
    optimal_stock_count: int
    low_stock_products: List[ProductStockSummary]
    out_of_stock_products: List[ProductStockSummary]
    replenishment_needed: List[ReplenishmentSuggestion]
    recent_stock_movements: List[StockMovementSummary]


from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import date
from app.schemas.common import BaseSchema

class RevenueSummaryData(BaseSchema):
    gross_revenue: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    net_revenue: Decimal
    completed_orders: int
    avg_basket_value: Decimal

class PurchaseSummaryData(BaseSchema):
    total_orders: int
    total_expenditure: Decimal
    received_orders: int
    pending_orders: int
    draft_orders: int

class ProductSalesReportRow(BaseSchema):
    product_id: int
    product_name: str
    barcode: str
    category_name: Optional[str] = None
    units_sold: int
    unit_mrp: Decimal
    gross_sales: Decimal
    tax_collected: Decimal
    net_sales: Decimal

class CategorySalesReportRow(BaseSchema):
    category_id: int
    category_name: str
    category_code: str
    units_sold: int
    gross_sales: Decimal
    contribution_percentage: Decimal

class StockReportRow(BaseSchema):
    product_id: int
    product_name: str
    barcode: str
    category_name: Optional[str] = None
    current_stock: int
    min_stock_level: int
    unit: str
    cost_price: Decimal
    selling_price: Decimal
    stock_value_cost: Decimal
    stock_value_mrp: Decimal
    stock_status: str

class ReportSummaryResponse(BaseSchema):
    report_title: str
    date_range_label: str
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    generated_at: str
    revenue_summary: RevenueSummaryData
    purchase_summary: PurchaseSummaryData
    category_sales: List[CategorySalesReportRow]
    product_sales: List[ProductSalesReportRow]
    stock_overview: Dict[str, Any]


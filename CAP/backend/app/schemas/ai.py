from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.common import BaseSchema

# 1. Stock Replenishment Schemas
class ReplenishmentInsightItem(BaseSchema):
    product_id: int
    product_name: str
    sku: Optional[str] = None
    barcode: str
    category_name: str
    current_stock: int
    min_stock_level: int
    average_daily_sales: float
    days_of_stock_remaining: float
    lead_time_days: int
    reorder_point: int
    suggested_order_qty: int
    estimated_cost: Decimal
    supplier_name: Optional[str] = None
    urgency: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    explanation: str

class ReplenishmentResponse(BaseSchema):
    engine: str  # "OPENAI_GPT" | "RULE_BASED_FALLBACK"
    model_used: str
    is_fallback: bool
    fallback_reason: Optional[str] = None
    total_items_analyzed: int
    items_needing_reorder: int
    total_estimated_restock_cost: Decimal
    recommendations: List[ReplenishmentInsightItem]
    executive_summary: str

# 2. Sales Trend & Slow Moving Schemas
class SalesTrendInsightItem(BaseSchema):
    product_id: int
    product_name: str
    category_name: str
    recent_period_units: int
    prior_period_units: int
    growth_rate_pct: float
    trend_direction: str  # "INCREASING", "DECREASING", "STABLE"
    analysis: str

class SlowMovingProductItem(BaseSchema):
    product_id: int
    product_name: str
    category_name: str
    current_stock: int
    units_sold_30d: int
    locked_capital: Decimal
    days_without_sale: int
    recommendation: str

class SalesTrendResponse(BaseSchema):
    engine: str
    model_used: str
    is_fallback: bool
    fallback_reason: Optional[str] = None
    recent_period_label: str
    prior_period_label: str
    recent_period_revenue: Decimal
    prior_period_revenue: Decimal
    revenue_growth_pct: float
    overall_trend: str  # "INCREASING", "DECREASING", "STABLE"
    top_performing_products: List[SalesTrendInsightItem]
    slow_moving_products: List[SlowMovingProductItem]
    executive_summary: str

# 3. Near-Expiry Product Schemas
class NearExpiryItem(BaseSchema):
    batch_id: int
    product_id: int
    product_name: str
    barcode: str
    category_name: str
    batch_number: str
    expiry_date: str
    days_to_expiry: int
    current_quantity: int
    status: str  # "EXPIRED", "CRITICAL", "WARNING", "ATTENTION", "OPTIMAL"
    recommended_action: str
    suggested_discount_pct: int
    is_sellable: bool
    explanation: str

class NearExpiryResponse(BaseSchema):
    engine: str
    model_used: str
    is_fallback: bool
    fallback_reason: Optional[str] = None
    total_batches_tracked: int
    expired_count: int
    critical_count: int
    warning_count: int
    items: List[NearExpiryItem]
    non_monitored_products_count: int
    policy_note: str = (
        "Strict Policy: Expired food and perishable goods MUST NEVER be sold. "
        "They are flagged for immediate physical withdrawal, quarantine, and supplier return or disposal."
    )

# 4. Chatbot Schemas
class ChatActionSuggestion(BaseSchema):
    label: str
    target_page: str
    action_type: str

class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    conversation_history: Optional[List[Dict[str, str]]] = None

class AIChatResponse(BaseSchema):
    reply: str
    engine: str
    model_used: str
    is_fallback: bool
    intent_detected: Optional[str] = None
    grounding_data_used: Optional[Dict[str, Any]] = None
    suggested_actions: Optional[List[ChatActionSuggestion]] = None

# 5. Full Insights Summary
class FullAIInsightsResponse(BaseSchema):
    engine: str
    model_used: str
    is_fallback: bool
    fallback_reason: Optional[str] = None
    replenishment: ReplenishmentResponse
    sales_trends: SalesTrendResponse
    near_expiry: NearExpiryResponse
    master_ai_summary: str

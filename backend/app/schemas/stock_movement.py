from typing import Optional
from decimal import Decimal
from datetime import date, datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class StockMovementBase(BaseSchema):
    product_id: int
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    movement_type: str = Field(..., max_length=30, description="INWARD_GRN, AUDIT_ADJUSTMENT, POS_SALE, EXPIRED_DISCARD")
    quantity: int = Field(..., description="Positive for inward/additions, negative for reductions")
    unit_cost: Optional[Decimal] = None
    reference_id: Optional[str] = None
    notes: Optional[str] = None

class StockMovementCreate(StockMovementBase):
    pass

class StockAdjustmentRequest(BaseSchema):
    """Payload for manual inventory adjustments or inward receipts."""
    product_id: int
    quantity: int = Field(..., description="Quantity to add (positive) or deduct (negative)")
    movement_type: str = Field("AUDIT_ADJUSTMENT", description="AUDIT_ADJUSTMENT, INWARD_GRN, or EXPIRED_DISCARD")
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    unit_cost: Optional[Decimal] = None
    notes: Optional[str] = None

class StockMovementResponse(StockMovementBase):
    id: int
    product_name: Optional[str] = None
    product_barcode: Optional[str] = None
    created_at: datetime

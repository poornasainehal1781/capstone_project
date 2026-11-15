from typing import List, Optional
from decimal import Decimal
from datetime import date, datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class PurchaseItemBase(BaseSchema):
    product_id: int
    quantity: int = Field(..., gt=0)
    unit_cost: Decimal = Field(..., ge=0)

class PurchaseItemCreate(PurchaseItemBase):
    pass

class PurchaseItemResponse(PurchaseItemBase):
    id: int
    purchase_id: int
    subtotal: Decimal

class PurchaseCreate(BaseSchema):
    supplier_id: int
    po_number: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    items: List[PurchaseItemCreate] = Field(..., min_length=1)

class PurchaseResponse(BaseSchema):
    id: int
    po_number: str
    supplier_id: int
    created_by_user_id: int
    total_amount: Decimal
    status: str
    expected_delivery_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseItemResponse] = []

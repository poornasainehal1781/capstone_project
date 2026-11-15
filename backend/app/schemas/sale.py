from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from pydantic import Field
from app.schemas.common import BaseSchema

class SaleItemBase(BaseSchema):
    product_id: int
    batch_number: Optional[str] = None
    quantity: int = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    tax_rate: Decimal = Field(default=Decimal("5.00"), ge=0)
    tax_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    discount: Decimal = Field(default=Decimal("0.00"), ge=0)
    line_total: Decimal = Field(..., ge=0)

class SaleItemCreate(BaseSchema):
    product_id: int
    batch_number: Optional[str] = None
    quantity: int = Field(..., gt=0)
    unit_price: Optional[Decimal] = Field(None, ge=0)
    tax_rate: Optional[Decimal] = Field(None, ge=0)
    discount: Optional[Decimal] = Field(Decimal("0.00"), ge=0)

class SaleItemResponse(SaleItemBase):
    id: int
    sale_id: int
    product_name: Optional[str] = None
    product_barcode: Optional[str] = None
    product_sku: Optional[str] = None

class SaleCreate(BaseSchema):
    customer_id: Optional[int] = None
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None
    payment_method: str = Field("CASH", pattern="^(CASH|UPI_QR|CARD|SPLIT|UPI)$")
    items: List[SaleItemCreate] = Field(..., min_length=1)
    discount_amount: Decimal = Field(Decimal("0.00"), ge=0)
    idempotency_key: Optional[str] = None
    notes: Optional[str] = None

class SaleResponse(BaseSchema):
    id: int
    invoice_number: str
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    cashier_id: int
    cashier_name: Optional[str] = None
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    grand_total: Decimal
    payment_method: str
    status: str
    idempotency_key: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[SaleItemResponse] = []

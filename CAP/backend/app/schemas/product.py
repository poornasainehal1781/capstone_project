from typing import Optional
from decimal import Decimal
from pydantic import Field
from datetime import datetime
from app.schemas.common import BaseSchema

class ProductBase(BaseSchema):
    barcode: str = Field(..., min_length=3, max_length=50, description="EAN-13, UPC, or barcode")
    sku: Optional[str] = Field(None, max_length=50, description="Internal SKU identifier")
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    category_id: int
    unit: str = Field("Pack", max_length=20)
    cost_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    selling_price: Decimal = Field(default=Decimal("0.00"), ge=0, description="MRP")
    tax_rate: Decimal = Field(default=Decimal("5.00"), ge=0, le=100)
    min_stock_level: int = Field(default=20, ge=0)
    is_perishable: bool = False

class ProductCreate(ProductBase):
    initial_stock: int = Field(default=0, ge=0, description="Optional opening stock quantity")
    initial_batch_number: Optional[str] = Field(None, description="Optional opening batch number")

class ProductUpdate(BaseSchema):
    barcode: Optional[str] = None
    sku: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    unit: Optional[str] = None
    cost_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    min_stock_level: Optional[int] = None
    is_perishable: Optional[bool] = None

class ProductResponse(ProductBase):
    id: int
    current_stock: int = 0
    category_name: Optional[str] = None
    category_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class StockAdjustmentRequest(BaseSchema):
    quantity_delta: int = Field(..., description="Quantity to adjust: positive to increase, negative to decrease")
    movement_type: str = Field("AUDIT_ADJUSTMENT", description="AUDIT_ADJUSTMENT, EXPIRED_DISCARD, DAMAGE_WRITE_OFF, or STOCK_IN")
    notes: Optional[str] = None
    batch_number: Optional[str] = None

class StockAdjustmentResponse(BaseSchema):
    product_id: int
    product_name: str
    previous_stock: int
    current_stock: int
    adjustment_applied: int
    movement_type: str
    movement_id: int
    timestamp: datetime

class BatchInwardRequest(BaseSchema):
    batch_number: str = Field(..., min_length=2, max_length=50)
    mfg_date: str = Field(..., description="YYYY-MM-DD")
    expiry_date: str = Field(..., description="YYYY-MM-DD")
    quantity: int = Field(..., gt=0)
    unit_cost: Decimal = Field(default=Decimal("0.00"), ge=0)

class BatchItemResponse(BaseSchema):
    id: int
    product_id: int
    product_name: str
    barcode: str
    category_name: str
    batch_number: str
    mfg_date: str
    expiry_date: str
    days_to_expiry: int
    initial_quantity: int
    current_quantity: int
    unit_cost: Decimal
    is_active: bool
    status: str  # EXPIRED, CRITICAL, WARNING, OPTIMAL

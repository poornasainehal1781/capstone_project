from typing import Optional
from pydantic import EmailStr, Field
from datetime import datetime
from app.schemas.common import BaseSchema

class SupplierBase(BaseSchema):
    name: str = Field(..., min_length=2, max_length=150)
    contact_person: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=20)
    email: EmailStr
    lead_time_days: int = Field(default=3, ge=1, le=60, description="Lead time days used for AI ROP computation")
    credit_terms: str = Field("Net 30", max_length=50)
    is_active: bool = True

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseSchema):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    lead_time_days: Optional[int] = None
    credit_terms: Optional[str] = None
    is_active: Optional[bool] = None

class SupplierResponse(SupplierBase):
    id: int
    created_at: datetime
    updated_at: datetime

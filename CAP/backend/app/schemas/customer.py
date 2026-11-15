from typing import Optional
from pydantic import EmailStr, Field
from datetime import datetime
from app.schemas.common import BaseSchema

class CustomerBase(BaseSchema):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=20)
    email: Optional[EmailStr] = None
    loyalty_points: int = Field(default=0, ge=0)
    tier: str = Field("Silver", pattern="^(Silver|Gold|Platinum)$")

class CustomerCreate(BaseSchema):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=20)
    email: Optional[EmailStr] = None

class CustomerUpdate(BaseSchema):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    loyalty_points: Optional[int] = None
    tier: Optional[str] = None

class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime
    updated_at: datetime

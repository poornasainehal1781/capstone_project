"""
Pydantic Schemas Registry for SmartRetail AI.
"""

from app.schemas.common import BaseSchema, HealthCheckResponse, DatabaseHealthResponse
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserMeResponse
from app.schemas.user import UserBase, UserCreate, UserUpdate, UserResponse
from app.schemas.category import CategoryBase, CategoryCreate, CategoryUpdate, CategoryResponse
from app.schemas.product import ProductBase, ProductCreate, ProductUpdate, ProductResponse
from app.schemas.customer import CustomerBase, CustomerCreate, CustomerUpdate, CustomerResponse
from app.schemas.supplier import SupplierBase, SupplierCreate, SupplierUpdate, SupplierResponse
from app.schemas.purchase import PurchaseItemBase, PurchaseItemCreate, PurchaseItemResponse, PurchaseCreate, PurchaseResponse
from app.schemas.sale import SaleItemBase, SaleItemCreate, SaleItemResponse, SaleCreate, SaleResponse
from app.schemas.stock_movement import (
    StockMovementBase,
    StockMovementCreate,
    StockAdjustmentRequest,
    StockMovementResponse
)

__all__ = [
    "BaseSchema",
    "HealthCheckResponse",
    "DatabaseHealthResponse",
    "LoginRequest",
    "RegisterRequest",
    "TokenResponse",
    "UserMeResponse",
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "CategoryBase",
    "CategoryCreate",
    "CategoryUpdate",
    "CategoryResponse",
    "ProductBase",
    "ProductCreate",
    "ProductUpdate",
    "ProductResponse",
    "CustomerBase",
    "CustomerCreate",
    "CustomerUpdate",
    "CustomerResponse",
    "SupplierBase",
    "SupplierCreate",
    "SupplierUpdate",
    "SupplierResponse",
    "PurchaseItemBase",
    "PurchaseItemCreate",
    "PurchaseItemResponse",
    "PurchaseCreate",
    "PurchaseResponse",
    "SaleItemBase",
    "SaleItemCreate",
    "SaleItemResponse",
    "SaleCreate",
    "SaleResponse",
    "StockMovementBase",
    "StockMovementCreate",
    "StockAdjustmentRequest",
    "StockMovementResponse",
]

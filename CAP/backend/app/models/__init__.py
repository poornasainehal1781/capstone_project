"""
SQLAlchemy ORM Models Registry for SmartRetail AI.
Importing all models here ensures Base.metadata discovers all tables
for Alembic migrations and database initialization.
"""

from app.database import Base
from app.models.base import TimestampMixin
from app.models.user import User
from app.models.category import Category
from app.models.product import Product
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.purchase import Purchase, PurchaseItem
from app.models.sale import Sale, SaleItem
from app.models.stock_movement import StockMovement
from app.models.batch import ProductBatch

__all__ = [
    "Base",
    "TimestampMixin",
    "User",
    "Category",
    "Product",
    "Customer",
    "Supplier",
    "Purchase",
    "PurchaseItem",
    "Sale",
    "SaleItem",
    "StockMovement",
    "ProductBatch",
]

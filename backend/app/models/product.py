from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin

class Product(Base, TimestampMixin):
    """
    Master SKU catalog item.
    Tracks barcodes, SKUs, MRP, purchase cost, GST tax rates, current stock, and safety thresholds.
    """
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String(50), unique=True, index=True, nullable=False)
    sku = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(String(200), index=True, nullable=False)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    unit = Column(String(20), default="Pack", nullable=False)
    cost_price = Column(Numeric(10, 2), nullable=False, default=0.00)
    selling_price = Column(Numeric(10, 2), nullable=False, default=0.00)  # MRP
    tax_rate = Column(Numeric(5, 2), nullable=False, default=5.00)        # GST Rate (0, 5, 12, 18)
    current_stock = Column(Integer, default=0, nullable=False)            # Real-time stock balance
    min_stock_level = Column(Integer, default=20, nullable=False)         # ROP trigger threshold
    is_perishable = Column(Boolean, default=False, nullable=False)

    # Relationships
    category = relationship("Category", back_populates="products")
    sale_items = relationship("SaleItem", back_populates="product")
    purchase_items = relationship("PurchaseItem", back_populates="product")
    stock_movements = relationship("StockMovement", back_populates="product", cascade="all, delete-orphan")
    batches = relationship("ProductBatch", back_populates="product", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Product id={self.id} barcode='{self.barcode}' sku='{self.sku}' name='{self.name}'>"

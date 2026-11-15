from sqlalchemy import Column, Integer, String, Numeric, Date, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin

class ProductBatch(Base, TimestampMixin):
    """
    Inventory Batch tracking for perishable and lot-tracked supermarket SKUs.
    Supports First-Expire-First-Out (FEFO) allocation and shelf-life monitoring.
    """
    __tablename__ = "product_batches"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_number = Column(String(50), nullable=False, index=True)
    mfg_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False, index=True)
    initial_quantity = Column(Integer, nullable=False, default=0)
    current_quantity = Column(Integer, nullable=False, default=0)
    unit_cost = Column(Numeric(10, 2), nullable=False, default=0.00)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    product = relationship("Product", back_populates="batches")

    def __repr__(self):
        return (
            f"<ProductBatch id={self.id} batch='{self.batch_number}' "
            f"product_id={self.product_id} exp='{self.expiry_date}' qty={self.current_quantity}>"
        )


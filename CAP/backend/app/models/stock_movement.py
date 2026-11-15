from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class StockMovement(Base):
    """
    Immutable audit ledger of every inventory change.
    Tracks inward deliveries (GRN), POS sales deductions, damage/expiry write-offs,
    and batch lot movements.
    """
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_number = Column(String(50), nullable=True, index=True)
    expiry_date = Column(Date, nullable=True, index=True)  # Crucial for FEFO shelf tracking
    movement_type = Column(String(30), nullable=False, index=True)
    # Common movement_type values:
    # - "INWARD_GRN"         (Purchase order receiving: +qty)
    # - "POS_SALE"           (Checkout deduction: -qty)
    # - "CUSTOMER_RETURN"    (Returned good: +qty)
    # - "EXPIRED_DISCARD"    (Perishable write-off: -qty)
    # - "AUDIT_ADJUSTMENT"   (Manual reconciliation: +/-qty)

    quantity = Column(Integer, nullable=False)  # Positive for additions, negative for deductions
    unit_cost = Column(Numeric(10, 2), nullable=True)
    reference_id = Column(String(50), nullable=True, index=True)  # PO Number or Invoice Number
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    product = relationship("Product", back_populates="stock_movements")

    def __repr__(self):
        return (
            f"<StockMovement id={self.id} product_id={self.product_id} "
            f"type='{self.movement_type}' qty={self.quantity}>"
        )

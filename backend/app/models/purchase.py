from sqlalchemy import Column, Integer, String, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin

class Purchase(Base, TimestampMixin):
    """
    Purchase Order (PO) issued to an FMCG supplier partner.
    """
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(50), unique=True, index=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    status = Column(String(20), nullable=False, default="DRAFT", index=True)  # DRAFT, CONFIRMED, IN_TRANSIT, RECEIVED, CANCELLED
    expected_delivery_date = Column(Date, nullable=True)

    # Relationships
    supplier = relationship("Supplier", back_populates="purchases")
    creator = relationship("User", back_populates="purchases")
    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Purchase id={self.id} po_number='{self.po_number}' status='{self.status}'>"

class PurchaseItem(Base):
    """
    Individual line item in a Purchase Order.
    """
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=1)
    unit_cost = Column(Numeric(10, 2), nullable=False, default=0.00)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0.00)

    # Relationships
    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product", back_populates="purchase_items")

    def __repr__(self):
        return f"<PurchaseItem id={self.id} po_id={self.purchase_id} product_id={self.product_id} qty={self.quantity}>"

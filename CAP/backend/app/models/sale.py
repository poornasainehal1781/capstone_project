from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin

class Sale(Base, TimestampMixin):
    """
    POS Billing Sales Order / Invoice record.
    Generated upon cashier transaction settlement.
    """
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    cashier_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    grand_total = Column(Numeric(12, 2), nullable=False, default=0.00)
    payment_method = Column(String(20), nullable=False, default="CASH", index=True)  # CASH, UPI_QR, CARD, SPLIT
    status = Column(String(20), nullable=False, default="COMPLETED", index=True)      # COMPLETED, REFUNDED, CANCELLED
    idempotency_key = Column(String(100), unique=True, index=True, nullable=True)
    notes = Column(String(255), nullable=True)

    # Relationships
    customer = relationship("Customer", back_populates="sales")
    cashier = relationship("User", back_populates="sales")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Sale id={self.id} invoice='{self.invoice_number}' total={self.grand_total}>"

class SaleItem(Base):
    """
    Individual line item in a POS Sales Invoice with FEFO batch assignment.
    """
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    batch_number = Column(String(50), nullable=True, index=True)  # Links to batch allocated under FEFO
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False, default=0.00)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=5.00)
    tax_amount = Column(Numeric(10, 2), nullable=False, default=0.00)
    discount = Column(Numeric(10, 2), nullable=False, default=0.00)
    line_total = Column(Numeric(12, 2), nullable=False, default=0.00)

    # Relationships
    sale = relationship("Sale", back_populates="items")
    product = relationship("Product", back_populates="sale_items")

    def __repr__(self):
        return f"<SaleItem id={self.id} sale_id={self.sale_id} product_id={self.product_id} qty={self.quantity}>"

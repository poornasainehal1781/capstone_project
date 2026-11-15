from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin

class Customer(Base, TimestampMixin):
    """
    Customer profile for POS checkout loyalty lookup and reward accumulation.
    """
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    email = Column(String(100), nullable=True)
    loyalty_points = Column(Integer, default=0, nullable=False)
    tier = Column(String(20), default="Silver", nullable=False)  # Silver, Gold, Platinum

    # Relationships
    sales = relationship("Sale", back_populates="customer")

    def __repr__(self):
        return f"<Customer id={self.id} phone='{self.phone}' name='{self.name}'>"

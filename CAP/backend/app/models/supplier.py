from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin

class Supplier(Base, TimestampMixin):
    """
    FMCG vendor / distributor partner.
    Stores delivery lead times which feeds directly into the AI Reorder Point (ROP) engine.
    """
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, index=True, nullable=False)
    contact_person = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    email = Column(String(100), nullable=False)
    lead_time_days = Column(Integer, default=3, nullable=False)  # Lead time (L) for AI formulas
    credit_terms = Column(String(50), default="Net 30", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    purchases = relationship("Purchase", back_populates="supplier")

    def __repr__(self):
        return f"<Supplier id={self.id} name='{self.name}' lead_time={self.lead_time_days}d>"

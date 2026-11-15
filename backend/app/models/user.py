from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin

class User(Base, TimestampMixin):
    """
    User account model for internal supermarket staff.
    Supports Role-Based Access Control (RBAC): ADMIN, MANAGER, CASHIER.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, default="CASHIER", index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    sales = relationship("Sale", back_populates="cashier", cascade="all, delete-orphan")
    purchases = relationship("Purchase", back_populates="creator")

    def __repr__(self):
        return f"<User id={self.id} username='{self.username}' role='{self.role}'>"

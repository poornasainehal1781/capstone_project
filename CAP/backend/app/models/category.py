from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin

class Category(Base, TimestampMixin):
    """
    Supermarket Department and Category model for organizing merchandise.
    """
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    code = Column(String(30), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    # Relationships (No automatic cascade delete so products are preserved)
    products = relationship("Product", back_populates="category")

    def __repr__(self):
        return f"<Category id={self.id} code='{self.code}' name='{self.name}'>"

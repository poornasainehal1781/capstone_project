from sqlalchemy import Column, DateTime
from sqlalchemy.sql import func
from app.database import Base

class TimestampMixin:
    """
    Reusable timestamp mixin adding created_at and updated_at
    columns to any SQLAlchemy ORM model.
    """
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

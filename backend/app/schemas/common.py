from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime

class BaseSchema(BaseModel):
    """Base schema configured for ORM compatibility."""
    model_config = ConfigDict(from_attributes=True)

class HealthCheckResponse(BaseModel):
    """Service health check response payload."""
    status: str
    app_name: str
    environment: str
    timestamp: datetime
    version: str

class DatabaseHealthResponse(BaseModel):
    """Database connectivity and diagnostic test response."""
    status: str
    database_dialect: str
    is_fallback_sqlite: bool
    url: str
    query_latency_ms: float
    tables_count: int
    tables: List[str]
    error: Optional[str] = None

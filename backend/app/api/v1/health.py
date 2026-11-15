from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db, check_database_connection
from app.schemas.common import HealthCheckResponse, DatabaseHealthResponse

router = APIRouter()

@router.get(
    "",
    response_model=HealthCheckResponse,
    summary="Application Health Check",
    description="Returns the operational status, application name, environment, and current timestamp."
)
def ping():
    return HealthCheckResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        timestamp=datetime.now(timezone.utc),
        version="1.0.0"
    )

@router.get(
    "/db",
    response_model=DatabaseHealthResponse,
    summary="Database Connectivity Test",
    description="Executes a live query on the database, measures round-trip latency, and lists registered tables."
)
def test_database():
    diag = check_database_connection()
    return DatabaseHealthResponse(
        status=diag["status"],
        database_dialect=diag["database_dialect"],
        is_fallback_sqlite=diag["is_fallback_sqlite"],
        url=diag["url"],
        query_latency_ms=diag["query_latency_ms"],
        tables_count=diag["tables_count"],
        tables=diag["tables"],
        error=diag.get("error")
    )

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import engine, Base, check_database_connection
from app.api.v1 import api_v1_router
import app.models  # Ensures all ORM models are registered

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("smartretail.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.
    Runs startup verification and teardown logic.
    """
    logger.info(f"Starting {settings.APP_NAME} in [{settings.APP_ENV}] mode...")
    
    # Automatically verify and create all database tables at startup
    try:
        from sqlalchemy import inspect, text
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        with engine.connect() as conn:
            for table_name, table in Base.metadata.tables.items():
                if table_name in existing_tables:
                    existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
                    for col in table.columns:
                        if col.name not in existing_cols:
                            col_type = col.type.compile(engine.dialect)
                            try:
                                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}"))
                                conn.commit()
                                logger.info(f"Added missing column: {table_name}.{col.name}")
                            except Exception as alter_err:
                                logger.warning(f"Could not auto-add column {table_name}.{col.name}: {alter_err}")
        logger.info(f"Database schema verified. Registered tables: {list(Base.metadata.tables.keys())}")
    except Exception as exc:
        logger.error(f"Error initializing database schema at startup: {exc}")

    yield

    logger.info(f"Shutting down {settings.APP_NAME}...")

# Initialize FastAPI Application
app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="AI-Powered Retail Inventory, POS Billing & Decision Support System API",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS Middleware for Frontend Access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(api_v1_router)

@app.get("/", summary="Root Welcome Endpoint", tags=["System"])
def root():
    """
    API Root providing system overview and navigation links.
    """
    diag = check_database_connection()
    return {
        "message": "Welcome to SmartRetail AI Backend API",
        "system": settings.APP_NAME,
        "version": "1.0.0",
        "environment": settings.APP_ENV,
        "database_status": diag["status"],
        "database_dialect": diag["database_dialect"],
        "tables_registered": diag["tables_count"],
        "documentation": {
            "swagger_ui": "/docs",
            "redoc": "/redoc"
        },
        "endpoints": {
            "health_check": "/api/v1/health",
            "database_test": "/api/v1/health/db"
        }
    }

@app.get("/health", summary="Basic Ping", tags=["System"])
def health():
    """Quick liveness probe."""
    return {"status": "ok", "app": settings.APP_NAME}

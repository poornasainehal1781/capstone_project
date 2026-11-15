import logging
import time
from typing import Generator, Dict, Any
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

logger = logging.getLogger("smartretail.database")

# Base class for all SQLAlchemy ORM models
Base = declarative_base()

def get_engine():
    """
    Creates and validates the SQLAlchemy database engine.
    Attempts primary PostgreSQL connection; if unavailable and fallback is permitted,
    falls back to SQLite for local development testing with clear instructions.
    """
    db_url = settings.DATABASE_URL

    # Try connecting to primary database
    try:
        connect_args = {}
        if "postgresql" in db_url:
            connect_args = {"connect_timeout": 3}

        engine = create_engine(
            db_url,
            connect_args=connect_args,
            pool_pre_ping=True,
            echo=False
        )
        
        # Test connection immediately
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(f"Connected to primary database: {engine.url.render_as_string(hide_password=True)}")
        return engine, False

    except Exception as exc:
        if settings.ALLOW_SQLITE_FALLBACK:
            logger.warning(
                f"PostgreSQL connection to {db_url} failed: {exc}. "
                f"Falling back to local SQLite ({settings.SQLITE_FALLBACK_URL}) for testing. "
                "To use PostgreSQL, ensure the PostgreSQL service is running and configure credentials in .env."
            )
            fallback_engine = create_engine(
                settings.SQLITE_FALLBACK_URL,
                connect_args={"check_same_thread": False},
                pool_pre_ping=True,
                echo=False
            )
            return fallback_engine, True
        else:
            logger.error(f"Failed to connect to database: {exc}")
            raise exc

engine, is_fallback = get_engine()

# Configured Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a transactional database session per request.
    Automatically closes session when request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_database_connection() -> Dict[str, Any]:
    """
    Diagnostic helper to test database connectivity, measure query latency,
    and report table counts.
    """
    start_time = time.time()
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            latency_ms = round((time.time() - start_time) * 1000, 2)
            
            # Inspect existing tables
            inspector = inspect(engine)
            tables = inspector.get_table_names()

            return {
                "status": "connected",
                "database_dialect": engine.dialect.name,
                "is_fallback_sqlite": is_fallback,
                "url": engine.url.render_as_string(hide_password=True),
                "query_latency_ms": latency_ms,
                "tables_count": len(tables),
                "tables": tables,
                "error": None
            }
    except Exception as exc:
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "disconnected",
            "database_dialect": engine.dialect.name,
            "is_fallback_sqlite": is_fallback,
            "url": engine.url.render_as_string(hide_password=True),
            "query_latency_ms": latency_ms,
            "tables_count": 0,
            "tables": [],
            "error": str(exc)
        }

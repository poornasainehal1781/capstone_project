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
    # Auto-seed database with demo data if empty
    try:
        from app.database import SessionLocal
        from app.models.user import User
        from app.models.category import Category
        from app.models.product import Product
        from app.models.supplier import Supplier
        from app.models.customer import Customer
        from app.core.security import hash_password
        import random

        db = SessionLocal()
        try:
            user_count = db.query(User).count()
            product_count = db.query(Product).count()
            if user_count == 0 or product_count == 0:
                logger.info(f"Seeding required (users={user_count}, products={product_count}) — running seed...")

                # Seed users (only if none exist)
                if user_count == 0:
                    for udata in [
                        ("admin", "admin@smartretail.com", "admin123", "ADMIN", "Admin User"),
                        ("manager", "manager@smartretail.com", "manager123", "MANAGER", "Store Manager"),
                        ("cashier", "cashier@smartretail.com", "cashier123", "CASHIER", "Cashier Staff"),
                    ]:
                        db.add(User(username=udata[0], email=udata[1], password_hash=hash_password(udata[2]), role=udata[3], full_name=udata[4], is_active=True))
                    db.commit()
                    logger.info("Users seeded")

                # Seed categories (get existing or create new)
                cat_objs = db.query(Category).order_by(Category.id).all()
                if len(cat_objs) == 0:
                    for c in [
                        ("Beverages", "BEV"), ("Dairy", "DAI"), ("Bakery", "BAK"),
                        ("Snacks", "SNA"), ("Fruits & Vegetables", "FRV"),
                        ("Meat & Seafood", "MEA"), ("Personal Care", "PER"), ("Household", "HOU")
                    ]:
                        obj = Category(name=c[0], code=c[1], description=f"{c[0]} products")
                        db.add(obj)
                        cat_objs.append(obj)
                    db.commit()
                    cat_objs = db.query(Category).order_by(Category.id).all()
                    logger.info("Categories seeded")

                # Seed products (only if none exist and categories available)
                if product_count == 0 and len(cat_objs) >= 8:
                    for pdata in [
                        ("Amul Full Cream Milk 1L", 1, 68, 55, 150, 20),
                        ("Britannia Bread 400g", 2, 45, 35, 200, 30),
                        ("Lay's Classic Salted 100g", 3, 20, 14, 500, 50),
                        ("Coca-Cola 750ml", 0, 45, 32, 300, 40),
                        ("Colgate Toothpaste 200g", 6, 95, 72, 180, 25),
                        ("Surf Excel 1kg", 7, 185, 145, 100, 15),
                        ("Basmati Rice 5kg", 4, 450, 360, 80, 10),
                        ("Haldiram Namkeen 400g", 3, 120, 90, 250, 30),
                        ("Tropicana Orange Juice 1L", 0, 110, 82, 120, 20),
                        ("Parle-G Biscuits 800g", 2, 55, 40, 300, 40),
                        ("Dettol Soap 75g", 6, 45, 32, 200, 25),
                        ("Tomatoes 1kg", 4, 40, 25, 100, 20),
                        ("Paneer 200g", 1, 85, 65, 80, 15),
                    ]:
                        db.add(Product(
                            name=pdata[0], barcode=f"SR{random.randint(1000000,9999999)}",
                            category_id=cat_objs[pdata[1]].id, selling_price=pdata[2],
                            cost_price=pdata[3], current_stock=pdata[4], min_stock_level=pdata[5],
                            unit="piece"
                        ))
                    db.commit()
                    logger.info("Products seeded")

                # Seed customers (only if none exist)
                if db.query(Customer).count() == 0:
                    for cdata in [
                        ("Priya Sharma", "priya@email.com", "9876501234"),
                        ("Rahul Verma", "rahul@email.com", "9876502345"),
                        ("Anjali Singh", "anjali@email.com", "9876503456"),
                        ("Suresh Patel", "suresh@email.com", "9876504567"),
                    ]:
                        db.add(Customer(name=cdata[0], email=cdata[1], phone=cdata[2], loyalty_points=random.randint(0, 500)))
                    db.commit()
                    logger.info("Customers seeded")

                logger.info("✅ Demo data seeding complete!")
            else:
                logger.info(f"Database already has {user_count} users and {product_count} products — skipping seed")
        finally:
            db.close()
    except Exception as seed_exc:
        logger.error(f"Auto-seed failed (non-critical): {seed_exc}")

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
    allow_origin_regex=r"^https?:\/\/.*(\.vercel\.app|localhost|127\.0\.0\.1)(:[0-9]+)?$",
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

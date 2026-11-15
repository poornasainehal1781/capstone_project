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
            supplier_count = db.query(Supplier).count()

            if user_count == 0 or product_count == 0 or supplier_count == 0:
                logger.info(f"Seeding required — users={user_count}, products={product_count}, suppliers={supplier_count}")

                # ── USERS ──────────────────────────────────────────────
                if user_count == 0:
                    for u in [
                        ("admin",   "admin@smartretail.com",   "admin123",   "ADMIN",   "Admin User"),
                        ("manager", "manager@smartretail.com", "manager123", "MANAGER", "Store Manager"),
                        ("cashier", "cashier@smartretail.com", "cashier123", "CASHIER", "Cashier Staff"),
                        ("manager2","manager2@smartretail.com","manager123", "MANAGER", "Assistant Manager"),
                        ("cashier2","cashier2@smartretail.com","cashier123", "CASHIER", "Cashier 2"),
                    ]:
                        db.add(User(username=u[0], email=u[1], password_hash=hash_password(u[2]), role=u[3], full_name=u[4], is_active=True))
                    db.commit()
                    logger.info("✅ Users seeded")

                # ── CATEGORIES ─────────────────────────────────────────
                cat_objs = db.query(Category).order_by(Category.id).all()
                if len(cat_objs) == 0:
                    cats = [
                        ("Beverages",          "BEV", "Cold drinks, juices, water, tea & coffee"),
                        ("Dairy & Eggs",        "DAI", "Milk, cheese, curd, paneer, butter & eggs"),
                        ("Bakery & Bread",      "BAK", "Bread, cakes, biscuits & baked goods"),
                        ("Snacks & Namkeen",    "SNA", "Chips, namkeen, popcorn & packaged snacks"),
                        ("Fruits & Vegetables", "FRV", "Fresh fruits and seasonal vegetables"),
                        ("Meat & Seafood",      "MEA", "Chicken, mutton, fish and seafood"),
                        ("Personal Care",       "PER", "Soap, shampoo, toothpaste & skincare"),
                        ("Household & Cleaning","HOU", "Detergent, cleaners, mops & household supplies"),
                        ("Staples & Grains",    "STA", "Rice, wheat, pulses, oil & sugar"),
                        ("Frozen Foods",        "FRZ", "Ice cream, frozen meals & frozen vegetables"),
                    ]
                    for c in cats:
                        db.add(Category(name=c[0], code=c[1], description=c[2]))
                    db.commit()
                    cat_objs = db.query(Category).order_by(Category.id).all()
                    logger.info("✅ Categories seeded")

                # Build category lookup by code
                cat_map = {c.code: c.id for c in cat_objs}

                # ── SUPPLIERS ──────────────────────────────────────────
                if supplier_count == 0:
                    suppliers = [
                        ("Metro Wholesale Pvt Ltd",    "Ravi Kumar",    "9876543210", "ravi@metrowholesale.com",    3, "Net 30"),
                        ("HUL Distributor Chennai",    "Meena Rajan",   "9876543220", "meena@huldist.com",          2, "Net 15"),
                        ("ITC Foods Bangalore",        "Suresh Nair",   "9876543230", "suresh@itcfoods.com",        4, "Net 45"),
                        ("Amul Regional Office",       "Priya Patel",   "9876543240", "priya@amul.coop",            1, "Net 7"),
                        ("Reliance Fresh Supply Co",   "Amit Sharma",   "9876543250", "amit@reliancefresh.com",     5, "Net 30"),
                        ("Nestle India Distributor",   "Kavya Reddy",   "9876543260", "kavya@nestledist.com",       3, "Net 30"),
                        ("P&G Distributor Hyderabad",  "Rahul Mehta",   "9876543270", "rahul@pgdist.com",           2, "Net 21"),
                    ]
                    for s in suppliers:
                        db.add(Supplier(name=s[0], contact_person=s[1], phone=s[2], email=s[3], lead_time_days=s[4], credit_terms=s[5], is_active=True))
                    db.commit()
                    logger.info("✅ Suppliers seeded")

                # ── PRODUCTS ───────────────────────────────────────────
                if product_count == 0 and len(cat_objs) >= 1:
                    # (name, category_code, selling_price, cost_price, stock, min_stock, unit, perishable, sku)
                    products = [
                        # Beverages
                        ("Coca-Cola 750ml",             "BEV", 45,  32,  300, 40, "bottle", False, "BEV001"),
                        ("Pepsi 2L",                    "BEV", 90,  65,  200, 30, "bottle", False, "BEV002"),
                        ("Tropicana Orange Juice 1L",   "BEV", 110, 82,  120, 20, "pack",   False, "BEV003"),
                        ("Red Bull 250ml",               "BEV", 125, 95,  150, 25, "can",    False, "BEV004"),
                        ("Nescafe Classic 200g",         "BEV", 320, 245, 80,  10, "jar",    False, "BEV005"),
                        ("Lipton Green Tea 100 bags",    "BEV", 185, 140, 90,  12, "box",    False, "BEV006"),
                        # Dairy
                        ("Amul Full Cream Milk 1L",      "DAI", 68,  55,  150, 20, "packet", True,  "DAI001"),
                        ("Amul Butter 500g",             "DAI", 265, 220, 80,  10, "pack",   True,  "DAI002"),
                        ("Mother Dairy Curd 400g",       "DAI", 45,  36,  120, 15, "cup",    True,  "DAI003"),
                        ("Amul Paneer 200g",             "DAI", 85,  65,  80,  10, "pack",   True,  "DAI004"),
                        ("Britannia Cheese Slice 200g",  "DAI", 110, 85,  100, 15, "pack",   False, "DAI005"),
                        # Bakery
                        ("Britannia Brown Bread 400g",   "BAK", 45,  35,  200, 30, "piece",  True,  "BAK001"),
                        ("Parle-G Biscuits 800g",        "BAK", 55,  40,  300, 40, "pack",   False, "BAK002"),
                        ("Hide & Seek Cookies 100g",     "BAK", 30,  22,  250, 35, "pack",   False, "BAK003"),
                        ("Britannia Good Day 200g",      "BAK", 40,  30,  280, 35, "pack",   False, "BAK004"),
                        # Snacks
                        ("Lay's Classic Salted 100g",    "SNA", 20,  14,  500, 50, "pack",   False, "SNA001"),
                        ("Haldiram Namkeen 400g",        "SNA", 120, 90,  250, 30, "pack",   False, "SNA002"),
                        ("Kurkure Masala Munch 90g",     "SNA", 20,  14,  400, 50, "pack",   False, "SNA003"),
                        ("Pringles Original 134g",       "SNA", 180, 140, 150, 20, "can",    False, "SNA004"),
                        ("Bingo Mad Angles 90g",         "SNA", 20,  14,  350, 45, "pack",   False, "SNA005"),
                        # Fruits & Vegetables
                        ("Tomatoes 1kg",                 "FRV", 40,  25,  100, 20, "kg",     True,  "FRV001"),
                        ("Onions 1kg",                   "FRV", 35,  22,  150, 25, "kg",     True,  "FRV002"),
                        ("Bananas 1 dozen",              "FRV", 60,  40,  80,  12, "dozen",  True,  "FRV003"),
                        ("Apples 1kg",                   "FRV", 180, 135, 60,  10, "kg",     True,  "FRV004"),
                        # Personal Care
                        ("Colgate Toothpaste 200g",      "PER", 95,  72,  180, 25, "tube",   False, "PER001"),
                        ("Dettol Soap 75g",              "PER", 45,  32,  200, 25, "bar",    False, "PER002"),
                        ("Head & Shoulders 180ml",       "PER", 185, 145, 120, 15, "bottle", False, "PER003"),
                        ("Dove Body Lotion 200ml",       "PER", 220, 175, 90,  12, "bottle", False, "PER004"),
                        # Household
                        ("Surf Excel 1kg",               "HOU", 185, 145, 100, 15, "pack",   False, "HOU001"),
                        ("Harpic Power Plus 500ml",      "HOU", 130, 98,  120, 15, "bottle", False, "HOU002"),
                        ("Vim Dish Wash Bar 200g",       "HOU", 30,  22,  250, 30, "bar",    False, "HOU003"),
                        # Staples
                        ("Basmati Rice 5kg",             "STA", 450, 360, 80,  10, "bag",    False, "STA001"),
                        ("Tata Salt 1kg",                "STA", 25,  18,  300, 40, "pack",   False, "STA002"),
                        ("Fortune Sunflower Oil 1L",     "STA", 165, 130, 120, 15, "bottle", False, "STA003"),
                        ("Toor Dal 1kg",                 "STA", 140, 108, 100, 15, "pack",   False, "STA004"),
                    ]
                    barcodes_used = set()
                    for p in products:
                        while True:
                            bc = f"SR{random.randint(1000000,9999999)}"
                            if bc not in barcodes_used:
                                barcodes_used.add(bc)
                                break
                        cat_id = cat_map.get(p[1], cat_objs[0].id)
                        db.add(Product(
                            name=p[0], barcode=bc, sku=p[8],
                            category_id=cat_id, selling_price=p[2],
                            cost_price=p[3], current_stock=p[4], min_stock_level=p[5],
                            unit=p[6], is_perishable=p[7], tax_rate=5.0
                        ))
                    db.commit()
                    logger.info(f"✅ {len(products)} products seeded")

                # ── CUSTOMERS ──────────────────────────────────────────
                if db.query(Customer).count() == 0:
                    customers = [
                        ("Priya Sharma",    "priya@gmail.com",   "9876501234", 1250, "Gold"),
                        ("Rahul Verma",     "rahul@gmail.com",   "9876502345", 320,  "Silver"),
                        ("Anjali Singh",    "anjali@gmail.com",  "9876503456", 2800, "Platinum"),
                        ("Suresh Patel",    "suresh@gmail.com",  "9876504567", 150,  "Silver"),
                        ("Meena Reddy",     "meena@gmail.com",   "9876505678", 980,  "Gold"),
                        ("Kiran Kumar",     "kiran@gmail.com",   "9876506789", 450,  "Silver"),
                        ("Deepa Nair",      "deepa@gmail.com",   "9876507890", 3500, "Platinum"),
                        ("Arun Joshi",      "arun@gmail.com",    "9876508901", 75,   "Silver"),
                        ("Sunita Gupta",    "sunita@gmail.com",  "9876509012", 1800, "Gold"),
                        ("Vijay Krishnan",  "vijay@gmail.com",   "9876500123", 620,  "Silver"),
                    ]
                    for c in customers:
                        db.add(Customer(name=c[0], email=c[1], phone=c[2], loyalty_points=c[3], tier=c[4]))
                    db.commit()
                    logger.info("✅ Customers seeded")

                logger.info("✅ All demo data seeded successfully!")
            else:
                logger.info(f"Database already populated — users={user_count}, products={product_count}, suppliers={supplier_count}")
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

"""
SMARTRETAIL AI - Master Data Seeder
Populates initial Categories, Products with real Barcodes, Stock Levels, and Customers.
"""

import sys
from decimal import Decimal
from sqlalchemy import text, inspect
from app.database import SessionLocal, engine, Base
from app.models.category import Category
from app.models.product import Product
from app.models.customer import Customer
from app.models.stock_movement import StockMovement

CATEGORIES_DATA = [
    {"name": "Dairy & Chilled", "code": "CAT-DAIRY", "description": "Fresh milk, cheese, paneer, yogurts, and butter"},
    {"name": "Staples & Grains", "code": "CAT-STAPLES", "description": "Atta, rice, pulses, sugar, and edible oils"},
    {"name": "Beverages & Juices", "code": "CAT-BEV", "description": "Soft drinks, tea, coffee, energy drinks, mineral water"},
    {"name": "Snacks & Packaged Food", "code": "CAT-SNACKS", "description": "Biscuits, chips, noodles, ready-to-eat breakfast"},
    {"name": "Personal Care", "code": "CAT-CARE", "description": "Oral care, soaps, shampoos, skincare, hygiene"},
    {"name": "Household & Cleaning", "code": "CAT-HOUSEHOLD", "description": "Detergents, floor cleaners, dishwash, insect repellents"},
    {"name": "Bakery & Confectionery", "code": "CAT-BAKERY", "description": "Fresh breads, buns, cakes, chocolates"},
]

CUSTOMERS_DATA = [
    {"name": "Ananya Deshmukh", "phone": "9880123456", "email": "ananya.d@gmail.com", "loyalty_points": 340, "tier": "Gold"},
    {"name": "Vikram Malhotra", "phone": "9845098765", "email": "v.malhotra@corp.in", "loyalty_points": 85, "tier": "Silver"},
    {"name": "Sunita Sundaram", "phone": "9731234890", "email": "sunita.s@outlook.com", "loyalty_points": 890, "tier": "Platinum"},
    {"name": "Rohan Kulkarni", "phone": "9900112233", "email": "rohan.k@gmail.com", "loyalty_points": 120, "tier": "Silver"},
    {"name": "Meera Krishnan", "phone": "9611223344", "email": "meera.k@gmail.com", "loyalty_points": 510, "tier": "Gold"},
]

PRODUCTS_DATA = [
    {
        "barcode": "8901030382718",
        "sku": "AML-TZ-1L",
        "name": "Amul Taaza Homogenised Toned Milk 1L",
        "category_code": "CAT-DAIRY",
        "unit": "Pack",
        "cost_price": Decimal("62.00"),
        "selling_price": Decimal("72.00"),
        "tax_rate": Decimal("5.00"),
        "current_stock": 25,
        "min_stock_level": 15,
        "is_perishable": True,
        "batch": "AML-2026-B1"
    },
    {
        "barcode": "8901233024823",
        "sku": "FTN-SO-1L",
        "name": "Fortune Sunlite Refined Sunflower Oil 1L",
        "category_code": "CAT-STAPLES",
        "unit": "Pouch",
        "cost_price": Decimal("135.00"),
        "selling_price": Decimal("165.00"),
        "tax_rate": Decimal("5.00"),
        "current_stock": 64,
        "min_stock_level": 20,
        "is_perishable": False,
        "batch": "FTN-8812"
    },
    {
        "barcode": "8901058852331",
        "sku": "TAT-SLT-1K",
        "name": "Tata Salt Vacuum Evaporated 1kg",
        "category_code": "CAT-STAPLES",
        "unit": "Pkt",
        "cost_price": Decimal("22.00"),
        "selling_price": Decimal("28.00"),
        "tax_rate": Decimal("0.00"),
        "current_stock": 120,
        "min_stock_level": 30,
        "is_perishable": False,
        "batch": "TAT-7701"
    },
    {
        "barcode": "8901063012015",
        "sku": "BRT-GD-200G",
        "name": "Britannia Good Day Butter Cookies 200g",
        "category_code": "CAT-SNACKS",
        "unit": "Pack",
        "cost_price": Decimal("38.00"),
        "selling_price": Decimal("50.00"),
        "tax_rate": Decimal("18.00"),
        "current_stock": 15,
        "min_stock_level": 10,
        "is_perishable": False,
        "batch": "BRT-GD-44"
    },
    {
        "barcode": "8901058863412",
        "sku": "NES-CF-50G",
        "name": "Nescafe Classic Instant Coffee Jar 50g",
        "category_code": "CAT-BEV",
        "unit": "Jar",
        "cost_price": Decimal("175.00"),
        "selling_price": Decimal("220.00"),
        "tax_rate": Decimal("18.00"),
        "current_stock": 35,
        "min_stock_level": 15,
        "is_perishable": False,
        "batch": "NES-CF-90"
    },
    {
        "barcode": "8901314010516",
        "sku": "COL-MF-150G",
        "name": "Colgate MaxFresh Spicy Fresh Toothpaste 150g",
        "category_code": "CAT-CARE",
        "unit": "Tube",
        "cost_price": Decimal("98.00"),
        "selling_price": Decimal("130.00"),
        "tax_rate": Decimal("18.00"),
        "current_stock": 52,
        "min_stock_level": 20,
        "is_perishable": False,
        "batch": "COL-MX-12"
    },
    {
        "barcode": "8901030704916",
        "sku": "SRF-MAT-1L",
        "name": "Surf Excel Matic Top Load Detergent 1L",
        "category_code": "CAT-HOUSEHOLD",
        "unit": "Bottle",
        "cost_price": Decimal("195.00"),
        "selling_price": Decimal("245.00"),
        "tax_rate": Decimal("18.00"),
        "current_stock": 14,
        "min_stock_level": 10,
        "is_perishable": False,
        "batch": "SRF-MAT-05"
    },
    {
        "barcode": "8901491101831",
        "sku": "LAY-MM-52G",
        "name": "Lay's India's Magic Masala Chips 52g",
        "category_code": "CAT-SNACKS",
        "unit": "Pouch",
        "cost_price": Decimal("15.50"),
        "selling_price": Decimal("20.00"),
        "tax_rate": Decimal("12.00"),
        "current_stock": 140,
        "min_stock_level": 40,
        "is_perishable": False,
        "batch": "LAY-MM-01"
    },
    {
        "barcode": "8901030018518",
        "sku": "KSN-KT-1K",
        "name": "Kissan Fresh Tomato Ketchup 1kg",
        "category_code": "CAT-SNACKS",
        "unit": "Bottle",
        "cost_price": Decimal("110.00"),
        "selling_price": Decimal("145.00"),
        "tax_rate": Decimal("12.00"),
        "current_stock": 28,
        "min_stock_level": 15,
        "is_perishable": False,
        "batch": "KSN-KT-09"
    },
    {
        "barcode": "8901725131238",
        "sku": "EPI-YG-100G",
        "name": "Epigamia Greek Yogurt Natural 100g",
        "category_code": "CAT-DAIRY",
        "unit": "Cup",
        "cost_price": Decimal("38.00"),
        "selling_price": Decimal("50.00"),
        "tax_rate": Decimal("5.00"),
        "current_stock": 22,
        "min_stock_level": 15,
        "is_perishable": True,
        "batch": "EPI-YG-08"
    },
    {
        "barcode": "8901491101837",
        "sku": "MAG-NOOD-70G",
        "name": "Maggi 2-Minute Masala Instant Noodles 70g",
        "category_code": "CAT-SNACKS",
        "unit": "Pack",
        "cost_price": Decimal("11.50"),
        "selling_price": Decimal("14.00"),
        "tax_rate": Decimal("12.00"),
        "current_stock": 200,
        "min_stock_level": 50,
        "is_perishable": False,
        "batch": "MAG-2026-N1"
    },
    {
        "barcode": "8901725181222",
        "sku": "CAD-SILK-60G",
        "name": "Cadbury Dairy Milk Silk Chocolate 60g",
        "category_code": "CAT-BAKERY",
        "unit": "Bar",
        "cost_price": Decimal("68.00"),
        "selling_price": Decimal("85.00"),
        "tax_rate": Decimal("18.00"),
        "current_stock": 45,
        "min_stock_level": 20,
        "is_perishable": False,
        "batch": "CAD-SLK-11"
    }
]

def migrate_sales_columns():
    """Ensure idempotency_key and notes columns exist on sales table."""
    inspector = inspect(engine)
    existing_cols = [c["name"] for c in inspector.get_columns("sales")]
    with engine.connect() as conn:
        if "idempotency_key" not in existing_cols:
            print("  Adding column 'idempotency_key' to 'sales'...")
            conn.execute(text("ALTER TABLE sales ADD COLUMN idempotency_key VARCHAR(100)"))
            conn.commit()
        if "notes" not in existing_cols:
            print("  Adding column 'notes' to 'sales'...")
            conn.execute(text("ALTER TABLE sales ADD COLUMN notes VARCHAR(255)"))
            conn.commit()

def seed_master():
    print("=" * 70)
    print("  SMARTRETAIL AI - Master Supermarket Catalog Seeder")
    print("=" * 70)

    Base.metadata.create_all(bind=engine)
    migrate_sales_columns()
    db = SessionLocal()

    try:
        # 1. Seed Categories
        cat_map = {}
        for c in CATEGORIES_DATA:
            existing = db.query(Category).filter((Category.code == c["code"]) | (Category.name == c["name"])).first()
            if not existing:
                cat_obj = Category(name=c["name"], code=c["code"], description=c["description"])
                db.add(cat_obj)
                db.flush()
                cat_map[c["code"]] = cat_obj.id
                print(f"  [CREATED] Category '{c['name']}' ({c['code']})")
            else:
                cat_map[c["code"]] = existing.id

        # 2. Seed Customers
        for cust in CUSTOMERS_DATA:
            existing = db.query(Customer).filter(Customer.phone == cust["phone"]).first()
            if not existing:
                cust_obj = Customer(
                    name=cust["name"],
                    phone=cust["phone"],
                    email=cust["email"],
                    loyalty_points=cust["loyalty_points"],
                    tier=cust["tier"]
                )
                db.add(cust_obj)
                print(f"  [CREATED] Customer '{cust['name']}' ({cust['phone']} - {cust['tier']} Tier)")

        # 3. Seed Products
        for p in PRODUCTS_DATA:
            cat_id = cat_map.get(p["category_code"])
            existing = db.query(Product).filter(Product.barcode == p["barcode"]).first()
            if not existing:
                prod = Product(
                    barcode=p["barcode"],
                    sku=p["sku"],
                    name=p["name"],
                    category_id=cat_id,
                    unit=p["unit"],
                    cost_price=p["cost_price"],
                    selling_price=p["selling_price"],
                    tax_rate=p["tax_rate"],
                    current_stock=p["current_stock"],
                    min_stock_level=p["min_stock_level"],
                    is_perishable=p["is_perishable"]
                )
                db.add(prod)
                db.flush()

                # Record opening stock movement
                move = StockMovement(
                    product_id=prod.id,
                    batch_number=p["batch"],
                    movement_type="INWARD_GRN",
                    quantity=p["current_stock"],
                    unit_cost=p["cost_price"],
                    reference_id="OPENING_STOCK",
                    notes="Initial shelf inventory balance."
                )
                db.add(move)
                print(f"  [CREATED] Product '{p['name']}' (Barcode: {p['barcode']} | Stock: {p['current_stock']})")

        db.commit()
        print("-" * 70)
        print("MASTER CATALOG POPULATION COMPLETED SUCCESSFULLY!")
        print("=" * 70)

    except Exception as exc:
        db.rollback()
        print(f"ERROR: Seeding master catalog failed: {exc}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    seed_master()

"""
SMARTRETAIL AI - Database Schema Initialization Script
Creates all tables, foreign keys, and indexes defined in SQLAlchemy ORM models.
"""

import sys
import logging
from sqlalchemy import inspect
from app.config import settings
from app.database import engine, Base, is_fallback
import app.models  # Registers all 10 models

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("init_db")

EXPECTED_TABLES = [
    "users",
    "categories",
    "products",
    "customers",
    "suppliers",
    "purchases",
    "purchase_items",
    "sales",
    "sale_items",
    "stock_movements"
]

def main():
    print("=" * 70)
    print("  SMARTRETAIL AI - Database Schema Initializer (Stage 3)")
    print("=" * 70)
    print(f"Target Database Dialect : {engine.dialect.name.upper()}")
    print(f"Active Connection URL   : {engine.url.render_as_string(hide_password=True)}")
    print(f"Using Offline Fallback  : {is_fallback}")
    print("-" * 70)

    print("Step 1: Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("  [OK] Tables created successfully.")

    print("\nStep 2: Inspecting created database schema...")
    inspector = inspect(engine)
    created_tables = inspector.get_table_names()

    all_ok = True
    for table_name in EXPECTED_TABLES:
        if table_name in created_tables:
            columns = inspector.get_columns(table_name)
            pk = inspector.get_pk_constraint(table_name).get("constrained_columns", [])
            fks = inspector.get_foreign_keys(table_name)
            fk_info = f" | {len(fks)} FK(s)" if fks else ""
            print(f"  [OK] [{table_name:<16}] {len(columns):>2} columns | PK: {pk}{fk_info}")
        else:
            print(f"  [X]  [{table_name:<16}] NOT FOUND!")
            all_ok = False

    print("-" * 70)
    if all_ok:
        print(f"SUCCESS: All {len(EXPECTED_TABLES)} core supermarket tables verified successfully!")
    else:
        print("WARNING: Some expected tables were not detected.")

    if is_fallback:
        print("\n" + "=" * 70)
        print("NOTE: Currently connected to local SQLite for verification testing.")
        print("To connect to your PostgreSQL instance:")
        print("  1. Ensure PostgreSQL service is running on port 5432.")
        print("  2. In PostgreSQL (pgAdmin/psql): CREATE DATABASE smartretail_db;")
        print("  3. Update .env with your credentials:")
        print("     DATABASE_URL=postgresql+psycopg2://<user>:<password>@localhost:5432/smartretail_db")
        print("  4. Re-run: python init_db.py")
        print("=" * 70)

if __name__ == "__main__":
    main()

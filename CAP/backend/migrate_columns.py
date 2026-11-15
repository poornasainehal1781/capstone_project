"""
Comprehensive migration script: checks all mapped SQLAlchemy models against tables and adds any missing columns.
"""
import sys
import os
from sqlalchemy import text, inspect

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.database import engine, Base
import app.models

def migrate():
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    with engine.connect() as conn:
        for table_name, table in Base.metadata.tables.items():
            if table_name in existing_tables:
                existing_cols = {c["name"]: c for c in inspector.get_columns(table_name)}
                for col in table.columns:
                    if col.name not in existing_cols:
                        col_type = col.type.compile(engine.dialect)
                        # Default handling
                        nullable = "NULL" if col.nullable else "DEFAULT 0"
                        sql = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}"
                        print(f"Adding missing column: {table_name}.{col.name} ({col_type})...")
                        try:
                            conn.execute(text(sql))
                            conn.commit()
                            print(f"  [OK] Added {table_name}.{col.name}")
                        except Exception as e:
                            print(f"  [ERR] Could not add {table_name}.{col.name}: {e}")
            else:
                print(f"Table {table_name} does not exist yet. create_all will handle it.")
    print("Migration check complete.")

if __name__ == "__main__":
    migrate()

"""
Seed script for Product Batches (FEFO & Expiry Tracking)
Populates initial realistic batch lots into PostgreSQL / SQLite.
"""
import sys
import datetime
from decimal import Decimal
from app.database import SessionLocal, Base, engine
from app.models.product import Product
from app.models.batch import ProductBatch

def seed_batches():
    print("=" * 70)
    print("  SEEDING PRODUCT BATCHES FOR AI DECISION SUPPORT & EXPIRY TRACKING")
    print("=" * 70)

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Find products
        milk = db.query(Product).filter(Product.name.like("%Amul Taaza%")).first()
        bread = db.query(Product).filter(Product.name.like("%Bread%")).first()
        oil = db.query(Product).filter(Product.name.like("%Sunflower Oil%")).first()
        noodles = db.query(Product).filter(Product.name.like("%Noodles%")).first()

        # If bread not in products, let's find any other perishable or use milk
        today = datetime.date.today()

        batches_to_create = []

        if milk:
            # 1. Critical near-expiry batch (expires in 5 days)
            batches_to_create.append({
                "product_id": milk.id,
                "batch_number": "AML-2026-B1",
                "mfg_date": today - datetime.timedelta(days=15),
                "expiry_date": today + datetime.timedelta(days=5),
                "initial_quantity": 25,
                "current_quantity": 10,
                "unit_cost": Decimal("62.00"),
                "is_active": True
            })
            # 2. Fresh optimal batch (expires in 22 days)
            batches_to_create.append({
                "product_id": milk.id,
                "batch_number": "AML-2026-B2",
                "mfg_date": today - datetime.timedelta(days=2),
                "expiry_date": today + datetime.timedelta(days=22),
                "initial_quantity": 20,
                "current_quantity": 15,
                "unit_cost": Decimal("62.00"),
                "is_active": True
            })
            # 3. Expired batch (expired 2 days ago) - Strictly for testing safety compliance
            batches_to_create.append({
                "product_id": milk.id,
                "batch_number": "AML-2026-EXP",
                "mfg_date": today - datetime.timedelta(days=30),
                "expiry_date": today - datetime.timedelta(days=2),
                "initial_quantity": 10,
                "current_quantity": 3,
                "unit_cost": Decimal("62.00"),
                "is_active": True
            })

        if noodles:
            # Warning batch (expires in 12 days)
            batches_to_create.append({
                "product_id": noodles.id,
                "batch_number": "MAG-2026-W1",
                "mfg_date": today - datetime.timedelta(days=60),
                "expiry_date": today + datetime.timedelta(days=12),
                "initial_quantity": 30,
                "current_quantity": 14,
                "unit_cost": Decimal("11.50"),
                "is_active": True
            })

        if oil:
            # Long shelf-life batch (expires in 240 days)
            batches_to_create.append({
                "product_id": oil.id,
                "batch_number": "FTN-8812",
                "mfg_date": today - datetime.timedelta(days=40),
                "expiry_date": today + datetime.timedelta(days=240),
                "initial_quantity": 70,
                "current_quantity": 64,
                "unit_cost": Decimal("135.00"),
                "is_active": True
            })

        created_count = 0
        for b_data in batches_to_create:
            existing = db.query(ProductBatch).filter(
                ProductBatch.batch_number == b_data["batch_number"],
                ProductBatch.product_id == b_data["product_id"]
            ).first()

            if existing:
                # Update dates & qty
                existing.expiry_date = b_data["expiry_date"]
                existing.mfg_date = b_data["mfg_date"]
                existing.current_quantity = b_data["current_quantity"]
                existing.is_active = True
                print(f"  [UPDATED] Batch {b_data['batch_number']} (Exp: {b_data['expiry_date']}, Qty: {b_data['current_quantity']})")
            else:
                batch_obj = ProductBatch(**b_data)
                db.add(batch_obj)
                created_count += 1
                print(f"  [CREATED] Batch {b_data['batch_number']} (Exp: {b_data['expiry_date']}, Qty: {b_data['current_quantity']})")

        db.commit()
        print(f"\nSuccessfully seeded/verified {len(batches_to_create)} batch records.")
    except Exception as exc:
        db.rollback()
        print(f"Error seeding batches: {exc}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_batches()


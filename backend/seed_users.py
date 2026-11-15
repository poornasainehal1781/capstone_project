"""
SMARTRETAIL AI - Initial Staff Account Provisioning Script
Seeds the database with the initial Admin, Manager, and Cashier accounts.
All passwords are encrypted with bcrypt (12 rounds) before insertion.
"""

import sys
from app.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User

DEFAULT_STAFF_ACCOUNTS = [
    {
        "username": "admin_rajesh",
        "email": "admin@smartretail.ai",
        "full_name": "Rajesh Sharma (General Manager)",
        "role": "ADMIN",
        "raw_password": "Admin@123",
    },
    {
        "username": "mgr_priya",
        "email": "manager@smartretail.ai",
        "full_name": "Priya Nair (Inventory Manager)",
        "role": "MANAGER",
        "raw_password": "Manager@123",
    },
    {
        "username": "cashier_karan",
        "email": "cashier@smartretail.ai",
        "full_name": "Karan Verma (POS Operator)",
        "role": "CASHIER",
        "raw_password": "Cashier@123",
    },
]

def seed_users():
    print("=" * 70)
    print("  SMARTRETAIL AI - Staff Account Seeder (Stage 4)")
    print("=" * 70)

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        created_count = 0
        updated_count = 0

        for staff in DEFAULT_STAFF_ACCOUNTS:
            existing = db.query(User).filter(User.username == staff["username"]).first()
            hashed_pwd = hash_password(staff["raw_password"])

            if existing:
                existing.password_hash = hashed_pwd
                existing.full_name = staff["full_name"]
                existing.role = staff["role"]
                existing.is_active = True
                print(f"  [UPDATED] User '{staff['username']}' (Role: {staff['role']}) password synchronized.")
                updated_count += 1
            else:
                new_user = User(
                    username=staff["username"],
                    email=staff["email"],
                    full_name=staff["full_name"],
                    password_hash=hashed_pwd,
                    role=staff["role"],
                    is_active=True,
                )
                db.add(new_user)
                print(f"  [CREATED] User '{staff['username']}' (Role: {staff['role']}) provisioned successfully.")
                created_count += 1

        db.commit()
        print("-" * 70)
        print(f"SUMMARY: {created_count} account(s) created, {updated_count} account(s) updated.")
        print("\nDEFAULT TEST CREDENTIALS:")
        print("  1. Admin   : Username: admin_rajesh   | Password: Admin@123")
        print("  2. Manager : Username: mgr_priya      | Password: Manager@123")
        print("  3. Cashier : Username: cashier_karan  | Password: Cashier@123")
        print("=" * 70)

    except Exception as exc:
        db.rollback()
        print(f"ERROR: Failed to seed users: {exc}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()

"""
SMARTRETAIL AI - Analytics & Historical Data Seeder (Stage 7)
Populates:
1. Suppliers (Amul, Adani Wilmar, HUL, Britannia, Nestle).
2. Purchase Orders with Purchase Items across statuses (RECEIVED, IN_TRANSIT, CONFIRMED, DRAFT).
3. Historical Sales across the last 30 days with line items, tax breakdowns, and payment methods.
4. Additional StockMovement records for historical completeness.
"""

import sys
import random
from datetime import datetime, timedelta, date
from decimal import Decimal
from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.purchase import Purchase, PurchaseItem
from app.models.sale import Sale, SaleItem
from app.models.stock_movement import StockMovement

SUPPLIERS_DATA = [
    {
        "name": "Gujarat Co-op Milk Mktg Fed (Amul)",
        "contact_person": "Suresh Patel",
        "phone": "9825012345",
        "email": "orders.bengaluru@amul.coop",
        "lead_time_days": 2,
        "credit_terms": "Net 15"
    },
    {
        "name": "Adani Wilmar Consumer Goods",
        "contact_person": "Manish Shah",
        "phone": "9879054321",
        "email": "supply@adaniwilmar.com",
        "lead_time_days": 4,
        "credit_terms": "Net 30"
    },
    {
        "name": "Hindustan Unilever Distributor Hub",
        "contact_person": "Amitabh Sen",
        "phone": "9820098765",
        "email": "b2b.orders@huldist.in",
        "lead_time_days": 3,
        "credit_terms": "Net 21"
    },
    {
        "name": "Britannia Industries Direct",
        "contact_person": "Ravi Chandra",
        "phone": "9845011223",
        "email": "south.orders@britannia.co.in",
        "lead_time_days": 3,
        "credit_terms": "Net 15"
    },
    {
        "name": "Nestle India Regional Depot",
        "contact_person": "Dinesh Iyer",
        "phone": "9810033445",
        "email": "depot.south@nestle.com",
        "lead_time_days": 5,
        "credit_terms": "Net 30"
    }
]

def seed_analytics():
    print("=" * 75)
    print("  SMARTRETAIL AI - Analytics & Historical Data Seeder (Stage 7)")
    print("=" * 75)

    db = SessionLocal()
    try:
        # 1. Fetch Users, Products, Customers
        manager = db.query(User).filter(User.role == "MANAGER").first()
        admin = db.query(User).filter(User.role == "ADMIN").first()
        cashier = db.query(User).filter(User.role == "CASHIER").first()
        user_id = manager.id if manager else (admin.id if admin else 1)
        cashier_id = cashier.id if cashier else user_id

        products = db.query(Product).all()
        customers = db.query(Customer).all()

        if not products:
            print("ERROR: No products found. Please run seed_master_data.py first.")
            return

        # 2. Seed Suppliers
        supplier_map = {}
        for s_data in SUPPLIERS_DATA:
            existing = db.query(Supplier).filter(Supplier.name == s_data["name"]).first()
            if not existing:
                sup = Supplier(
                    name=s_data["name"],
                    contact_person=s_data["contact_person"],
                    phone=s_data["phone"],
                    email=s_data["email"],
                    lead_time_days=s_data["lead_time_days"],
                    credit_terms=s_data["credit_terms"],
                    is_active=True
                )
                db.add(sup)
                db.flush()
                supplier_map[s_data["name"]] = sup.id
                print(f"  [CREATED] Supplier: {sup.name} (Lead: {sup.lead_time_days}d)")
            else:
                supplier_map[s_data["name"]] = existing.id

        # 3. Seed Purchase Orders
        existing_pos = db.query(Purchase).count()
        if existing_pos == 0:
            po_configs = [
                {
                    "po_number": "PO-2026-089",
                    "supplier_name": "Gujarat Co-op Milk Mktg Fed (Amul)",
                    "status": "RECEIVED",
                    "days_ago": 5,
                    "items": [(products[0], 50)]  # Milk
                },
                {
                    "po_number": "PO-2026-090",
                    "supplier_name": "Britannia Industries Direct",
                    "status": "IN_TRANSIT",
                    "days_ago": 2,
                    "items": [(products[3], 60)] if len(products) > 3 else [(products[0], 20)] # Good Day
                },
                {
                    "po_number": "PO-2026-091",
                    "supplier_name": "Hindustan Unilever Distributor Hub",
                    "status": "CONFIRMED",
                    "days_ago": 1,
                    "items": [(products[6], 30)] if len(products) > 6 else [(products[0], 15)] # Surf Excel
                },
                {
                    "po_number": "PO-2026-092",
                    "supplier_name": "Adani Wilmar Consumer Goods",
                    "status": "DRAFT",
                    "days_ago": 0,
                    "items": [(products[1], 40)] if len(products) > 1 else [(products[0], 10)] # Sunflower Oil
                }
            ]

            for cfg in po_configs:
                sup_id = supplier_map.get(cfg["supplier_name"])
                if not sup_id:
                    continue

                created_dt = datetime.now() - timedelta(days=cfg["days_ago"])
                po = Purchase(
                    po_number=cfg["po_number"],
                    supplier_id=sup_id,
                    created_by_user_id=user_id,
                    total_amount=Decimal("0.00"),
                    status=cfg["status"],
                    expected_delivery_date=created_dt.date() + timedelta(days=3),
                    created_at=created_dt
                )
                db.add(po)
                db.flush()

                po_total = Decimal("0.00")
                for prod, qty in cfg["items"]:
                    cost = Decimal(str(prod.cost_price))
                    subtot = Decimal(qty) * cost
                    po_item = PurchaseItem(
                        purchase_id=po.id,
                        product_id=prod.id,
                        quantity=qty,
                        unit_cost=cost,
                        subtotal=subtot
                    )
                    db.add(po_item)
                    po_total += subtot

                po.total_amount = po_total
                print(f"  [CREATED] Purchase Order: {po.po_number} - Rs. {po_total:.2f} ({po.status})")

        # 4. Seed Historical Sales across 30 Days (Daily, Weekly, Monthly curves)
        # Check current completed sales count
        completed_sales_count = db.query(Sale).filter(Sale.status == "COMPLETED").count()
        if completed_sales_count < 15:
            print("\nSeeding historical sales across the last 30 days for rich analytics...")
            payment_methods = ["UPI_QR", "UPI_QR", "CASH", "CARD", "UPI_QR"]

            # Generate sales across past 28 days with natural volume curve
            random.seed(42)
            today = datetime.now()

            for day_offset in range(28, -1, -1):
                sale_date = today - timedelta(days=day_offset)
                # Weekend bump (Saturday/Sunday have more sales)
                is_weekend = sale_date.weekday() in (5, 6)
                num_sales_today = random.randint(3, 6) if is_weekend else random.randint(1, 3)

                for s_idx in range(num_sales_today):
                    hour = random.randint(9, 21)
                    minute = random.randint(0, 59)
                    exact_time = sale_date.replace(hour=hour, minute=minute, second=random.randint(0, 59))

                    customer = random.choice(customers) if (customers and random.random() > 0.3) else None
                    method = random.choice(payment_methods)

                    # Select 1 to 3 items
                    selected_prods = random.sample(products, k=min(len(products), random.randint(1, 3)))
                    line_items_data = []
                    subtotal = Decimal("0.00")
                    tax_amount = Decimal("0.00")

                    for p in selected_prods:
                        qty = random.randint(1, 3)
                        price = Decimal(str(p.selling_price))
                        tax_rate = Decimal(str(p.tax_rate))
                        gross = price * Decimal(qty)
                        line_tax = round(gross * (tax_rate / Decimal("100.00")), 2)
                        line_tot = gross + line_tax

                        subtotal += gross
                        tax_amount += line_tax
                        line_items_data.append({
                            "product": p,
                            "quantity": qty,
                            "unit_price": price,
                            "tax_rate": tax_rate,
                            "tax_amount": line_tax,
                            "line_total": line_tot
                        })

                    discount = Decimal("0.00")
                    if subtotal > 150 and random.random() > 0.6:
                        discount = Decimal("10.00")

                    grand_total = max(Decimal("0.00"), subtotal + tax_amount - discount)
                    invoice_no = f"INV-{exact_time.strftime('%Y%m%d')}-{random.randint(1000, 9999)}"

                    sale = Sale(
                        invoice_number=invoice_no,
                        customer_id=customer.id if customer else None,
                        cashier_id=cashier_id,
                        subtotal=subtotal,
                        tax_amount=tax_amount,
                        discount_amount=discount,
                        grand_total=grand_total,
                        payment_method=method,
                        status="COMPLETED",
                        notes="Historical POS transaction",
                        created_at=exact_time,
                        updated_at=exact_time
                    )
                    db.add(sale)
                    db.flush()

                    for it in line_items_data:
                        s_item = SaleItem(
                            sale_id=sale.id,
                            product_id=it["product"].id,
                            batch_number=f"BAT-{it['product'].id}",
                            quantity=it["quantity"],
                            unit_price=it["unit_price"],
                            tax_rate=it["tax_rate"],
                            tax_amount=it["tax_amount"],
                            discount=Decimal("0.00"),
                            line_total=it["line_total"]
                        )
                        db.add(s_item)

            print(f"  [OK] Successfully populated historical sales spanning 30 days.")

        db.commit()
        print("-" * 75)
        print("STAGE 7 ANALYTICS DATABASE SEEDING COMPLETED SUCCESSFULLY!")
        print("=" * 75)

    except Exception as exc:
        db.rollback()
        print(f"ERROR during analytics data seeding: {exc}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    seed_analytics()


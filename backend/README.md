# SMARTRETAIL AI — Backend & Database Engine (Stage 3)

**AI-Powered Retail Inventory, POS Billing & Decision Support System**

---

## 1. Architecture Overview

The backend is built with **FastAPI**, **SQLAlchemy 2.0 ORM**, **Pydantic v2**, and **PostgreSQL**. It provides the core data persistence layer for hypermarket operations, high-speed POS transaction integrity, FEFO batch expiry tracking, and analytical telemetry.

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI entry point, CORS, lifespan, documentation
│   ├── config.py                # Environment configuration using Pydantic Settings
│   ├── database.py              # SQLAlchemy engine, session maker, get_db dependency
│   ├── models/                  # SQLAlchemy ORM Models
│   │   ├── __init__.py          # Model discovery & metadata registry
│   │   ├── base.py              # TimestampMixin (created_at, updated_at)
│   │   ├── user.py              # User model (ADMIN, MANAGER, CASHIER)
│   │   ├── category.py          # Category model
│   │   ├── product.py           # Product master catalog (EAN-13, MRP, Cost, Tax)
│   │   ├── customer.py          # Customer profile & loyalty tier
│   │   ├── supplier.py          # Supplier model (lead time days for AI ROP)
│   │   ├── purchase.py          # Purchase (PO) and PurchaseItem models
│   │   ├── sale.py              # Sale (Invoice) and SaleItem models
│   │   └── stock_movement.py    # Immutable audit ledger for FEFO inventory
│   ├── schemas/                 # Pydantic v2 Request/Response validation models
│   │   ├── __init__.py
│   │   ├── common.py            # HealthCheckResponse, DatabaseHealthResponse
│   │   ├── user.py              # UserBase, UserCreate, UserResponse
│   │   ├── category.py          # CategoryBase, CategoryCreate, CategoryResponse
│   │   ├── product.py           # ProductBase, ProductCreate, ProductResponse
│   │   ├── customer.py          # CustomerBase, CustomerCreate, CustomerResponse
│   │   ├── supplier.py          # SupplierBase, SupplierCreate, SupplierResponse
│   │   ├── purchase.py          # PurchaseCreate, PurchaseResponse
│   │   ├── sale.py              # SaleCreate, SaleResponse
│   │   └── stock_movement.py    # StockMovementCreate, StockMovementResponse
│   └── api/
│       ├── __init__.py
│       └── v1/
│           ├── __init__.py      # Router prefix /api/v1
│           └── health.py        # /health, /health/db endpoints
├── alembic/                     # Database migration revisions
│   ├── versions/
│   └── env.py
├── alembic.ini
├── init_db.py                   # Direct database table initializer & inspector
├── test_backend.py              # Automated verification test suite
├── requirements.txt             # Dependencies
├── .env.example                 # Configuration template
└── .env                         # Active environment variables
```

---

## 2. Database Models & Schema Design

The system implements 10 core tables with primary keys, foreign keys, timestamps, and indexes:

| Table | Purpose | Key Columns & Indexes |
| :--- | :--- | :--- |
| `users` | Supermarket internal staff | `id` (PK), `username` (Unique/Indexed), `email` (Unique/Indexed), `password_hash`, `role` (`ADMIN`, `MANAGER`, `CASHIER`), `is_active` |
| `categories` | Merchandise departments | `id` (PK), `name` (Unique/Indexed), `code` (Unique/Indexed), `description` |
| `products` | Master SKU catalog | `id` (PK), `barcode` (Unique/Indexed), `name` (Indexed), `category_id` (FK), `cost_price`, `selling_price` (MRP), `tax_rate` (GST %), `min_stock_level` (ROP), `is_perishable` |
| `customers` | POS CRM & Loyalty | `id` (PK), `phone` (Unique/Indexed), `name`, `email`, `loyalty_points`, `tier` (`Silver`, `Gold`, `Platinum`) |
| `suppliers` | FMCG vendor partners | `id` (PK), `name` (Unique/Indexed), `contact_person`, `phone`, `email`, `lead_time_days` (Used by AI Restock), `credit_terms` |
| `purchases` | Purchase Orders (PO) | `id` (PK), `po_number` (Unique/Indexed), `supplier_id` (FK), `created_by_user_id` (FK), `total_amount`, `status`, `expected_delivery_date` |
| `purchase_items`| PO line items | `id` (PK), `purchase_id` (FK), `product_id` (FK), `quantity`, `unit_cost`, `subtotal` |
| `sales` | POS Billing Invoices | `id` (PK), `invoice_number` (Unique/Indexed), `customer_id` (FK, Nullable), `cashier_id` (FK), `subtotal`, `tax_amount`, `discount_amount`, `grand_total`, `payment_method` (`CASH`, `UPI_QR`, `CARD`, `SPLIT`), `status` |
| `sale_items` | Invoice line items | `id` (PK), `sale_id` (FK), `product_id` (FK), `batch_number` (FEFO allocation), `quantity`, `unit_price`, `tax_rate`, `tax_amount`, `discount`, `line_total` |
| `stock_movements` | Inventory audit ledger | `id` (PK), `product_id` (FK), `batch_number`, `expiry_date` (FEFO), `movement_type` (`INWARD_GRN`, `POS_SALE`, `CUSTOMER_RETURN`, `EXPIRED_DISCARD`, `AUDIT_ADJUSTMENT`), `quantity`, `unit_cost`, `reference_id` |

---

## 3. How to Configure PostgreSQL

### Option A: Local PostgreSQL Server (Windows / pgAdmin)
1. Start the PostgreSQL service if it is stopped:
   ```powershell
   Start-Service postgresql-x64-16  # or your installed version
   ```
2. Open `psql` or `pgAdmin` and create the capstone database:
   ```sql
   CREATE DATABASE smartretail_db;
   ```
3. Update `c:\Users\kowsh\OneDrive\Documents\Desktop\CAP\backend\.env`:
   ```ini
   DATABASE_URL="postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/smartretail_db"
   ```

### Option B: Docker PostgreSQL (1-Command Instant Setup)
If you have Docker Desktop installed, run:
```powershell
docker run --name smartretail-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=smartretail_db -p 5432:5432 -d postgres:16
```

### Option C: Offline SQLite Development Fallback
If PostgreSQL is not running locally, the backend gracefully switches to local SQLite (`sqlite:///./smartretail_dev.db`) when `ALLOW_SQLITE_FALLBACK=True`. This allows instant testing, validation, and schema inspection. When you start PostgreSQL, the backend automatically connects to PostgreSQL!

---

## 4. How to Run and Test the Backend

### Step 1: Activate Virtual Environment
```powershell
cd c:\Users\kowsh\OneDrive\Documents\Desktop\CAP\backend
.\venv\Scripts\Activate.ps1
```

### Step 2: Initialize Database Tables
```powershell
python init_db.py
```

### Step 3: Run Automated Verification Tests
```powershell
python test_backend.py
```

### Step 4: Start the FastAPI Server
```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 5. Live Endpoints & Interactive API Docs

Once running, access the following in your browser:

- **Swagger UI Interactive Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Root Welcome Info**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Liveness Health Check**: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)
- **Database Diagnostic Test**: [http://127.0.0.1:8000/api/v1/health/db](http://127.0.0.1:8000/api/v1/health/db)

# SmartRetail AI
### AI-Powered Retail Inventory, POS Billing & Decision Support System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/Frontend-React_19-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/UI-TailwindCSS_v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/AI-OpenAI_GPT--4o--mini-412991?logo=openai)](https://platform.openai.com/)

---

## 1. Project Overview

**SmartRetail AI** is an enterprise-grade, full-stack supermarket operations management and decision-support platform designed for modern Indian and global brick-and-mortar retail stores. It bridges the critical operational divide between high-speed front-desk Point-of-Sale (POS) barcode checkout and intelligent back-office inventory replenishment. 

By unifying hardware-grade barcode/QR scanning, atomic transactional stock accounting, GST-compliant tax invoicing, multi-period financial reporting, and an AI decision-support copilot grounded in real database queries, SmartRetail AI empowers cashiers, inventory managers, and store owners to eliminate stockouts, prevent dead-stock accumulation, and optimize shelf-life margins.

---

## 2. Problem Statement

Traditional standalone retail stores and regional supermarkets face significant operational challenges:
1. **Disconnected Systems**: Traditional electronic cash registers (ECRs) or simple billing software do not synchronize in real time with procurement or supplier replenishment pipelines.
2. **Stockouts & Overstocking**: Inaccurate manual reordering causes revenue loss from stockouts of high-velocity goods while tying up working capital in slow-moving or perishable inventory.
3. **Perishable Product Shrinkage**: Supermarkets experience high spoilage losses due to lack of batch-level First-Expiry-First-Out (FEFO) tracking.
4. **Billing Friction**: Slow search interfaces and inability to reliably scan standard retail EAN-13 barcodes result in customer queue bottlenecks.
5. **Lack of Actionable Insights**: Store managers lack accessible, grounded analytics tools to query store metrics without technical SQL expertise.

---

## 3. Project Objectives

- **Sub-Second POS Billing**: Deliver an ultra-fast checkout workflow supporting real-time camera and hardware barcode scanning, stock validation, and instant PDF invoice printing.
- **Atomic Stock Ledger**: Ensure every completed sale, purchase order inwarding, and return atomically commits inventory balance changes and creates an immutable `StockMovement` audit record.
- **FEFO Expiry Control**: Monitor product batches with automated warning alerts for lots expiring within 7 to 15 days, preventing non-sellable stock distribution.
- **AI-Driven Replenishment**: Automate Reorder Point (ROP) calculation using 30-day sales velocity, supplier lead time, and dynamic safety buffers.
- **Secure Decision Support Assistant**: Provide a manager-facing chatbot grounded in predefined, parameterized database query functions—strictly eliminating raw SQL injection vulnerabilities and hallucinated business metrics.
- **Transparent Fallback Architecture**: Guarantee 100% operational uptime by seamlessly falling back to a deterministic rule-based engine when external AI APIs are offline or unconfigured.

---

## 4. Main Features & Modules

| Module | Core Capabilities |
| :--- | :--- |
| **Authentication & RBAC** | JWT bearer tokens, salted Bcrypt password hashing, and granular role enforcement (`ADMIN`, `MANAGER`, `CASHIER`). |
| **Executive Dashboard** | Real-time counters for today's revenue, completed orders, low-stock alerts, registered customers, and top-selling SKUs. |
| **Product & Department Catalog** | Full catalog CRUD with EAN-13 / UPC barcode indexing, SKU codes, cost/selling prices, GST tax rates (0%, 5%, 12%, 18%), and stock thresholds. |
| **POS Billing & Scanning** | Camera-based HTML5 barcode/QR scanner, instant SKU lookup, multi-tier quantity controls, customer loyalty tracking, and instant ReportLab PDF receipt generation. |
| **Inventory & FEFO Batches** | Warehouse inventory valuation, batch number tracking, manufacturing/expiry date alerts, and comprehensive stock movement logs. |
| **Procurement & Inwarding** | Purchase order (PO) generation, supplier lead-time management, and atomic Goods Receipt Note (GRN) inwarding. |
| **Reports & Analytics** | Interactive Recharts visualizations (Daily, Weekly, Monthly revenue, category splits, payment mix), dynamic date-range filters, and streaming CSV/PDF exports. |
| **AI Decision Support** | Stock replenishment radar, sales trend trajectory, near-expiry monitoring, and an interactive grounding chatbot with live badge transparency (`OPENAI_GPT` vs `RULE_BASED_FALLBACK`). |
| **User Management** | Administrative portal for provisioning staff accounts, assigning roles, and toggling active employment status. |

---

## 5. Technology Stack

### Frontend Architecture
- **Framework**: React 19 (SPA with React Router DOM v7)
- **Tooling & Bundler**: Vite v8.3
- **Styling**: Tailwind CSS v4, Lucide React icons
- **Data Visualization**: Recharts v2 (Responsive Area, Line, Bar, and Pie Charts)
- **Barcode & QR Scanner**: Html5-QRCode (Browser MediaDevices Camera Stream)
- **HTTP Client**: Axios with JWT interceptors and automatic 401 token clearing

### Backend Architecture
- **Framework**: FastAPI (Python 3.11+) with ASGI Uvicorn server
- **Data Modeling & ORM**: SQLAlchemy 2.0 with dialect-neutral declarative mappings
- **Validation**: Pydantic v2 schemas for strict input parsing and output serialization
- **Security & Cryptography**: Passlib (Bcrypt hashing) and python-jose (JWT HS256 tokens)
- **PDF Generation**: ReportLab engine for vector thermal receipts and executive reports
- **AI Orchestration**: OpenAI Python SDK (`gpt-4o-mini`) + Deterministic Decision Engine fallback

### Database & Storage
- **Primary Database**: PostgreSQL 14+ (Relational, ACID-compliant transactions)
- **Local Fallback**: SQLite 3 with WAL mode enabled (Automatic zero-friction developer setup)

---

## 6. System Architecture

```
  +-----------------------------------------------------------------------+
  |                             CLIENT TIER                               |
  |  React 19 Single Page Application (Vite 8, Tailwind CSS, Recharts)     |
  |  - Cashier POS View        - Inventory Manager      - Executive Dash  |
  |  - Barcode Camera Scanner  - AI Insights Copilot    - Staff Admin     |
  +-----------------------------------+-----------------------------------+
                                      | HTTP / REST (JWT Bearer Token)
                                      v
  +-----------------------------------------------------------------------+
  |                           API GATEWAY TIER                            |
  |              FastAPI ASGI Server (Uvicorn / Port 8000)                |
  |  - CORS Security Policy        - Request Rate Limiting / Validation   |
  |  - Role-Based Access Guards    - Idempotency Interceptor              |
  +-----------------------------------+-----------------------------------+
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
  +------------------------------+         +-------------------------------+
  |       BUSINESS DOMAINS       |         |      AI DECISION SUPPORT      |
  | - Auth & User Accounts       |         | - Retail Analytics Grounding  |
  | - Product & Category Catalog |         |   (Zero Raw SQL Execution)    |
  | - Transactional POS Checkout |         | - Deterministic Rule Engine   |
  | - Purchase Order Inwarding   |         | - OpenAI GPT-4o-mini Service  |
  | - PDF & CSV Export Engine    |         | - Transparent Engine Labeling |
  +--------------+---------------+         +---------------+---------------+
                 |                                         |
                 +--------------------+--------------------+
                                      |
                                      v
  +-----------------------------------------------------------------------+
  |                              DATA TIER                                |
  |            SQLAlchemy 2.0 ORM (Session Transaction Manager)           |
  |                                                                       |
  |    [PRIMARY] PostgreSQL 14+          [LOCAL DEV] SQLite 3 Fallback    |
  |    - ACID Relational Schemas         - Auto-migrating Column Schema   |
  |    - Foreign Keys & Cascades         - Seeded Supermarket Master Data |
  +-----------------------------------------------------------------------+
```

---

## 7. Database Overview

SmartRetail AI operates an ACID-compliant relational schema comprising 9 primary entity tables:

1. **`users`**: Staff profiles, roles (`ADMIN`, `MANAGER`, `CASHIER`), salted Bcrypt password hashes, and active status.
2. **`categories`**: Supermarket merchandise departments (code, name, description).
3. **`products`**: Master SKU catalog (EAN-13 barcode, SKU, name, unit, cost price, selling price, GST tax rate, current stock balance, minimum reorder point, perishable flag).
4. **`product_batches`**: Lot numbers, manufacturing dates, expiry dates, batch initial/current quantity for FEFO compliance.
5. **`customers`**: Customer profiles, contact phone numbers, loyalty points ledger, and membership tiers (`Silver`, `Gold`, `Platinum`).
6. **`sales`**: Header records for completed checkout transactions (invoice number, cashier ID, customer ID, subtotal, GST total, discount, grand total, payment method, idempotency key).
7. **`sale_items`**: Line items for each sale (sale ID, product ID, quantity, unit price, tax rate, line total).
8. **`suppliers`**: Supplier directory, contact details, payment terms, and lead time in days.
9. **`purchases` & `purchase_items`**: Purchase orders (PO number, supplier ID, status `PENDING`/`RECEIVED`, total amount) and line items with inwarding tracking.
10. **`stock_movements`**: Immutable inventory audit ledger recording movement type (`POS_SALE`, `PURCHASE_RECEIPT`, `CUSTOMER_RETURN`, `STOCK_ADJUSTMENT`), quantity delta (+/-), and document reference ID.

---

## 8. AI Features & How They Work

### A. Dynamic Reorder Point (ROP) Replenishment Radar
The replenishment engine computes inventory replenishment needs based on standard supply chain safety stock principles:

$$\text{Average Daily Sales (ADS)} = \frac{\sum_{t=1}^{30} \text{Units Sold in Last 30 Days}}{30}$$

$$\text{Reorder Point (ROP)} = (\text{ADS} \times \text{Supplier Lead Time}) + \text{Safety Buffer}$$

- If $\text{Current Stock} \le \text{ROP}$: The system generates an immediate replenishment alert, calculates recommended reorder batch size, and identifies the preferred supplier.
- Deterministic logic guarantees reliable calculations regardless of API network availability.

### B. Sales Trend & Trajectory Engine
Compares current rolling 7-day revenue against the prior 7-day period:
- Calculates percentage delta: $\frac{\text{Rev}_{\text{current}} - \text{Rev}_{\text{prior}}}{\text{Rev}_{\text{prior}}} \times 100\%$
- Trajectory classifications: `INCREASING` ($\ge +5\%$), `STABLE` ($-5\%$ to $+5\%$), `DECREASING` ($< -5\%$).
- Surfaces top revenue-generating SKUs and slow-moving products with zero sales in the last 14 days.

### C. Near-Expiry FEFO Monitoring
- Scans `product_batches` active inventory.
- Groups lots into:
  - **Critical Alert**: Expiring in $< 7$ days (suggests immediate promotional bundle or mark-down).
  - **Warning Alert**: Expiring in $7 - 15$ days (prioritized at checkout via FEFO).
  - **Expired**: Past expiry date (system strictly blocks sale and flags for quarantine/write-off).

### D. Grounded AI Retail Copilot (Chatbot)
- Managers can ask business questions in natural English (e.g., *"What were today's total sales?"*, *"Which products need replenishment?"*).
- **Security-First Architecture**: Natural language intent is routed to predefined, parameterized database grounding functions in [`retail_analytics_grounding.py`](file:///backend/app/services/retail_analytics_grounding.py).
- **Zero Raw SQL Execution**: The LLM is never permitted to execute arbitrary SQL or view customer PII.
- **Transparent Engine Labeling**: Every response carries an engine badge (`OPENAI_GPT` or `RULE_BASED_FALLBACK`).

---

## 9. Installation & Local Setup

### Prerequisites
- **Python 3.11+** installed
- **Node.js 18+** & **npm** installed
- **Git** installed
- *(Optional)* **PostgreSQL 14+** (SQLite development fallback is enabled by default)

### Step 1: Clone Repository
```powershell
git clone <repository_url>
cd CAP
```

### Step 2: Backend Setup
```powershell
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Windows Command Prompt:
.\venv\Scripts\activate.bat
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed master supermarket catalog (Categories, Products, Customers, Batches)
python seed_master_data.py
python seed_batches.py
```

### Step 3: Frontend Setup
```powershell
cd ../frontend

# Install frontend dependencies
npm install
```

---

## 10. Environment Variable Configuration

Create a `.env` file in the `backend/` directory:

```env
# =====================================================================
# Database Configuration
# =====================================================================
# For PostgreSQL (Production / Staging):
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/smartretail_db
# Allow automatic SQLite fallback for local developer machines:
ALLOW_SQLITE_FALLBACK=True
SQLITE_FALLBACK_URL=sqlite:///./smartretail_dev.db

# =====================================================================
# Security & JWT Configuration
# =====================================================================
SECRET_KEY=smartretail-super-secret-jwt-key-2026-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# =====================================================================
# AI Copilot Configuration (Optional)
# =====================================================================
# If omitted, system seamlessly runs in Deterministic Rule Engine mode
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# =====================================================================
# Application Settings
# =====================================================================
APP_NAME=SmartRetail AI
APP_ENV=development
DEBUG=True
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

---

## 11. Application Startup Commands

### Start Backend Server
In the `backend/` directory with virtual environment activated:
```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Interactive Swagger API Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Alternative ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### Start Frontend Server
In the `frontend/` directory:
```powershell
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)

### Default User Credentials
| Role | Username | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin_rajesh` | `Admin@123` | Full system access, staff user management |
| **Store Manager** | `mgr_priya` | `Manager@123` | Inventory, Purchases, Reports, AI Insights, Cancel Sales |
| **Cashier** | `cashier_karan` | `Cashier@123` | POS Billing, Barcode Scanning, Receipt Printing |

---

## 12. Testing Instructions

SmartRetail AI includes comprehensive automated test suites covering all operational tiers.

### Run Master System Integration Test Suite
Tests all 5 real-world supermarket workflows, password hashing, and RBAC zone isolation:
```powershell
cd backend
python test_full_system_integration.py
```

### Run Domain-Specific Test Suites
```powershell
# 1. Authentication & RBAC Zone Security Test Suite
python test_auth_rbac.py

# 2. POS Billing, Overselling Prevention, FEFO Allocation & Stock Decrement
python test_pos_billing.py

# 3. Analytics, Reports & PDF/CSV Export
python test_analytics_reports.py

# 4. AI Insights, Grounding & Chatbot Q&A
python test_ai_integration.py
```

### Run Frontend Production Build Check
```powershell
cd frontend
npm run build
```

---

## 13. Production Deployment Guide

### A. Deploy Frontend to Vercel
1. Connect the GitHub repository to [Vercel](https://vercel.com/).
2. Set **Root Directory** to `frontend`.
3. Set **Framework Preset** to `Vite`.
4. Configure Environment Variable:
   - `VITE_API_URL`: `https://smartretail-backend-api.onrender.com` (Your Render backend URL).
5. Deploy! Client-side routing is handled by `frontend/vercel.json`.

### B. Deploy Backend & PostgreSQL to Render
1. In [Render](https://render.com/), choose **Blueprints** and connect the repository pointing to `render.yaml`.
2. Render automatically provisions:
   - **PostgreSQL Database**: `smartretail-postgres`
   - **FastAPI Web Service**: `smartretail-backend-api` with automatic environment variable wiring.
3. For custom container deployment, a production multi-stage `backend/Dockerfile` and `.dockerignore` are included.

---

## 14. Documentation Directory (`docs/`)

For in-depth technical specifications, review the comprehensive manuals located in the [`docs/`](file:///docs/) directory:
- [`docs/academic_project_report.md`](file:///docs/academic_project_report.md) — Comprehensive academic capstone report.
- [`docs/system_architecture.md`](file:///docs/system_architecture.md) — Deep-dive architecture and component interactions.
- [`docs/database_documentation.md`](file:///docs/database_documentation.md) — ER diagrams, schema definitions, and indexes.
- [`docs/api_documentation.md`](file:///docs/api_documentation.md) — RESTful API specifications with request/response schemas.
- [`docs/demo_presentation_script.md`](file:///docs/demo_presentation_script.md) — 12-step presentation and viva demo guide.
- [`docs/deployment_guide.md`](file:///docs/deployment_guide.md) — Production deployment guidelines for Docker, Vercel, and Render.
- [`docs/testing_report.md`](file:///docs/testing_report.md) — Comprehensive test cases, pass/fail logs, and quality audit.

---

## 15. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.


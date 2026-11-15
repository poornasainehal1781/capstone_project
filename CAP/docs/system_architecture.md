# System Architecture Documentation
## SmartRetail AI — Retail Inventory, POS Billing & Decision Support System

---

## 1. High-Level Architecture Overview

SmartRetail AI is structured according to a modern multi-tiered client-server architecture designed for high availability, low-latency transaction processing, and strict operational security.

```mermaid
flowchart TD
    subgraph ClientTier ["1. Client Tier (Browser / POS Terminal)"]
        UI_Cashier["Cashier Interface (POS Billing & Camera Scanner)"]
        UI_Manager["Manager Portal (Inventory, PO, Reports, AI Copilot)"]
        UI_Admin["Admin Console (Staff User Provisioning & Roles)"]
    end

    subgraph GatewayTier ["2. Application & API Gateway (FastAPI / Port 8000)"]
        AuthGuard["JWT & Role Authorization Guard (Bcrypt / HS256)"]
        CORSMiddleware["CORS Security Policy"]
        IdempotencyFilter["Idempotency & Duplicate Billing Interceptor"]
        RouterLayer["API V1 Endpoints Router Layer"]
    end

    subgraph ServiceTier ["3. Business Logic & Processing Tier"]
        POSService["POS Checkout & Stock Decrement Engine"]
        PurchaseService["PO Management & Inwarding GRN Engine"]
        AnalyticsService["Recharts Aggregation & Reporting Engine"]
        PDFService["ReportLab PDF Generator (Receipts & Reports)"]
        AIService["AI Decision Support Engine (GPT-4o-mini & Rule Fallback)"]
    end

    subgraph DataTier ["4. Persistent Data Tier"]
        SQLAlchemyORM["SQLAlchemy 2.0 ORM (Session Manager)"]
        PostgreSQL[("Primary Database: PostgreSQL 14+")]
        SQLiteFallback[("Developer Fallback: SQLite 3 (WAL Mode)")]
    end

    UI_Cashier -->|HTTP REST / JWT| AuthGuard
    UI_Manager -->|HTTP REST / JWT| AuthGuard
    UI_Admin -->|HTTP REST / JWT| AuthGuard

    AuthGuard --> CORSMiddleware --> IdempotencyFilter --> RouterLayer

    RouterLayer --> POSService
    RouterLayer --> PurchaseService
    RouterLayer --> AnalyticsService
    RouterLayer --> PDFService
    RouterLayer --> AIService

    POSService --> SQLAlchemyORM
    PurchaseService --> SQLAlchemyORM
    AnalyticsService --> SQLAlchemyORM
    AIService --> SQLAlchemyORM

    SQLAlchemyORM --> PostgreSQL
    SQLAlchemyORM -.->|Fallback if PG Offline| SQLiteFallback
```

---

## 2. Client Tier Architecture

The frontend is implemented as a React 19 Single Page Application (SPA) bundled with Vite:

### Key Client Subsystems
1. **Routing & Role Guarding (`App.jsx`, `ProtectedRoute.jsx`)**:
   - Manages client-side route navigation.
   - Restricts sensitive routes based on authenticated user role.
   - Redirects unauthorized roles (e.g., cashiers attempting to open `/users` or `/reports`) back to permitted operational views.
2. **State & Session Persistence (`AuthContext.jsx`)**:
   - Stores JWT access token, expiration, and user profile in browser storage.
   - Automatically injects `Authorization: Bearer <token>` into Axios headers for every backend call.
   - Clears credentials and navigates to `/login` upon receiving `401 Unauthorized` responses.
3. **Hardware & Camera Barcode Scanner (`BarcodeScannerModal.jsx`)**:
   - Utilizes `html5-qrcode` to interface directly with device camera video streams via HTML5 WebRTC.
   - Supports 1D EAN-13, UPC, Code 128, and 2D QR codes.
   - Emits an audible confirmation tone and auto-adds matching catalog items to the checkout cart.
   - Provides an auto-focus text input fallback for handheld USB/Bluetooth laser barcode scanners that emulate keyboard input.
4. **Data Visualization (`Dashboard.jsx`, `SalesReports.jsx`)**:
   - Renders interactive Area, Bar, and Line charts using Recharts.
   - Responsive breakpoints configured with Tailwind CSS v4.

---

## 3. Backend & API Gateway Tier

The backend is built with FastAPI running on the high-performance ASGI Uvicorn server:

### Gateway Security & Routing Pipeline
1. **CORS Middleware**: Explicitly whitelists allowed origins (e.g., `http://localhost:5173`) while allowing standard REST verbs (`GET`, `POST`, `PUT`, `DELETE`).
2. **Authentication Middleware (`app/api/deps.py`)**:
   - `get_current_user`: Decodes JWT payload, validates signature and expiration, and fetches user entity.
   - `get_current_manager`: Verifies user has `ADMIN` or `MANAGER` role.
   - `get_current_admin`: Verifies user has `ADMIN` role.
3. **Idempotency Interceptor**:
   - In `POST /api/v1/sales`, cashiers send an `idempotency_key` (UUID).
   - If a transaction with that key already exists, the backend returns the existing invoice without executing a second debit from inventory.

---

## 4. Transactional & Stock Management Architecture

All inventory modifications follow strict atomic consistency rules:

```mermaid
sequenceDiagram
    autonumber
    actor Cashier as Cashier Terminal
    participant API as FastAPI /api/v1/sales
    participant DB as Database (Session Transaction)
    participant Stock as Product & StockMovement

    Cashier->>API: POST /api/v1/sales (Items, IdempotencyKey)
    API->>DB: Begin Database Transaction
    API->>DB: Check IdempotencyKey
    API->>Stock: Check Available Stock for each SKU
    alt Insufficient Stock
        API-->>Cashier: 400 Bad Request (Insufficient Stock)
        API->>DB: Rollback Transaction
    else Stock Available
        API->>DB: Insert Sale Header (Invoice #)
        API->>DB: Insert Sale Line Items
        API->>Stock: UPDATE products SET current_stock = current_stock - qty
        API->>Stock: INSERT INTO stock_movements (POS_SALE, -qty, Invoice#)
        API->>DB: Commit Transaction
        API-->>Cashier: 201 Created (Sale Data + Totals)
    end
```

---

## 5. AI Subsystem Architecture

The AI subsystem incorporates a hybrid architecture combining an LLM synthesizer with a deterministic mathematical engine:

```mermaid
flowchart TD
    UserQuery["Manager Query in AI Chatbot"] --> IntentClassifier["Intent Classification (NLP / Keywords)"]
    
    IntentClassifier -->|TODAYS_SALES| F1["grounding.get_todays_sales_summary()"]
    IntentClassifier -->|LOW_STOCK_LOOKUP| F2["grounding.get_low_stock_products()"]
    IntentClassifier -->|TOP_PRODUCTS| F3["grounding.get_top_selling_products()"]
    IntentClassifier -->|REPLENISHMENT_ANALYSIS| F4["grounding.get_replenishment_data()"]
    IntentClassifier -->|SALES_TRENDS| F5["grounding.get_sales_trends_data()"]
    IntentClassifier -->|EXPIRY_ANALYSIS| F6["grounding.get_near_expiry_batches()"]

    F1 & F2 & F3 & F4 & F5 & F6 --> VerifiedData["Structured DB Query Results"]

    VerifiedData --> EngineCheck{"OpenAI API Key Available & Valid?"}

    EngineCheck -->|Yes| LLMCall["OpenAI GPT-4o-mini Synthesis"]
    EngineCheck -->|No / Error| RuleFallback["RuleBasedDecisionEngine v1.0"]

    LLMCall --> BadgeA["Engine: OPENAI_GPT (is_fallback: False)"]
    RuleFallback --> BadgeB["Engine: RULE_BASED_FALLBACK (is_fallback: True)"]

    BadgeA & BadgeB --> ChatResponse["Return Grounded Natural Language Response"]
```

### Security Guarantees of the AI Architecture:
- **No Direct SQL Execution**: The AI model is strictly prohibited from formulating or executing arbitrary SQL strings. All database queries are pre-written in SQLAlchemy with explicit parameterization.
- **Role Isolation**: Only authenticated Managers and Admins can access AI insights or chat endpoints.
- **PII Protection**: Customer phone numbers and staff password hashes are excluded from AI grounding contexts.


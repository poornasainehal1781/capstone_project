# RESTful API Documentation
## SmartRetail AI — API Specifications & Endpoints Reference

---

## 1. Overview & General Conventions

- **Base URL**: `http://localhost:8000/api/v1`
- **Interactive Documentation**: Swagger UI at `http://localhost:8000/docs` | ReDoc at `http://localhost:8000/redoc`
- **Data Exchange Format**: `application/json` (unless exporting `text/csv` or `application/pdf`)
- **Authentication**: JWT Bearer token passed in HTTP request header:
  ```http
  Authorization: Bearer <access_token>
  ```
- **Error Format**: All non-2xx responses return standard JSON error envelopes:
  ```json
  {
    "detail": "Error description message"
  }
  ```

---

## 2. Authentication & Identity Endpoints

### 2.1 Authenticate Staff User (Login)
- **Method & Route**: `POST /auth/login`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "username": "cashier_karan",
    "password": "Cashier@123"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "token_type": "bearer",
    "expires_in": 28800,
    "user": {
      "id": 3,
      "username": "cashier_karan",
      "email": "karan.csh@smartretail.com",
      "full_name": "Karan Malhotra",
      "role": "CASHIER",
      "is_active": true
    }
  }
  ```

### 2.2 Get Current Profile
- **Method & Route**: `GET /auth/me`
- **Access**: Authenticated (`CASHIER`, `MANAGER`, `ADMIN`)
- **Success Response (200 OK)**: Returns the authenticated user object.

---

## 3. Products & Categories Endpoints

### 3.1 List Products
- **Method & Route**: `GET /products`
- **Query Parameters**:
  - `search` (string, optional): Search across name, barcode, or SKU.
  - `category_id` (integer, optional): Filter by department.
  - `low_stock` (boolean, optional): Filter items at or below ROP.
- **Success Response (200 OK)**: List of `ProductResponse` objects.

### 3.2 Lookup Product by Barcode
- **Method & Route**: `GET /products/barcode/{barcode}`
- **Access**: Authenticated (`CASHIER`, `MANAGER`, `ADMIN`)
- **Success Response (200 OK)**:
  ```json
  {
    "id": 2,
    "barcode": "8901030382718",
    "sku": "AML-TZ-1L",
    "name": "Amul Taaza Homogenised Toned Milk 1L",
    "category_id": 1,
    "unit": "Pack",
    "cost_price": "62.00",
    "selling_price": "72.00",
    "tax_rate": "5.00",
    "current_stock": 25,
    "min_stock_level": 15,
    "is_perishable": true
  }
  ```
- **Error Response (404 Not Found)**:
  ```json
  {
    "detail": "Product with barcode '8901030382718' not found in catalog."
  }
  ```

### 3.3 Create Product
- **Method & Route**: `POST /products`
- **Access**: `MANAGER`, `ADMIN`
- **Success Response (201 Created)**

---

## 4. POS Billing & Sales Endpoints

### 4.1 Process POS Checkout
- **Method & Route**: `POST /sales`
- **Access**: `CASHIER`, `MANAGER`, `ADMIN`
- **Request Body**:
  ```json
  {
    "customer_id": 1,
    "payment_method": "UPI_QR",
    "discount_amount": 10.00,
    "idempotency_key": "TXN-20261102-A1B2C3",
    "items": [
      {
        "product_id": 2,
        "quantity": 2
      }
    ]
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "id": 14,
    "invoice_number": "INV-20261102-36257",
    "cashier_id": 3,
    "customer_id": 1,
    "subtotal": "137.14",
    "tax_amount": "6.86",
    "discount_amount": "10.00",
    "grand_total": "134.00",
    "payment_method": "UPI_QR",
    "status": "COMPLETED",
    "created_at": "2026-11-02T23:34:25"
  }
  ```
- **Error Response (400 Bad Request)**:
  ```json
  {
    "detail": "Insufficient stock for 'Amul Taaza Homogenised Toned Milk 1L'. Current stock available: 2 Pack, requested: 10."
  }
  ```

### 4.2 Download Printable PDF Receipt
- **Method & Route**: `GET /sales/{sale_id}/pdf`
- **Access**: `CASHIER`, `MANAGER`, `ADMIN`
- **Success Response (200 OK)**: Binary stream of `application/pdf` with header `%PDF`.

### 4.3 Cancel Sale & Restore Stock
- **Method & Route**: `POST /sales/{sale_id}/cancel`
- **Access**: `MANAGER`, `ADMIN` (Cashiers receive `403 Forbidden`)
- **Success Response (200 OK)**: Returns updated sale status and restores inventory balances.

---

## 5. Procurement & Purchases Endpoints

### 5.1 Issue Purchase Order
- **Method & Route**: `POST /purchases`
- **Access**: `MANAGER`, `ADMIN`
- **Request Body**:
  ```json
  {
    "supplier_id": 1,
    "items": [
      {
        "product_id": 2,
        "quantity": 50,
        "unit_cost": 62.00
      }
    ]
  }
  ```
- **Success Response (201 Created)**: Returns purchase order with `status: "PENDING"`.

### 5.2 Receive Purchase Order (GRN Inwarding)
- **Method & Route**: `POST /purchases/{purchase_id}/receive`
- **Access**: `MANAGER`, `ADMIN`
- **Success Response (200 OK)**: Marks PO as `RECEIVED`, atomically increments stock by received quantity, and logs `StockMovement`.

---

## 6. Executive Reports & Analytics Endpoints

### 6.1 Main Dashboard Metrics
- **Method & Route**: `GET /analytics/dashboard`
- **Access**: `MANAGER`, `ADMIN`
- **Success Response (200 OK)**: Returns `total_revenue`, `completed_orders_count`, `total_products`, `low_stock_products_count`, `registered_customers_count`, `todays_revenue`, and `top_selling_products`.

### 6.2 Executive Report Summary
- **Method & Route**: `GET /reports/summary?date_range=last_7_days`
- **Access**: `MANAGER`, `ADMIN`

### 6.3 Streaming CSV Export
- **Method & Route**: `GET /reports/export/csv?report_type=sales`
- **Allowed Types**: `sales`, `inventory`, `purchases`
- **Success Response (200 OK)**: CSV stream (`text/csv`) with descriptive headers.

### 6.4 Executive PDF Report Export
- **Method & Route**: `GET /reports/export/pdf?report_type=summary`
- **Allowed Types**: `summary`, `sales`, `inventory`
- **Success Response (200 OK)**: Styled 3-page executive PDF report.

---

## 7. AI Decision Support & Chatbot Endpoints

### 7.1 Replenishment Recommendations
- **Method & Route**: `GET /ai/replenishment`
- **Access**: `MANAGER`, `ADMIN`
- **Success Response (200 OK)**:
  ```json
  {
    "engine": "RULE_BASED_FALLBACK",
    "model_used": "Deterministic Decision Engine v1.0",
    "is_fallback": true,
    "total_items_analyzed": 13,
    "items_needing_reorder": 0,
    "estimated_total_reorder_cost": 0.00,
    "recommendations": []
  }
  ```

### 7.2 Sales Trends Analysis
- **Method & Route**: `GET /ai/sales-trends`
- **Access**: `MANAGER`, `ADMIN`

### 7.3 Near-Expiry FEFO Batches
- **Method & Route**: `GET /ai/near-expiry`
- **Access**: `MANAGER`, `ADMIN`

### 7.4 Interactive AI Retail Assistant (Chatbot)
- **Method & Route**: `POST /ai/chat`
- **Access**: `MANAGER`, `ADMIN` (Cashiers receive `403 Forbidden`)
- **Request Body**:
  ```json
  {
    "message": "What were today's total sales?"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "reply": "**Today's Store Performance (2026-11-02):**\n- Completed Invoices: 2\n- Gross Sales: Rs. 403.04\n- Total Discounts: Rs. 10.00\n- Net Revenue Collected: Rs. 393.04",
    "intent_detected": "TODAYS_SALES",
    "engine": "RULE_BASED_FALLBACK",
    "model_used": "Deterministic Decision Engine v1.0",
    "is_fallback": true,
    "timestamp": "2026-11-02T23:38:03"
  }
  ```


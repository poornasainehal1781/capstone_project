# Production Deployment Guide
## SmartRetail AI — Production Architecture & Hosting Manual

---

## 1. Production Architecture Overview

In a production environment, SmartRetail AI is deployed as a decoupled, horizontally scalable multi-container architecture fronted by an Nginx reverse proxy and SSL termination.

```mermaid
flowchart TD
    Client["Client Browsers / POS Terminals (HTTPS:443)"] --> Nginx["Nginx Reverse Proxy & SSL Termination"]
    
    subgraph FrontendApp ["Frontend Hosting"]
        Nginx -->|Static Assets /| StaticDist["React 19 Static Production Build (/usr/share/nginx/html)"]
    end

    subgraph BackendCluster ["Backend API Cluster"]
        Nginx -->|/api/v1 Reverse Proxy| Gunicorn["Gunicorn Process Manager (Uvicorn Workers)"]
        Gunicorn --> Worker1["FastAPI Worker 1"]
        Gunicorn --> Worker2["FastAPI Worker 2"]
        Gunicorn --> Worker3["FastAPI Worker 3"]
    end

    subgraph DatabaseCluster ["Data Tier"]
        Worker1 & Worker2 & Worker3 --> PgBouncer["PgBouncer Connection Pooler"]
        PgBouncer --> PostgreSQL[("Managed PostgreSQL 14+ (AWS RDS / Neon / Railway)")]
    end
```

---

## 2. Environment Variables & Secrets Management

In production, environment variables must **never** be committed to version control. Set variables via server environment injection, Docker secrets, or cloud provider secret managers (e.g., AWS Secrets Manager, Railway/Render dashboard).

### Example Production `.env.production`
```env
# =====================================================================
# Application Settings
# =====================================================================
APP_NAME="SmartRetail AI Enterprise"
APP_ENV="production"
DEBUG=False
CORS_ORIGINS=["https://pos.yourstore.com","https://admin.yourstore.com"]

# =====================================================================
# Database Configuration (PostgreSQL with SSL)
# =====================================================================
DATABASE_URL="postgresql+psycopg2://smartretail_user:STRONG_SECURE_PASSWORD@db.yourstore.com:5432/smartretail_prod?sslmode=require"
ALLOW_SQLITE_FALLBACK=False

# =====================================================================
# Security & JWT Tokens
# Generate with: python -c "import secrets; print(secrets.token_urlsafe(64))"
# =====================================================================
SECRET_KEY="GENERATE_A_CRYPTOGRAPHICALLY_RANDOM_64_CHAR_STRING_FOR_PROD"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=480

# =====================================================================
# AI Orchestration (OpenAI API)
# =====================================================================
OPENAI_API_KEY="sk-proj-YOUR_ACTUAL_PRODUCTION_OPENAI_KEY"
OPENAI_MODEL="gpt-4o-mini"
```

---

## 3. Containerization (Docker)

### 3.1 Backend Dockerfile (`backend/Dockerfile`)
```dockerfile
# Multi-stage production Dockerfile for FastAPI
FROM python:3.11-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Final Runtime Image
FROM python:3.11-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
COPY app/ ./app
COPY seed_master_data.py seed_batches.py ./

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Use Gunicorn with Uvicorn worker class for production concurrency
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "app.main:app"]
```

### 3.2 Frontend Dockerfile (`frontend/Dockerfile`)
```dockerfile
# Stage 1: Build the React 19 SPA
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3.3 Nginx Configuration (`frontend/nginx.conf`)
```nginx
server {
    listen 80;
    server_name localhost;

    # Gzip compression for fast asset delivery
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        # Support React Router single-page navigation
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to FastAPI backend cluster
    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3.4 Production Orchestration (`docker-compose.yml`)
```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: smartretail-postgres
    restart: always
    environment:
      POSTGRES_USER: smartretail_user
      POSTGRES_PASSWORD: STRONG_SECURE_PASSWORD
      POSTGRES_DB: smartretail_prod
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: smartretail-backend
    restart: always
    depends_on:
      - db
    environment:
      - DATABASE_URL=postgresql+psycopg2://smartretail_user:STRONG_SECURE_PASSWORD@db:5432/smartretail_prod
      - SECRET_KEY=PROD_SECRET_KEY_HERE
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    ports:
      - "8000:8000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: smartretail-frontend
    restart: always
    depends_on:
      - backend
    ports:
      - "80:80"

volumes:
  postgres_data:
```

---

## 4. Cloud Deployment Options

### Option A: Cloud PaaS Deployment (Render + Vercel)
1. **Database & Backend on Render**:
   - SmartRetail AI includes an infrastructure-as-code blueprint `render.yaml` at project root.
   - In [Render](https://render.com/), choose **New Blueprint Instance** and link the repository.
   - Render automatically provisions the `smartretail-postgres` database and the `smartretail-backend-api` FastAPI web service.
   - Add your `OPENAI_API_KEY` to the environment variables in the Render dashboard.
2. **Frontend on Vercel**:
   - In [Vercel](https://vercel.com/), import the GitHub repository.
   - Set **Root Directory** to `frontend`.
   - Framework Preset: `Vite`.
   - Build Command: `npm run build` | Output Directory: `dist`.
   - Add Environment Variable: `VITE_API_URL` pointing to your Render backend (e.g. `https://smartretail-backend-api.onrender.com`).
   - The included `frontend/vercel.json` automatically manages client-side SPA routing and sets secure HTTP headers.

### Option B: Virtual Private Server (VPS / AWS EC2 / DigitalOcean)
1. Provision Ubuntu 22.04 LTS instance with minimum 2GB RAM.
2. Install Docker & Docker Compose:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose
   ```
3. Clone repository and populate `.env.production`.
4. Launch with Docker Compose:
   ```bash
   docker-compose up -d --build
   ```
5. Install Certbot for free automated Let's Encrypt SSL certificates:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d pos.yourstore.com
   ```

---

## 5. Database Backup & Disaster Recovery Strategy

1. **Daily Automated Logical Dumps**:
   ```bash
   # Crontab schedule: Every midnight (00:00 UTC)
   0 0 * * * pg_dump -U smartretail_user -d smartretail_prod -Fc -f /backups/smartretail_$(date +\%F).dump
   ```
2. **Restoration Procedure**:
   ```bash
   pg_restore -U smartretail_user -d smartretail_prod --clean /backups/smartretail_YYYY-MM-DD.dump
   ```
3. **Point-In-Time Recovery (PITR)**:
   For managed databases (AWS RDS, Supabase, Neon), enable automated daily snapshots and 7-day transaction log retention.


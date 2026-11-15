from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.role_test import router as role_test_router
from app.api.v1.categories import router as categories_router
from app.api.v1.products import router as products_router
from app.api.v1.customers import router as customers_router
from app.api.v1.sales import router as sales_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.reports import router as reports_router
from app.api.v1.ai import router as ai_router
from app.api.v1.suppliers import router as suppliers_router
from app.api.v1.purchases import router as purchases_router

api_v1_router = APIRouter(prefix="/api/v1")

# Mount API modules
api_v1_router.include_router(health_router, prefix="/health", tags=["Health & Diagnostics"])
api_v1_router.include_router(auth_router, prefix="/auth", tags=["Authentication & JWT"])
api_v1_router.include_router(users_router, prefix="/users", tags=["Staff Administration (Admin Only)"])
api_v1_router.include_router(role_test_router, prefix="/test", tags=["RBAC Permission Verification"])
api_v1_router.include_router(categories_router, prefix="/categories", tags=["Supermarket Categories"])
api_v1_router.include_router(products_router, prefix="/products", tags=["Product Master Catalog"])
api_v1_router.include_router(customers_router, prefix="/customers", tags=["Customer Loyalty Profiles"])
api_v1_router.include_router(suppliers_router)
api_v1_router.include_router(purchases_router)
api_v1_router.include_router(sales_router, prefix="/sales", tags=["POS Billing & Sales"])
api_v1_router.include_router(analytics_router, prefix="/analytics", tags=["Sales & Inventory Analytics"])
api_v1_router.include_router(reports_router, prefix="/reports", tags=["Executive Reports & Exports"])
api_v1_router.include_router(ai_router)

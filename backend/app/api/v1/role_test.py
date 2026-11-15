from fastapi import APIRouter, Depends
from app.models.user import User
from app.api.deps import (
    get_current_admin,
    get_current_manager,
    get_current_cashier
)

router = APIRouter()

@router.get(
    "/admin-zone",
    summary="Admin-Only Protected Resource",
    description="Accessible exclusively by users with role 'ADMIN'."
)
def test_admin_zone(admin: User = Depends(get_current_admin)):
    return {
        "status": "granted",
        "message": f"Welcome Admin {admin.full_name}. Full system access authorized.",
        "user_role": admin.role
    }

@router.get(
    "/manager-zone",
    summary="Manager & Admin Protected Resource",
    description="Accessible by 'MANAGER' and 'ADMIN'. Blocked for 'CASHIER'."
)
def test_manager_zone(manager: User = Depends(get_current_manager)):
    return {
        "status": "granted",
        "message": f"Welcome {manager.role} {manager.full_name}. Inventory & Purchase management authorized.",
        "user_role": manager.role
    }

@router.get(
    "/cashier-zone",
    summary="Cashier, Manager & Admin POS Resource",
    description="Accessible by all valid staff roles: 'CASHIER', 'MANAGER', 'ADMIN'."
)
def test_cashier_zone(cashier: User = Depends(get_current_cashier)):
    return {
        "status": "granted",
        "message": f"Welcome {cashier.role} {cashier.full_name}. POS Billing Terminal authorized.",
        "user_role": cashier.role
    }

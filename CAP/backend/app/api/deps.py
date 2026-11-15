from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

# HTTP Bearer token extractor
http_bearer = HTTPBearer(auto_error=False)

def get_role_permissions(role: str) -> List[str]:
    """
    Resolves operational permissions granted to each supermarket staff role.
    """
    if role == "ADMIN":
        return [
            "all",
            "user_management",
            "inventory_manage",
            "pos_checkout",
            "purchase_manage",
            "reports_view",
            "ai_insights",
            "category_manage",
            "product_edit"
        ]
    elif role == "MANAGER":
        return [
            "inventory_manage",
            "pos_checkout",
            "purchase_manage",
            "reports_view",
            "ai_insights",
            "product_edit"
        ]
    elif role == "CASHIER":
        return [
            "pos_checkout",
            "customer_lookup",
            "customer_create"
        ]
    return []

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates the Bearer JWT token from the Authorization header,
    retrieves the active user record from database, and ensures active status.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or token signature is invalid. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: Optional[int] = payload.get("uid")
    username: Optional[str] = payload.get("sub")

    if user_id is None and username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload structure.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Lookup user in database
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
    else:
        user = db.query(User).filter(User.username == username).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user no longer exists in system.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated. Please contact the administrator.",
        )

    return user

def require_roles(allowed_roles: List[str]):
    """
    Role-Based Access Control (RBAC) dependency factory.
    Enforces that current user belongs to one of the authorized roles.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access forbidden: role '{current_user.role}' lacks sufficient privileges. "
                    f"Required role: {', '.join(allowed_roles)}."
                ),
            )
        return current_user

    return role_checker

# Role-specific dependency shortcuts
get_current_admin = require_roles(["ADMIN"])
get_current_manager = require_roles(["ADMIN", "MANAGER"])
get_current_cashier = require_roles(["ADMIN", "MANAGER", "CASHIER"])

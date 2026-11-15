from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserResponse, UserCreate
from app.api.deps import get_current_admin

router = APIRouter()

class RoleUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(ADMIN|MANAGER|CASHIER)$")

@router.get(
    "",
    response_model=List[UserResponse],
    summary="List All Staff Accounts [ADMIN ONLY]",
    description="Retrieves directory of all supermarket staff accounts. Restricted to ADMIN."
)
def list_users(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).order_by(User.id.asc()).all()
    return users

@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Admin Provision Staff Account [ADMIN ONLY]",
    description="Admin provisions a new Cashier, Manager, or Admin account."
)
def create_staff_user(
    req: UserCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(
        (User.username == req.username) | (User.email == req.email)
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email is already registered."
        )

    new_user = User(
        username=req.username,
        email=req.email,
        full_name=req.full_name,
        password_hash=hash_password(req.password),
        role=req.role,
        is_active=req.is_active,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.patch(
    "/{user_id}/toggle-status",
    response_model=UserResponse,
    summary="Toggle Staff Active Status [ADMIN ONLY]",
    description="Enables or disables a staff member's login access. Restricted to ADMIN."
)
def toggle_user_status(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot deactivate their own active account."
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff user with ID {user_id} not found."
        )

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user

@router.patch(
    "/{user_id}/role",
    response_model=UserResponse,
    summary="Update Staff Role [ADMIN ONLY]",
    description="Promotes or reassigns staff roles. Restricted to ADMIN."
)
def update_user_role(
    user_id: int,
    req: RoleUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff user with ID {user_id} not found."
        )

    user.role = req.role
    db.commit()
    db.refresh(user)
    return user

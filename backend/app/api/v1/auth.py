from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.config import settings
from app.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserMeResponse
)
from app.schemas.user import UserResponse
from app.api.deps import get_current_user, get_role_permissions

router = APIRouter()

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New Staff Account",
    description="Creates a new supermarket staff account with hashed password."
)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # Check if username or email is already taken
    existing_user = db.query(User).filter(
        (User.username == req.username) | (User.email == req.email)
    ).first()

    if existing_user:
        if existing_user.username == req.username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{req.username}' is already registered."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email address '{req.email}' is already in use."
            )

    # Hash the password
    hashed_pwd = hash_password(req.password)

    new_user = User(
        username=req.username,
        email=req.email,
        full_name=req.full_name,
        password_hash=hashed_pwd,
        role=req.role,
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Staff Login & JWT Token Issuance",
    description="Authenticates staff credentials and returns a signed JWT access token."
)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    # Lookup user by username
    user = db.query(User).filter(User.username == req.username).first()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your staff account has been deactivated. Please contact an Administrator.",
        )

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    # Create signed JWT access token
    access_token = create_access_token(
        subject=user.username,
        role=user.role,
        user_id=user.id
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        user=UserResponse.model_validate(user)
    )

@router.get(
    "/me",
    response_model=UserMeResponse,
    summary="Get Current Authenticated Profile",
    description="Validates Bearer token and returns the staff member's profile and RBAC permissions."
)
def get_me(current_user: User = Depends(get_current_user)):
    permissions = get_role_permissions(current_user.role)
    return UserMeResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        permissions=permissions
    )

@router.post(
    "/logout",
    summary="Staff Logout",
    description="Signals session termination. Client must clear token from local storage."
)
def logout(current_user: User = Depends(get_current_user)):
    return {
        "status": "success",
        "message": f"User '{current_user.username}' successfully logged out. Please clear client-side token."
    }

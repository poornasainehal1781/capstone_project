from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from app.schemas.common import BaseSchema
from app.schemas.user import UserResponse

class LoginRequest(BaseModel):
    """Payload for staff login."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)

class RegisterRequest(BaseModel):
    """Payload for registering a new staff account."""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=6, max_length=100)
    role: str = Field("CASHIER", pattern="^(ADMIN|MANAGER|CASHIER)$")

class TokenResponse(BaseModel):
    """Response containing JWT access token and user metadata."""
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: UserResponse

class UserMeResponse(BaseModel):
    """Detailed profile of currently authenticated user with effective permissions."""
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    permissions: List[str]

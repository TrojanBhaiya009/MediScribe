"""
Authentication Router - JWT-based local authentication.
"""

from datetime import datetime, timedelta
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import UserAccount, UserRole

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "mediscribe-dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
security = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class UserInfo(BaseModel):
    id: str
    username: str
    displayName: str
    role: str
    doctorId: Optional[str] = None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session),
) -> UserAccount:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = session.get(UserAccount, user_id)
    if not user or not user.isActive:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return user


def require_role(*allowed_roles: UserRole):
    async def role_checker(current_user: UserAccount = Depends(get_current_user)) -> UserAccount:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in allowed_roles]}",
            )
        return current_user

    return role_checker


require_doctor = require_role(UserRole.DOCTOR)
require_pharmacist = require_role(UserRole.PHARMACIST)
require_admin = require_role(UserRole.ADMIN)
require_receptionist = require_role(UserRole.RECEPTIONIST)
require_doctor_or_admin = require_role(UserRole.DOCTOR, UserRole.ADMIN)


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, session: Session = Depends(get_session)):
    statement = select(UserAccount).where(UserAccount.username == request.username)
    user = session.exec(statement).first()
    stored_hash = user.passwordHash if user else None
    if user and (not stored_hash) and user.hashedPassword:
        stored_hash = user.hashedPassword

    if not user or not stored_hash or not verify_password(request.password, stored_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    if not user.isActive:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    user.lastLoginAt = datetime.now()
    session.add(user)
    session.commit()

    token_data = {
        "sub": user.id,
        "username": user.username,
        "role": user.role,
        "doctorId": user.doctorId,
    }
    access_token = create_access_token(token_data)

    return TokenResponse(
        access_token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
        user={
            "id": user.id,
            "username": user.username,
            "displayName": user.displayName,
            "role": user.role,
            "doctorId": user.doctorId,
        },
    )


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: UserAccount = Depends(get_current_user)):
    return UserInfo(
        id=current_user.id or "",
        username=current_user.username,
        displayName=current_user.displayName,
        role=current_user.role,
        doctorId=current_user.doctorId,
    )


@router.post("/register")
async def register_user(
    username: str,
    password: str,
    display_name: str,
    role: UserRole,
    doctor_id: Optional[str] = None,
    session: Session = Depends(get_session),
):
    existing = session.exec(select(UserAccount).where(UserAccount.username == username)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")

    hashed = get_password_hash(password)

    user = UserAccount(
        id=str(uuid.uuid4()),
        username=username,
        passwordHash=hashed,
        hashedPassword=hashed,
        displayName=display_name,
        fullName=display_name,
        role=role,
        doctorId=doctor_id,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    return {"message": "User created successfully", "userId": user.id}

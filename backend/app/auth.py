from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt as _bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

ACCESS_TOKEN_EXPIRE_MANAGER = timedelta(hours=8)
ACCESS_TOKEN_EXPIRE_CLIENT = timedelta(days=30)
REFRESH_TOKEN_EXPIRE_MANAGER = timedelta(days=30)
REFRESH_TOKEN_EXPIRE_CLIENT = timedelta(days=90)


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=8))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.AGON_JWT_SECRET, algorithm="HS256")


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=30))
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.AGON_JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.AGON_JWT_SECRET, algorithms=["HS256"])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Invalid or expired token"}},
        )


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Returns the authenticated User (manager or instructor) from JWT."""
    from app.models.user import User

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Invalid token type"}},
        )
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Token missing subject"}},
        )
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {"code": "AUTH_TOKEN_INVALID", "message": "User not found or inactive"}
            },
        )
    return user


def get_current_client(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Returns the authenticated Client from JWT."""
    from app.models.client import Client

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Invalid token type"}},
        )
    client_id = payload.get("sub")
    if client_id is None:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Token missing subject"}},
        )
    client = db.query(Client).filter(Client.id == int(client_id)).first()
    if not client or not client.is_active:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {"code": "AUTH_TOKEN_INVALID", "message": "Client not found or inactive"}
            },
        )
    return client


def create_qr_token(booking_id: int) -> str:
    """Create a signed QR token for check-in."""
    to_encode = {
        "booking_id": booking_id,
        "type": "qr_checkin",
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }
    return jwt.encode(to_encode, settings.AGON_JWT_SECRET, algorithm="HS256")


def decode_qr_token(token: str) -> dict:
    """Decode and validate a QR token. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(token, settings.AGON_JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "qr_checkin":
            raise HTTPException(
                400,
                detail={
                    "error": {"code": "CHECKIN_INVALID_QR", "message": "Invalid QR token type"}
                },
            )
        return payload
    except JWTError:
        raise HTTPException(
            400,
            detail={
                "error": {"code": "CHECKIN_INVALID_QR", "message": "Invalid or expired QR code"}
            },
        )


def require_manager(current_user=Depends(get_current_user)):
    """Dependency: requires the user to have role='manager'."""
    if current_user.role != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "AUTH_INSUFFICIENT_PERMISSIONS",
                    "message": "Manager access required",
                }
            },
        )
    return current_user

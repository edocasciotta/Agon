import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt as _bcrypt
from app.config import settings
from app.database import get_db
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

ACCESS_TOKEN_EXPIRE_MANAGER = timedelta(hours=8)
ACCESS_TOKEN_EXPIRE_CLIENT = timedelta(days=30)
REFRESH_TOKEN_EXPIRE_MANAGER = timedelta(days=30)
REFRESH_TOKEN_EXPIRE_CLIENT = timedelta(days=90)

# bcrypt silently ignores bytes beyond 72 — reject longer passwords instead.
PASSWORD_MAX_BYTES = 72


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


# Hash of a random unguessable value, computed once at import. Verifying
# against it when an email is unknown keeps login timing comparable to the
# known-email path, so responses don't reveal whether an account exists.
_TIMING_EQUALIZER_HASH = hash_password(secrets.token_hex(16))


def burn_password_check() -> None:
    """Perform a dummy bcrypt verification to equalize login timing."""
    verify_password("timing-equalizer", _TIMING_EQUALIZER_HASH)


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
    """Returns the authenticated User (manager or instructor) from JWT.

    User.id and Client.id share the same integer space, so the JWT ``role``
    claim MUST be checked before the DB lookup — otherwise a client token whose
    ``sub`` collides with a staff User id would be resolved as that User
    (privilege escalation). A client token is rejected with 403 here.
    """
    from app.models.user import User

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Invalid token type"}},
        )
    if payload.get("role", "client") not in ("manager", "instructor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "AUTH_INSUFFICIENT_PERMISSIONS",
                    "message": "Staff access required",
                }
            },
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
    """Returns the authenticated Client from JWT.

    The JWT ``role`` claim MUST be ``client`` — User.id and Client.id share the
    same integer space, so a staff token whose ``sub`` collides with a Client id
    would otherwise be resolved as that Client (cross-entity confusion).
    """
    from app.models.client import Client

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Invalid token type"}},
        )
    if payload.get("role", "client") != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "AUTH_INSUFFICIENT_PERMISSIONS",
                    "message": "Client access required",
                }
            },
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
        "exp": datetime.now(timezone.utc) + timedelta(hours=2),
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


def require_manager(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Dependency: requires manager role.

    Checks the JWT role claim before the DB lookup so non-manager tokens
    receive 403 Forbidden rather than 401 Unauthorized.
    """
    from app.models.user import User

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Invalid token type"}},
        )
    role = payload.get("role", "client")
    if role != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "AUTH_INSUFFICIENT_PERMISSIONS",
                    "message": "Manager access required",
                }
            },
        )
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {"code": "AUTH_TOKEN_INVALID", "message": "User not found or inactive"}
            },
        )
    return user


def require_staff(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Dependency: requires manager or instructor role (backoffice staff).

    Checks the JWT role claim before the DB lookup so a client token receives
    403 Forbidden rather than 401 Unauthorized.
    """
    from app.models.user import User

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Invalid token type"}},
        )
    role = payload.get("role", "client")
    if role not in ("manager", "instructor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "AUTH_INSUFFICIENT_PERMISSIONS",
                    "message": "Staff access required",
                }
            },
        )
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {"code": "AUTH_TOKEN_INVALID", "message": "User not found or inactive"}
            },
        )
    return user

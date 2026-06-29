import uuid
from datetime import timedelta
from app.utils import utcnow
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.limiter import limiter
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    oauth2_scheme,
    ACCESS_TOKEN_EXPIRE_MANAGER,
    ACCESS_TOKEN_EXPIRE_CLIENT,
    REFRESH_TOKEN_EXPIRE_MANAGER,
    REFRESH_TOKEN_EXPIRE_CLIENT,
)
from app.schemas.auth import (
    LoginRequest,
    ClientRegisterRequest,
    TokenResponse,
    RefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.models.user import User
from app.models.client import Client
from app.models.invitation_token import InvitationToken
from app.models.studio_settings import StudioSettings

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register/client", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
async def register_client(request: Request, payload: ClientRegisterRequest, db: Session = Depends(get_db)):
    """Register a new client account (mobile app). Auto-logs in and returns tokens."""
    if len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "AUTH_PASSWORD_TOO_SHORT", "message": "Password must be at least 8 characters"}},
        )
    existing = db.query(Client).filter(Client.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "AUTH_EMAIL_ALREADY_EXISTS", "message": "A client with this email already exists"}},
        )
    client = Client(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(client)
    db.commit()
    db.refresh(client)

    token_data = {"sub": str(client.id), "role": "client"}
    access_token = create_access_token(token_data, expires_delta=ACCESS_TOKEN_EXPIRE_CLIENT)
    refresh_token = create_refresh_token(token_data, expires_delta=REFRESH_TOKEN_EXPIRE_CLIENT)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse, status_code=200)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    """Login for managers, instructors, and clients. Tries users table first, then clients."""
    # Try users table (manager / instructor)
    user = db.query(User).filter(User.email == payload.email).first()
    if user and verify_password(payload.password, user.password_hash):
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": {"code": "AUTH_ACCOUNT_INACTIVE", "message": "Account is inactive"}},
            )
        token_data = {"sub": str(user.id), "role": user.role}
        access_token = create_access_token(token_data, expires_delta=ACCESS_TOKEN_EXPIRE_MANAGER)
        refresh_token = create_refresh_token(token_data, expires_delta=REFRESH_TOKEN_EXPIRE_MANAGER)
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    # Try clients table
    client = db.query(Client).filter(Client.email == payload.email).first()
    if client and client.password_hash and verify_password(payload.password, client.password_hash):
        if not client.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": {"code": "AUTH_ACCOUNT_INACTIVE", "message": "Account is inactive"}},
            )
        token_data = {"sub": str(client.id), "role": "client"}
        access_token = create_access_token(token_data, expires_delta=ACCESS_TOKEN_EXPIRE_CLIENT)
        refresh_token = create_refresh_token(token_data, expires_delta=REFRESH_TOKEN_EXPIRE_CLIENT)
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": {"code": "AUTH_INVALID_CREDENTIALS", "message": "Invalid email or password"}},
    )


@router.post("/refresh", response_model=TokenResponse, status_code=200)
async def refresh_token_endpoint(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Issue a new access token from a valid refresh token."""
    decoded = decode_token(payload.refresh_token)
    if decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Invalid token type"}},
        )
    sub = decoded.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Token missing subject"}},
        )

    # Determine if sub is a User or Client (try users first)
    user = db.query(User).filter(User.id == int(sub)).first()
    if user and user.is_active:
        token_data = {"sub": str(user.id), "role": user.role}
        new_access = create_access_token(token_data, expires_delta=ACCESS_TOKEN_EXPIRE_MANAGER)
        return TokenResponse(access_token=new_access, refresh_token=payload.refresh_token)

    client = db.query(Client).filter(Client.id == int(sub)).first()
    if client and client.is_active:
        token_data = {"sub": str(client.id), "role": "client"}
        new_access = create_access_token(token_data, expires_delta=ACCESS_TOKEN_EXPIRE_CLIENT)
        return TokenResponse(access_token=new_access, refresh_token=payload.refresh_token)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "User or client not found or inactive"}},
    )


@router.post("/logout", status_code=200)
async def logout():
    """Invalidate session (stateless — client should discard tokens)."""
    return {"message": "Logged out successfully"}


@router.post("/forgot-password", status_code=200)
@limiter.limit("3/hour")
async def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request a password reset email."""
    # Always return 200 regardless of whether the email exists (security best practice)
    client = db.query(Client).filter(Client.email == payload.email).first()
    if client:
        token_str = str(uuid.uuid4())
        invitation = InvitationToken(
            client_id=client.id,
            token=token_str,
            expires_at=utcnow() + timedelta(hours=2),
        )
        db.add(invitation)

        studio_settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
        base_url = (studio_settings.tunnel_url if studio_settings and studio_settings.tunnel_url else "http://localhost:5173")
        reset_url = f"{base_url}/reset-password?token={token_str}"
        studio_name = (studio_settings.studio_name if studio_settings else "Agon Studio")

        try:
            from app.services.email_service import send_password_reset_email
            await send_password_reset_email(db, client.email, client.full_name, reset_url, studio_name)
        except Exception:
            pass  # Silently fail — don't reveal email existence

        db.commit()

    return {"message": "If that email exists, a reset link has been sent"}


@router.post("/reset-password", status_code=200)
async def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using a token."""
    inv = db.query(InvitationToken).filter(InvitationToken.token == payload.token).first()
    if not inv:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "RESET_TOKEN_NOT_FOUND", "message": "Reset token not found"}},
        )
    if inv.used:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "RESET_TOKEN_ALREADY_USED", "message": "This reset token has already been used"}},
        )
    if inv.expires_at < utcnow():
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "RESET_TOKEN_EXPIRED", "message": "This reset token has expired"}},
        )
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "AUTH_PASSWORD_TOO_SHORT", "message": "Password must be at least 8 characters"}},
        )
    client = db.query(Client).filter(Client.id == inv.client_id).first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "CLIENT_NOT_FOUND", "message": "Client not found"}},
        )
    client.password_hash = hash_password(payload.new_password)
    inv.used = True
    db.commit()
    return {"message": "Password updated"}


@router.get("/invite/{token}", status_code=200)
async def validate_invite_token(token: str, db: Session = Depends(get_db)):
    """Validate an invitation token and return basic client info."""
    inv = db.query(InvitationToken).filter(InvitationToken.token == token).first()
    if not inv:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "INVITATION_NOT_FOUND", "message": "Invitation token not found"}},
        )
    if inv.used:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "INVITATION_ALREADY_USED", "message": "This invitation has already been used"}},
        )
    if inv.expires_at < utcnow():
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "INVITATION_EXPIRED", "message": "This invitation has expired"}},
        )
    client_obj = db.query(Client).filter(Client.id == inv.client_id).first()
    if not client_obj:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "CLIENT_NOT_FOUND", "message": "Client not found"}},
        )
    return {
        "client_id": client_obj.id,
        "email": client_obj.email,
        "full_name": client_obj.full_name,
        "token_valid": True,
    }


@router.get("/me", status_code=200)
async def get_me(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Return the current authenticated user or client profile."""
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Invalid token type"}},
        )
    sub = payload.get("sub")
    role = payload.get("role")

    if role in ("manager", "instructor"):
        user = db.query(User).filter(User.id == int(sub)).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=401,
                detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "User not found or inactive"}},
            )
        return {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
        }
    else:
        client = db.query(Client).filter(Client.id == int(sub)).first()
        if not client or not client.is_active:
            raise HTTPException(
                status_code=401,
                detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Client not found or inactive"}},
            )
        return {
            "id": client.id,
            "email": client.email,
            "full_name": client.full_name,
            "role": "client",
            "is_active": client.is_active,
        }

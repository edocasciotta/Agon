"""
Email settings endpoints.
GET  /api/v1/studio/email        → SMTP settings (password masked)
PUT  /api/v1/studio/email        → save SMTP settings
POST /api/v1/studio/email/test   → send test email to current manager
"""

from typing import Optional

from app.auth import require_manager
from app.database import get_db
from app.models.studio_settings import StudioSettings
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/studio/email", tags=["email-settings"])


class EmailSettingsResponse(BaseModel):
    email_smtp_host: Optional[str] = None
    email_smtp_port: int = 587
    email_smtp_user: Optional[str] = None
    email_smtp_password: str = ""  # masked: "***" if set, "" if not
    email_from_name: Optional[str] = None
    email_from_address: Optional[str] = None
    email_smtp_tls: bool = True


class EmailSettingsUpdate(BaseModel):
    email_smtp_host: Optional[str] = None
    email_smtp_port: Optional[int] = None
    email_smtp_user: Optional[str] = None
    email_smtp_password: Optional[str] = None  # None = don't change; "" = clear
    email_from_name: Optional[str] = None
    email_from_address: Optional[str] = None
    email_smtp_tls: Optional[bool] = None


def _get_or_create_settings(db: Session) -> StudioSettings:
    settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    if not settings:
        settings = StudioSettings(
            id=1,
            studio_name="Agon Studio",
            timezone="Europe/Rome",
            cancellation_hours=2,
            checkin_open_minutes_before=30,
            checkin_close_minutes_after=15,
            waitlist_confirm_minutes=30,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _to_response(s: StudioSettings) -> EmailSettingsResponse:
    return EmailSettingsResponse(
        email_smtp_host=s.email_smtp_host,
        email_smtp_port=s.email_smtp_port or 587,
        email_smtp_user=s.email_smtp_user,
        email_smtp_password="***" if s.email_smtp_password else "",
        email_from_name=s.email_from_name,
        email_from_address=s.email_from_address,
        email_smtp_tls=s.email_smtp_tls if s.email_smtp_tls is not None else True,
    )


@router.get("", response_model=EmailSettingsResponse)
def get_email_settings(
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    s = _get_or_create_settings(db)
    return _to_response(s)


@router.put("", response_model=EmailSettingsResponse)
def update_email_settings(
    payload: EmailSettingsUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    s = _get_or_create_settings(db)
    if payload.email_smtp_host is not None:
        s.email_smtp_host = payload.email_smtp_host
    if payload.email_smtp_port is not None:
        s.email_smtp_port = payload.email_smtp_port
    if payload.email_smtp_user is not None:
        s.email_smtp_user = payload.email_smtp_user
    if payload.email_smtp_password is not None:
        # Empty string means "clear the password"; otherwise save as-is
        s.email_smtp_password = payload.email_smtp_password if payload.email_smtp_password else None
    if payload.email_from_name is not None:
        s.email_from_name = payload.email_from_name
    if payload.email_from_address is not None:
        s.email_from_address = payload.email_from_address
    if payload.email_smtp_tls is not None:
        s.email_smtp_tls = payload.email_smtp_tls
    db.commit()
    db.refresh(s)
    return _to_response(s)


@router.post("/test", status_code=200)
async def send_test_email(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    """Send a test email to the currently authenticated manager."""
    from app.services.email_service import send_test_email as _send_test

    s = _get_or_create_settings(db)
    studio_name = s.studio_name or "Agon Studio"
    try:
        await _send_test(db, current_user.email, current_user.full_name, studio_name)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "SMTP_NOT_CONFIGURED", "message": str(e)}},
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": "SMTP_SEND_FAILED",
                    "message": f"Failed to send test email: {str(e)}",
                }
            },
        )
    return {"message": f"Test email sent to {current_user.email}"}

"""
Email settings endpoints.
GET  /api/v1/studio/email        → SMTP settings (password masked)
PUT  /api/v1/studio/email        → save SMTP settings
POST /api/v1/studio/email/test   → send test email to current manager
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.auth import require_manager
from app.models.studio_settings import StudioSettings
from app.models.user import User

router = APIRouter(prefix="/api/v1/studio/email", tags=["email-settings"])


class EmailSettingsResponse(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: str = ""  # masked: "***" if set, "" if not
    from_name: Optional[str] = None
    from_address: Optional[str] = None
    smtp_tls: bool = True


class EmailSettingsUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None  # None means "don't change"
    from_name: Optional[str] = None
    from_address: Optional[str] = None
    smtp_tls: Optional[bool] = None


def _get_or_create_settings(db: Session) -> StudioSettings:
    settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    if not settings:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "SETTINGS_NOT_FOUND", "message": "Studio settings not found"}},
        )
    return settings


@router.get("", response_model=EmailSettingsResponse)
def get_email_settings(
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    s = _get_or_create_settings(db)
    return EmailSettingsResponse(
        smtp_host=s.email_smtp_host,
        smtp_port=s.email_smtp_port or 587,
        smtp_user=s.email_smtp_user,
        smtp_password="***" if s.email_smtp_password else "",
        from_name=s.email_from_name,
        from_address=s.email_from_address,
        smtp_tls=s.email_smtp_tls if s.email_smtp_tls is not None else True,
    )


@router.put("", response_model=EmailSettingsResponse)
def update_email_settings(
    payload: EmailSettingsUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    s = _get_or_create_settings(db)
    if payload.smtp_host is not None:
        s.email_smtp_host = payload.smtp_host
    if payload.smtp_port is not None:
        s.email_smtp_port = payload.smtp_port
    if payload.smtp_user is not None:
        s.email_smtp_user = payload.smtp_user
    if payload.smtp_password is not None:
        s.email_smtp_password = payload.smtp_password
    if payload.from_name is not None:
        s.email_from_name = payload.from_name
    if payload.from_address is not None:
        s.email_from_address = payload.from_address
    if payload.smtp_tls is not None:
        s.email_smtp_tls = payload.smtp_tls
    db.commit()
    db.refresh(s)
    return EmailSettingsResponse(
        smtp_host=s.email_smtp_host,
        smtp_port=s.email_smtp_port or 587,
        smtp_user=s.email_smtp_user,
        smtp_password="***" if s.email_smtp_password else "",
        from_name=s.email_from_name,
        from_address=s.email_from_address,
        smtp_tls=s.email_smtp_tls if s.email_smtp_tls is not None else True,
    )


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
            detail={"error": {"code": "SMTP_SEND_FAILED", "message": f"Failed to send test email: {str(e)}"}},
        )
    return {"message": f"Test email sent to {current_user.email}"}

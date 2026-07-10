"""
SMS (Twilio) settings endpoints.
GET  /api/v1/sms/settings        → Twilio settings (auth token masked)
PUT  /api/v1/sms/settings        → save Twilio settings
POST /api/v1/sms/settings/test   → send test SMS to a given phone number
"""

from typing import Optional

from app.auth import require_manager
from app.database import get_db
from app.models.studio_settings import StudioSettings
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/sms", tags=["sms-settings"])


class SmsSettingsResponse(BaseModel):
    sms_provider_account_sid: Optional[str] = None
    sms_provider_auth_token: str = ""  # masked: "••••1234" if set, "" if not
    sms_from_number: Optional[str] = None
    sms_enabled: bool = False


class SmsSettingsUpdate(BaseModel):
    account_sid: Optional[str] = None
    auth_token: Optional[str] = None  # None = don't change; "" = clear
    from_number: Optional[str] = None
    enabled: Optional[bool] = None


class SmsTestSendRequest(BaseModel):
    to_phone: str


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


def _mask_token(token: Optional[str]) -> str:
    """Never return the raw Twilio auth token. Show only the last 4 chars."""
    if not token:
        return ""
    if len(token) <= 4:
        return "••••"
    return f"••••{token[-4:]}"


def _to_response(s: StudioSettings) -> SmsSettingsResponse:
    return SmsSettingsResponse(
        sms_provider_account_sid=s.sms_provider_account_sid,
        sms_provider_auth_token=_mask_token(s.sms_provider_auth_token),
        sms_from_number=s.sms_from_number,
        sms_enabled=s.sms_enabled if s.sms_enabled is not None else False,
    )


@router.get("/settings", response_model=SmsSettingsResponse)
def get_sms_settings(
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    s = _get_or_create_settings(db)
    return _to_response(s)


@router.put("/settings", response_model=SmsSettingsResponse)
def update_sms_settings(
    payload: SmsSettingsUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    s = _get_or_create_settings(db)
    if payload.account_sid is not None:
        s.sms_provider_account_sid = payload.account_sid
    if payload.auth_token is not None:
        # Empty string means "clear the token"; otherwise save as-is
        s.sms_provider_auth_token = payload.auth_token if payload.auth_token else None
    if payload.from_number is not None:
        s.sms_from_number = payload.from_number
    if payload.enabled is not None:
        s.sms_enabled = payload.enabled
    db.commit()
    db.refresh(s)
    return _to_response(s)


@router.post("/settings/test", status_code=200)
def send_test_sms_endpoint(
    payload: SmsTestSendRequest,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    """Send a test SMS to verify the Twilio configuration works."""
    from app.services.sms_service import SmsSendError
    from app.services.sms_service import send_test_sms as _send_test

    s = _get_or_create_settings(db)
    studio_name = s.studio_name or "Agon Studio"
    try:
        _send_test(db, payload.to_phone, studio_name)
    except ValueError as e:
        raise HTTPException(
            status_code=503,
            detail={"error": {"code": "SMS_NOT_CONFIGURED", "message": str(e)}},
        )
    except SmsSendError as e:
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "SMS_SEND_FAILED", "message": str(e)}},
        )
    return {"message": f"Test SMS sent to {payload.to_phone}"}

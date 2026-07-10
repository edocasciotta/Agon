"""
Manual one-off SMS — POST /api/v1/sms/send

Manager-initiated ad-hoc message to a specific client. No template/event
involved — this is a raw message, unlike send_event_sms.
"""

import logging

from app.auth import require_manager
from app.database import get_db
from app.models.client import Client
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/sms", tags=["sms-send"])

logger = logging.getLogger(__name__)


class SmsSendRequest(BaseModel):
    client_id: int
    body: str


@router.post("/send", status_code=200)
def send_manual_sms(
    payload: SmsSendRequest,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    from app.services.sms_service import SmsSendError, send_sms

    client_obj = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client_obj:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )
    if not client_obj.phone:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "CLIENT_NO_PHONE",
                    "message": "This client has no phone number on file",
                }
            },
        )

    try:
        send_sms(db, client_obj.phone, payload.body)
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

    logger.info(f"Manual SMS sent: client_id={client_obj.id}")
    return {"status": "sent"}

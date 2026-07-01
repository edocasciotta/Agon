import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.notification_log import NotificationLog
from app.utils import utcnow

logger = logging.getLogger(__name__)

try:
    from exponent_server_sdk import (
        DeviceNotRegisteredError,
        PushClient,
        PushMessage,
        PushServerError,
        PushTicketError,
    )

    _EXPO_AVAILABLE = True
except ImportError:
    _EXPO_AVAILABLE = False
    PushClient = None
    PushMessage = None
    PushServerError = Exception
    DeviceNotRegisteredError = Exception
    PushTicketError = Exception


def send_push_notification(
    db: Session,
    client_id: int,
    expo_push_token: Optional[str],
    title: str,
    body: str,
    notification_type: str,
    data: Optional[dict] = None,
) -> None:
    """
    Send a push notification via Expo. Logs result to notification_log.
    If expo_push_token is None or empty, logs as 'failed' and returns.
    """
    log = NotificationLog(
        client_id=client_id,
        type=notification_type,
        title=title,
        body=body,
        status="pending",
    )
    db.add(log)
    db.flush()

    if not expo_push_token:
        log.status = "failed"
        db.commit()
        return

    if not _EXPO_AVAILABLE or PushClient is None:
        logger.warning("exponent_server_sdk not available; skipping push")
        log.status = "failed"
        db.commit()
        return

    try:
        response = PushClient().publish(
            PushMessage(
                to=expo_push_token,
                title=title,
                body=body,
                data=data or {},
            )
        )
        response.validate_response()
        log.status = "sent"
        log.expo_ticket_id = getattr(response, "id", None)
        log.sent_at = utcnow()
    except (PushServerError, DeviceNotRegisteredError, PushTicketError) as e:
        logger.warning(f"Push notification failed for client {client_id}: {e}")
        log.status = "failed"
    except Exception as e:
        logger.error(f"Unexpected push error for client {client_id}: {e}")
        log.status = "failed"

    db.commit()

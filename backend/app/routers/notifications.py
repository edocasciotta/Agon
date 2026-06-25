from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.auth import get_current_client, require_manager
from app.models.notification_log import NotificationLog
from app.models.client import Client
from app.schemas.notification import NotificationSendRequest, NotificationResponse
from app.services.push_service import send_push_notification

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.post("/send")
async def send_notification(
    body: NotificationSendRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    """Send a manual push notification to a client (manager only)."""
    client = db.query(Client).filter(Client.id == body.client_id).first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )
    send_push_notification(
        db,
        client.id,
        client.expo_push_token,
        body.title,
        body.body,
        "manual",
    )
    return {"status": "queued"}


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client),
):
    """List notifications for the authenticated client."""
    notifications = (
        db.query(NotificationLog)
        .filter(NotificationLog.client_id == current_client.id)
        .order_by(NotificationLog.created_at.desc())
        .all()
    )
    return notifications


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client),
):
    """Acknowledge a notification (client can only access their own)."""
    notification = (
        db.query(NotificationLog)
        .filter(
            NotificationLog.id == notification_id,
            NotificationLog.client_id == current_client.id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Notification not found"}},
        )
    return {"status": "ok"}

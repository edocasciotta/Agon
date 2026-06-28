from app.utils import utcnow
import asyncio
import logging
from datetime import datetime, date, timedelta, timezone
from sqlalchemy.orm import Session
from app.database import SessionLocal

logger = logging.getLogger(__name__)


async def run_membership_expiry_loop():
    """Runs daily. Expires stale memberships and sends 7-day reminders."""
    while True:
        try:
            db: Session = SessionLocal()
            try:
                _check_membership_expiry(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Membership expiry error: {e}")
        await asyncio.sleep(86400)  # 24 hours


def _check_membership_expiry(db: Session):
    from app.models.membership import Membership
    from app.models.client import Client
    from app.services.push_service import send_push_notification

    today = date.today()
    reminder_date = today + timedelta(days=7)

    # Send 7-day reminders
    expiring_soon = db.query(Membership).filter(
        Membership.status == 'active',
        Membership.expires_at == reminder_date,
    ).all()
    for m in expiring_soon:
        client = db.query(Client).filter(Client.id == m.client_id).first()
        if client:
            send_push_notification(
                db, client.id, client.expo_push_token,
                "Membership expiring soon",
                "Your membership expires in 7 days. Renew to keep booking classes.",
                "membership_expiry_reminder",
            )

    # Expire overdue memberships
    expired = db.query(Membership).filter(
        Membership.status == 'active',
        Membership.expires_at < today,
        Membership.expires_at.isnot(None),
    ).all()
    for m in expired:
        m.status = 'expired'
        m.updated_at = utcnow()
    db.commit()

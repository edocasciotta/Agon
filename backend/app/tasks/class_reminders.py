import asyncio
import logging
from datetime import timedelta

from app.database import SessionLocal
from app.utils import utcnow
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


async def run_class_reminder_loop():
    """Runs every 15 minutes. Sends class reminders to confirmed bookings."""
    while True:
        try:
            db: Session = SessionLocal()
            try:
                _send_class_reminders(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Class reminder error: {e}")
        await asyncio.sleep(900)  # 15 minutes


def _send_class_reminders(db: Session):
    from app.models.booking import Booking
    from app.models.client import Client
    from app.models.notification_log import NotificationLog
    from app.models.scheduled_class import ScheduledClass
    from app.models.studio_settings import StudioSettings
    from app.services.push_service import send_push_notification

    settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    reminder_hours = settings.reminder_hours_before if settings else 24

    now = utcnow()
    window_end = now + timedelta(hours=reminder_hours + 0.25)
    window_start = now + timedelta(hours=reminder_hours - 0.25)

    classes = (
        db.query(ScheduledClass)
        .filter(
            ScheduledClass.status == "scheduled",
            ScheduledClass.starts_at >= window_start,
            ScheduledClass.starts_at <= window_end,
        )
        .all()
    )

    for sc in classes:
        # Check if reminder already sent for this class
        already_sent = (
            db.query(NotificationLog)
            .filter(
                NotificationLog.type == "class_reminder",
                NotificationLog.body.contains(str(sc.id)),
            )
            .first()
        )
        if already_sent:
            continue

        bookings = (
            db.query(Booking)
            .filter(
                Booking.scheduled_class_id == sc.id,
                Booking.status == "confirmed",
            )
            .all()
        )

        for booking in bookings:
            client = db.query(Client).filter(Client.id == booking.client_id).first()
            if client:
                send_push_notification(
                    db,
                    client.id,
                    client.expo_push_token,
                    "Class reminder",
                    f"Your class starts soon (class_id={sc.id}). See you there!",
                    "class_reminder",
                )

import asyncio
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.waitlist import Waitlist

logger = logging.getLogger(__name__)


async def run_waitlist_expiry_loop():
    """Runs every 5 minutes. Expires stale waitlist offers and triggers next offer."""
    while True:
        try:
            db: Session = SessionLocal()
            try:
                _expire_stale_offers(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Waitlist expiry error: {e}")
        await asyncio.sleep(300)  # 5 minutes


def _expire_stale_offers(db: Session):
    from app.services.booking_service import process_waitlist, get_studio_settings
    now = datetime.utcnow()
    stale = db.query(Waitlist).filter(
        Waitlist.status == "offered",
        Waitlist.offer_expires_at <= now,
    ).all()
    for entry in stale:
        entry.status = "expired"
        entry.updated_at = now
        db.commit()
        settings = get_studio_settings(db)
        if settings:
            process_waitlist(db, entry.scheduled_class_id, settings)

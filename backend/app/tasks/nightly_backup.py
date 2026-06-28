from app.utils import utcnow
import asyncio
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.config import settings

logger = logging.getLogger(__name__)


async def run_nightly_backup_loop():
    """Runs daily. Backs up the SQLite database file."""
    while True:
        try:
            db: Session = SessionLocal()
            try:
                _perform_backup(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Backup error: {e}")
        await asyncio.sleep(86400)  # 24 hours


def _perform_backup(db: Session):
    from app.models.studio_settings import StudioSettings

    db_path = Path(settings.DATABASE_URL.replace("sqlite:///", ""))
    if not db_path.exists():
        logger.warning(f"Database file not found at {db_path}, skipping backup")
        return

    backup_dir = Path("backups")
    backup_dir.mkdir(exist_ok=True)

    timestamp = utcnow().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"agon_backup_{timestamp}.db"
    shutil.copy2(db_path, backup_path)
    logger.info(f"Backup created: {backup_path}")

    # Retain only last 30 backups
    backups = sorted(backup_dir.glob("agon_backup_*.db"))
    while len(backups) > 30:
        oldest = backups.pop(0)
        oldest.unlink()
        logger.info(f"Removed old backup: {oldest}")

    # Update last_backup_at
    studio = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    if studio:
        studio.last_backup_at = utcnow()
        studio.updated_at = utcnow()
        db.commit()

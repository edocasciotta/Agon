import logging
import shutil
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


def _backup_sqlite(source: Path, dest_dir: Path) -> Path:
    """Copy a SQLite file to dest_dir with a timestamped filename.

    Returns the path of the created backup file.
    Raises OSError if the source does not exist or the copy fails.
    """
    if not source.exists():
        raise FileNotFoundError(f"Database file not found: {source}")
    dest_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    dest = dest_dir / f"agon_backup_{timestamp}.db"
    shutil.copy2(source, dest)
    return dest


async def run_backup() -> bool:
    """Back up the SQLite database to the ./backups directory."""
    try:
        from app.config import settings

        db_url = settings.DATABASE_URL
        if not db_url.startswith("sqlite:///"):
            logger.warning("Backup skipped: non-SQLite database URL")
            return False

        source = Path(db_url.replace("sqlite:///", ""))
        dest_dir = Path("backups")
        dest = _backup_sqlite(source, dest_dir)
        logger.info("Backup created: %s", dest)
        return True
    except Exception:
        logger.exception("Backup failed")
        return False

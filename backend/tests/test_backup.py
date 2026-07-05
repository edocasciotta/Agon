"""Tests for the SQLite backup utility."""

import sqlite3
from pathlib import Path


def _seed_db(path: Path):
    """Create a minimal SQLite DB with one test table and three rows."""
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)")
    conn.executemany("INSERT INTO items VALUES (?, ?)", [(1, "a"), (2, "b"), (3, "c")])
    conn.commit()
    conn.close()


def test_backup_creates_file(tmp_path):
    """_backup_sqlite creates a copy in the destination directory."""
    from app.backup import _backup_sqlite

    source = tmp_path / "source.db"
    _seed_db(source)

    dest_dir = tmp_path / "backups"
    backup_path = _backup_sqlite(source, dest_dir)

    assert backup_path.exists(), "Backup file was not created"
    assert backup_path.parent == dest_dir


def test_backup_file_is_readable_sqlite(tmp_path):
    """The backup file is a valid SQLite database."""
    from app.backup import _backup_sqlite

    source = tmp_path / "source.db"
    _seed_db(source)

    backup_path = _backup_sqlite(source, tmp_path / "backups")

    conn = sqlite3.connect(backup_path)
    rows = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    conn.close()
    assert rows == 3


def test_backup_row_count_matches_source(tmp_path):
    """Row count in backup matches the source database exactly."""
    from app.backup import _backup_sqlite

    source = tmp_path / "source.db"
    _seed_db(source)

    backup_path = _backup_sqlite(source, tmp_path / "backups")

    src_conn = sqlite3.connect(source)
    src_count = src_conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    src_conn.close()

    bak_conn = sqlite3.connect(backup_path)
    bak_count = bak_conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    bak_conn.close()

    assert bak_count == src_count


def test_backup_raises_when_source_missing(tmp_path):
    """_backup_sqlite raises FileNotFoundError if the source DB doesn't exist."""
    import pytest
    from app.backup import _backup_sqlite

    with pytest.raises(FileNotFoundError):
        _backup_sqlite(tmp_path / "nonexistent.db", tmp_path / "backups")


def test_backup_creates_dest_dir_if_missing(tmp_path):
    """_backup_sqlite creates the destination directory when it doesn't exist."""
    from app.backup import _backup_sqlite

    source = tmp_path / "source.db"
    _seed_db(source)

    dest_dir = tmp_path / "deep" / "nested" / "backups"
    assert not dest_dir.exists()

    _backup_sqlite(source, dest_dir)
    assert dest_dir.exists()


def test_backup_filename_contains_timestamp(tmp_path):
    """Backup filenames include a datestamp so multiple backups coexist."""
    from app.backup import _backup_sqlite

    source = tmp_path / "source.db"
    _seed_db(source)

    backup_path = _backup_sqlite(source, tmp_path / "backups")
    assert "agon_backup_" in backup_path.name
    assert backup_path.suffix == ".db"

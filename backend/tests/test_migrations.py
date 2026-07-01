"""Verify that Alembic migrations apply cleanly on a fresh SQLite database."""

import pytest


def test_alembic_upgrade_head_on_fresh_db(tmp_path):
    """All migrations apply without error on a blank database."""
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, inspect, text

    db_path = tmp_path / "migration_test.db"
    db_url = f"sqlite:///{db_path}"

    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    # Apply all migrations from scratch
    command.upgrade(alembic_cfg, "head")

    engine = create_engine(db_url)
    with engine.connect() as conn:
        inspector = inspect(conn)
        tables = set(inspector.get_table_names())

    core_tables = {
        "users",
        "clients",
        "instructors",
        "class_templates",
        "scheduled_classes",
        "bookings",
        "memberships",
        "membership_types",
        "payments",
        "checkins",
        "waitlist",
        "studio_settings",
        "locations",
    }
    missing = core_tables - tables
    assert not missing, f"Missing tables after migration: {missing}"


def test_alembic_downgrade_base_on_fresh_db(tmp_path):
    """Downgrade to base runs without error (migration files are reversible)."""
    from alembic import command
    from alembic.config import Config

    db_path = tmp_path / "migration_down_test.db"
    db_url = f"sqlite:///{db_path}"

    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    command.upgrade(alembic_cfg, "head")
    # Downgrade all the way back to empty
    command.downgrade(alembic_cfg, "base")

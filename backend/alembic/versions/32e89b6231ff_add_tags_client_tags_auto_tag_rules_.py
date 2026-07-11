"""add_tags_client_tags_auto_tag_rules_tables

Revision ID: 32e89b6231ff
Revises: 625ab8f0aab6
Create Date: 2026-07-07 10:19:57.869550

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "32e89b6231ff"
down_revision: Union[str, None] = "625ab8f0aab6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables may already exist via create_tables() at startup, so use IF NOT EXISTS.
    op.execute("""
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location_id INTEGER NOT NULL DEFAULT 1,
            name VARCHAR NOT NULL,
            color VARCHAR,
            created_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
            updated_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
            CONSTRAINT uq_tag_location_name UNIQUE (location_id, name)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS client_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location_id INTEGER NOT NULL DEFAULT 1,
            client_id INTEGER NOT NULL REFERENCES clients(id),
            tag_id INTEGER NOT NULL REFERENCES tags(id),
            assigned_at DATETIME NOT NULL,
            assigned_by VARCHAR NOT NULL,
            created_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
            updated_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
            CONSTRAINT uq_client_tag UNIQUE (client_id, tag_id)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS auto_tag_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location_id INTEGER NOT NULL DEFAULT 1,
            tag_id INTEGER NOT NULL REFERENCES tags(id),
            trigger_event VARCHAR NOT NULL,
            condition_json VARCHAR,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
            updated_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP)
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_auto_tag_rule_lookup
        ON auto_tag_rules (location_id, trigger_event, is_active)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_auto_tag_rule_lookup")
    op.execute("DROP TABLE IF EXISTS auto_tag_rules")
    op.execute("DROP TABLE IF EXISTS client_tags")
    op.execute("DROP TABLE IF EXISTS tags")

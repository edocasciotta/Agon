"""add_locations_table

Revision ID: ea32f91fea27
Revises: b2c3d4e5f6a7
Create Date: 2026-06-29 14:08:02.395431

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'ea32f91fea27'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Table already created by create_tables() at startup; just ensure default location exists.
    op.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR NOT NULL,
            address VARCHAR,
            phone VARCHAR,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
            updated_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP)
        )
    """)
    op.execute("""
        INSERT OR IGNORE INTO locations (id, name, is_active)
        VALUES (1, 'Main Studio', 1)
    """)


def downgrade() -> None:
    op.drop_table('locations')

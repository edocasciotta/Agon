"""fix_locations_table_creation

Ensure the locations table exists via proper Alembic DDL (the previous
migration ea32f91fea27 used raw op.execute() which is not visible to
SQLAlchemy's inspector in some contexts and doesn't survive a clean migration
run without create_tables() having been called first).

Revision ID: 19a82c3bff90
Revises: 086528153a55
Create Date: 2026-07-01 16:28:41.957339

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "19a82c3bff90"
down_revision: Union[str, None] = "086528153a55"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "locations" not in inspector.get_table_names():
        op.create_table(
            "locations",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("name", sa.String, nullable=False),
            sa.Column("address", sa.String),
            sa.Column("phone", sa.String),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
            sa.Column(
                "created_at",
                sa.DateTime,
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime,
                nullable=False,
                server_default=sa.func.now(),
            ),
        )
    # Ensure the default location row exists
    conn.execute(
        sa.text(
            "INSERT OR IGNORE INTO locations (id, name, is_active) VALUES (1, 'Main Studio', 1)"
        )
    )


def downgrade() -> None:
    pass  # do not drop locations — it contains studio data

"""add color settings to studio_settings

Revision ID: d1e2f3a4b5c6
Revises: c4d5e6f7a8b9
Create Date: 2026-07-03 18:00:00.000000

"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("studio_settings", sa.Column("primary_color", sa.String(), nullable=True))
    op.add_column("studio_settings", sa.Column("secondary_color", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("studio_settings", "secondary_color")
    op.drop_column("studio_settings", "primary_color")

"""add_calendar_hours_to_studio_settings

Revision ID: c4d5e6f7a8b9
Revises: ea32f91fea27
Create Date: 2026-07-03 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "19a82c3bff90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "studio_settings",
        sa.Column("calendar_start_hour", sa.Integer(), nullable=False, server_default="7"),
    )
    op.add_column(
        "studio_settings",
        sa.Column("calendar_end_hour", sa.Integer(), nullable=False, server_default="21"),
    )


def downgrade() -> None:
    op.drop_column("studio_settings", "calendar_end_hour")
    op.drop_column("studio_settings", "calendar_start_hour")

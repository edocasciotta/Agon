"""add booking windows to class_templates

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-07-03 18:05:00.000000

"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "class_templates", sa.Column("cancellation_window_hours", sa.Integer(), nullable=True)
    )
    op.add_column(
        "class_templates", sa.Column("booking_open_hours_before", sa.Integer(), nullable=True)
    )
    op.add_column(
        "class_templates", sa.Column("booking_close_hours_before", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("class_templates", "booking_close_hours_before")
    op.drop_column("class_templates", "booking_open_hours_before")
    op.drop_column("class_templates", "cancellation_window_hours")

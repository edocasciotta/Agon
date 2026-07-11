"""add_calendar_sync_token_to_clients

Revision ID: b467324a232d
Revises: f1a2b3c4d5e6
Create Date: 2026-07-10 08:54:49.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b467324a232d"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("calendar_sync_token", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_clients_calendar_sync_token"),
        "clients",
        ["calendar_sync_token"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_clients_calendar_sync_token"), table_name="clients")
    op.drop_column("clients", "calendar_sync_token")

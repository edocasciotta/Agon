"""add_waivers_and_waiver_signatures

Revision ID: ba57122d7494
Revises: b467324a232d
Create Date: 2026-07-10 09:30:00.000000

Hand-written: `alembic revision --autogenerate` emits a spurious
`op.drop_table('locations')` on this codebase (pre-existing bug,
task_3685606b, unrelated to this change) — mirrors the file structure of
b467324a232d_add_calendar_sync_token_to_clients.py instead.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ba57122d7494"
down_revision: Union[str, None] = "b467324a232d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "waivers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("location_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "requires_before_booking", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        op.f("ix_waivers_location_id_active"),
        "waivers",
        ["location_id", "is_active"],
    )

    op.create_table(
        "waiver_signatures",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("location_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("waiver_id", sa.Integer(), sa.ForeignKey("waivers.id"), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("waiver_version", sa.Integer(), nullable=False),
        sa.Column("signed_name", sa.String(), nullable=False),
        sa.Column("signed_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("ip_address", sa.String(), nullable=True),
    )
    op.create_index(
        op.f("ix_waiver_signatures_waiver_client_version"),
        "waiver_signatures",
        ["waiver_id", "client_id", "waiver_version"],
    )
    op.create_index(
        op.f("ix_waiver_signatures_client_id"),
        "waiver_signatures",
        ["client_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_waiver_signatures_client_id"), table_name="waiver_signatures")
    op.drop_index(
        op.f("ix_waiver_signatures_waiver_client_version"), table_name="waiver_signatures"
    )
    op.drop_table("waiver_signatures")

    op.drop_index(op.f("ix_waivers_location_id_active"), table_name="waivers")
    op.drop_table("waivers")

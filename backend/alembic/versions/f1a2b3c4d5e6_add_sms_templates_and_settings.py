"""add_sms_templates_and_settings

Revision ID: f1a2b3c4d5e6
Revises: 93a8001b6cef
Create Date: 2026-07-10 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "f1a2b3c4d5e6"
down_revision = "93a8001b6cef"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "studio_settings", sa.Column("sms_provider_account_sid", sa.String(), nullable=True)
    )
    op.add_column(
        "studio_settings", sa.Column("sms_provider_auth_token", sa.String(), nullable=True)
    )
    op.add_column("studio_settings", sa.Column("sms_from_number", sa.String(), nullable=True))
    op.add_column(
        "studio_settings",
        sa.Column("sms_enabled", sa.Boolean(), nullable=False, server_default="0"),
    )

    op.create_table(
        "sms_templates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "sms_event_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["template_id"], ["sms_templates.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_type"),
    )


def downgrade() -> None:
    op.drop_table("sms_event_assignments")
    op.drop_table("sms_templates")
    op.drop_column("studio_settings", "sms_enabled")
    op.drop_column("studio_settings", "sms_from_number")
    op.drop_column("studio_settings", "sms_provider_auth_token")
    op.drop_column("studio_settings", "sms_provider_account_sid")

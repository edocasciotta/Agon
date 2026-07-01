"""add_email_smtp_settings

Revision ID: a1b2c3d4e5f6
Revises: 06ae94d7aa0e
Create Date: 2026-06-29 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "06ae94d7aa0e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("studio_settings", sa.Column("email_smtp_host", sa.String(), nullable=True))
    op.add_column(
        "studio_settings",
        sa.Column("email_smtp_port", sa.Integer(), nullable=True, server_default="587"),
    )
    op.add_column("studio_settings", sa.Column("email_smtp_user", sa.String(), nullable=True))
    op.add_column("studio_settings", sa.Column("email_smtp_password", sa.String(), nullable=True))
    op.add_column("studio_settings", sa.Column("email_from_name", sa.String(), nullable=True))
    op.add_column("studio_settings", sa.Column("email_from_address", sa.String(), nullable=True))
    op.add_column(
        "studio_settings",
        sa.Column("email_smtp_tls", sa.Boolean(), nullable=True, server_default="1"),
    )
    # Make client password_hash nullable for backoffice-created clients
    with op.batch_alter_table("clients") as batch_op:
        batch_op.alter_column("password_hash", existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    op.drop_column("studio_settings", "email_smtp_tls")
    op.drop_column("studio_settings", "email_from_address")
    op.drop_column("studio_settings", "email_from_name")
    op.drop_column("studio_settings", "email_smtp_password")
    op.drop_column("studio_settings", "email_smtp_user")
    op.drop_column("studio_settings", "email_smtp_port")
    op.drop_column("studio_settings", "email_smtp_host")
    with op.batch_alter_table("clients") as batch_op:
        batch_op.alter_column("password_hash", existing_type=sa.String(), nullable=False)

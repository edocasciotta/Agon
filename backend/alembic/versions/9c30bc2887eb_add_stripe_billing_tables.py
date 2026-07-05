"""add_stripe_billing_tables

Revision ID: 9c30bc2887eb
Revises: e2f3a4b5c6d7
Create Date: 2026-07-05 14:41:56.584990

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9c30bc2887eb"
down_revision: Union[str, None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = inspector.get_table_names()

    if "stripe_customers" not in existing:
        op.create_table(
            "stripe_customers",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("location_id", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False),
            sa.Column("stripe_customer_id", sa.Text(), nullable=False, unique=True),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )

    if "stripe_prices" not in existing:
        op.create_table(
            "stripe_prices",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("location_id", sa.Integer(), nullable=False, server_default="1"),
            sa.Column(
                "membership_type_id",
                sa.Integer(),
                sa.ForeignKey("membership_types.id"),
                nullable=False,
            ),
            sa.Column("stripe_product_id", sa.Text(), nullable=False),
            sa.Column("stripe_price_id", sa.Text(), nullable=False),
            sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("billing_interval", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )

    if "stripe_subscriptions" not in existing:
        op.create_table(
            "stripe_subscriptions",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("location_id", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False),
            sa.Column("stripe_subscription_id", sa.Text(), nullable=False, unique=True),
            sa.Column("stripe_price_id", sa.Text(), nullable=False),
            sa.Column("status", sa.Text(), nullable=False),
            sa.Column("current_period_end", sa.DateTime(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )
        op.create_index(
            "ix_stripe_subscriptions_client_id_status",
            "stripe_subscriptions",
            ["client_id", "status"],
        )

    if "stripe_checkout_sessions" not in existing:
        op.create_table(
            "stripe_checkout_sessions",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("location_id", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False),
            sa.Column("stripe_session_id", sa.Text(), nullable=False, unique=True),
            sa.Column(
                "membership_type_id",
                sa.Integer(),
                sa.ForeignKey("membership_types.id"),
                nullable=False,
            ),
            sa.Column("mode", sa.Text(), nullable=False, server_default="payment"),
            sa.Column("status", sa.Text(), nullable=False, server_default="open"),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )
        op.create_index(
            "ix_stripe_checkout_sessions_client_id_status",
            "stripe_checkout_sessions",
            ["client_id", "status"],
        )

    if "stripe_webhook_events" not in existing:
        op.create_table(
            "stripe_webhook_events",
            sa.Column("stripe_event_id", sa.Text(), primary_key=True),
            sa.Column("event_type", sa.Text(), nullable=False),
            sa.Column(
                "processed_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )

    # Add sellable_online column to membership_types if not already present
    mt_columns = [c["name"] for c in inspector.get_columns("membership_types")]
    if "sellable_online" not in mt_columns:
        op.add_column(
            "membership_types",
            sa.Column("sellable_online", sa.Boolean(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    op.drop_column("membership_types", "sellable_online")
    op.drop_index(
        "ix_stripe_checkout_sessions_client_id_status", table_name="stripe_checkout_sessions"
    )
    op.drop_table("stripe_checkout_sessions")
    op.drop_index(
        "ix_stripe_subscriptions_client_id_status", table_name="stripe_subscriptions"
    )
    op.drop_table("stripe_subscriptions")
    op.drop_table("stripe_prices")
    op.drop_table("stripe_customers")
    op.drop_table("stripe_webhook_events")

"""add_gift_cards_and_gift_card_redemptions

Revision ID: 93a8001b6cef
Revises: 32e89b6231ff
Create Date: 2026-07-09 20:22:34.338875

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '93a8001b6cef'
down_revision: Union[str, None] = '32e89b6231ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gift_cards',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('initial_value', sa.Float(), nullable=False),
        sa.Column('remaining_balance', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(), nullable=False, server_default=sa.text("'EUR'")),
        sa.Column('purchaser_client_id', sa.Integer(), nullable=True),
        sa.Column('recipient_name', sa.String(), nullable=True),
        sa.Column('recipient_email', sa.String(), nullable=True),
        sa.Column('message', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['purchaser_client_id'], ['clients.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_gift_cards_code'),
    )
    op.create_index('ix_gift_cards_code', 'gift_cards', ['code'], unique=True)

    op.create_table(
        'gift_card_redemptions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('gift_card_id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('balance_after', sa.Float(), nullable=False),
        sa.Column('stripe_checkout_session_id', sa.String(), nullable=True),
        sa.Column('redeemed_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['gift_card_id'], ['gift_cards.id']),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('gift_card_redemptions')
    op.drop_index('ix_gift_cards_code', table_name='gift_cards')
    op.drop_table('gift_cards')

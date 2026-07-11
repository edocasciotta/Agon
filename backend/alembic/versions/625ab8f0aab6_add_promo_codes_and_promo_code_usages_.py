"""add_promo_codes_and_promo_code_usages_tables

Revision ID: 625ab8f0aab6
Revises: 19c44dd02404
Create Date: 2026-07-07 10:07:03.241812

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '625ab8f0aab6'
down_revision: Union[str, None] = '19c44dd02404'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'promo_codes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('discount_type', sa.String(), nullable=False),
        sa.Column('discount_value', sa.Float(), nullable=False),
        sa.Column('applicable_membership_type_ids', sa.String(), nullable=True),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('current_uses', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('one_per_client', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('valid_from', sa.DateTime(), nullable=False),
        sa.Column('valid_until', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('location_id', 'code', name='uq_promo_codes_location_code'),
    )
    op.create_index(
        'ix_promo_codes_location_code_active',
        'promo_codes',
        ['location_id', 'code', 'is_active'],
    )

    op.create_table(
        'promo_code_usages',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('promo_code_id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('discount_amount', sa.Float(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['promo_code_id'], ['promo_codes.id']),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('promo_code_usages')
    op.drop_index('ix_promo_codes_location_code_active', table_name='promo_codes')
    op.drop_table('promo_codes')

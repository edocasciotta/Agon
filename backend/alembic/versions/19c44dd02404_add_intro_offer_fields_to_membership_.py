"""add_intro_offer_fields_to_membership_types

Revision ID: 19c44dd02404
Revises: b3cd111ee905
Create Date: 2026-07-06 21:46:56.829962

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '19c44dd02404'
down_revision: Union[str, None] = 'b3cd111ee905'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('membership_types', sa.Column('is_intro_offer', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    op.add_column('membership_types', sa.Column('intro_price', sa.Float(), nullable=True))
    op.add_column('membership_types', sa.Column('intro_validity_days', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('membership_types', 'intro_validity_days')
    op.drop_column('membership_types', 'intro_price')
    op.drop_column('membership_types', 'is_intro_offer')

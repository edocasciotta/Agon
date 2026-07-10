"""add_rollover_credits_columns

Revision ID: b3cd111ee905
Revises: 5f2647be9373
Create Date: 2026-07-06 21:39:11.684264

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3cd111ee905'
down_revision: Union[str, None] = '5f2647be9373'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('membership_types', sa.Column('rollover_enabled', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    op.add_column('membership_types', sa.Column('max_rollover_credits', sa.Integer(), nullable=True))
    op.add_column('memberships', sa.Column('rollover_credits', sa.Integer(), nullable=False, server_default=sa.text('0')))


def downgrade() -> None:
    op.drop_column('memberships', 'rollover_credits')
    op.drop_column('membership_types', 'max_rollover_credits')
    op.drop_column('membership_types', 'rollover_enabled')

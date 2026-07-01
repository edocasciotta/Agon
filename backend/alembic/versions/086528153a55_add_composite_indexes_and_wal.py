"""add_composite_indexes_and_wal

Revision ID: 086528153a55
Revises: ea32f91fea27
Create Date: 2026-07-01 16:23:22.173881

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '086528153a55'
down_revision: Union[str, None] = 'ea32f91fea27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('idx_booking_class_status', 'bookings', ['scheduled_class_id', 'status'], unique=False)
    op.create_index('idx_booking_client_status', 'bookings', ['client_id', 'status'], unique=False)
    op.create_index('idx_membership_client_status', 'memberships', ['client_id', 'status'], unique=False)
    op.create_index('idx_class_starts_at_location_status', 'scheduled_classes', ['starts_at', 'location_id', 'status'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_class_starts_at_location_status', table_name='scheduled_classes')
    op.drop_index('idx_membership_client_status', table_name='memberships')
    op.drop_index('idx_booking_client_status', table_name='bookings')
    op.drop_index('idx_booking_class_status', table_name='bookings')

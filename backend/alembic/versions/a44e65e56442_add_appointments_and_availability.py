"""add_appointments_and_availability

Revision ID: a44e65e56442
Revises: ba57122d7494
Create Date: 2026-07-12 09:00:00.000000

Hand-written (mirrors ba57122d7494's approach): `alembic revision
--autogenerate` emits a spurious `op.drop_table('locations')` on this
codebase (pre-existing bug, task_3685606b, unrelated to this change).

Adds the 1-on-1 appointment booking engine: appointment_services (manager-
defined service types), instructor_availability (weekly recurring windows,
no date-range exceptions/holidays in this round), and appointments (1:1
bookings, mirrors bookings.py but no separate scheduled-instance layer since
each appointment IS one instance).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a44e65e56442"
down_revision: Union[str, None] = "ba57122d7494"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "appointment_services",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("location_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("buffer_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "instructor_availability",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("location_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("instructor_id", sa.Integer(), sa.ForeignKey("instructors.id"), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        op.f("idx_availability_instructor_day_active"),
        "instructor_availability",
        ["instructor_id", "day_of_week", "is_active"],
    )

    op.create_table(
        "appointments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("location_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "service_id",
            sa.Integer(),
            sa.ForeignKey("appointment_services.id"),
            nullable=False,
        ),
        sa.Column("instructor_id", sa.Integer(), sa.ForeignKey("instructors.id"), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("starts_at", sa.DateTime(), nullable=False),
        sa.Column("ends_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="confirmed"),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        sa.Column("cancellation_reason", sa.String(), nullable=True),
        sa.Column("credit_deducted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        op.f("idx_appointment_instructor_starts_status"),
        "appointments",
        ["instructor_id", "starts_at", "status"],
    )
    op.create_index(
        op.f("idx_appointment_client_status"),
        "appointments",
        ["client_id", "status"],
    )


def downgrade() -> None:
    op.drop_index(op.f("idx_appointment_client_status"), table_name="appointments")
    op.drop_index(op.f("idx_appointment_instructor_starts_status"), table_name="appointments")
    op.drop_table("appointments")

    op.drop_index(
        op.f("idx_availability_instructor_day_active"), table_name="instructor_availability"
    )
    op.drop_table("instructor_availability")

    op.drop_table("appointment_services")

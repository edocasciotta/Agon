"""add_service_scoping_to_availability_and_locations

Revision ID: aea4bdb031a8
Revises: a44e65e56442
Create Date: 2026-07-13 16:30:10.861566

Hand-trimmed from `alembic revision --autogenerate`: the raw autogenerate
diff also included a batch of unrelated spurious changes on other tables
(NOT NULL/autoincrement rewrites on auto_tag_rules.id, client_tags.id,
locations.id, tags.id; a dropped gift_cards unique constraint; dropped
waiver/waiver_signatures indexes) — all pre-existing SQLite-reflection noise
unrelated to this change (same class of issue documented in
a44e65e56442's docstring). Only the two changes below are real:

1. `instructor_availability.service_id` (nullable FK to
   `appointment_services.id`) — NULL means "available for ALL services"
   (wildcard), which is what every existing row means today, so this is a
   pure additive/backward-compatible change requiring no backfill. Added via
   batch mode so the FK constraint is actually enforced by SQLite (a plain
   ALTER TABLE ADD COLUMN cannot attach a FK constraint on this backend).
2. New `appointment_service_locations` join table linking
   `appointment_services` <-> `locations` (many-to-many). A service with zero
   rows here is treated as offered at ALL locations (wildcard), consistent
   with (1) and requiring no backfill for existing services.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "aea4bdb031a8"
down_revision: Union[str, None] = "a44e65e56442"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_FK_NAME = "fk_instructor_availability_service_id_appointment_services"


def upgrade() -> None:
    op.create_table(
        "appointment_service_locations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "service_id", sa.Integer(), sa.ForeignKey("appointment_services.id"), nullable=False
        ),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("service_id", "location_id", name="uq_appointment_service_location"),
    )

    with op.batch_alter_table("instructor_availability") as batch_op:
        batch_op.add_column(sa.Column("service_id", sa.Integer(), nullable=True))
        batch_op.create_index("idx_availability_service", ["service_id"])
        batch_op.create_foreign_key(_FK_NAME, "appointment_services", ["service_id"], ["id"])


def downgrade() -> None:
    with op.batch_alter_table("instructor_availability") as batch_op:
        batch_op.drop_constraint(_FK_NAME, type_="foreignkey")
        batch_op.drop_index("idx_availability_service")
        batch_op.drop_column("service_id")

    op.drop_table("appointment_service_locations")

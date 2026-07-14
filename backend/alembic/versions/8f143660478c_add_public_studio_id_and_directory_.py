"""add_public_studio_id_and_directory_secret_to_studio_settings

Revision ID: 8f143660478c
Revises: aea4bdb031a8
Create Date: 2026-07-14 17:56:31.359964

Hand-trimmed from `alembic revision --autogenerate`: the raw autogenerate
diff also included a batch of unrelated spurious changes on other tables
(NOT NULL/autoincrement rewrites on auto_tag_rules.id, client_tags.id,
locations.id, tags.id; a dropped gift_cards unique constraint; dropped
waiver/waiver_signatures indexes) — the same pre-existing SQLite-reflection
noise already documented in aea4bdb031a8's docstring, unrelated to this
change. Only the change below is real:

Add `studio_settings.public_studio_id` (unique, NOT NULL) and
`studio_settings.directory_secret` (NOT NULL). Both are added as nullable
first, backfilled for every existing row (there is normally only the single
id=1 row in this single-studio-per-backend deployment model, but the loop
below is not id-specific so it stays correct if that ever changes), then
tightened to NOT NULL via batch mode — SQLite can't add a NOT NULL column
with per-row-unique values in one step. Values are generated the same way
app/models/studio_settings.py generates them for new rows going forward
(uuid4() / secrets.token_urlsafe(32)), so a freshly migrated existing studio
ends up indistinguishable from a freshly created one.
"""

import secrets
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8f143660478c"
down_revision: Union[str, None] = "aea4bdb031a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UQ_NAME = "uq_studio_settings_public_studio_id"


def upgrade() -> None:
    op.add_column("studio_settings", sa.Column("public_studio_id", sa.String(), nullable=True))
    op.add_column("studio_settings", sa.Column("directory_secret", sa.String(), nullable=True))

    conn = op.get_bind()
    studio_settings = sa.table(
        "studio_settings",
        sa.column("id", sa.Integer),
        sa.column("public_studio_id", sa.String),
        sa.column("directory_secret", sa.String),
    )
    existing_ids = [row[0] for row in conn.execute(sa.select(studio_settings.c.id))]
    for row_id in existing_ids:
        conn.execute(
            studio_settings.update()
            .where(studio_settings.c.id == row_id)
            .values(
                public_studio_id=str(uuid.uuid4()),
                directory_secret=secrets.token_urlsafe(32),
            )
        )

    with op.batch_alter_table("studio_settings") as batch_op:
        batch_op.alter_column("public_studio_id", existing_type=sa.String(), nullable=False)
        batch_op.alter_column("directory_secret", existing_type=sa.String(), nullable=False)
        batch_op.create_unique_constraint(_UQ_NAME, ["public_studio_id"])


def downgrade() -> None:
    with op.batch_alter_table("studio_settings") as batch_op:
        batch_op.drop_constraint(_UQ_NAME, type_="unique")
        batch_op.drop_column("directory_secret")
        batch_op.drop_column("public_studio_id")

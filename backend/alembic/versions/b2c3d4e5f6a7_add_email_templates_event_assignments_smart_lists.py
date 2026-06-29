"""add_email_templates_event_assignments_smart_lists

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-29 00:01:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'email_templates',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('html_body', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'email_event_assignments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['template_id'], ['email_templates.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_type'),
    )

    op.create_table(
        'smart_lists',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('filters', sa.String(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('smart_lists')
    op.drop_table('email_event_assignments')
    op.drop_table('email_templates')

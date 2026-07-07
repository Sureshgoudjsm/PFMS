"""
add_salary_day_and_milestone

Revision ID: add_salary_day_and_milestone
Revises: None
Create Date: 2026-06-28 03:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_salary_day_and_milestone'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Add nullable salary_day column without default
    op.add_column('users', sa.Column('salary_day', sa.Integer(), nullable=True))
    # Add forecast_alert_threshold with default 1000.0
    op.add_column('users', sa.Column('forecast_alert_threshold', sa.Float(), nullable=False, server_default='1000.0'))
    # Create milestones table
    op.create_table(
        'milestones',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('related_entity_id', sa.Integer(), nullable=True),
        sa.Column('achieved_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'type', 'related_entity_id', name='uq_milestone')
    )

def downgrade():
    op.drop_table('milestones')
    op.drop_column('users', 'forecast_alert_threshold')
    op.drop_column('users', 'salary_day')

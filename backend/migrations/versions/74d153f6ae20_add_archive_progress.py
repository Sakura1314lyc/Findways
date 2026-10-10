"""add archive investigation progress

Revision ID: 74d153f6ae20
Revises: 1031bb511f59
"""

from alembic import op
import sqlalchemy as sa


revision = "74d153f6ae20"
down_revision = "1031bb511f59"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "archive_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_code", sa.String(length=64), nullable=False),
        sa.Column("clues_solved", sa.Boolean(), nullable=False),
        sa.Column("reflection", sa.Text(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "case_code", name="uq_archive_progress_user_id"),
    )
    op.create_index("ix_archive_progress_user_id", "archive_progress", ["user_id"])
    op.create_index("ix_archive_progress_case_code", "archive_progress", ["case_code"])


def downgrade() -> None:
    op.drop_index("ix_archive_progress_case_code", table_name="archive_progress")
    op.drop_index("ix_archive_progress_user_id", table_name="archive_progress")
    op.drop_table("archive_progress")

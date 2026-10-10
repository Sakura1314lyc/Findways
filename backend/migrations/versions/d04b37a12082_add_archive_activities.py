from alembic import op
import sqlalchemy as sa

revision = "d04b37a12082"
down_revision = "c91f2a60d701"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "archive_activities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_code", sa.String(64), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("correct", sa.Boolean(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_archive_activities_user_id", "archive_activities", ["user_id"])
    op.create_index("ix_archive_activities_case_code", "archive_activities", ["case_code"])


def downgrade() -> None:
    op.drop_table("archive_activities")

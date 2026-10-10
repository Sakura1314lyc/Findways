from alembic import op
import sqlalchemy as sa

revision = "a619e238c704"
down_revision = "d04b37a12082"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "archive_agent_turns",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_code", sa.String(64), nullable=False),
        sa.Column("question", sa.String(300), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("stage", sa.String(24), nullable=False),
        sa.Column("focus_clue_id", sa.String(64), nullable=True),
        sa.Column("evidence_ids", sa.JSON(), nullable=False),
        sa.Column("tools", sa.JSON(), nullable=False),
        sa.Column("mode", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_archive_agent_turns_user_id", "archive_agent_turns", ["user_id"])
    op.create_index("ix_archive_agent_turns_case_code", "archive_agent_turns", ["case_code"])


def downgrade() -> None:
    op.drop_table("archive_agent_turns")

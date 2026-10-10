from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, false, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ArchiveProgress(Base, TimestampMixin):
    __tablename__ = "archive_progress"
    __table_args__ = (UniqueConstraint("user_id", "case_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    case_code: Mapped[str] = mapped_column(String(64), index=True)
    clues_solved: Mapped[bool] = mapped_column(Boolean, default=False)
    reflection: Mapped[str] = mapped_column(Text, default="")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    hints_used: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    best_score: Mapped[float] = mapped_column(Float, default=0.0, server_default=text("0"))
    passed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    probe_passed: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    detail: Mapped[dict] = mapped_column(JSON, default=dict, server_default=text("'{}'"))

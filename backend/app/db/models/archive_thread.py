from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ArchiveThreadNote(Base, TimestampMixin):
    __tablename__ = "archive_thread_notes"
    __table_args__ = (UniqueConstraint("user_id", "thread"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    thread: Mapped[str] = mapped_column(String(4))
    note: Mapped[str] = mapped_column(Text, default="")

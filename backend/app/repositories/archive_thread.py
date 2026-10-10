from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.archive_thread import ArchiveThreadNote
from app.repositories.base import BaseRepository


class ArchiveThreadRepository(BaseRepository):
    model = ArchiveThreadNote

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_for(self, user_id: int, thread: str) -> ArchiveThreadNote | None:
        return await self.session.scalar(
            select(ArchiveThreadNote).where(
                ArchiveThreadNote.user_id == user_id, ArchiveThreadNote.thread == thread
            )
        )

    async def list_for(self, user_id: int) -> list[ArchiveThreadNote]:
        result = await self.session.execute(
            select(ArchiveThreadNote).where(ArchiveThreadNote.user_id == user_id)
        )
        return list(result.scalars().all())

    async def upsert(self, user_id: int, thread: str, note: str) -> ArchiveThreadNote:
        row = await self.get_for(user_id, thread)
        if row is None:
            row = ArchiveThreadNote(user_id=user_id, thread=thread, note=note)
            self.session.add(row)
        else:
            row.note = note
        await self.session.flush()
        return row

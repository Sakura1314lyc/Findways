from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.archive import ArchiveProgress
from app.db.models.archive_activity import ArchiveActivity


class ArchiveReportRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def progress_for(self, user_id: int) -> list[ArchiveProgress]:
        result = await self.session.scalars(select(ArchiveProgress).where(ArchiveProgress.user_id == user_id))
        return list(result)

    async def activities_for(self, user_id: int) -> list[ArchiveActivity]:
        result = await self.session.scalars(
            select(ArchiveActivity).where(ArchiveActivity.user_id == user_id).order_by(ArchiveActivity.id)
        )
        return list(result)

    def record(self, user_id: int, case_code: str, kind: str, correct: bool | None = None) -> None:
        self.session.add(ArchiveActivity(user_id=user_id, case_code=case_code, kind=kind, correct=correct))

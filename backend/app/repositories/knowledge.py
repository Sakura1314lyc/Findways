from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.knowledge import KnowledgePoint
from app.repositories.base import BaseRepository


class KnowledgeRepository(BaseRepository):
    model = KnowledgePoint

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def list_all(self) -> list[KnowledgePoint]:
        result = await self.session.execute(select(KnowledgePoint).order_by(KnowledgePoint.id))
        return list(result.scalars().all())

    async def get_by_codes(self, codes: list[str]) -> list[KnowledgePoint]:
        if not codes:
            return []
        result = await self.session.execute(select(KnowledgePoint).where(KnowledgePoint.code.in_(codes)))
        return list(result.scalars().all())

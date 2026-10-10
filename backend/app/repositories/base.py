from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base


class BaseRepository:
    model: type[Base]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, id_: int):
        return await self.session.get(self.model, id_)

    async def list(self, offset: int = 0, limit: int = 20) -> list:
        result = await self.session.execute(select(self.model).offset(offset).limit(limit))
        return list(result.scalars().all())

    async def count(self) -> int:
        result = await self.session.execute(select(func.count()).select_from(self.model))
        return int(result.scalar_one())

    async def create(self, obj):
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def delete(self, obj) -> None:
        await self.session.delete(obj)
        await self.session.flush()

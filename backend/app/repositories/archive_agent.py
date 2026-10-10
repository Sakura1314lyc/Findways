from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.archive_activity import ArchiveActivity
from app.db.models.archive_agent import ArchiveAgentTurn
from app.db.models.knowledge import KnowledgePoint


class ArchiveAgentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def recent_turns(self, user_id: int, case_code: str, limit: int = 8) -> list[ArchiveAgentTurn]:
        result = await self.session.scalars(
            select(ArchiveAgentTurn)
            .where(ArchiveAgentTurn.user_id == user_id, ArchiveAgentTurn.case_code == case_code)
            .order_by(ArchiveAgentTurn.id.desc())
            .limit(limit)
        )
        return list(reversed(result.all()))

    async def turn_count(self, user_id: int, case_code: str) -> int:
        result = await self.session.scalar(
            select(func.count()).select_from(ArchiveAgentTurn).where(
                ArchiveAgentTurn.user_id == user_id, ArchiveAgentTurn.case_code == case_code,
            )
        )
        return int(result or 0)

    async def wrong_attempts(self, user_id: int, case_code: str) -> int:
        result = await self.session.scalars(
            select(ArchiveActivity.id).where(
                ArchiveActivity.user_id == user_id,
                ArchiveActivity.case_code == case_code,
                ArchiveActivity.kind == "check",
                ArchiveActivity.correct.is_(False),
            )
        )
        return len(result.all())

    async def knowledge(self, codes: list[str]) -> list[KnowledgePoint]:
        result = await self.session.scalars(select(KnowledgePoint).where(KnowledgePoint.code.in_(codes)))
        return list(result.all())

    async def save(self, turn: ArchiveAgentTurn) -> ArchiveAgentTurn:
        self.session.add(turn)
        await self.session.commit()
        await self.session.refresh(turn)
        return turn

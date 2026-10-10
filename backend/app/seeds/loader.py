import json
import logging
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.knowledge import KnowledgePoint

logger = logging.getLogger(__name__)

SEED_DIR = Path(__file__).resolve().parent


def _load(name: str):
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


async def seed_knowledge(session: AsyncSession) -> int:
    result = await session.execute(select(func.count()).select_from(KnowledgePoint))
    if int(result.scalar_one()) > 0:
        return 0
    created = 0
    for item in _load("knowledge_points.json"):
        session.add(KnowledgePoint(**item))
        created += 1
    await session.commit()
    logger.info("seeded knowledge_points count=%s", created)
    return created


async def seed_all(session: AsyncSession) -> dict:
    return {"knowledge_points": await seed_knowledge(session)}

from sqlalchemy.ext.asyncio import AsyncSession

from app.rag.retriever import Retriever
from app.repositories.knowledge import KnowledgeRepository
from app.schemas.knowledge import KnowledgePointOut, KnowledgeSearchOut, SearchHitOut


class KnowledgeService:
    def __init__(self, session: AsyncSession, retriever: Retriever) -> None:
        self.repo = KnowledgeRepository(session)
        self.retriever = retriever

    async def list_points(self) -> list[KnowledgePointOut]:
        rows = await self.repo.list_all()
        return [
            KnowledgePointOut(
                id=row.id,
                code=row.code,
                name=row.name,
                chapter=row.chapter,
                summary=row.summary,
                key_points=row.key_points or [],
                quotes=row.quotes or [],
                sources=row.sources or [],
                tags=row.tags or [],
                misconceptions=row.misconceptions or [],
                application=row.application or "",
            )
            for row in rows
        ]

    async def search(self, query: str, top_k: int = 6) -> KnowledgeSearchOut:
        hits = self.retriever.search(query, top_k=top_k)
        return KnowledgeSearchOut(
            query=query,
            hits=[
                SearchHitOut(text=hit.text, source=hit.source, kind=hit.kind, kp_codes=hit.kp_codes) for hit in hits
            ],
        )

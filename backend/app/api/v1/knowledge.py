from fastapi import APIRouter, Query

from app.api.deps import RetrieverDep, SessionDep
from app.schemas.knowledge import KnowledgePointOut, KnowledgeSearchOut
from app.services.knowledge_service import KnowledgeService

router = APIRouter()


@router.get("/points", response_model=list[KnowledgePointOut])
async def list_points(session: SessionDep, retriever: RetrieverDep) -> list[KnowledgePointOut]:
    return await KnowledgeService(session, retriever).list_points()


@router.get("/search", response_model=KnowledgeSearchOut)
async def search(
    session: SessionDep,
    retriever: RetrieverDep,
    q: str = Query(min_length=2, max_length=200),
    top_k: int = Query(6, ge=1, le=20),
) -> KnowledgeSearchOut:
    return await KnowledgeService(session, retriever).search(q, top_k)

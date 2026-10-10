from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import SessionDep

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(session: SessionDep) -> dict:
    await session.execute(text("SELECT 1"))
    return {"status": "ready"}

import os
import sys
import tempfile
from pathlib import Path

TEST_DB = Path(tempfile.gettempdir()) / "mingbian_test.db"
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ["APP_ENV"] = "testing"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB.as_posix()}"
os.environ["LLM_PROVIDER"] = "mock"
os.environ["SEED_ON_STARTUP"] = "false"
os.environ["SECRET_KEY"] = "test-secret-key-for-mingbian-suite-0123456789"
os.environ["TEACHER_CODE"] = "teacher-code-1234"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.db.session import SessionLocal, init_models
from app.main import app
from app.rag.retriever import build_retriever, get_retriever
from app.seeds.loader import seed_all

_prepared = False


async def prepare_database() -> None:
    global _prepared
    if _prepared:
        return
    await init_models()
    async with SessionLocal() as session:
        await seed_all(session)
        await build_retriever(session)
    _prepared = True


def unique_account() -> dict:
    suffix = uuid.uuid4().hex[:8]
    return {
        "email": f"user_{suffix}@example.com",
        "username": f"user_{suffix}",
        "password": "test-password-123",
    }


@pytest_asyncio.fixture
async def client():
    await prepare_database()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


@pytest_asyncio.fixture
async def auth_client(client):
    account = unique_account()
    response = await client.post("/api/v1/auth/register", json=account)
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    yield client


@pytest_asyncio.fixture
async def retriever():
    await prepare_database()
    return get_retriever()

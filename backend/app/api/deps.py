from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError
from app.db.models.user import User
from app.db.session import get_session
from app.llm.client import LLMPort, get_llm_client
from app.rag.retriever import Retriever, get_retriever
from app.services.auth_service import AuthService

bearer_scheme = HTTPBearer(auto_error=False)

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_retriever_dep() -> Retriever:
    return get_retriever()


def get_llm_dep() -> LLMPort:
    return get_llm_client()


RetrieverDep = Annotated[Retriever, Depends(get_retriever_dep)]
LLMDep = Annotated[LLMPort, Depends(get_llm_dep)]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: SessionDep,
) -> User:
    if credentials is None or not credentials.credentials:
        raise AuthenticationError("缺少访问令牌")
    service = AuthService(session)
    return await service.resolve_user_from_access_token(credentials.credentials)


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "-")

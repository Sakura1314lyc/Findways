from fastapi import APIRouter, Query, Response

from app.api.deps import CurrentUser, LLMDep, SessionDep
from app.core.config import get_settings
from app.repositories.chat import ChatRepository
from app.schemas.chat import ChatDetail, ChatMessageRequest, ChatReply, ChatSessionCreate, ChatSessionOut, ChatStatus
from app.services.chat_service import ChatService

router = APIRouter()


@router.get("/status", response_model=ChatStatus)
async def chat_status(user: CurrentUser, llm: LLMDep) -> ChatStatus:
    available = not llm.is_mock
    return ChatStatus(
        available=available, model=get_settings().llm_model if available else None,
        message="模型已配置，可开始对话" if available else "聊天模型尚未连接，请联系管理员配置模型服务。",
    )


@router.get("/sessions", response_model=list[ChatSessionOut])
async def list_sessions(
    user: CurrentUser, session: SessionDep, case_code: str | None = Query(default=None, max_length=64),
) -> list[ChatSessionOut]:
    return await ChatRepository(session).list_sessions(user.id, case_code)


@router.post("/sessions", response_model=ChatSessionOut, status_code=201)
async def create_session(payload: ChatSessionCreate, user: CurrentUser, session: SessionDep) -> ChatSessionOut:
    return await ChatService(session).create(user.id, payload.case_code)


@router.get("/sessions/{session_id}", response_model=ChatDetail)
async def get_session(
    session_id: int, user: CurrentUser, session: SessionDep, before_id: int | None = Query(default=None, gt=0),
) -> ChatDetail:
    return await ChatService(session).detail(user.id, session_id, before_id)


@router.post("/sessions/{session_id}/messages", response_model=ChatReply)
async def send_message(
    session_id: int, payload: ChatMessageRequest, user: CurrentUser, session: SessionDep, llm: LLMDep,
) -> ChatReply:
    return await ChatService(session).reply(user.id, session_id, payload, llm)


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: int, user: CurrentUser, session: SessionDep) -> Response:
    await ChatRepository(session).remove(user.id, session_id)
    return Response(status_code=204)

from datetime import UTC, datetime

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.db.models.archive import ArchiveProgress
from app.db.models.chat import ChatMessage, ChatSession


class ChatRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def owned(self, user_id: int, session_id: int) -> ChatSession:
        conversation = await self.session.scalar(
            select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
        )
        if conversation is None:
            raise NotFoundError("对话不存在或已删除")
        return conversation

    async def list_sessions(self, user_id: int, case_code: str | None = None) -> list[ChatSession]:
        query = select(ChatSession).where(ChatSession.user_id == user_id)
        if case_code:
            query = query.where(ChatSession.case_code == case_code)
        rows = await self.session.scalars(
            query.order_by(ChatSession.updated_at.desc(), ChatSession.id.desc()).limit(100)
        )
        return list(rows)

    async def create(self, user_id: int, case_code: str | None) -> ChatSession:
        conversation = ChatSession(user_id=user_id, case_code=case_code)
        self.session.add(conversation)
        await self.session.commit()
        await self.session.refresh(conversation)
        return conversation

    async def messages(self, session_id: int, limit: int = 51, before_id: int | None = None) -> list[ChatMessage]:
        query = select(ChatMessage).where(ChatMessage.session_id == session_id)
        if before_id is not None:
            query = query.where(ChatMessage.id < before_id)
        rows = await self.session.scalars(query.order_by(ChatMessage.id.desc()).limit(limit))
        return list(reversed(rows.all()))

    async def request_messages(self, session_id: int, request_id: str) -> list[ChatMessage]:
        rows = await self.session.scalars(
            select(ChatMessage)
            .where(
                ChatMessage.session_id == session_id,
                ChatMessage.request_id == request_id,
            )
            .order_by(ChatMessage.id)
        )
        return list(rows)

    async def progress(self, user_id: int, code: str) -> ArchiveProgress | None:
        return await self.session.scalar(
            select(ArchiveProgress).where(
                ArchiveProgress.user_id == user_id,
                ArchiveProgress.case_code == code,
            )
        )

    async def save_reply(
        self,
        conversation: ChatSession,
        version: int,
        content: str,
        answer: str,
        request_id: str,
    ) -> list[ChatMessage]:
        title = content.replace("\n", " ")[:32] if version == 0 else conversation.title
        changed = await self.session.execute(
            update(ChatSession)
            .where(
                ChatSession.id == conversation.id,
                ChatSession.user_id == conversation.user_id,
                ChatSession.version == version,
            )
            .values(title=title, version=version + 1, updated_at=datetime.now(UTC))
        )
        if changed.rowcount != 1:
            await self.session.rollback()
            raise ConflictError("对话已有新回复，请刷新后再发送。")
        rows = [
            ChatMessage(session_id=conversation.id, role="user", content=content, request_id=request_id),
            ChatMessage(session_id=conversation.id, role="assistant", content=answer, request_id=request_id),
        ]
        self.session.add_all(rows)
        await self.session.commit()
        await self.session.refresh(conversation)
        for row in rows:
            await self.session.refresh(row)
        return rows

    async def remove(self, user_id: int, session_id: int) -> None:
        await self.owned(user_id, session_id)
        await self.session.execute(delete(ChatMessage).where(ChatMessage.session_id == session_id))
        await self.session.execute(
            delete(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id,
            )
        )
        await self.session.commit()

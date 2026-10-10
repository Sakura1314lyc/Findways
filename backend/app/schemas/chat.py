from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatSessionCreate(BaseModel):
    case_code: str | None = Field(default=None, max_length=64)


class ChatSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    case_code: str | None
    created_at: datetime
    updated_at: datetime


class ChatMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    request_id: UUID

    @field_validator("content")
    @classmethod
    def content_is_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("请输入消息")
        return value.strip()


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class ChatDetail(BaseModel):
    session: ChatSessionOut
    messages: list[ChatMessageOut]
    has_more: bool


class ChatReply(BaseModel):
    session: ChatSessionOut
    messages: list[ChatMessageOut]


class ChatStatus(BaseModel):
    available: bool
    model: str | None
    message: str

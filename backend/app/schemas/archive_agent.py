from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AgentRequest(BaseModel):
    question: str = Field(default="", max_length=300)
    focus_clue_id: str | None = Field(default=None, max_length=64)


class AgentEvidence(BaseModel):
    id: str
    label: str
    text: str
    source: str
    kind: Literal["archive", "knowledge"]


class AgentTurnOut(BaseModel):
    id: int
    question: str
    answer: str
    stage: Literal["explore", "connect", "reflect"]
    focus_clue_id: str | None
    evidence: list[AgentEvidence]
    tools: list[str]
    mode: Literal["offline", "online"]
    created_at: datetime

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ChapterReport(BaseModel):
    chapter: str
    total: int
    completed: int
    completion_rate: float


class CaseReport(BaseModel):
    case_code: str
    title: str
    chapter: str
    status: Literal["not_started", "in_progress", "completed"]
    note_characters: int
    started_at: datetime | None
    completed_at: datetime | None


class DailyReport(BaseModel):
    date: str
    started: int = 0
    completed: int = 0
    note_characters: int = 0


class ArchiveReport(BaseModel):
    generated_at: datetime
    empty: bool
    total_cases: int
    started_count: int
    completed_count: int
    completion_rate: float
    first_attempt_rate: float | None
    first_attempt_passed: int
    first_attempt_sample: int
    untracked_started_count: int
    note_characters: int
    chapters: list[ChapterReport]
    cases: list[CaseReport]
    timeline: list[DailyReport]
    incomplete: list[CaseReport]
    timezone: str = "Asia/Shanghai"
    summary: str
    commentary: str | None = None
    commentary_mode: Literal["offline", "online"] = "offline"
    recommendations: list[str] = Field(default_factory=list)

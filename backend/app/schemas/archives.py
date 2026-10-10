from pydantic import BaseModel, Field


class CheckRequest(BaseModel):
    order: list[str] | None = Field(default=None, min_length=1, max_length=16)
    rejected: list[str] | None = None
    placements: dict[str, str] | None = None
    reasons: dict[str, str] | None = None


class CompleteRequest(BaseModel):
    reflection: str = Field(min_length=12, max_length=2000)


class GuideRequest(BaseModel):
    question: str = Field(min_length=2, max_length=300)


class ProbeAnswer(BaseModel):
    question: str = Field(min_length=2, max_length=200)
    answer: str = Field(min_length=2, max_length=600)


class ProbeRequest(BaseModel):
    answers: list[ProbeAnswer] = Field(min_length=1, max_length=3)


class TransferRequest(BaseModel):
    option: str = Field(min_length=1, max_length=8)
    reason: str = Field(min_length=4, max_length=400)


class ChainRequest(BaseModel):
    links: dict[str, str] = Field(min_length=1)


class FillRequest(BaseModel):
    answer: str = Field(min_length=2, max_length=600)


class ThreadNoteRequest(BaseModel):
    note: str = Field(min_length=12, max_length=800)


class ThreadMapRequest(BaseModel):
    mapping: dict[str, str] = Field(min_length=1)

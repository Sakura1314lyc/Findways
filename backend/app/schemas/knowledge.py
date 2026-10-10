from pydantic import BaseModel


class KnowledgePointOut(BaseModel):
    id: int
    code: str
    name: str
    chapter: str
    summary: str
    key_points: list
    quotes: list
    sources: list
    tags: list
    misconceptions: list = []
    application: str = ""


class SearchHitOut(BaseModel):
    text: str
    source: str
    kind: str
    kp_codes: list[str]


class KnowledgeSearchOut(BaseModel):
    query: str
    hits: list[SearchHitOut]

import math
from collections import Counter
from dataclasses import dataclass, field

import jieba

from app.db.models.knowledge import KnowledgePoint


def tokenize(text: str) -> list[str]:
    tokens = []
    for token in jieba.lcut(text or ""):
        token = token.strip().lower()
        if len(token) >= 2 or token.isdigit():
            tokens.append(token)
    return tokens


@dataclass
class Chunk:
    text: str
    source: str
    kind: str
    kp_codes: list[str] = field(default_factory=list)


class BM25Index:
    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self.chunks: list[Chunk] = []
        self._tf: list[Counter] = []
        self._len: list[int] = []
        self._avg_len = 1.0
        self._idf: dict[str, float] = {}

    def build(self, chunks: list[Chunk]) -> None:
        self.chunks = chunks
        self._tf = []
        self._len = []
        df: Counter = Counter()
        for chunk in chunks:
            tokens = tokenize(chunk.text)
            self._tf.append(Counter(tokens))
            self._len.append(len(tokens))
            for term in set(tokens):
                df[term] += 1
        self._avg_len = sum(self._len) / max(len(self._len), 1)
        total = len(chunks)
        self._idf = {term: math.log(1 + (total - d + 0.5) / (d + 0.5)) for term, d in df.items()}

    def search(self, query: str, top_k: int = 5, kp_filter: list[str] | None = None) -> list[Chunk]:
        query_terms = tokenize(query)
        if not query_terms:
            return []
        scored: list[tuple[float, Chunk]] = []
        for i, chunk in enumerate(self.chunks):
            if kp_filter and not set(chunk.kp_codes) & set(kp_filter):
                continue
            score = 0.0
            for term in query_terms:
                tf = self._tf[i].get(term, 0)
                if tf == 0 or term not in self._idf:
                    continue
                denom = tf + self.k1 * (1 - self.b + self.b * self._len[i] / self._avg_len)
                score += self._idf[term] * tf * (self.k1 + 1) / denom
            if score > 0:
                scored.append((score, chunk))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [chunk for _, chunk in scored[:top_k]]

    def context(self, query: str, top_k: int = 4, kp_filter: list[str] | None = None) -> str:
        hits = self.search(query, top_k=top_k, kp_filter=kp_filter)
        return "\n".join(f"【{hit.source}】{hit.text}" for hit in hits)


def chunks_from_knowledge(kps: list[KnowledgePoint]) -> list[Chunk]:
    chunks: list[Chunk] = []
    for kp in kps:
        chunks.append(
            Chunk(
                text=f"{kp.name}：{kp.summary}",
                source=f"知识点｜{kp.name}",
                kind="summary",
                kp_codes=[kp.code],
            )
        )
        if kp.key_points:
            chunks.append(
                Chunk(
                    text=f"{kp.name}要点：" + "；".join(kp.key_points),
                    source=f"知识点｜{kp.name}",
                    kind="key_points",
                    kp_codes=[kp.code],
                )
            )
        for quote in kp.quotes or []:
            chunks.append(
                Chunk(
                    text=f"“{quote.get('text', '')}”（{quote.get('source', '')}）",
                    source=quote.get("source", f"知识点｜{kp.name}"),
                    kind="quote",
                    kp_codes=[kp.code],
                )
            )
        if kp.application:
            chunks.append(
                Chunk(
                    text=f"{kp.name}的现实应用：{kp.application}",
                    source=f"知识点｜{kp.name}",
                    kind="application",
                    kp_codes=[kp.code],
                )
            )
        if kp.misconceptions:
            chunks.append(
                Chunk(
                    text=f"{kp.name}常见误区：" + "；".join(kp.misconceptions),
                    source=f"知识点｜{kp.name}",
                    kind="misconception",
                    kp_codes=[kp.code],
                )
            )
    return chunks


class Retriever:
    def __init__(self) -> None:
        self.index = BM25Index()

    def build(self, kps: list[KnowledgePoint]) -> None:
        self.index.build(chunks_from_knowledge(kps))

    def search(self, query: str, top_k: int = 5, kp_filter: list[str] | None = None) -> list[Chunk]:
        return self.index.search(query, top_k=top_k, kp_filter=kp_filter)

    def context(self, query: str, top_k: int = 4, kp_filter: list[str] | None = None) -> str:
        return self.index.context(query, top_k=top_k, kp_filter=kp_filter)


_retriever: Retriever | None = None


def get_retriever() -> Retriever:
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever


async def build_retriever(session) -> Retriever:
    from app.repositories.knowledge import KnowledgeRepository

    retriever = get_retriever()
    kps = await KnowledgeRepository(session).list_all()
    retriever.build(kps)
    return retriever

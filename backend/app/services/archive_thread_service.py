from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError
from app.repositories.archive_thread import ArchiveThreadRepository
from app.services.archive_cards_service import THREADS, all_cards, hidden_card_id, timeline_mode


class ArchiveThreadService:
    def __init__(self, session: AsyncSession) -> None:
        self.notes = ArchiveThreadRepository(session)

    async def overview(self, user_id: int, cases: list[dict], progress_rows: list) -> dict:
        passed = {row.case_code for row in progress_rows if row.clues_solved}
        fill_done = {
            row.case_code
            for row in progress_rows
            if row.clues_solved and (row.detail or {}).get("fill_result")
        }
        buckets = {
            key: {"thread": key, "name": name, "total": 0, "cards": []}
            for key, name in THREADS.items()
        }
        for case in cases:
            if timeline_mode(case):
                continue
            hidden = hidden_card_id(case)
            for card in all_cards(case):
                thread = card.get("thread")
                if thread not in buckets:
                    continue
                buckets[thread]["total"] += 1
                if case["code"] not in passed:
                    continue
                if card["id"] == hidden and case["code"] not in fill_done:
                    continue
                buckets[thread]["cards"].append({
                    "case_code": case["code"],
                    "case_title": case["title"],
                    "case_chapter": case["chapter"],
                    "label": card["label"],
                    "text": card["text"],
                    "source": card["source"],
                })
        notes = {row.thread: row.note for row in await self.notes.list_for(user_id)}
        items = []
        for key, bucket in buckets.items():
            collected = len(bucket["cards"])
            items.append({
                **bucket,
                "collected": collected,
                "unlocked": bucket["total"] > 0 and collected == bucket["total"],
                "note": notes.get(key, ""),
            })
        return {
            "items": items,
            "total_threads": len(items),
            "completed_threads": sum(int(item["unlocked"]) for item in items),
        }

    async def save_note(self, user_id: int, thread: str, note: str) -> dict:
        if thread not in THREADS:
            raise BusinessRuleError("主线不存在")
        row = await self.notes.upsert(user_id, thread, note.strip())
        await self.notes.session.commit()
        return {"thread": thread, "note": row.note}

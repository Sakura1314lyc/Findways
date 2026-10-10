from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.archive import ArchiveProgress
from app.services.archive_cards_service import all_cards


class TeacherService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def overview(self, cases: list[dict], card_limit: int = 200) -> dict:
        rows = list((await self.session.scalars(select(ArchiveProgress))).all())
        case_map = {case["code"]: case for case in cases}
        card_map = {}
        for case in cases:
            for card in all_cards(case):
                card_map[card["id"]] = (case, card)

        students = {row.user_id for row in rows}
        totals = {
            "students": len(students),
            "records": len(rows),
            "attempts": sum(row.attempts or 0 for row in rows),
            "passed": sum(1 for row in rows if row.clues_solved),
            "notes_saved": sum(1 for row in rows if row.completed_at is not None),
            "probe_passed": sum(1 for row in rows if row.probe_passed),
        }

        per_case: dict[str, dict] = defaultdict(lambda: {"students": 0, "attempts": 0, "passed": 0, "notes": 0})
        for row in rows:
            if row.case_code not in case_map:
                continue
            entry = per_case[row.case_code]
            entry["students"] += 1
            entry["attempts"] += row.attempts or 0
            entry["passed"] += int(row.clues_solved)
            entry["notes"] += int(row.completed_at is not None)
        case_rows = []
        for code, entry in per_case.items():
            case = case_map[code]
            case_rows.append({
                "case_code": code,
                "title": case["title"],
                "chapter": case["chapter"],
                "students": entry["students"],
                "attempts": entry["attempts"],
                "passed": entry["passed"],
                "notes": entry["notes"],
                "pass_rate": round(entry["passed"] / entry["students"], 4) if entry["students"] else None,
            })
        case_rows.sort(key=lambda item: (item["pass_rate"] if item["pass_rate"] is not None else 1, item["case_code"]))

        per_card: dict[str, dict] = defaultdict(lambda: {"attempts": 0, "stage": 0, "order": 0, "triage": 0})
        for row in rows:
            detail = row.detail or {}
            for card_id, count in (detail.get("card_attempts") or {}).items():
                per_card[card_id]["attempts"] += count
            for card_id, kinds in (detail.get("card_errors") or {}).items():
                for kind, count in kinds.items():
                    per_card[card_id][kind] = per_card[card_id].get(kind, 0) + count
        card_rows = []
        for card_id, stats in per_card.items():
            if card_id not in card_map or not stats["attempts"]:
                continue
            case, card = card_map[card_id]
            errors = stats["stage"] + stats["order"] + stats["triage"]
            card_rows.append({
                "case_code": case["code"],
                "case_title": case["title"],
                "card_id": card_id,
                "label": card.get("label", ""),
                "attempts": stats["attempts"],
                "errors": errors,
                "error_rate": round(errors / stats["attempts"], 4),
                "stage_errors": stats["stage"],
                "order_errors": stats["order"],
                "triage_errors": stats["triage"],
                "is_distractor": card.get("stage") == "distractor",
            })
        card_rows.sort(key=lambda item: (-item["error_rate"], -item["errors"], item["card_id"]))
        return {
            "totals": totals,
            "cases": case_rows,
            "cards": card_rows[:card_limit],
            "note": "数据为匿名聚合，不含账号信息与笔记正文。",
        }

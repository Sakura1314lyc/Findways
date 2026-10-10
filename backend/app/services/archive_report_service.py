import asyncio
from collections import defaultdict
from datetime import UTC, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.client import LLMPort
from app.repositories.archive_report import ArchiveReportRepository
from app.schemas.archive_report import ArchiveReport, CaseReport, ChapterReport, DailyReport

REPORT_TIMEZONE = timezone(timedelta(hours=8))


def as_utc(value: datetime | None) -> datetime | None:
    return value.replace(tzinfo=UTC) if value and value.tzinfo is None else value


class ArchiveReportService:
    def __init__(self, session: AsyncSession):
        self.repository = ArchiveReportRepository(session)

    def record(self, user_id: int, code: str, kind: str, correct: bool | None = None) -> None:
        self.repository.record(user_id, code, kind, correct)

    async def generate(self, user_id: int, cases: list[dict], llm: LLMPort) -> ArchiveReport:
        codes = {case["code"] for case in cases}
        progress = {row.case_code: row for row in await self.repository.progress_for(user_id) if row.case_code in codes}
        activities = await self.repository.activities_for(user_id)
        tracked = set()
        first_checks = {}
        for activity in activities:
            if activity.case_code not in progress:
                continue
            if activity.kind == "start":
                tracked.add(activity.case_code)
            elif activity.kind == "check" and activity.case_code in tracked:
                first_checks.setdefault(activity.case_code, activity.correct)
        daily: dict[str, DailyReport] = {}
        chapters = defaultdict(lambda: [0, 0])
        items = []
        for case in cases:
            row = progress.get(case["code"])
            completed_at = as_utc(row.completed_at) if row else None
            started_at = as_utc(row.created_at) if row else None
            characters = len("".join(row.reflection.split())) if row else 0
            items.append(CaseReport(
                case_code=case["code"], title=case["title"], chapter=case["chapter"],
                status="completed" if completed_at else "in_progress" if row else "not_started",
                note_characters=characters, started_at=started_at, completed_at=completed_at,
            ))
            chapters[case["chapter"]][0] += 1
            chapters[case["chapter"]][1] += int(completed_at is not None)
            for stamp, field in ((started_at, "started"), (completed_at, "completed")):
                if stamp:
                    day = stamp.astimezone(REPORT_TIMEZONE).date().isoformat()
                    bucket = daily.setdefault(day, DailyReport(date=day))
                    setattr(bucket, field, getattr(bucket, field) + 1)
                    if field == "completed":
                        bucket.note_characters += characters
        done = sum(item.status == "completed" for item in items)
        sample = len(first_checks)
        passed = sum(value is True for value in first_checks.values())
        incomplete = [item for item in items if item.status != "completed"]
        summary = (
            "还没有开启档案，选一份感兴趣的材料开始探索。" if not progress else
            f"已开启 {len(progress)} 份档案，完成 {done} / {len(cases)} 份，"
            f"已保存笔记共 {sum(item.note_characters for item in items)} 字（不含空白）。"
        )
        advice = {}
        pending = next((item for item in incomplete if item.status == "in_progress"), None)
        if pending:
            advice["continue"] = f"可以先继续已开启的《{pending.title}》，完成线索整理和发现笔记。"
        elif incomplete:
            advice["start"] = f"下一份可以探索《{incomplete[0].title}》。"
        if sample and passed < sample:
            advice["revisit"] = f"有 {sample - passed} 份档案的首次排序未通过，可回看历史条件与实践探索的区别。"
        if len(progress) > len(tracked):
            advice["history"] = "部分历史进度缺少完整尝试记录，未计入一次通过率。"
        if done:
            advice["notes"] = "可以回看已保存的笔记，检查每个判断是否有档案材料作为依据。"
        report = ArchiveReport(
            generated_at=datetime.now(UTC), empty=not progress, total_cases=len(cases), started_count=len(progress),
            completed_count=done, completion_rate=done / len(cases) if cases else 0,
            first_attempt_rate=passed / sample if sample else None,
            first_attempt_passed=passed, first_attempt_sample=sample,
            untracked_started_count=len(set(progress) - tracked),
            note_characters=sum(item.note_characters for item in items),
            chapters=[ChapterReport(chapter=chapter, total=total, completed=count, completion_rate=count / total)
                      for chapter, (total, count) in chapters.items()],
            cases=items, timeline=[daily[day] for day in sorted(daily)], incomplete=incomplete,
            summary=summary, recommendations=list(advice.values()),
        )
        if not llm.is_mock and progress and advice:
            try:
                result = await asyncio.wait_for(llm.chat_json(
                    system="你是学习报告辅导员。只依据已提供统计，选择最适合的建议编号。"
                    "不得编造学习行为、能力评价、时长或成绩。仅返回 JSON：{\"recommendation_ids\": [编号]}，"
                    "最多选择两项，禁止生成其他文字。",
                    user=report.model_dump_json(exclude={"cases", "incomplete", "commentary"})
                    + "\n可选建议：" + str(advice),
                    temperature=0.0, max_tokens=160,
                ), timeout=8)
                selected = result.get("recommendation_ids") if isinstance(result, dict) else None
                if (isinstance(selected, list) and 0 < len(selected) <= 2
                        and all(isinstance(key, str) and key in advice for key in selected)):
                    report.commentary = " ".join(advice[key] for key in dict.fromkeys(selected))
                    report.commentary_mode = "online"
            except Exception:
                pass
        return report

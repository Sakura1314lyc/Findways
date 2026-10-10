from datetime import UTC, datetime

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, LLMDep, SessionDep
from app.core.exceptions import BusinessRuleError, NotFoundError
from app.db.models.archive import ArchiveProgress
from app.schemas.archive_agent import AgentRequest, AgentTurnOut
from app.schemas.archive_report import ArchiveReport
from app.schemas.archives import (
    ChainRequest,
    CheckRequest,
    CompleteRequest,
    FillRequest,
    GuideRequest,
    ProbeRequest,
    ThreadMapRequest,
    ThreadNoteRequest,
    TransferRequest,
)
from app.services.archive_agent_service import ArchiveAgentService
from app.services.archive_cards_service import (
    cards_mode,
    case_cards,
    grade_chain,
    grade_fill,
    grade_probe,
    grade_thread_map,
    grade_transfer,
    hint_for,
    public_case,
    score_placements,
    score_timeline,
    timeline_mode,
)
from app.services.archive_loader import load_cases
from app.services.archive_report_service import ArchiveReportService
from app.services.archive_thread_service import ArchiveThreadService

router = APIRouter()
ROLES = ("context", "practice", "theory")


def _case(code: str) -> dict:
    case = next((item for item in load_cases() if item["code"] == code), None)
    if case is None:
        raise NotFoundError("档案不存在")
    return case


async def _progress(session: SessionDep, user_id: int, code: str) -> ArchiveProgress | None:
    return await session.scalar(
        select(ArchiveProgress).where(ArchiveProgress.user_id == user_id, ArchiveProgress.case_code == code)
    )


def _progress_out(row: ArchiveProgress) -> dict:
    case = _case(row.case_code)
    detail = row.detail or {}
    payload = {
        "case_code": row.case_code,
        "clues_solved": row.clues_solved,
        "reflection": row.reflection,
        "completed_at": row.completed_at,
        "created_at": row.created_at,
        "attempts": row.attempts,
        "hints_used": row.hints_used,
        "best_score": row.best_score,
        "passed_at": row.passed_at,
        "probe_passed": row.probe_passed,
        "placements": detail.get("last_placements") or {},
        "probe_results": detail.get("probe_results") or [],
        "transfer_result": detail.get("transfer_result"),
        "chain_result": detail.get("chain_result"),
        "fill_result": detail.get("fill_result"),
        "timeline_result": detail.get("last_timeline"),
        "thread_map_result": detail.get("thread_map_result"),
        "submitted_order": detail.get("last_order") or [],
        "submitted_rejected": detail.get("last_rejected") or [],
    }
    if not cards_mode(case):
        clues = case.get("clues") or []
        payload["clue_order"] = [
            next(clue["id"] for clue in clues if clue["role"] == role) for role in ROLES
        ] if row.clues_solved else []
    return payload


def _merge_detail(row: ArchiveProgress, **updates) -> None:
    row.detail = {**(row.detail or {}), **updates}


@router.get("/cases")
async def list_cases() -> list[dict]:
    return [public_case(case) for case in load_cases()]


@router.get("/progress")
async def list_progress(user: CurrentUser, session: SessionDep) -> dict:
    rows = (await session.scalars(select(ArchiveProgress).where(ArchiveProgress.user_id == user.id))).all()
    return {
        "total_cases": len(load_cases()),
        "completed_count": sum(row.completed_at is not None for row in rows),
        "items": [_progress_out(row) for row in rows],
    }


@router.get("/report", response_model=ArchiveReport)
async def get_report(user: CurrentUser, session: SessionDep, llm: LLMDep) -> ArchiveReport:
    return await ArchiveReportService(session).generate(user.id, load_cases(), llm)


@router.get("/cases/{code}")
async def get_case(code: str, user: CurrentUser, session: SessionDep) -> dict:
    case = _case(code)
    row = await _progress(session, user.id, code)
    unlocked = bool(row and row.clues_solved)
    fill_done = bool(unlocked and (row.detail or {}).get("fill_result"))
    return public_case(case, detail=True, unlocked=unlocked, fill_done=fill_done)


@router.post("/cases/{code}/start")
async def start_case(code: str, user: CurrentUser, session: SessionDep) -> dict:
    _case(code)
    user_id = user.id
    row = await _progress(session, user_id, code)
    if row is None:
        row = ArchiveProgress(user_id=user_id, case_code=code, clues_solved=False, reflection="")
        session.add(row)
        ArchiveReportService(session).record(user_id, code, "start")
        try:
            await session.commit()
            await session.refresh(row)
        except IntegrityError:
            await session.rollback()
            row = await _progress(session, user_id, code)
            if row is None:
                raise
    return _progress_out(row)


@router.post("/cases/{code}/check")
async def check_case(code: str, payload: CheckRequest, user: CurrentUser, session: SessionDep) -> dict:
    case = _case(code)
    row = await _progress(session, user.id, code)
    if row is None:
        raise BusinessRuleError("请先打开档案")
    if timeline_mode(case):
        return await _check_timeline(case, row, payload, user.id, session)
    if cards_mode(case):
        return await _check_cards(case, row, payload, user.id, session)
    return await _check_legacy(case, row, payload, user.id, session)


def _accumulate_card_stats(row: ArchiveProgress, cards: list[dict], mistakes: list[dict]) -> None:
    detail = row.detail or {}
    attempts = dict(detail.get("card_attempts") or {})
    errors = {key: dict(value) for key, value in (detail.get("card_errors") or {}).items()}
    for card in cards:
        attempts[card["id"]] = attempts.get(card["id"], 0) + 1
    for mistake in mistakes:
        entry = errors.setdefault(mistake["id"], {})
        kind = mistake.get("kind", "stage")
        entry[kind] = entry.get(kind, 0) + 1
    row.detail = {**detail, "card_attempts": attempts, "card_errors": errors}


async def _check_timeline(
    case: dict, row: ArchiveProgress, payload: CheckRequest, user_id: int, session: SessionDep,
) -> dict:
    result = score_timeline(case, payload.order or [], payload.rejected or [], payload.reasons or {})
    row.attempts = (row.attempts or 0) + 1
    row.best_score = max(row.best_score or 0.0, result["score"])
    if result["passed"] and not row.clues_solved:
        row.clues_solved = True
        row.passed_at = datetime.now(UTC)
    _accumulate_card_stats(row, case_cards(case), result["mistakes"])
    _merge_detail(
        row,
        last_timeline=result,
        last_order=payload.order or [],
        last_rejected=payload.rejected or [],
        last_reasons=payload.reasons or {},
        last_result=result,
    )
    ArchiveReportService(session).record(user_id, case["code"], "check", result["passed"])
    await session.commit()
    remaining = max(len(case.get("hints") or []) - (row.hints_used or 0), 0)
    if result["passed"]:
        hint = "时间轴已经排好，可以阅读理论卡，并完成主线归位。"
    else:
        hint = hint_for(case, row.hints_used or 0)["hint"]
    return {
        **result,
        "hint": hint,
        "hint_remaining": remaining,
        "attempts": row.attempts,
        "best_score": row.best_score,
        "hints_used": row.hints_used,
    }


async def _check_cards(
    case: dict, row: ArchiveProgress, payload: CheckRequest, user_id: int, session: SessionDep,
) -> dict:
    if not payload.placements:
        raise BusinessRuleError("请为每张档案卡选择归属后再核对")
    reasons = payload.reasons or {}
    missing_reasons = [
        card_id
        for card_id, value in payload.placements.items()
        if value == "reject" and len((reasons.get(card_id) or "").strip()) < 4
    ]
    if missing_reasons:
        raise BusinessRuleError("标记为「不属于本关」的卡片需要写明剔除理由（至少 4 个字）")
    result = score_placements(case, payload.placements)
    row.attempts = (row.attempts or 0) + 1
    row.best_score = max(row.best_score or 0.0, result["score"])
    if result["passed"] and not row.clues_solved:
        row.clues_solved = True
        row.passed_at = datetime.now(UTC)
    _accumulate_card_stats(row, case_cards(case), result["mistakes"])
    _merge_detail(row, last_placements=payload.placements, last_reasons=reasons, last_result=result)
    ArchiveReportService(session).record(user_id, case["code"], "check", result["passed"])
    await session.commit()
    remaining = max(len(case.get("hints") or []) - (row.hints_used or 0), 0)
    if result["passed"]:
        hint = "线索已经全部归位，可以阅读理论形成卡，并完成通关追问与迁移任务。"
    else:
        hint = hint_for(case, row.hints_used or 0)["hint"]
    return {
        **result,
        "hint": hint,
        "hint_remaining": remaining,
        "attempts": row.attempts,
        "best_score": row.best_score,
        "hints_used": row.hints_used,
    }


async def _check_legacy(
    case: dict, row: ArchiveProgress, payload: CheckRequest, user_id: int, session: SessionDep,
) -> dict:
    clues = case.get("clues") or []
    expected = [next(clue["id"] for clue in clues if clue["role"] == role) for role in ROLES]
    order = payload.order or []
    if len(set(order)) != 3 or set(order) != set(expected):
        raise BusinessRuleError("请把三张不同的档案卡都放进线索板")
    correct = order == expected
    row.attempts = (row.attempts or 0) + 1
    if not row.clues_solved:
        ArchiveReportService(session).record(user_id, case["code"], "check", correct)
        if correct:
            row.clues_solved = True
            row.passed_at = datetime.now(UTC)
        await session.commit()
    first_wrong = next(
        (index for index, (actual, wanted) in enumerate(zip(order, expected, strict=True)) if actual != wanted),
        0,
    )
    hints = ("先找描述当时历史条件的卡片。", "接着找记录实践探索的卡片。", "最后找理论认识逐步形成的卡片。")
    return {
        "mode": "order",
        "correct": correct,
        "passed": correct,
        "attempts": row.attempts,
        "hint": "三条线索已经连起来了，可以整理理论形成卡。" if correct else hints[first_wrong],
    }


@router.post("/cases/{code}/hint")
async def request_hint(code: str, user: CurrentUser, session: SessionDep) -> dict:
    case = _case(code)
    row = await _progress(session, user.id, code)
    if row is None:
        raise BusinessRuleError("请先打开档案")
    if row.clues_solved:
        return {
            "hint": "本关线索已全部归位，提示不再需要。",
            "remaining": 0,
            "exhausted": True,
            "hints_used": row.hints_used,
        }
    result = hint_for(case, row.hints_used or 0)
    if not result["exhausted"]:
        row.hints_used = (row.hints_used or 0) + 1
        await session.commit()
    return {**result, "hints_used": row.hints_used}


@router.post("/cases/{code}/probe")
async def submit_probe(code: str, payload: ProbeRequest, user: CurrentUser, session: SessionDep) -> dict:
    case = _case(code)
    row = await _progress(session, user.id, code)
    if row is None or not row.clues_solved:
        raise BusinessRuleError("请先完成线索整理")
    probes = case.get("probes") or []
    known = {probe["question"]: probe for probe in probes}
    results = []
    for item in payload.answers:
        probe = known.get(item.question)
        if probe is None:
            raise BusinessRuleError("存在不属于本关的通关追问")
        results.append(grade_probe(probe, item.answer))
    answered = {item.question for item in payload.answers}
    complete = answered == set(known) and len(known) > 0
    probe_passed = complete and all(result["correct"] for result in results)
    _merge_detail(row, probe_results=results)
    row.probe_passed = probe_passed
    await session.commit()
    return {"results": results, "probe_passed": probe_passed, "answered_all": complete}


@router.post("/cases/{code}/transfer")
async def submit_transfer(code: str, payload: TransferRequest, user: CurrentUser, session: SessionDep) -> dict:
    case = _case(code)
    row = await _progress(session, user.id, code)
    if row is None or not row.clues_solved:
        raise BusinessRuleError("请先完成线索整理")
    result = grade_transfer(case, payload.option)
    _merge_detail(row, transfer_result={**result, "option": payload.option, "reason": payload.reason})
    await session.commit()
    return result


@router.post("/cases/{code}/chain")
async def submit_chain(code: str, payload: ChainRequest, user: CurrentUser, session: SessionDep) -> dict:
    case = _case(code)
    row = await _progress(session, user.id, code)
    if row is None or not row.clues_solved:
        raise BusinessRuleError("请先完成线索整理")
    result = grade_chain(case, payload.links)
    _merge_detail(row, chain_result=result)
    await session.commit()
    return result


@router.post("/cases/{code}/fill")
async def submit_fill(code: str, payload: FillRequest, user: CurrentUser, session: SessionDep) -> dict:
    case = _case(code)
    row = await _progress(session, user.id, code)
    if row is None or not row.clues_solved:
        raise BusinessRuleError("请先完成线索整理")
    result = grade_fill(case, payload.answer)
    _merge_detail(row, fill_result=result)
    await session.commit()
    return result


@router.get("/threads")
async def list_threads(user: CurrentUser, session: SessionDep) -> dict:
    rows = (await session.scalars(select(ArchiveProgress).where(ArchiveProgress.user_id == user.id))).all()
    return await ArchiveThreadService(session).overview(user.id, load_cases(), list(rows))


@router.post("/threads/{thread}/note")
async def save_thread_note(
    thread: str, payload: ThreadNoteRequest, user: CurrentUser, session: SessionDep,
) -> dict:
    return await ArchiveThreadService(session).save_note(user.id, thread, payload.note)


@router.post("/cases/{code}/thread-map")
async def submit_thread_map(
    code: str, payload: ThreadMapRequest, user: CurrentUser, session: SessionDep,
) -> dict:
    case = _case(code)
    row = await _progress(session, user.id, code)
    if row is None or not row.clues_solved:
        raise BusinessRuleError("请先完成线索整理")
    result = grade_thread_map(case, payload.mapping)
    _merge_detail(row, thread_map_result=result)
    await session.commit()
    return result


@router.post("/cases/{code}/complete")
async def complete_case(code: str, payload: CompleteRequest, user: CurrentUser, session: SessionDep) -> dict:
    _case(code)
    row = await _progress(session, user.id, code)
    if row is None or not row.clues_solved:
        raise BusinessRuleError("请先完成线索整理")
    reflection = payload.reflection.strip()
    if len(reflection) < 12:
        raise BusinessRuleError("发现笔记至少需要 12 个字")
    row.reflection = reflection
    if row.completed_at is None:
        row.completed_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(row)
    return _progress_out(row)


@router.post("/cases/{code}/guide")
async def guide(code: str, payload: GuideRequest, user: CurrentUser, session: SessionDep, llm: LLMDep) -> dict:
    case = _case(code)
    if await _progress(session, user.id, code) is None:
        raise BusinessRuleError("请先打开档案")
    question = payload.question.strip()
    if not question:
        raise BusinessRuleError("请输入想探究的问题")
    cards = "\n".join(f"- {item['label']}：{item['text']}（{item['source']}）" for item in case_cards(case))
    fallback = "可以先想一想：" + case["guide_questions"][0] + " 再从档案卡中找依据。"
    if llm.is_mock:
        return {"answer": fallback, "mode": "offline"}
    try:
        answer = await llm.chat(
            system="你是毛概课程的档案探究引导员。只依据用户提供的档案内容回答，不编造史料、引文或结论。用中文回答，最多120字，以启发式问题和材料线索引导学生，不直接代写发现笔记。",
            user=f"关卡：{case['title']}\n档案：\n{cards}\n学生问题：{question}",
            temperature=0.3,
            max_tokens=220,
        )
        return {"answer": answer, "mode": "online"}
    except Exception:
        return {"answer": fallback, "mode": "offline"}


@router.get("/cases/{code}/agent/history", response_model=list[AgentTurnOut])
async def agent_history(code: str, user: CurrentUser, session: SessionDep) -> list[AgentTurnOut]:
    case = _case(code)
    row = await _progress(session, user.id, code)
    return await ArchiveAgentService(session).history(user.id, case, bool(row and row.clues_solved))


@router.post("/cases/{code}/agent", response_model=AgentTurnOut)
async def investigate_case(
    code: str, payload: AgentRequest, user: CurrentUser, session: SessionDep, llm: LLMDep,
) -> AgentTurnOut:
    case = _case(code)
    row = await _progress(session, user.id, code)
    if row is None:
        raise BusinessRuleError("请先打开档案")
    return await ArchiveAgentService(session).investigate(user.id, case, row, payload, llm)

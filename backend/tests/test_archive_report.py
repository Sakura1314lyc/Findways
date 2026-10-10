from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from app.api.deps import get_llm_dep
from app.db.models.archive import ArchiveProgress
from app.db.session import SessionLocal
from app.main import app
from tests.test_archives import CASES, check_payload, timeline_payload


async def solve(client, case, wrong=False):
    path = f"/api/v1/archives/cases/{case['code']}"
    assert (await client.post(path + "/start")).status_code == 200
    if case.get("mode") == "timeline":
        if wrong:
            assert not (await client.post(path + "/check", json=timeline_payload(case, wrong=True))).json()["correct"]
        assert (await client.post(path + "/check", json=timeline_payload(case))).json()["correct"]
        assert (await client.post(path + "/check", json=timeline_payload(case))).json()["correct"]
    else:
        if wrong:
            assert not (await client.post(path + "/check", json=check_payload(case, wrong=True))).json()["correct"]
        assert (await client.post(path + "/check", json=check_payload(case))).json()["correct"]
        assert (await client.post(path + "/check", json=check_payload(case))).json()["correct"]
    note = " 我从历史条件和实践探索中理解理论的形成，并尝试用自己的话记录发现。 \n"
    result = await client.post(path + "/complete", json={"reflection": note})
    assert result.status_code == 200
    return len("".join(note.split()))


async def test_report_empty_and_requires_auth(client, auth_client):
    response = await auth_client.get("/api/v1/archives/report")
    assert response.status_code == 200
    report = response.json()
    assert report["empty"] and report["completed_count"] == report["note_characters"] == 0
    assert report["timeline"] == [] and report["first_attempt_rate"] is None
    assert report["total_cases"] == len(report["incomplete"]) == len(CASES)
    assert report["commentary_mode"] == "offline"
    client.headers.clear()
    assert (await client.get("/api/v1/archives/report")).status_code == 401
    assert (await client.get("/api/v1/archives/cases/seek_truth")).status_code == 401


async def test_report_partial_and_first_attempt_denominator(auth_client):
    count = await solve(auth_client, CASES[0], wrong=True)
    count += await solve(auth_client, CASES[1])
    await auth_client.post(f"/api/v1/archives/cases/{CASES[2]['code']}/start")
    invalid = await auth_client.post(f"/api/v1/archives/cases/{CASES[2]['code']}/check", json={"order": ["x"] * 3})
    assert invalid.status_code == 422
    report = (await auth_client.get("/api/v1/archives/report")).json()
    assert not report["empty"] and report["started_count"] == 3
    assert report["completed_count"] == 2 and report["completion_rate"] == pytest.approx(2 / len(CASES))
    assert report["first_attempt_rate"] == 0.5
    assert report["first_attempt_sample"] == 2 and report["first_attempt_passed"] == 1
    assert report["untracked_started_count"] == 0
    assert report["note_characters"] == count and len(report["incomplete"]) == len(CASES) - 2
    assert sum(day["completed"] for day in report["timeline"]) == 2
    assert sum(day["started"] for day in report["timeline"]) == 3
    assert sum(day["note_characters"] for day in report["timeline"]) == count
    assert sum(chapter["completed"] for chapter in report["chapters"]) == 2


async def test_report_all_completed(auth_client):
    count = 0
    for case in CASES:
        count += await solve(auth_client, case)
    report = (await auth_client.get("/api/v1/archives/report")).json()
    assert report["completed_count"] == report["first_attempt_sample"] == len(CASES)
    assert report["completion_rate"] == report["first_attempt_rate"] == 1
    assert report["note_characters"] == count and report["incomplete"] == []
    assert all(item["completion_rate"] == 1 for item in report["chapters"])


async def test_report_historical_attempts_unknown_and_local_date(auth_client):
    user_id = (await auth_client.get("/api/v1/auth/me")).json()["id"]
    async with SessionLocal() as session:
        session.add(ArchiveProgress(
            user_id=user_id, case_code=CASES[0]["code"], clues_solved=True,
            reflection="历史记录没有尝试次数，不能算作一次通过。",
            created_at=datetime(2026, 9, 20, 16, 30, tzinfo=UTC),
            completed_at=datetime(2026, 9, 21, 17, 30, tzinfo=UTC),
        ))
        session.add(ArchiveProgress(user_id=user_id, case_code=CASES[1]["code"], clues_solved=False, reflection=""))
        await session.commit()
    await solve(auth_client, CASES[1])
    report = (await auth_client.get("/api/v1/archives/report")).json()
    assert report["first_attempt_rate"] is None and report["untracked_started_count"] == 2
    assert report["first_attempt_sample"] == 0
    assert next(day for day in report["timeline"] if day["date"] == "2026-09-21")["started"] == 1
    assert next(day for day in report["timeline"] if day["date"] == "2026-09-22")["completed"] == 1


@pytest.mark.parametrize("response,online", [
    ({"recommendation_ids": ["notes"]}, True),
    ({"recommendation_ids": ["studied_for_100_hours"]}, False),
    ({"commentary": "已学习100小时"}, False),
    (RuntimeError("unavailable"), False),
])
async def test_report_llm_is_grounded_and_failure_falls_back(auth_client, response, online):
    await solve(auth_client, CASES[0])
    llm = AsyncMock()
    llm.is_mock = False
    if isinstance(response, Exception):
        llm.chat_json.side_effect = response
    else:
        llm.chat_json.return_value = response
    app.dependency_overrides[get_llm_dep] = lambda: llm
    try:
        result = await auth_client.get("/api/v1/archives/report")
        assert result.status_code == 200
        report = result.json()
        assert report["commentary_mode"] == ("online" if online else "offline")
        assert "100" not in (report["commentary"] or "")
        assert bool(report["commentary"]) == online
        assert "我从历史条件" not in llm.chat_json.call_args.kwargs["user"]
    finally:
        app.dependency_overrides.pop(get_llm_dep, None)

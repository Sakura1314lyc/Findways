from unittest.mock import AsyncMock

import pytest

from app.api.deps import get_llm_dep
from app.main import app
from tests.conftest import unique_account
from tests.test_archives import case_by_code, check_payload

PATH = "/api/v1/archives/cases/rural_road"
CASE = case_by_code("rural_road")


async def test_agent_observes_selects_evidence_remembers_and_changes_stage(auth_client):
    assert (await auth_client.post(PATH + "/agent", json={})).status_code == 422
    assert (await auth_client.post(PATH + "/start")).status_code == 200
    invalid = await auth_client.post(PATH + "/agent", json={"focus_clue_id": "other_case"})
    assert invalid.status_code == 422

    first = (await auth_client.post(PATH + "/agent", json={})).json()
    assert first["stage"] == "explore" and first["mode"] == "offline"
    assert first["tools"] == ["核对学习阶段", "查阅档案卡"]
    assert len(first["evidence"]) == 1 and first["evidence"][0]["kind"] == "archive"
    assert first["evidence"][0]["source"] and first["focus_clue_id"] == first["evidence"][0]["id"]
    assert "theory_summary" not in str(first) and "guide_questions" not in str(first)
    assert "reflection_prompt" not in str(first) and "reject_reason" not in str(first)

    second = (await auth_client.post(PATH + "/agent", json={})).json()
    assert second["focus_clue_id"] != first["focus_clue_id"]
    focused = (await auth_client.post(PATH + "/agent", json={
        "question": "这张卡与道路有什么关系？", "focus_clue_id": "rural_c2",
    })).json()
    assert focused["focus_clue_id"] == "rural_c2"
    history = (await auth_client.get(PATH + "/agent/history")).json()
    assert [turn["id"] for turn in history] == [first["id"], second["id"], focused["id"]]
    assert history[-1]["question"] == "这张卡与道路有什么关系？"

    await auth_client.post(PATH + "/check", json=check_payload(CASE, wrong=True))
    corrected = (await auth_client.post(PATH + "/agent", json={})).json()
    assert corrected["stage"] == "explore"
    assert corrected["tools"] == ["核对学习阶段", "查阅档案卡"]
    await auth_client.post(PATH + "/check", json=check_payload(CASE))
    linked = (await auth_client.post(PATH + "/agent", json={"question": "道路理论怎么形成？"})).json()
    assert linked["stage"] == "connect"
    assert {item["kind"] for item in linked["evidence"]} == {"archive", "knowledge"}
    assert "检索理论手册" in linked["tools"]
    assert all(item["source"] for item in linked["evidence"])
    await auth_client.post(PATH + "/complete", json={"reflection": "农村根据地的探索回应了当时革命面临的具体问题。"})
    reflected = (await auth_client.post(PATH + "/agent", json={})).json()
    assert reflected["stage"] == "reflect" and "笔记" in reflected["answer"]
    assert "农村根据地的探索回应" not in str(reflected)


async def test_agent_history_is_isolated(client):
    tokens = []
    for _ in range(2):
        response = await client.post("/api/v1/auth/register", json=unique_account())
        tokens.append(response.json()["access_token"])
    headers_a = {"Authorization": "Bearer " + tokens[0]}
    headers_b = {"Authorization": "Bearer " + tokens[1]}
    await client.post(PATH + "/start", headers=headers_a)
    await client.post(PATH + "/agent", headers=headers_a, json={"question": "我的问题只属于账号A"})
    assert (await client.get(PATH + "/agent/history", headers=headers_b)).json() == []
    assert (await client.post(PATH + "/agent", headers=headers_b, json={})).status_code == 422
    await client.post(PATH + "/start", headers=headers_b)
    assert (await client.get(PATH + "/agent/history", headers=headers_b)).json() == []


async def test_agent_keeps_rotating_after_history_window(auth_client):
    await auth_client.post(PATH + "/start")
    focuses = []
    for _ in range(10):
        result = await auth_client.post(PATH + "/agent", json={})
        assert result.status_code == 200
        focuses.append(result.json()["focus_clue_id"])
    assert all(focuses[index] != focuses[index + 1] for index in range(len(focuses) - 1))
    assert len((await auth_client.get(PATH + "/agent/history")).json()) == 8


@pytest.mark.parametrize("plan,online", [
    ({"tool": "archive_card", "id": "rural_c3", "question_style": 1}, True),
    ({"tool": "knowledge_point", "id": "kp_rural_road", "question_style": 0}, False),
    ({"tool": "archive_card", "id": "rural_c3", "question_style": 100}, False),
    (RuntimeError("model unavailable"), False),
])
async def test_agent_validates_model_plan_and_falls_back(auth_client, plan, online):
    await auth_client.post(PATH + "/start")
    llm = AsyncMock()
    llm.is_mock = False
    if isinstance(plan, Exception):
        llm.chat_json.side_effect = plan
    else:
        llm.chat_json.return_value = plan
    app.dependency_overrides[get_llm_dep] = lambda: llm
    try:
        response = await auth_client.post(PATH + "/agent", json={"question": "道路怎样形成？"})
        assert response.status_code == 200
        turn = response.json()
        assert turn["mode"] == ("online" if online else "offline")
        assert len(turn["evidence"]) == 1 and turn["stage"] == "explore"
        assert "theory_summary" not in str(turn) and "guide_questions" not in str(turn)
        assert "guide_questions" not in llm.chat_json.call_args.kwargs["user"]
        assert "reject_reason" not in llm.chat_json.call_args.kwargs["user"]
    finally:
        app.dependency_overrides.pop(get_llm_dep, None)

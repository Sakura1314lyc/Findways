import asyncio
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.api.deps import get_llm_dep
from app.main import app
from tests.conftest import unique_account
from tests.test_archives import case_by_code, check_payload

PATH = "/api/v1/chat"


@pytest.fixture
def model():
    llm = AsyncMock()
    llm.is_mock = False
    llm.chat_messages.return_value = "可以先休息十分钟，再把复习任务分成三小段。"
    app.dependency_overrides[get_llm_dep] = lambda: llm
    yield llm
    app.dependency_overrides.pop(get_llm_dep, None)


def message(content="今天有点累，能聊聊吗？", request_id=None):
    return {"content": content, "request_id": request_id or str(uuid4())}


async def new_session(client, case_code=None):
    response = await client.post(PATH + "/sessions", json={"case_code": case_code})
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def test_general_chat_generates_answers_remembers_and_retries_once(auth_client, model):
    session_id = await new_session(auth_client)
    status = (await auth_client.get(PATH + "/status")).json()
    assert status["available"] and "api_key" not in str(status)
    payload = message()
    first = await auth_client.post(f"{PATH}/sessions/{session_id}/messages", json=payload)
    assert first.status_code == 200, first.text
    assert [row["role"] for row in first.json()["messages"]] == ["user", "assistant"]
    assert first.json()["messages"][1]["content"] == model.chat_messages.return_value
    duplicate = await auth_client.post(f"{PATH}/sessions/{session_id}/messages", json=payload)
    assert duplicate.json() == first.json() and model.chat_messages.await_count == 1
    changed = await auth_client.post(
        f"{PATH}/sessions/{session_id}/messages", json={**payload, "content": "另一条消息"}
    )
    assert changed.status_code == 409
    await auth_client.post(f"{PATH}/sessions/{session_id}/messages", json=message("那第三段安排什么？"))
    sent = model.chat_messages.call_args.args[0]
    assert [item["role"] for item in sent] == ["system", "user", "assistant", "user"]
    assert sent[1]["content"] == payload["content"] and sent[2]["content"] == model.chat_messages.return_value
    history = (await auth_client.get(f"{PATH}/sessions/{session_id}")).json()
    assert len(history["messages"]) == 4 and history["has_more"] is False
    listed = (await auth_client.get(PATH + "/sessions")).json()
    assert listed[0]["title"] == payload["content"] and listed[0]["case_code"] is None


async def test_chat_records_are_account_scoped(client, model):
    tokens = []
    for _ in range(2):
        response = await client.post("/api/v1/auth/register", json=unique_account())
        tokens.append(response.json()["access_token"])
    owner = {"Authorization": "Bearer " + tokens[0]}
    other = {"Authorization": "Bearer " + tokens[1]}
    created = await client.post(PATH + "/sessions", headers=owner, json={})
    session_id = created.json()["id"]
    await client.post(f"{PATH}/sessions/{session_id}/messages", headers=owner, json=message("只属于我的对话"))
    assert (await client.get(PATH + "/sessions", headers=other)).json() == []
    assert (await client.get(f"{PATH}/sessions/{session_id}", headers=other)).status_code == 404
    assert (
        await client.post(f"{PATH}/sessions/{session_id}/messages", headers=other, json=message())
    ).status_code == 404
    assert (await client.delete(f"{PATH}/sessions/{session_id}", headers=other)).status_code == 404
    assert model.chat_messages.await_count == 1
    assert (await client.delete(f"{PATH}/sessions/{session_id}", headers=owner)).status_code == 204
    assert (await client.get(f"{PATH}/sessions/{session_id}", headers=owner)).status_code == 404
    assert (await client.get(PATH + "/sessions", headers=owner)).json() == []


async def test_chat_requires_login(client):
    client.headers.clear()
    assert (await client.get(PATH + "/status")).status_code == 401
    assert (await client.get(PATH + "/sessions")).status_code == 401
    assert (await client.post(PATH + "/sessions", json={})).status_code == 401
    assert (await client.get(PATH + "/sessions/1")).status_code == 401
    assert (await client.post(PATH + "/sessions/1/messages", json=message())).status_code == 401
    assert (await client.delete(PATH + "/sessions/1")).status_code == 401


async def test_chat_without_model_is_explicit_and_does_not_save_a_fake_reply(auth_client):
    session_id = await new_session(auth_client)
    assert (await auth_client.get(PATH + "/status")).json()["available"] is False
    result = await auth_client.post(f"{PATH}/sessions/{session_id}/messages", json=message())
    assert result.status_code == 502 and "尚未连接" in result.text
    assert (await auth_client.get(f"{PATH}/sessions/{session_id}")).json()["messages"] == []


@pytest.mark.parametrize("reply", [RuntimeError("private-key-do-not-expose"), "", "  ", None])
async def test_chat_failure_is_recoverable_and_does_not_leak_provider_errors(auth_client, model, reply):
    session_id = await new_session(auth_client)
    if isinstance(reply, Exception):
        model.chat_messages.side_effect = reply
    else:
        model.chat_messages.return_value = reply
    payload = message()
    result = await auth_client.post(f"{PATH}/sessions/{session_id}/messages", json=payload)
    assert result.status_code == 502 and "private-key" not in result.text
    assert (await auth_client.get(f"{PATH}/sessions/{session_id}")).json()["messages"] == []
    model.chat_messages.side_effect = None
    model.chat_messages.return_value = "现在可以继续聊了。"
    retry = await auth_client.post(f"{PATH}/sessions/{session_id}/messages", json=payload)
    assert retry.status_code == 200 and len(retry.json()["messages"]) == 2


async def test_chat_case_context_uses_visible_material_and_does_not_send_private_notes(auth_client, model):
    case = case_by_code("rural_road")
    await auth_client.post("/api/v1/archives/cases/rural_road/start")
    session_id = await new_session(auth_client, "rural_road")
    await auth_client.post(f"{PATH}/sessions/{session_id}/messages", json=message("为什么不能照搬城市中心道路？"))
    sent = model.chat_messages.call_args.args[0][0]["content"]
    assert case["title"] in sent and case["theory_summary"] not in sent
    assert "guide_questions" not in sent and "reject_reason" not in sent and "reflection_prompt" not in sent
    hidden = next(card for card in case["cards"] if card["id"] == case["fill_blank"]["card_id"])
    assert hidden["text"] not in sent
    await auth_client.post("/api/v1/archives/cases/rural_road/check", json=check_payload(case))
    await auth_client.post(
        "/api/v1/archives/cases/rural_road/complete", json={"reflection": "这是一条私人笔记，不发送给外部模型。"}
    )
    await auth_client.post(f"{PATH}/sessions/{session_id}/messages", json=message("再解释一下这项理论"))
    sent = model.chat_messages.call_args.args[0][0]["content"]
    assert case["theory_summary"] in sent and "这是一条私人笔记" not in sent
    assert len((await auth_client.get(PATH + "/sessions?case_code=rural_road")).json()) == 1
    assert (await auth_client.get(PATH + "/sessions?case_code=seek_truth")).json() == []
    assert (await auth_client.post(PATH + "/sessions", json={"case_code": "unknown"})).status_code == 404


async def test_chat_input_and_history_pagination(auth_client, model):
    session_id = await new_session(auth_client)
    for value in ["", "   ", "a" * 4001]:
        assert (
            await auth_client.post(f"{PATH}/sessions/{session_id}/messages", json=message(value))
        ).status_code == 422
    assert model.chat_messages.await_count == 0
    for index in range(26):
        response = await auth_client.post(f"{PATH}/sessions/{session_id}/messages", json=message(f"第{index}次提问"))
        assert response.status_code == 200
    assert len(model.chat_messages.call_args.args[0]) == 14
    page = (await auth_client.get(f"{PATH}/sessions/{session_id}")).json()
    assert len(page["messages"]) == 50 and page["has_more"]
    oldest = page["messages"][0]["id"]
    previous = (await auth_client.get(f"{PATH}/sessions/{session_id}?before_id={oldest}")).json()
    assert len(previous["messages"]) == 2 and not previous["has_more"]
    assert previous["messages"][-1]["id"] < oldest


async def test_simultaneous_messages_do_not_mix_history(auth_client, model):
    session_id = await new_session(auth_client)
    ready = asyncio.Event()
    count = 0

    async def respond(*args, **kwargs):
        nonlocal count
        count += 1
        if count == 2:
            ready.set()
        await asyncio.wait_for(ready.wait(), timeout=5)
        return "一条完整回复"

    model.chat_messages.side_effect = respond
    results = await asyncio.gather(
        *[
            auth_client.post(f"{PATH}/sessions/{session_id}/messages", json=message(f"同时发送{index}"))
            for index in range(2)
        ]
    )
    assert sorted(response.status_code for response in results) == [200, 409]
    history = (await auth_client.get(f"{PATH}/sessions/{session_id}")).json()["messages"]
    assert [item["role"] for item in history] == ["user", "assistant"]

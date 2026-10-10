from unittest.mock import AsyncMock

from app.api.deps import get_llm_dep
from app.main import app

PATH = "/api/v1/archives/cases/rural_road"


async def test_legacy_agent_route_uses_real_chat_and_keeps_history(auth_client):
    assert (await auth_client.post(PATH + "/agent", json={})).status_code == 422
    await auth_client.post(PATH + "/start")
    assert (await auth_client.post(PATH + "/agent", json={"focus_clue_id": "unknown"})).status_code == 422
    llm = AsyncMock()
    llm.is_mock = False
    llm.chat_messages.return_value = "复习可以分成三个短时段，我们先从你的目标聊起。"
    app.dependency_overrides[get_llm_dep] = lambda: llm
    try:
        first = await auth_client.post(PATH + "/agent", json={"question": "帮我安排复习", "focus_clue_id": "rural_c2"})
        assert first.status_code == 200
        assert first.json()["answer"] == llm.chat_messages.return_value
        assert first.json()["mode"] == "online"
        assert first.json()["evidence"][0]["source"]
        await auth_client.post(PATH + "/agent", json={"question": "第三个时段做什么？"})
        assert len(llm.chat_messages.call_args.args[0]) == 4
        assert len((await auth_client.get(PATH + "/agent/history")).json()) == 2
        llm.chat_json.assert_not_called()
    finally:
        app.dependency_overrides.pop(get_llm_dep, None)


async def test_legacy_agent_no_longer_returns_fake_planned_replies(auth_client):
    await auth_client.post(PATH + "/start")
    response = await auth_client.post(PATH + "/agent", json={"question": "聊聊天"})
    assert response.status_code == 502
    assert (await auth_client.get(PATH + "/agent/history")).json() == []

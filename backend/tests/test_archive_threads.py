from tests.conftest import unique_account
from tests.test_archives import case_by_code, check_payload, fill_answer


async def _solve(client, case: dict) -> None:
    path = f"/api/v1/archives/cases/{case['code']}"
    assert (await client.post(path + "/start")).status_code == 200
    response = await client.post(path + "/check", json=check_payload(case))
    assert response.json()["passed"] is True


async def test_threads_hide_uncollected_cards_and_wait_for_fill(auth_client):
    case = case_by_code("seek_truth")
    hidden_id = case["fill_blank"]["card_id"]
    hidden_label = next(card["label"] for card in case["cards"] if card["id"] == hidden_id)
    thread = next(card["thread"] for card in case["cards"] if card["id"] == hidden_id)

    overview = (await auth_client.get("/api/v1/archives/threads")).json()
    assert overview["total_threads"] == 4 and overview["completed_threads"] == 0
    assert all(item["collected"] == 0 and not item["unlocked"] and item["cards"] == [] for item in overview["items"])
    assert all(item["total"] > 0 for item in overview["items"])

    await _solve(auth_client, case)
    overview = (await auth_client.get("/api/v1/archives/threads")).json()
    threads = {item["thread"]: item for item in overview["items"]}
    assert threads[thread]["collected"] == 0
    assert all(item["label"] != hidden_label for item in threads[thread]["cards"])
    others = [item for item in overview["items"] if item["thread"] != thread]
    assert any(item["collected"] > 0 for item in others)

    fill = await auth_client.post(
        f"/api/v1/archives/cases/{case['code']}/fill", json={"answer": fill_answer(case)}
    )
    assert fill.json()["correct"] is True
    overview = (await auth_client.get("/api/v1/archives/threads")).json()
    threads = {item["thread"]: item for item in overview["items"]}
    labels = [item["label"] for item in threads[thread]["cards"]]
    assert hidden_label in labels
    revealed = next(item for item in threads[thread]["cards"] if item["label"] == hidden_label)
    assert revealed["text"] and revealed["source"] and revealed["case_code"] == case["code"]


async def test_thread_note_upsert_and_isolation(client):
    tokens = []
    for _ in range(2):
        response = await client.post("/api/v1/auth/register", json=unique_account())
        assert response.status_code == 201
        tokens.append(response.json()["access_token"])
    headers_a = {"Authorization": "Bearer " + tokens[0]}
    headers_b = {"Authorization": "Bearer " + tokens[1]}

    first = await client.post(
        "/api/v1/archives/threads/A/note",
        headers=headers_a,
        json={"note": "实事求是这条线索从调查研究一直延续到改革开放。"},
    )
    assert first.status_code == 200 and first.json()["thread"] == "A"
    second = await client.post(
        "/api/v1/archives/threads/A/note",
        headers=headers_a,
        json={"note": "第二次修改：这条主线强调一切从实际出发。"},
    )
    assert second.json()["note"].startswith("第二次修改")

    overview_a = (await client.get("/api/v1/archives/threads", headers=headers_a)).json()
    note_a = next(item["note"] for item in overview_a["items"] if item["thread"] == "A")
    assert note_a.startswith("第二次修改")
    overview_b = (await client.get("/api/v1/archives/threads", headers=headers_b)).json()
    assert all(item["note"] == "" for item in overview_b["items"])
    assert all(item["collected"] == 0 for item in overview_b["items"])

    invalid = await client.post(
        "/api/v1/archives/threads/Z/note",
        headers=headers_a,
        json={"note": "不存在的主线也要写满十二个字。"},
    )
    assert invalid.status_code == 422
    short = await client.post(
        "/api/v1/archives/threads/A/note",
        headers=headers_a,
        json={"note": "太短"},
    )
    assert short.status_code == 422


async def test_threads_require_login(client):
    assert (await client.get("/api/v1/archives/threads")).status_code == 401
    assert (
        await client.post("/api/v1/archives/threads/A/note", json={"note": "未登录不能写入这条主线笔记。"})
    ).status_code == 401

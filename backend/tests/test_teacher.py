import json

from tests.test_archives import case_by_code, check_payload, correct_placements, visible_cards, wrong_placements

TEACHER_CODE = "teacher-code-1234"


async def _overview(client) -> dict:
    response = await client.get("/api/v1/teacher/overview")
    assert response.status_code == 200, response.text
    return response.json()


def _card_row(overview: dict, card_id: str) -> dict:
    return next((item for item in overview["cards"] if item["card_id"] == card_id), {})


async def test_teacher_requires_role_and_code(auth_client):
    assert (await auth_client.get("/api/v1/teacher/overview")).status_code == 403

    wrong = await auth_client.post("/api/v1/users/me/teacher", json={"code": "wrong-code-9999"})
    assert wrong.status_code == 403
    still_blocked = await auth_client.get("/api/v1/teacher/overview")
    assert still_blocked.status_code == 403

    claim = await auth_client.post("/api/v1/users/me/teacher", json={"code": TEACHER_CODE})
    assert claim.status_code == 200 and claim.json()["is_superuser"] is True
    me = (await auth_client.get("/api/v1/auth/me")).json()
    assert me["is_superuser"] is True


async def test_teacher_overview_aggregates_anonymously(auth_client):
    await auth_client.post("/api/v1/users/me/teacher", json={"code": TEACHER_CODE})
    case = case_by_code("seek_truth")
    path = f"/api/v1/archives/cases/{case['code']}"
    before = await _overview(auth_client)

    await auth_client.post(path + "/start")
    await auth_client.post(path + "/check", json=check_payload(case, wrong=True))
    await auth_client.post(path + "/check", json=check_payload(case))

    after = await _overview(auth_client)
    assert after["totals"]["attempts"] == before["totals"]["attempts"] + 2
    assert after["totals"]["passed"] == before["totals"]["passed"] + 1
    assert after["totals"]["students"] >= before["totals"]["students"]

    case_after = next(item for item in after["cases"] if item["case_code"] == case["code"])
    case_before = next((item for item in before["cases"] if item["case_code"] == case["code"]), None)
    assert case_after["attempts"] == (case_before["attempts"] if case_before else 0) + 2
    assert case_after["passed"] == (case_before["passed"] if case_before else 0) + 1

    expected = correct_placements(case)
    handled = wrong_placements(case)
    mistaken = [card_id for card_id, value in handled.items() if expected[card_id] != value]
    assert mistaken, "错误提交应当包含错放卡片"
    for card_id in mistaken:
        row = _card_row(after, card_id)
        assert row, card_id
        assert row["attempts"] == _card_row(before, card_id).get("attempts", 0) + 2
        assert row["errors"] == _card_row(before, card_id).get("errors", 0) + 1
    assert all(0 <= item["error_rate"] <= 1 for item in after["cards"])
    assert all(item["error_rate"] == 0 for item in after["cards"] if item["attempts"] and not item["errors"])

    dumped = json.dumps(after, ensure_ascii=False)
    assert "@" not in dumped
    assert "近代中国的城乡结构" not in dumped
    assert after["note"]


async def test_teacher_overview_updates_after_more_practice(auth_client):
    await auth_client.post("/api/v1/users/me/teacher", json={"code": TEACHER_CODE})
    case = case_by_code("rural_road")
    path = f"/api/v1/archives/cases/{case['code']}"
    before = await _overview(auth_client)

    await auth_client.post(path + "/start")
    await auth_client.post(path + "/check", json=check_payload(case))

    after = await _overview(auth_client)
    case_after = next(item for item in after["cases"] if item["case_code"] == case["code"])
    case_before = next((item for item in before["cases"] if item["case_code"] == case["code"]), None)
    assert case_after["attempts"] == (case_before["attempts"] if case_before else 0) + 1
    assert case_after["passed"] == (case_before["passed"] if case_before else 0) + 1
    assert case_after["pass_rate"] == round(case_after["passed"] / case_after["students"], 4)
    for card in visible_cards(case):
        row = _card_row(after, card["id"])
        assert row
        assert row["errors"] == _card_row(before, card["id"]).get("errors", 0)

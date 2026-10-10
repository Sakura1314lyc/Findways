import pytest

from tests.test_archives import case_by_code, timeline_payload


async def test_timeline_case_locks_metadata_until_passed(auth_client):
    case = case_by_code("grand_road")
    path = f"/api/v1/archives/cases/{case['code']}"
    detail = (await auth_client.get(path)).json()
    assert detail["mode"] == "timeline"
    assert detail["card_total"] == 12 and detail["timeline_total"] == 10
    assert detail["card_total"] == len(detail["cards"])
    assert all(set(card) == {"id", "label", "text", "source"} for card in detail["cards"])
    assert "thread_map" not in detail and "chain_edges" not in detail
    assert "theory_summary" not in detail and "reflection_prompt" not in detail
    assert "hints" not in detail and "fill_blank" not in detail

    assert (await auth_client.post(path + "/start")).status_code == 200
    premature = await auth_client.post(path + "/complete", json={"reflection": "把这段道路按时间顺序整理一遍。"})
    assert premature.status_code == 422

    incomplete = await auth_client.post(
        path + "/check",
        json={"order": list(case["timeline_order"])[:3], "rejected": []},
    )
    assert incomplete.status_code == 422
    overlap = await auth_client.post(
        path + "/check",
        json={
            "order": [case["timeline_order"][0]] * 2 + list(case["timeline_order"])[1:10],
            "rejected": [],
        },
    )
    assert overlap.status_code == 422
    no_reason = await auth_client.post(
        path + "/check",
        json={
            "order": list(case["timeline_order"]),
            "rejected": [card["id"] for card in case["cards"] if card["stage"] == "distractor"],
            "reasons": {},
        },
    )
    assert no_reason.status_code == 422

    wrong = await auth_client.post(path + "/check", json=timeline_payload(case, wrong=True))
    assert wrong.status_code == 200
    body = wrong.json()
    assert body["mode"] == "timeline" and body["correct"] is False
    assert body["position_hits"] <= 2 and body["triage_correct"] == 2
    assert body["mistakes"] and all(set(item) == {"id", "label", "kind"} for item in body["mistakes"])
    assert body["hint"] and body["attempts"] == 1

    good = await auth_client.post(path + "/check", json=timeline_payload(case))
    assert good.status_code == 200
    body = good.json()
    assert body["correct"] is True and body["passed"] is True
    assert body["score"] == 1.0 and body["position_hits"] == 10 and body["triage_correct"] == 2
    assert body["best_score"] == 1.0 and body["attempts"] == 2

    unlocked = (await auth_client.get(path)).json()
    assert unlocked["theory_summary"] and unlocked["reflection_prompt"]
    assert len(unlocked["hints"]) == 3 and len(unlocked["probes"]) == 2
    timeline_cards = [card for card in unlocked["cards"] if "variant" not in card]
    trap_cards = [card for card in unlocked["cards"] if "variant" in card]
    assert len(timeline_cards) == 10 and len(trap_cards) == 2
    assert all(card["year"] and card["thread"] for card in timeline_cards)
    assert all(card["reject_reason"] for card in trap_cards)
    assert "stage" not in timeline_cards[0]
    assert len(unlocked["thread_map"]["cards"]) == 10
    assert {option["key"] for option in unlocked["thread_map"]["options"]} == {"A", "B", "C", "D"}


async def test_timeline_thread_map_grading(auth_client):
    case = case_by_code("grand_road")
    path = f"/api/v1/archives/cases/{case['code']}"
    await auth_client.post(path + "/start")
    await auth_client.post(path + "/check", json=timeline_payload(case))

    correct = {card["id"]: card["thread"] for card in case["cards"] if card["stage"] != "distractor"}
    incomplete = await auth_client.post(path + "/thread-map", json={"mapping": {"x": "A"}})
    assert incomplete.status_code == 422
    invalid = await auth_client.post(
        path + "/thread-map",
        json={"mapping": {**correct, next(iter(correct)): "Z"}},
    )
    assert invalid.status_code == 422

    swapped = dict(correct)
    first, second = list(swapped)[0], list(swapped)[1]
    swapped[first], swapped[second] = swapped[second], swapped[first]
    partial = await auth_client.post(path + "/thread-map", json={"mapping": swapped})
    assert partial.status_code == 200
    assert partial.json()["correct_count"] == 8 and partial.json()["passed"] is True

    result = await auth_client.post(path + "/thread-map", json={"mapping": correct})
    assert result.status_code == 200
    body = result.json()
    assert body["passed"] is True and body["correct_count"] == body["total"] == 10
    assert all(item["answer"] in {"A", "B", "C", "D"} for item in body["results"])

    progress = (await auth_client.get("/api/v1/archives/progress")).json()
    item = next(row for row in progress["items"] if row["case_code"] == case["code"])
    assert item["timeline_result"]["position_hits"] == 10
    assert item["thread_map_result"]["correct_count"] == 10


@pytest.mark.asyncio
async def test_timeline_case_requires_start_and_pass(auth_client):
    case = case_by_code("grand_road")
    path = f"/api/v1/archives/cases/{case['code']}"
    blocked = await auth_client.post(path + "/thread-map", json={"mapping": {"x": "A"}})
    assert blocked.status_code == 422
    blocked_probe = await auth_client.post(
        path + "/probe",
        json={"answers": [{"question": "任何问题都行", "answer": "随便写一点"}]},
    )
    assert blocked_probe.status_code == 422

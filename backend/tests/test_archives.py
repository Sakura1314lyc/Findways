import asyncio
import json
from pathlib import Path

import pytest

from tests.conftest import unique_account

SEEDS = Path(__file__).resolve().parents[1] / "app" / "seeds"
CASES = json.loads((SEEDS / "archive_cases.json").read_text(encoding="utf-8"))
CARD_STAGES = ("context", "practice", "theory")
REJECT = "reject"


def case_by_code(code: str) -> dict:
    return next(item for item in CASES if item["code"] == code)


def visible_cards(case: dict) -> list[dict]:
    hidden = (case.get("fill_blank") or {}).get("card_id")
    return [card for card in case["cards"] if card["id"] != hidden]


def correct_placements(case: dict) -> dict[str, str]:
    return {
        card["id"]: REJECT if card["stage"] == "distractor" else card["stage"]
        for card in visible_cards(case)
    }


def wrong_placements(case: dict) -> dict[str, str]:
    placements = correct_placements(case)
    context_id = next(card["id"] for card in visible_cards(case) if card["stage"] == "context")
    practice_id = next(card["id"] for card in visible_cards(case) if card["stage"] == "practice")
    trap_id = next(card["id"] for card in visible_cards(case) if card["stage"] == "distractor")
    placements[context_id], placements[practice_id] = placements[practice_id], placements[context_id]
    placements[trap_id] = "context"
    return placements


def correct_chain(case: dict) -> dict[str, str]:
    return {child: parents[0] for child, parents in case["causal_edges"].items()}


def correct_reasons(case: dict) -> dict[str, str]:
    return {
        card["id"]: "它属于另一个年代或颠倒了因果关系，应当剔除。"
        for card in visible_cards(case)
        if card["stage"] == "distractor"
    }


def check_payload(case: dict, wrong: bool = False) -> dict:
    placements = wrong_placements(case) if wrong else correct_placements(case)
    return {"placements": placements, "reasons": correct_reasons(case)}


def fill_answer(case: dict) -> str:
    return "这张卡片说的是：" + "、".join(case["fill_blank"]["points"]) + "。"


def timeline_payload(case: dict, wrong: bool = False) -> dict:
    order = list(case["timeline_order"])
    if wrong:
        order = list(reversed(order))
    rejected = [card["id"] for card in case["cards"] if card["stage"] == "distractor"]
    reasons = {card_id: "它属于另一个年代或颠倒了因果关系，应当剔除。" for card_id in rejected}
    return {"order": order, "rejected": rejected, "reasons": reasons}


@pytest.mark.asyncio
async def test_archive_exploration_flow(auth_client):
    cases = (await auth_client.get("/api/v1/archives/cases")).json()
    assert len(cases) == len(CASES) == 11
    assert sum(item["chapter"].startswith("拓展") for item in cases) == 2
    assert sum(item.get("mode") == "timeline" for item in cases) == 1
    case = case_by_code("rural_road")
    code = case["code"]
    visible = visible_cards(case)
    stage_total = len([card for card in visible if card["stage"] != "distractor"])

    detail_response = await auth_client.get(f"/api/v1/archives/cases/{code}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["card_total"] == len(visible) and detail["hint_total"] == 3
    assert len(detail["cards"]) == len(visible)
    assert all(set(card) == {"id", "label", "text", "source"} for card in detail["cards"])
    assert detail["fill_blank"]["card_id"] == case["fill_blank"]["card_id"]
    assert detail["fill_blank"]["label"] and detail["fill_blank"]["text"] is None
    assert "theory_summary" not in detail and "reflection_prompt" not in detail
    assert "hints" not in detail and "probes" not in detail and "transfer" not in detail
    assert "chain_edges" not in detail and "causal_edges" not in detail
    assert "guide_questions" not in detail

    start = await auth_client.post(f"/api/v1/archives/cases/{code}/start")
    assert start.status_code == 200
    assert not start.json()["clues_solved"]
    assert (await auth_client.post(f"/api/v1/archives/cases/{code}/start")).status_code == 200

    premature = await auth_client.post(
        f"/api/v1/archives/cases/{code}/complete",
        json={"reflection": "革命道路的形成需要分析具体国情和实践经验。"},
    )
    assert premature.status_code == 422

    incomplete = await auth_client.post(
        f"/api/v1/archives/cases/{code}/check",
        json={"placements": {"rural_c1": "context"}},
    )
    assert incomplete.status_code == 422
    invalid = await auth_client.post(
        f"/api/v1/archives/cases/{code}/check",
        json={"placements": {**correct_placements(case), "rural_c1": "unknown"}},
    )
    assert invalid.status_code == 422
    unknown = await auth_client.post(
        f"/api/v1/archives/cases/{code}/check",
        json={"placements": {**correct_placements(case), "not_a_card": "context"}},
    )
    assert unknown.status_code == 422
    trap = next(card for card in visible if card["stage"] == "distractor")
    no_reason = await auth_client.post(
        f"/api/v1/archives/cases/{code}/check",
        json={
            "placements": {card["id"]: correct_placements(case)[card["id"]] for card in visible},
            "reasons": {trap["id"]: "短"},
        },
    )
    assert no_reason.status_code == 422

    first_hint = (await auth_client.post(f"/api/v1/archives/cases/{code}/hint")).json()
    assert first_hint["remaining"] == 2 and not first_hint["exhausted"]
    await auth_client.post(f"/api/v1/archives/cases/{code}/hint")
    third_hint = (await auth_client.post(f"/api/v1/archives/cases/{code}/hint")).json()
    assert third_hint["remaining"] == 0 and not third_hint["exhausted"]
    exhausted = (await auth_client.post(f"/api/v1/archives/cases/{code}/hint")).json()
    assert exhausted["exhausted"] is True and exhausted["hints_used"] == 3

    bad = await auth_client.post(
        f"/api/v1/archives/cases/{code}/check",
        json=check_payload(case, wrong=True),
    )
    assert bad.status_code == 200
    body = bad.json()
    assert body["correct"] is False and body["passed"] is False
    assert 0 < body["score"] < 0.75
    assert body["stage_total"] == stage_total and body["triage_total"] == 2
    assert body["mistakes"] and all(set(item) == {"id", "label", "kind"} for item in body["mistakes"])
    assert body["hint"] and body["hint_remaining"] == 0
    locked_after_fail = (await auth_client.get(f"/api/v1/archives/cases/{code}")).json()
    assert "theory_summary" not in locked_after_fail
    assert all("stage" not in card for card in locked_after_fail["cards"])

    good = await auth_client.post(
        f"/api/v1/archives/cases/{code}/check",
        json=check_payload(case),
    )
    assert good.status_code == 200
    body = good.json()
    assert body["correct"] is True and body["passed"] is True
    assert body["score"] == 1.0 and body["stage_correct"] == stage_total and body["triage_correct"] == 2

    unlocked = (await auth_client.get(f"/api/v1/archives/cases/{code}")).json()
    assert unlocked["theory_summary"] and unlocked["reflection_prompt"]
    assert len(unlocked["hints"]) == 3 and len(unlocked["probes"]) == 2
    assert "answer" in unlocked["transfer"]
    assert len(unlocked["chain_edges"]) == len(case["causal_edges"])
    assert all(set(edge) == {"child_id", "child_label", "options"} for edge in unlocked["chain_edges"])
    assert all(edge["options"] for edge in unlocked["chain_edges"])
    assert "accepted" not in unlocked["chain_edges"][0]
    assert unlocked["fill_blank"]["text"] is None
    assert all(card["stage"] in CARD_STAGES + ("distractor",) for card in unlocked["cards"])
    assert any(card.get("reject_reason") for card in unlocked["cards"] if card["stage"] == "distractor")

    chain_ok = await auth_client.post(f"/api/v1/archives/cases/{code}/chain", json={"links": correct_chain(case)})
    assert chain_ok.status_code == 200
    assert chain_ok.json()["passed"] is True and chain_ok.json()["correct_count"] == chain_ok.json()["total"]
    assert all(item["accepted"] for item in chain_ok.json()["results"])
    bad_chain = await auth_client.post(f"/api/v1/archives/cases/{code}/chain", json={"links": {"nope": "nope"}})
    assert bad_chain.status_code == 422

    bad_fill = await auth_client.post(f"/api/v1/archives/cases/{code}/fill", json={"answer": "记不清了，先跳过吧。"})
    assert bad_fill.status_code == 200 and bad_fill.json()["correct"] is False
    good_fill = await auth_client.post(f"/api/v1/archives/cases/{code}/fill", json={"answer": fill_answer(case)})
    assert good_fill.status_code == 200 and good_fill.json()["correct"] is True
    assert good_fill.json()["card"]["text"] and good_fill.json()["hit"]
    filled = (await auth_client.get(f"/api/v1/archives/cases/{code}")).json()
    assert filled["fill_blank"]["text"]

    probes = case["probes"]
    partial = await auth_client.post(
        f"/api/v1/archives/cases/{code}/probe",
        json={"answers": [{"question": probes[0]["question"], "answer": "不知道"}]},
    )
    assert partial.status_code == 200
    assert partial.json()["probe_passed"] is False and partial.json()["answered_all"] is False
    complete_probe = await auth_client.post(
        f"/api/v1/archives/cases/{code}/probe",
        json={"answers": [{"question": probe["question"], "answer": probe["reference"]} for probe in probes]},
    )
    assert complete_probe.status_code == 200
    assert complete_probe.json()["probe_passed"] is True
    wrong_probe = await auth_client.post(
        f"/api/v1/archives/cases/{code}/probe",
        json={"answers": [{"question": "不属于本关的问题", "answer": "随便写一点内容"}]},
    )
    assert wrong_probe.status_code == 422

    transfer = case["transfer"]
    wrong_option = next(item["key"] for item in transfer["options"] if item["key"] != transfer["answer"])
    wrong_transfer = await auth_client.post(
        f"/api/v1/archives/cases/{code}/transfer",
        json={"option": wrong_option, "reason": "我觉得这样更稳妥"},
    )
    assert wrong_transfer.status_code == 200 and wrong_transfer.json()["correct"] is False
    right_transfer = await auth_client.post(
        f"/api/v1/archives/cases/{code}/transfer",
        json={"option": transfer["answer"], "reason": "要兼顾两个方向，不能走极端"},
    )
    assert right_transfer.status_code == 200 and right_transfer.json()["correct"] is True
    assert right_transfer.json()["rationale"]

    hint = await auth_client.post(
        f"/api/v1/archives/cases/{code}/guide",
        json={"question": "为什么要从农村开始？"},
    )
    assert hint.status_code == 200
    assert hint.json()["answer"] and hint.json()["mode"] == "offline"

    reflection = "近代中国的城乡结构和城市起义的挫折，推动了农村根据地的探索。"
    finished = await auth_client.post(
        f"/api/v1/archives/cases/{code}/complete",
        json={"reflection": reflection},
    )
    assert finished.status_code == 200
    assert finished.json()["completed_at"]
    assert finished.json()["reflection"] == reflection
    progress = (await auth_client.get("/api/v1/archives/progress")).json()
    item = next(row for row in progress["items"] if row["case_code"] == code)
    assert item["attempts"] == 2 and item["hints_used"] == 3
    assert item["best_score"] == 1.0 and item["passed_at"]
    assert item["probe_passed"] is True
    assert item["placements"] == correct_placements(case)
    assert item["transfer_result"]["correct"] is True
    assert item["chain_result"]["correct_count"] == item["chain_result"]["total"]
    assert item["fill_result"]["correct"] is True
    assert progress["completed_count"] >= 1


@pytest.mark.asyncio
async def test_archive_progress_is_private(client):
    accounts = [unique_account(), unique_account()]
    tokens = []
    for account in accounts:
        response = await client.post("/api/v1/auth/register", json=account)
        assert response.status_code == 201
        tokens.append(response.json()["access_token"])
    headers_a = {"Authorization": f"Bearer {tokens[0]}"}
    headers_b = {"Authorization": f"Bearer {tokens[1]}"}
    case = case_by_code("seek_truth")
    assert (await client.post("/api/v1/archives/cases/seek_truth/start", headers=headers_a)).status_code == 200
    progress_b = (await client.get("/api/v1/archives/progress", headers=headers_b)).json()
    assert progress_b["items"] == []
    assert (await client.post("/api/v1/archives/cases/unknown/start", headers=headers_a)).status_code == 404
    await client.post(
        "/api/v1/archives/cases/seek_truth/check",
        headers=headers_a,
        json=check_payload(case),
    )
    detail_b = (await client.get("/api/v1/archives/cases/seek_truth", headers=headers_b)).json()
    assert "theory_summary" not in detail_b and "reflection_prompt" not in detail_b
    assert all("stage" not in card for card in detail_b["cards"])
    report_b = (await client.get("/api/v1/archives/report", headers=headers_b)).json()
    assert report_b["empty"] and report_b["first_attempt_sample"] == 0


def test_archive_seed_integrity():
    codes = {item["code"] for item in json.loads((SEEDS / "knowledge_points.json").read_text(encoding="utf-8"))}
    assert len(CASES) == len({item["code"] for item in CASES}) == 11
    assert [item["chapter"][:3] for item in CASES[:8]] == [f"第{number}章" for number in "一二三四五六七八"]
    for case in CASES:
        cards = case["cards"]
        correct = [card for card in cards if card["stage"] != "distractor"]
        traps = [card for card in cards if card["stage"] == "distractor"]
        assert len({card["id"] for card in cards}) == len(cards), case["code"]
        lengths = [len(card["text"]) for card in cards]
        assert max(lengths) - min(lengths) <= 60, case["code"]
        for card in cards:
            assert card["label"] and card["text"] and card["source"], card["id"]
            if card["stage"] == "distractor":
                assert card["variant"] in {"anachronism", "reversed", "misconception", "mismatch"}, card["id"]
                assert len(card["reject_reason"]) >= 15, card["id"]
        assert len(case["hints"]) == 3 and all(len(hint) >= 15 for hint in case["hints"]), case["code"]
        assert len(case["probes"]) == 2
        for probe in case["probes"]:
            assert probe["question"] and len(probe["reference"]) >= 20 and len(probe["keywords"]) >= 3
        transfer = case["transfer"]
        keys = [item["key"] for item in transfer["options"]]
        assert len(keys) == 3 and transfer["answer"] in keys and len(transfer["rationale"]) >= 20
        assert 0.5 <= case["pass_line"] <= 1
        assert len(case["guide_questions"]) == 3 and all(case["guide_questions"])
        assert case["theory_codes"] and set(case["theory_codes"]) <= codes
        assert case["cover"] in {"method", "road", "transform", "industry", "reform", "people", "development"}
        if case.get("mode") == "timeline":
            order = case["timeline_order"]
            assert len(correct) == 10 and len(traps) == 2 and len(cards) == 12, case["code"]
            assert set(order) == {card["id"] for card in correct}, case["code"]
            years = [int(next(card["year"] for card in correct if card["id"] == card_id)) for card_id in order]
            assert years == sorted(years), case["code"]
            assert {card.get("thread") for card in correct} == {"A", "B", "C", "D"}, case["code"]
            assert "fill_blank" not in case and "causal_edges" not in case, case["code"]
            continue
        hidden = case["fill_blank"]["card_id"]
        hidden_card = next(card for card in cards if card["id"] == hidden)
        assert len(cards) == 8 and len(correct) == 6 and len(traps) == 2, case["code"]
        assert hidden_card["stage"] == "practice", case["code"]
        assert len(case["fill_blank"]["points"]) >= 3, case["code"]
        assert {card["stage"] for card in correct} == set(CARD_STAGES), case["code"]
        for card in correct:
            assert card.get("thread") in {None, "A", "B", "C", "D"}, card["id"]
        order = [card["id"] for card in cards]
        edges = case["causal_edges"]
        assert 2 <= len(edges) <= 4, case["code"]
        for child, parents in edges.items():
            assert child in order and child != hidden, case["code"]
            assert parents, case["code"]
            for parent in parents:
                assert parent in order and parent != hidden, case["code"]
                assert order.index(parent) < order.index(child), case["code"]


@pytest.mark.parametrize("code", ["theory_development", "new_era_contradiction", "chinese_modernization"])
async def test_added_archive_complete_flow(auth_client, code):
    case = case_by_code(code)
    path = f"/api/v1/archives/cases/{code}"
    assert (await auth_client.post(path + "/start")).status_code == 200
    wrong = await auth_client.post(path + "/check", json=check_payload(case, wrong=True))
    assert wrong.json()["correct"] is False
    right = await auth_client.post(path + "/check", json=check_payload(case))
    assert right.json()["correct"] is True
    guide = (await auth_client.post(path + "/guide", json={"question": "怎样分析这些材料之间的联系？"})).json()
    assert guide == {"answer": "可以先想一想：" + case["guide_questions"][0] + " 再从档案卡中找依据。",
                     "mode": "offline"}
    detail = (await auth_client.get(path)).json()
    assert "guide_questions" not in detail
    assert all("stage" in card for card in detail["cards"])
    assert detail["theory_summary"] == case["theory_summary"]
    note = "通过这份档案，我认识到需要结合历史条件、实践探索来理解理论认识的形成。"
    complete = await auth_client.post(path + "/complete", json={"reflection": note})
    assert complete.status_code == 200 and complete.json()["completed_at"]
    assert (await auth_client.post(path + "/start")).json()["reflection"] == note


@pytest.mark.asyncio
async def test_opening_same_archive_concurrently_is_idempotent(auth_client):
    path = "/api/v1/archives/cases/market_reform/start"
    results = await asyncio.gather(auth_client.post(path), auth_client.post(path))
    assert [item.status_code for item in results] == [200, 200]
    assert results[0].json()["case_code"] == results[1].json()["case_code"]

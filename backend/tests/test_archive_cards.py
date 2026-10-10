import pytest

from app.core.exceptions import BusinessRuleError
from app.services.archive_cards_service import (
    case_cards,
    grade_chain,
    grade_fill,
    grade_probe,
    grade_thread_map,
    grade_transfer,
    hidden_card,
    hint_for,
    public_case,
    score_placements,
    score_timeline,
)
from tests.test_archives import CASES, case_by_code, correct_placements, fill_answer, visible_cards

CASE = case_by_code("seek_truth")
VISIBLE = visible_cards(CASE)
STAGE_TOTAL = len([card for card in VISIBLE if card["stage"] != "distractor"])


def test_case_cards_supports_both_formats_and_excludes_hidden():
    assert len(case_cards(CASE)) == len(VISIBLE)
    assert hidden_card(CASE)["id"] == CASE["fill_blank"]["card_id"]
    assert all(card["id"] != CASE["fill_blank"]["card_id"] for card in case_cards(CASE))
    legacy = {"clues": [{"id": "a", "role": "context", "label": "x", "text": "y", "source": "z"}]}
    assert case_cards(legacy)[0]["id"] == "a"
    assert case_cards({}) == []
    assert hidden_card(legacy) is None


def test_score_placements_full_credit():
    result = score_placements(CASE, correct_placements(CASE))
    assert result["passed"] is True and result["score"] == 1.0
    assert result["stage_correct"] == result["stage_total"] == STAGE_TOTAL
    assert result["triage_correct"] == result["triage_total"] == 2
    assert result["mistakes"] == []


def test_score_placements_partial_credit_above_pass_line_without_leaking_answers():
    placements = correct_placements(CASE)
    context_id = next(card["id"] for card in VISIBLE if card["stage"] == "context")
    placements[context_id] = "practice"
    result = score_placements(CASE, placements)
    total = len(VISIBLE)
    assert result["score"] == round((total - 1) / total, 4)
    assert result["passed"] is True
    assert [item["id"] for item in result["mistakes"]] == [context_id]
    assert all(set(item) == {"id", "label", "kind"} for item in result["mistakes"])


def test_score_placements_below_pass_line():
    placements = correct_placements(CASE)
    context_id = next(card["id"] for card in VISIBLE if card["stage"] == "context")
    trap_id = next(card["id"] for card in VISIBLE if card["stage"] == "distractor")
    placements[context_id] = "practice"
    placements[trap_id] = "context"
    result = score_placements(CASE, placements)
    assert result["passed"] is False and result["score"] < 0.75
    assert len(result["mistakes"]) == 2


def test_score_placements_rejects_bad_payloads():
    with pytest.raises(BusinessRuleError):
        score_placements(CASE, {})
    with pytest.raises(BusinessRuleError):
        score_placements(CASE, {**correct_placements(CASE), "outside": "context"})
    with pytest.raises(BusinessRuleError):
        score_placements(CASE, {**correct_placements(CASE), "seek_c1": "nowhere"})
    with pytest.raises(BusinessRuleError):
        score_placements(CASE, {**correct_placements(CASE), CASE["fill_blank"]["card_id"]: "context"})


def test_hint_ladder_progresses_and_then_repeats_last():
    first = hint_for(CASE, 0)
    assert first["remaining"] == 2 and first["exhausted"] is False
    last = hint_for(CASE, len(CASE["hints"]) - 1)
    assert last["remaining"] == 0 and last["exhausted"] is False
    exhausted = hint_for(CASE, len(CASE["hints"]))
    assert exhausted["exhausted"] is True and exhausted["hint"] == CASE["hints"][-1]
    assert all(hint_for(CASE, index)["hint"] for index in range(len(CASE["hints"]) + 2))
    assert hint_for({"code": "x"}, 0)["exhausted"] is True


def test_grade_probe_uses_keyword_coverage():
    probe = CASE["probes"][0]
    assert grade_probe(probe, probe["reference"])["correct"] is True
    assert grade_probe(probe, "不知道")["correct"] is False
    assert grade_probe(probe, "实践")["correct"] is False
    hit = grade_probe(probe, probe["keywords"][0] + probe["keywords"][1] + probe["keywords"][2])
    assert hit["correct"] is True and len(hit["hit"]) >= 3
    assert grade_probe(probe, probe["reference"])["reference"] == probe["reference"]


def test_grade_transfer_returns_rationale_and_rejects_unknown_option():
    transfer = CASE["transfer"]
    assert grade_transfer(CASE, transfer["answer"])["correct"] is True
    wrong = next(item["key"] for item in transfer["options"] if item["key"] != transfer["answer"])
    result = grade_transfer(CASE, wrong)
    assert result["correct"] is False and result["answer"] == transfer["answer"] and result["rationale"]
    with pytest.raises(BusinessRuleError):
        grade_transfer(CASE, "Z")


def test_grade_chain_accepts_listed_parents_and_rejects_malformed_payload():
    edges = CASE["causal_edges"]
    accepted_links = {child: parents[0] for child, parents in edges.items()}
    result = grade_chain(CASE, accepted_links)
    assert result["passed"] is True and result["correct_count"] == result["total"] == len(edges)
    assert all(item["accepted"] for item in result["results"])

    multi = case_by_code("socialist_transformation")
    multi_edges = multi["causal_edges"]
    minority_child = next(child for child, parents in multi_edges.items() if len(parents) > 1)
    alternate = {child: parents[0] for child, parents in multi_edges.items()}
    alternate[minority_child] = multi_edges[minority_child][1]
    assert grade_chain(multi, alternate)["correct_count"] == len(multi_edges)

    with pytest.raises(BusinessRuleError):
        grade_chain(CASE, {})
    with pytest.raises(BusinessRuleError):
        grade_chain(CASE, {**accepted_links, "not_a_card": "seek_c1"})
    with pytest.raises(BusinessRuleError):
        grade_chain({**CASE, "causal_edges": {}}, accepted_links)


def test_grade_fill_matches_points_and_reveals_card():
    points = CASE["fill_blank"]["points"]
    good = grade_fill(CASE, fill_answer(CASE))
    assert good["correct"] is True and len(good["hit"]) == len(points)
    assert good["card"]["id"] == CASE["fill_blank"]["card_id"] and good["card"]["text"]

    partial = grade_fill(CASE, "、".join(points[:2]))
    assert len(partial["hit"]) <= 2
    assert grade_fill(CASE, "不知道")["correct"] is False

    fragment = points[0].split("，")[0]
    assert fragment in grade_fill(CASE, f"我记得这里面提到了{fragment}，但细节说不全。")["hit"] or len(fragment) < 2

    with pytest.raises(BusinessRuleError):
        grade_fill({**CASE, "fill_blank": {}}, "随便写点内容")


def test_public_case_hides_answers_until_unlocked():
    locked = public_case(CASE, detail=True, unlocked=False)
    assert set(locked["cards"][0]) == {"id", "label", "text", "source"}
    for field in ("theory_summary", "reflection_prompt", "hints", "probes", "transfer", "guide_questions"):
        assert field not in locked, field
    assert "chain_edges" not in locked and "causal_edges" not in locked
    assert locked["hint_total"] == 3 and locked["card_total"] == len(VISIBLE)
    assert locked["fill_blank"]["text"] is None and locked["fill_blank"]["label"]

    unlocked = public_case(CASE, detail=True, unlocked=True)
    assert unlocked["theory_summary"] and unlocked["reflection_prompt"]
    assert len(unlocked["hints"]) == 3 and len(unlocked["probes"]) == 2 and unlocked["transfer"]["answer"]
    assert len(unlocked["chain_edges"]) == len(CASE["causal_edges"])
    assert all(set(edge) == {"child_id", "child_label", "options"} for edge in unlocked["chain_edges"])
    assert unlocked["fill_blank"]["text"] is None

    filled = public_case(CASE, detail=True, unlocked=True, fill_done=True)
    assert filled["fill_blank"]["text"] == hidden_card(CASE)["text"]
    assert filled["fill_blank"]["points"] == CASE["fill_blank"]["points"]

    stages = {card["stage"] for card in unlocked["cards"]}
    assert stages == {"context", "practice", "theory", "distractor"}
    assert all("reject_reason" in card for card in unlocked["cards"] if card["stage"] == "distractor")
    assert "guide_questions" not in unlocked

    listing = public_case(CASE)
    assert "cards" not in listing and "hints" not in listing and "probes" not in listing
    assert "card_total" not in listing and "fill_blank" not in listing


def test_every_case_passes_its_own_pass_line():
    for case in CASES:
        if case.get("mode") == "timeline":
            traps = [card["id"] for card in case["cards"] if card["stage"] == "distractor"]
            reasons = {card_id: "它属于另一个年代或颠倒了因果关系，应当剔除。" for card_id in traps}
            timeline = score_timeline(case, case["timeline_order"], traps, reasons)
            assert timeline["passed"] is True and timeline["score"] == 1.0, case["code"]
            mapping = {card["id"]: card["thread"] for card in case["cards"] if card["stage"] != "distractor"}
            assert grade_thread_map(case, mapping)["passed"] is True, case["code"]
            continue
        full = score_placements(case, correct_placements(case))
        assert full["passed"] is True and full["score"] == 1.0, case["code"]
        edges = grade_chain(case, {child: parents[0] for child, parents in case["causal_edges"].items()})
        assert edges["passed"] is True, case["code"]
        assert grade_fill(case, fill_answer(case))["correct"] is True, case["code"]

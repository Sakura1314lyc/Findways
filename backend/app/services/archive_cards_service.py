from app.core.exceptions import BusinessRuleError

CARD_STAGES = ("context", "practice", "theory")
REJECT = "reject"
DEFAULT_PASS_LINE = 0.75
PROBE_KEYWORD_COVERAGE = 0.5
FILL_COVERAGE = 0.6
CHAIN_PASS_LINE = 0.75
THREAD_PASS_LINE = 0.75

THREADS: dict[str, str] = {
    "A": "实事求是",
    "B": "群众路线",
    "C": "独立自主",
    "D": "矛盾分析",
}


def all_cards(case: dict) -> list[dict]:
    return case.get("cards") or case.get("clues") or []


def hidden_card_id(case: dict) -> str | None:
    blank = case.get("fill_blank") or {}
    return blank.get("card_id")


def hidden_card(case: dict) -> dict | None:
    target = hidden_card_id(case)
    if not target:
        return None
    return next((card for card in all_cards(case) if card["id"] == target), None)


def case_cards(case: dict) -> list[dict]:
    target = hidden_card_id(case)
    return [card for card in all_cards(case) if card["id"] != target]


def cards_mode(case: dict) -> bool:
    return bool(case.get("cards"))


def timeline_mode(case: dict) -> bool:
    return case.get("mode") == "timeline"


def correct_card_ids(case: dict) -> list[str]:
    return [card["id"] for card in case_cards(case) if card.get("stage") != "distractor"]


def distractor_ids(case: dict) -> list[str]:
    return [card["id"] for card in case_cards(case) if card.get("stage") == "distractor"]


def expected_placement(card: dict) -> str:
    return REJECT if card.get("stage") == "distractor" else card.get("stage", "")


def score_placements(case: dict, placements: dict[str, str]) -> dict:
    cards = case_cards(case)
    known = {card["id"] for card in cards}
    if not placement_is_complete(cards, placements):
        raise BusinessRuleError("请为每张档案卡选择归属")
    unknown = set(placements) - known
    if unknown:
        raise BusinessRuleError("存在不属于本关的卡片")
    allowed = set(CARD_STAGES) | {REJECT}
    if any(value not in allowed for value in placements.values()):
        raise BusinessRuleError("归属选项无效")
    stage_correct = stage_total = triage_correct = triage_total = earned = total = 0
    mistakes = []
    for card in cards:
        chosen = placements[card["id"]]
        expected = expected_placement(card)
        is_trap = card.get("stage") == "distractor"
        ok = chosen == expected
        if is_trap:
            triage_total += 1
            triage_correct += int(ok)
        else:
            stage_total += 1
            stage_correct += int(ok)
        total += 1
        earned += int(ok)
        if not ok:
            mistakes.append({
                "id": card["id"],
                "label": card.get("label", ""),
                "kind": "triage" if is_trap else "stage",
            })
    score = round(earned / total, 4) if total else 0.0
    passed = score >= float(case.get("pass_line", DEFAULT_PASS_LINE))
    return {
        "mode": "cards",
        "correct": passed,
        "passed": passed,
        "score": score,
        "earned": earned,
        "total": total,
        "stage_correct": stage_correct,
        "stage_total": stage_total,
        "triage_correct": triage_correct,
        "triage_total": triage_total,
        "mistakes": mistakes,
    }


def placement_is_complete(cards: list[dict], placements: dict[str, str]) -> bool:
    return isinstance(placements, dict) and set(placements) == {card["id"] for card in cards}


def hint_for(case: dict, hints_used: int) -> dict:
    hints = case.get("hints") or []
    if not hints:
        return {"hint": "本关未配置提示，可以结合档案出处自行判断。", "remaining": 0, "exhausted": True}
    if hints_used >= len(hints):
        return {"hint": hints[-1], "remaining": 0, "exhausted": True}
    return {
        "hint": hints[hints_used],
        "remaining": len(hints) - hints_used - 1,
        "exhausted": False,
    }


def grade_probe(probe: dict, answer: str) -> dict:
    text = (answer or "").strip()
    keywords = probe.get("keywords") or []
    hit = [keyword for keyword in keywords if keyword in text]
    coverage = len(hit) / len(keywords) if keywords else (1.0 if len(text) >= 12 else 0.0)
    correct = len(text) >= 8 and coverage >= PROBE_KEYWORD_COVERAGE
    return {
        "question": probe.get("question", ""),
        "correct": correct,
        "hit": hit,
        "reference": probe.get("reference", ""),
    }


def grade_transfer(case: dict, option: str) -> dict:
    transfer = case.get("transfer") or {}
    options = transfer.get("options") or []
    keys = {item.get("key") for item in options}
    if option not in keys:
        raise BusinessRuleError("请选择一个迁移情境选项")
    return {
        "correct": option == transfer.get("answer"),
        "answer": transfer.get("answer", ""),
        "rationale": transfer.get("rationale", ""),
    }


def chain_payload(case: dict) -> list[dict]:
    cards = {card["id"]: card for card in case_cards(case)}
    order = [card["id"] for card in case_cards(case)]
    edges = case.get("causal_edges") or {}
    payload = []
    for child_id in edges:
        child = cards.get(child_id)
        if child is None:
            continue
        position = order.index(child_id)
        options = [
            {"id": previous, "label": cards[previous]["label"]}
            for previous in order[:position]
        ]
        payload.append({"child_id": child_id, "child_label": child["label"], "options": options})
    return payload


def grade_chain(case: dict, links: dict[str, str]) -> dict:
    cards = {card["id"]: card for card in case_cards(case)}
    edges = case.get("causal_edges") or {}
    if not edges:
        raise BusinessRuleError("本关未配置因果连线任务")
    if set(links) != set(edges):
        raise BusinessRuleError("请为每一张卡片说明它由哪张较早的卡片推动")
    results = []
    correct_count = 0
    for child_id, accepted in edges.items():
        chosen = links[child_id]
        if chosen not in cards:
            raise BusinessRuleError("存在不属于本关的卡片")
        ok = chosen in accepted
        correct_count += int(ok)
        results.append({
            "child_id": child_id,
            "child_label": cards[child_id]["label"],
            "chosen_id": chosen,
            "chosen_label": cards[chosen]["label"],
            "correct": ok,
            "accepted": [{"id": parent, "label": cards[parent]["label"]} for parent in accepted if parent in cards],
        })
    total = len(edges)
    passed = correct_count >= max(1, round(total * CHAIN_PASS_LINE))
    return {"results": results, "correct_count": correct_count, "total": total, "passed": passed}


def _point_fragments(point: str) -> list[str]:
    fragments: list[str] = []
    for separator in "，,、；;。：" :
        point = point.replace(separator, "|")
    for fragment in point.split("|"):
        fragment = fragment.strip()
        if len(fragment) >= 2:
            fragments.append(fragment)
    return fragments or [point]


def grade_fill(case: dict, answer: str) -> dict:
    blank = case.get("fill_blank") or {}
    points = blank.get("points") or []
    card = hidden_card(case)
    if not points or card is None:
        raise BusinessRuleError("本关未配置缺失补全任务")
    text = (answer or "").strip()
    hit = []
    for point in points:
        if point in text or any(fragment in text for fragment in _point_fragments(point)):
            hit.append(point)
    coverage = len(hit) / len(points)
    correct = len(text) >= 12 and coverage >= FILL_COVERAGE
    return {
        "correct": correct,
        "hit": hit,
        "points": points,
        "card": {"id": card["id"], "label": card["label"], "text": card["text"], "source": card["source"]},
    }


def score_timeline(case: dict, order: list[str], rejected: list[str], reasons: dict[str, str] | None = None) -> dict:
    cards = case_cards(case)
    known = {card["id"] for card in cards}
    by_id = {card["id"]: card for card in cards}
    expected_order = list(case.get("timeline_order") or [])
    traps = [card["id"] for card in cards if card.get("stage") == "distractor"]
    if not expected_order:
        raise BusinessRuleError("本关未配置时间轴任务")
    order = list(order or [])
    rejected = list(rejected or [])
    if set(order) | set(rejected) != known or len(order) + len(rejected) != len(known):
        raise BusinessRuleError("请确认每张卡片都处理过：要么排入时间轴，要么放进剔除托盘")
    if set(order) & set(rejected):
        raise BusinessRuleError("同一张卡片不能既排入时间轴又被剔除")
    proposal_reasons = reasons or {}
    missing = [card_id for card_id in rejected if len((proposal_reasons.get(card_id) or "").strip()) < 4]
    if missing:
        raise BusinessRuleError("标记为「不属于本关」的卡片需要写明剔除理由（至少 4 个字）")
    position_hits = 0
    mistakes = []
    for index, wanted in enumerate(expected_order):
        actual = order[index] if index < len(order) else None
        if actual == wanted:
            position_hits += 1
        elif actual is not None:
            mistakes.append({"id": actual, "label": by_id[actual]["label"], "kind": "order"})
    rejected_set = set(rejected)
    triage_correct = 0
    for trap in traps:
        if trap in rejected_set:
            triage_correct += 1
        else:
            mistakes.append({"id": trap, "label": by_id[trap]["label"], "kind": "triage"})
    for card_id in rejected:
        if card_id not in traps:
            mistakes.append({"id": card_id, "label": by_id[card_id]["label"], "kind": "order"})
    earned = position_hits + triage_correct
    total = len(expected_order) + len(traps)
    score = round(earned / total, 4) if total else 0.0
    passed = score >= float(case.get("pass_line", DEFAULT_PASS_LINE))
    return {
        "mode": "timeline",
        "correct": passed,
        "passed": passed,
        "score": score,
        "earned": earned,
        "total": total,
        "position_hits": position_hits,
        "position_total": len(expected_order),
        "triage_correct": triage_correct,
        "triage_total": len(traps),
        "mistakes": mistakes,
    }


def thread_map_payload(case: dict) -> dict:
    cards = [card for card in case_cards(case) if card.get("stage") != "distractor"]
    return {
        "options": [{"key": key, "name": name} for key, name in THREADS.items()],
        "cards": [{"id": card["id"], "label": card["label"]} for card in cards],
    }


def grade_thread_map(case: dict, mapping: dict[str, str]) -> dict:
    cards = [card for card in case_cards(case) if card.get("stage") != "distractor"]
    expected = {card["id"]: card.get("thread") for card in cards}
    if not expected or any(value not in THREADS for value in expected.values()):
        raise BusinessRuleError("本关未配置主线归位任务")
    if set(mapping) != set(expected):
        raise BusinessRuleError("请为每一张卡片选择所属主线")
    results = []
    hits = 0
    for card_id, answer in expected.items():
        chosen = mapping[card_id]
        if chosen not in THREADS:
            raise BusinessRuleError("主线选项无效")
        ok = chosen == answer
        hits += int(ok)
        results.append({
            "card_id": card_id,
            "label": next(card["label"] for card in cards if card["id"] == card_id),
            "chosen": chosen,
            "answer": answer,
            "correct": ok,
        })
    total = len(expected)
    return {
        "results": results,
        "correct_count": hits,
        "total": total,
        "passed": hits >= max(1, round(total * THREAD_PASS_LINE)),
    }


def public_card(card: dict, unlocked: bool, timeline: bool = False) -> dict:
    fields = ["id", "label", "text", "source"]
    if unlocked:
        fields.extend(["variant", "reject_reason", "thread"])
        if timeline:
            fields.append("year")
        else:
            fields.append("stage")
    return {field: card[field] for field in fields if field in card}


def public_case(case: dict, detail: bool = False, unlocked: bool = False, fill_done: bool = False) -> dict:
    hidden_fields = {"cards", "clues", "guide_questions", "hints", "probes", "transfer", "causal_edges", "fill_blank"}
    timeline = timeline_mode(case)
    base = {key: value for key, value in case.items() if key not in hidden_fields}
    if detail:
        base["cards"] = [public_card(card, unlocked, timeline) for card in case_cards(case)]
        base["card_total"] = len(case_cards(case))
        base["hint_total"] = len(case.get("hints") or [])
        if timeline:
            base["timeline_total"] = len(case.get("timeline_order") or [])
        blank = hidden_card(case)
        if blank is not None:
            points = (case.get("fill_blank") or {}).get("points") or []
            base["fill_blank"] = {
                "card_id": blank["id"],
                "label": blank["label"],
                "text": blank["text"] if fill_done else None,
                "source": blank["source"] if fill_done else None,
                "points": points if fill_done else None,
            }
    if not detail or not unlocked:
        base.pop("theory_summary", None)
        base.pop("reflection_prompt", None)
    if detail and unlocked:
        base["hints"] = case.get("hints") or []
        base["probes"] = case.get("probes") or []
        base["transfer"] = case.get("transfer") or {}
        base["chain_edges"] = chain_payload(case)
        if timeline:
            base["thread_map"] = thread_map_payload(case)
    return base

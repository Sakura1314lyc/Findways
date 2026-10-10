import json
from pathlib import Path

SEED_DIR = Path(__file__).resolve().parents[1] / "app" / "seeds"


def _load(name: str):
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


def test_knowledge_points_are_complete():
    points = _load("knowledge_points.json")
    assert len(points) >= 25, f"知识点数量应不少于25个，当前 {len(points)}"
    codes = [item["code"] for item in points]
    assert len(codes) == len(set(codes)), "知识点 code 存在重复"
    for item in points:
        assert item["name"] and item["chapter"] and len(item["summary"]) >= 30, item["code"]
        assert len(item["key_points"]) >= 3, item["code"]
        assert len(item["misconceptions"]) >= 2, item["code"]
        assert item["application"].strip(), item["code"]
        assert item["sources"], item["code"]
        for quote in item["quotes"]:
            assert quote["text"] and quote["source"], item["code"]

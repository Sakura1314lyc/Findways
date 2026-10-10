import json
from functools import lru_cache
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parents[1] / "seeds" / "archive_cases.json"


@lru_cache
def load_cases() -> list[dict]:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def case_by_code(code: str) -> dict | None:
    return next((item for item in load_cases() if item["code"] == code), None)

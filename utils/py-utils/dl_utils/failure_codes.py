"""Failure code descriptions loaded from the shared CSV data file."""

import csv
from pathlib import Path

_CSV_PATH = Path(__file__).parent / "failure_codes.csv"


def _load_failure_codes() -> dict[str, str]:
    codes: dict[str, str] = {}
    with open(_CSV_PATH, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            codes[row['code'].strip()] = row['description'].strip()
    return codes


_FAILURE_CODE_DESCRIPTIONS: dict[str, str] = _load_failure_codes()


def get_failure_code_description(code: str) -> str | None:
    """Returns the human-readable description for a failure code, or None if not found."""
    return _FAILURE_CODE_DESCRIPTIONS.get(code)

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scrapers.pricing import parse_price_text


def test_turkish_thousands_comma_decimal():
    assert parse_price_text("1.299,00 TL") == 1299.0


def test_comma_decimal():
    assert parse_price_text("1299,99") == 1299.99


def test_plain_dot():
    assert parse_price_text("1299.99") == 1299.99


def test_thousands_dot_only():
    assert parse_price_text("1.299") == 1299.0

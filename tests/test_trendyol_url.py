from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scrapers.trendyol import parse_api_payload
from scrapers.trendyol_url import extract_trendyol_content_id, normalize_trendyol_url


def test_extract_content_id_from_path():
    assert (
        extract_trendyol_content_id("https://www.trendyol.com/apple/iphone-p-762254881?boutiqueId=1")
        == 762254881
    )


def test_normalize_deeplink():
    url = normalize_trendyol_url("ty://?Page=Product&ContentId=1925865")
    assert url == "https://www.trendyol.com/-p-1925865"


def test_parse_api_fixture():
    data = json.loads((ROOT / "tests/fixtures/trendyol_api.json").read_text(encoding="utf-8"))
    result = parse_api_payload(data)
    assert result.price == 57249.0
    assert "Test Trendyol" in result.title

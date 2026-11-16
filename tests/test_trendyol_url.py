from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scrapers.trendyol import parse_api_payload
from scrapers.trendyol_url import extract_trendyol_content_id, normalize_trendyol_url


AVVA_URL = (
    "https://www.trendyol.com/avva/erkek-bej-beli-lastikli-100-keten-relaxed-fit-pantolon-b003032-p-926542786"
)


def test_extract_content_id_from_path():
    assert (
        extract_trendyol_content_id("https://www.trendyol.com/apple/iphone-p-762254881?boutiqueId=1")
        == 762254881
    )


def test_extract_avva_sku_slug_content_id():
    assert extract_trendyol_content_id(AVVA_URL) == 926542786


def test_extract_last_p_id_when_multiple():
    url = "https://www.trendyol.com/x/clearance-p-111222333-sku-b003032-p-926542786"
    assert extract_trendyol_content_id(url) == 926542786


def test_normalize_deeplink():
    url = normalize_trendyol_url("ty://?Page=Product&ContentId=1925865")
    assert url == "https://www.trendyol.com/-p-1925865"


def test_parse_api_fixture():
    data = json.loads((ROOT / "tests/fixtures/trendyol_api.json").read_text(encoding="utf-8"))
    result = parse_api_payload(data)
    assert result.price == 57249.0
    assert "Test Trendyol" in result.title

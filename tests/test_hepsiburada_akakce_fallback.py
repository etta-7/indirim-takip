from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scrapers.hepsiburada_akakce_fallback import fetch_via_akakce
from scrapers.hepsiburada_url import extract_hepsiburada_sku, is_failed_hepsiburada_short_resolve

CANONICAL = "https://www.hepsiburada.com/apple-iphone-15-128gb-p-HBCV00004X9X2I"
SHORT = "https://hb.biz/HBV00000Y1NON"
FIXTURES = ROOT / "tests" / "fixtures"


def test_extract_hepsiburada_sku():
    assert extract_hepsiburada_sku(CANONICAL) == "HBCV00004X9X2I"
    assert extract_hepsiburada_sku(SHORT) == "HBV00000Y1NON"


def test_failed_short_resolve():
    assert is_failed_hepsiburada_short_resolve("https://hb.biz", SHORT)
    assert not is_failed_hepsiburada_short_resolve(CANONICAL, SHORT)


def test_hepsiburada_offer_from_fixture():
    from scrapers.hepsiburada_akakce_fallback import _hepsiburada_offer_price

    html = (FIXTURES / "akakce_hepsiburada_offer.html").read_text(encoding="utf-8")
    assert _hepsiburada_offer_price(html) == 57499.0


def test_fetch_via_akakce_canonical(monkeypatch):
    ua = "Mozilla/5.0 (test)"
    search_html = (
        '<a href="/cep-telefonu/en-ucuz-apple-iphone-15-hbcv00004x9x2i-fiyati,99.html">x</a>'
    )
    product_html = (FIXTURES / "akakce_hepsiburada_offer.html").read_text(encoding="utf-8")

    class Resp:
        def __init__(self, text: str):
            self.text = text

        def raise_for_status(self):
            return None

    def fake_get(url, **kwargs):
        if "arama" in url:
            return Resp(search_html)
        return Resp(product_html)

    monkeypatch.setattr("scrapers.hepsiburada_akakce_fallback.requests.get", fake_get)
    result = fetch_via_akakce(CANONICAL, ua)
    assert result.price == 57499.0

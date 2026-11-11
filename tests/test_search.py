from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scrapers.search import (
    build_search_url,
    normalize_site,
    parse_akakce_search,
    parse_cimri_search,
    parse_hepsiburada_search,
    parse_trendyol_search,
)

FIXTURES = Path(__file__).parent / "fixtures"


def test_normalize_site_aliases():
    assert normalize_site("ty") == "trendyol"
    assert normalize_site("Akakçe") == "akakce"
    assert normalize_site("HB") == "hepsiburada"


def test_build_search_url_trendyol():
    url = build_search_url("trendyol", "ck erkek mont xl")
    assert url.startswith("https://www.trendyol.com/sr?q=")
    assert "ck" in url


def test_parse_trendyol_search_fixture():
    html = (FIXTURES / "trendyol_search.html").read_text(encoding="utf-8")
    results = parse_trendyol_search(html)
    assert len(results) >= 2
    assert any("CK Erkek Mont" in r.title for r in results)
    assert any(r.price == 2499.0 for r in results)


def test_parse_hepsiburada_search_fixture():
    html = (FIXTURES / "hepsiburada_search.html").read_text(encoding="utf-8")
    results = parse_hepsiburada_search(html)
    assert len(results) >= 2
    assert results[0].price == 2650.0
    assert "hepsiburada.com" in results[0].url


def test_parse_akakce_search_fixture():
    html = (FIXTURES / "akakce_search.html").read_text(encoding="utf-8")
    results = parse_akakce_search(html)
    assert len(results) >= 1
    assert results[0].price == 2480.0


def test_parse_cimri_search_fixture():
    html = (FIXTURES / "cimri_search.html").read_text(encoding="utf-8")
    results = parse_cimri_search(html)
    assert len(results) >= 2
    assert results[0].price == 2420.0

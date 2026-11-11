from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scrapers.akakce import parse_html as akakce_parse
from scrapers.cimri import parse_html as cimri_parse
from scrapers.hepsiburada import parse_html as hb_parse
from scrapers.trendyol import parse_html as ty_parse

FIXTURES = Path(__file__).parent / "fixtures"


def test_trendyol_fixture():
    html = (FIXTURES / "trendyol.html").read_text(encoding="utf-8")
    r = ty_parse(html)
    assert r.price == 899.99
    assert "Kulaklık" in r.title


def test_hepsiburada_fixture():
    html = (FIXTURES / "hepsiburada.html").read_text(encoding="utf-8")
    r = hb_parse(html)
    assert r.price == 4500.0


def test_akakce_fixture():
    html = (FIXTURES / "akakce.html").read_text(encoding="utf-8")
    r = akakce_parse(html)
    assert r.price == 12000.0


def test_cimri_fixture():
    html = (FIXTURES / "cimri.html").read_text(encoding="utf-8")
    r = cimri_parse(html)
    assert r.price == 32999.0

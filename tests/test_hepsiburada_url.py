from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scrapers.base import detect_site
from scrapers.hepsiburada_url import is_hepsiburada_short_url, is_hepsiburada_url
from scrapers.trendyol import resolve_product_url

EXAMPLE_SHORT = "https://hb.biz/HBV00000Y1NON"
CANONICAL = "https://www.hepsiburada.com/apple-iphone-15-128gb-p-HBCV00004X9X2I"


def test_is_hepsiburada_short_url():
    assert is_hepsiburada_short_url(EXAMPLE_SHORT)
    assert is_hepsiburada_short_url("https://www.hb.biz/x")
    assert not is_hepsiburada_short_url("https://www.hepsiburada.com/urun")


def test_detect_site_hb_biz():
    assert detect_site(EXAMPLE_SHORT) == "hepsiburada"


def test_is_hepsiburada_url():
    assert is_hepsiburada_url("https://www.hepsiburada.com/foo")
    assert is_hepsiburada_url(EXAMPLE_SHORT)


@patch("scrapers.trendyol.resolve_redirects", return_value=CANONICAL)
def test_resolve_product_url_expands_hb_biz(mock_resolve):
    ua = "Mozilla/5.0 (test)"
    out = resolve_product_url(EXAMPLE_SHORT, ua)
    mock_resolve.assert_called_once_with(EXAMPLE_SHORT, ua)
    assert out == CANONICAL


@pytest.mark.integration
def test_resolve_product_url_hb_biz_live():
    ua = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    )
    resolved = resolve_product_url(EXAMPLE_SHORT, ua)
    assert "hepsiburada.com" in resolved.lower()

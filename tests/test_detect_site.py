from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scrapers.base import detect_site


def test_detect_trendyol():
    assert detect_site("https://www.trendyol.com/foo-p-123456") == "trendyol"


def test_detect_trendyol_ty_gl():
    assert detect_site("https://ty.gl/abc123") == "trendyol"


def test_detect_trendyol_deeplink():
    assert detect_site("ty://?Page=Product&ContentId=1925865") == "trendyol"


def test_detect_hepsiburada():
    assert detect_site("https://www.hepsiburada.com/urun") == "hepsiburada"

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scrapers.base import detect_site


def test_detect_trendyol():
    assert detect_site("https://www.trendyol.com/foo-p-123") == "trendyol"


def test_detect_hepsiburada():
    assert detect_site("https://www.hepsiburada.com/urun") == "hepsiburada"

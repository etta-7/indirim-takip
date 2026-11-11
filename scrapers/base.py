from __future__ import annotations

from typing import Callable
from urllib.parse import urlparse

import requests

from scrapers import akakce, cimri, hepsiburada, trendyol
from scrapers.pricing import PriceResult

SITE_DETECTORS: list[tuple[str, Callable[[str], bool]]] = [
    ("trendyol", trendyol.url_matches),
    ("hepsiburada", hepsiburada.url_matches),
    ("akakce", akakce.url_matches),
    ("cimri", cimri.url_matches),
]

PARSERS: dict[str, Callable[[str], PriceResult]] = {
    "trendyol": trendyol.parse_html,
    "hepsiburada": hepsiburada.parse_html,
    "akakce": akakce.parse_html,
    "cimri": cimri.parse_html,
}


def detect_site(url: str) -> str:
    for name, matcher in SITE_DETECTORS:
        if matcher(url):
            return name
    host = urlparse(url).netloc.lower()
    if "trendyol" in host:
        return "trendyol"
    if "hepsiburada" in host:
        return "hepsiburada"
    if "akakce" in host or "akakçe" in host:
        return "akakce"
    if "cimri" in host:
        return "cimri"
    return "unknown"


def fetch_html(url: str, user_agent: str, timeout: float = 15.0) -> str:
    headers = {
        "User-Agent": user_agent,
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml",
    }
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding or "utf-8"
    return resp.text


def fetch_price(url: str, user_agent: str) -> PriceResult:
    site = detect_site(url)
    if site == "unknown" or site not in PARSERS:
        raise ValueError(f"Desteklenmeyen veya tanınamayan URL: {url}")

    html = fetch_html(url, user_agent)
    result = PARSERS[site](html)
    if result.price <= 0:
        raise ValueError(f"Fiyat okunamadı: {url}")
    return result

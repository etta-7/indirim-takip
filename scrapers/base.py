from __future__ import annotations

from typing import Callable
from urllib.parse import urlparse

import requests

from scrapers import akakce, cimri, hepsiburada, trendyol
from scrapers.pricing import PriceResult
from scrapers.hepsiburada_url import is_hepsiburada_url
from scrapers.trendyol_url import is_trendyol_url

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
    if is_trendyol_url(url):
        return "trendyol"
    if is_hepsiburada_url(url):
        return "hepsiburada"
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


def fetch_html(
    url: str,
    user_agent: str,
    timeout: float = 15.0,
    extra_headers: dict[str, str] | None = None,
) -> str:
    headers = {
        "User-Agent": user_agent,
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml",
    }
    if extra_headers:
        headers.update(extra_headers)
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding or "utf-8"
    return resp.text


def fetch_price(url: str, user_agent: str) -> PriceResult:
    resolved = trendyol.resolve_product_url(url, user_agent)
    site = detect_site(resolved)
    if site == "unknown" or site not in PARSERS:
        raise ValueError(f"Desteklenmeyen veya tanınamayan URL: {url}")

    if site == "trendyol":
        result = trendyol.fetch_price(resolved, user_agent)
    elif site == "hepsiburada":
        page_url = resolved if "hepsiburada.com" in resolved.lower() else url
        result = hepsiburada.fetch_price(url, user_agent, page_url)
    else:
        html = fetch_html(resolved, user_agent)
        result = PARSERS[site](html)
    if result.price <= 0:
        raise ValueError(f"Fiyat okunamadı: {url}")
    return result

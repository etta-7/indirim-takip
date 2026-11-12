from __future__ import annotations

import re
import urllib.parse

import requests

from scrapers.akakce import parse_html as parse_akakce_html
from scrapers.pricing import PriceResult

_COLOR = frozenset(
    {
        "bej",
        "siyah",
        "beyaz",
        "lacivert",
        "haki",
        "mavi",
        "gri",
        "yesil",
        "yeşil",
        "kirmizi",
        "kırmızı",
    }
)


def _build_query(page_url: str) -> str:
    try:
        parsed = urllib.parse.urlparse(page_url)
        segments = [s for s in parsed.path.split("/") if s]
        brand = segments[0].replace("-", " ") if segments else ""
        slug = segments[-1] if segments else ""
        sku_m = re.search(r"-b(\d+)-p-", slug, re.I) or re.search(r"b(\d{4,})", page_url, re.I)
        sku = f"b{sku_m.group(1)}" if sku_m else ""
        tokens = re.sub(r"-p-\d+$", "", slug).split("-")
        color = next((t for t in tokens if t.lower() in _COLOR), None)
        parts = [p for p in (brand, color, sku) if p]
        return " ".join(parts) if parts else brand or "trendyol"
    except ValueError:
        return "trendyol"


def _score_href(href: str, page_url: str) -> int:
    score = 0
    lower = href.lower()
    sku_m = re.search(r"-b(\d+)-p-", page_url, re.I) or re.search(r"b(\d{4,})", page_url, re.I)
    if sku_m and f"b{sku_m.group(1)}" in lower:
        score += 50
    try:
        path = urllib.parse.urlparse(page_url).path.lower()
        brand = [s for s in path.split("/") if s][0]
        if brand and brand in lower:
            score += 10
        slug = [s for s in path.split("/") if s][-1]
        for t in re.sub(r"-p-\d+$", "", slug).split("-"):
            if t.lower() in _COLOR and t.lower() in lower:
                score += 20
                break
    except (ValueError, IndexError):
        pass
    if "fiyati," in lower:
        score += 5
    return score


def _pick_link(search_html: str, page_url: str) -> str | None:
    best: tuple[int, str] | None = None
    for m in re.finditer(r'href="(/[^"]+,\d+\.html)"', search_html):
        href = m.group(1)
        score = _score_href(href, page_url)
        if score <= 0:
            continue
        if best is None or score > best[0]:
            best = (score, href)
    return best[1] if best else None


def _trendyol_offer_price(html: str) -> float | None:
    for m in re.finditer(r'"vdName":\[0,"Trendyol"\][\s\S]*?"price":\[0,([\d.]+)\]', html):
        val = float(m.group(1))
        if val > 0:
            return val
    return None


def fetch_via_akakce(page_url: str, user_agent: str, timeout: float = 20.0) -> PriceResult:
    q = _build_query(page_url)
    search_url = f"https://www.akakce.com/arama/?q={urllib.parse.quote(q)}"
    headers = {"User-Agent": user_agent, "Accept-Language": "tr-TR,tr;q=0.9"}
    search = requests.get(search_url, headers=headers, timeout=timeout)
    search.raise_for_status()
    href = _pick_link(search.text, page_url)
    if not href:
        raise ValueError("Akakçe'de eşleşen ürün bulunamadı")
    product_url = href if href.startswith("http") else f"https://www.akakce.com{href}"
    prod = requests.get(product_url, headers=headers, timeout=timeout)
    prod.raise_for_status()
    trendyol = _trendyol_offer_price(prod.text)
    if trendyol is not None:
        base = parse_akakce_html(prod.text)
        return PriceResult(title=base.title, price=trendyol)
    parsed = parse_akakce_html(prod.text)
    return PriceResult(title=f"{parsed.title} (piyasa — Akakçe)", price=parsed.price)

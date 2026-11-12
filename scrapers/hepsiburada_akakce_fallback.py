from __future__ import annotations

import re
import urllib.parse

import requests

from scrapers.akakce import parse_html as parse_akakce_html
from scrapers.hepsiburada_url import extract_hepsiburada_sku
from scrapers.pricing import PriceResult


def _build_query(page_url: str) -> str:
    try:
        segments = [s for s in urllib.parse.urlparse(page_url).path.split("/") if s]
        slug = segments[-1] if segments else ""
        name = re.sub(r"-p[m]?-(HB[CV][A-Z0-9]+)$", "", slug, flags=re.I).replace("-", " ")
        if len(name.strip()) > 3:
            return name.strip()
    except ValueError:
        pass
    sku = extract_hepsiburada_sku(page_url)
    if sku:
        return sku
    return "hepsiburada"


def _score_href(href: str, page_url: str) -> int:
    score = 0
    lower = href.lower()
    sku = extract_hepsiburada_sku(page_url)
    if sku and sku.lower() in lower:
        score += 80
    try:
        slug = [s for s in urllib.parse.urlparse(page_url).path.split("/") if s][-1]
        for token in re.sub(r"-p[m]?-(HB[CV][A-Z0-9]+)$", "", slug, flags=re.I).split("-"):
            if len(token) > 2 and token.lower() in lower:
                score += 8
    except (ValueError, IndexError):
        pass
    if "fiyati," in lower:
        score += 5
    return score


def _pick_links(search_html: str, page_url: str, limit: int = 6) -> list[str]:
    ranked: list[tuple[int, str]] = []
    for m in re.finditer(r'href="(/[^"]+,\d+\.html)"', search_html):
        href = m.group(1)
        score = _score_href(href, page_url)
        if score <= 0:
            continue
        ranked.append((score, href))
    ranked.sort(key=lambda row: row[0], reverse=True)
    seen: set[str] = set()
    out: list[str] = []
    for _, href in ranked:
        if href in seen:
            continue
        seen.add(href)
        out.append(href)
        if len(out) >= limit:
            break
    return out


_VARIANT_DRIFT = ("plus", "pro", "max", "mini", "ultra", "se")


def _page_matches_url(html: str, page_url: str) -> bool:
    lower = html.lower()
    sku = extract_hepsiburada_sku(page_url)
    if sku and sku.lower() in lower:
        return True
    try:
        slug = [s for s in urllib.parse.urlparse(page_url).path.split("/") if s][-1]
        stem = re.sub(r"-p[m]?-(HB[CV][A-Z0-9]+)$", "", slug, flags=re.I).lower()
        tokens = [t for t in stem.split("-") if len(t) > 1]
        if len(tokens) < 2:
            return False
        from bs4 import BeautifulSoup

        title = BeautifulSoup(html, "lxml").find("h1")
        title_text = title.get_text(strip=True).lower() if title else ""
        hay = f"{title_text} {lower}"
        if any(token not in hay for token in tokens):
            return False
        for variant in _VARIANT_DRIFT:
            if variant not in stem and variant in title_text:
                return False
        return True
    except (ValueError, IndexError):
        return False


def _hepsiburada_offer_price(html: str) -> float | None:
    normalized = html.replace("&quot;", '"')
    best: float | None = None
    for m in re.finditer(
        r'"vdName":\[0,"Hepsiburada"\][\s\S]*?"price":\[0,([\d.]+)\]',
        normalized,
        flags=re.I,
    ):
        val = float(m.group(1))
        if val > 0 and (best is None or val < best):
            best = val
    return best


def fetch_via_akakce(page_url: str, user_agent: str, timeout: float = 20.0) -> PriceResult:
    headers = {"User-Agent": user_agent, "Accept-Language": "tr-TR,tr;q=0.9"}
    q = _build_query(page_url)
    search = requests.get(
        f"https://www.akakce.com/arama/?q={urllib.parse.quote(q)}",
        headers=headers,
        timeout=timeout,
    )
    search.raise_for_status()
    paths = _pick_links(search.text, page_url)
    sku = extract_hepsiburada_sku(page_url)
    if not paths and sku and sku != q:
        retry = requests.get(
            f"https://www.akakce.com/arama/?q={urllib.parse.quote(sku)}",
            headers=headers,
            timeout=timeout,
        )
        retry.raise_for_status()
        paths = _pick_links(retry.text, page_url)
    if not paths:
        raise ValueError("Akakçe'de eşleşen ürün bulunamadı")
    last_error: str | None = None
    for href in paths:
        product_url = href if href.startswith("http") else f"https://www.akakce.com{href}"
        prod = requests.get(product_url, headers=headers, timeout=timeout)
        prod.raise_for_status()
        if not _page_matches_url(prod.text, page_url):
            last_error = "Akakçe ürünü HB URL ile eşleşmedi"
            continue
        hb = _hepsiburada_offer_price(prod.text)
        if hb is not None:
            base = parse_akakce_html(prod.text)
            return PriceResult(title=base.title, price=hb)
        parsed = parse_akakce_html(prod.text)
        return PriceResult(title=f"{parsed.title} (piyasa — Akakçe)", price=parsed.price)
    raise ValueError(last_error or "Akakçe'de eşleşen ürün bulunamadı")

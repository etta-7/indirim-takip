from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import quote_plus, urljoin

from bs4 import BeautifulSoup

from scrapers.base import fetch_html
from scrapers.pricing import parse_price_text

SUPPORTED_SITES = ("trendyol", "hepsiburada", "akakce", "cimri")

SITE_ALIASES: dict[str, str] = {
    "trendyol": "trendyol",
    "ty": "trendyol",
    "hepsiburada": "hepsiburada",
    "hepsiburda": "hepsiburada",
    "hb": "hepsiburada",
    "akakce": "akakce",
    "akakçe": "akakce",
    "cimri": "cimri",
}

SEARCH_URLS: dict[str, str] = {
    "trendyol": "https://www.trendyol.com/sr?q={q}",
    "hepsiburada": "https://www.hepsiburada.com/ara?q={q}",
    "akakce": "https://www.akakce.com/arama/?q={q}",
    "cimri": "https://www.cimri.com/arama?q={q}",
}

SEARCH_LIMIT = 8


@dataclass(frozen=True)
class SearchResult:
    title: str
    url: str
    price: float | None = None


def normalize_site(name: str | None) -> str | None:
    if not name:
        return None
    key = name.strip().lower()
    return SITE_ALIASES.get(key)


def build_search_url(site: str, query: str) -> str:
    if site not in SEARCH_URLS:
        raise ValueError(f"Bilinmeyen site: {site}")
    return SEARCH_URLS[site].format(q=quote_plus(query))


def _abs_url(site: str, href: str) -> str | None:
    href = (href or "").strip()
    if not href or href.startswith("#"):
        return None
    if href.startswith("http"):
        return href.split("?")[0] if site == "trendyol" else href
    bases = {
        "trendyol": "https://www.trendyol.com",
        "hepsiburada": "https://www.hepsiburada.com",
        "akakce": "https://www.akakce.com",
        "cimri": "https://www.cimri.com",
    }
    return urljoin(bases[site], href)


def _dedupe(results: list[SearchResult]) -> list[SearchResult]:
    seen: set[str] = set()
    out: list[SearchResult] = []
    for r in results:
        if r.url in seen:
            continue
        seen.add(r.url)
        out.append(r)
        if len(out) >= SEARCH_LIMIT:
            break
    return out


def parse_trendyol_search(html: str) -> list[SearchResult]:
    soup = BeautifulSoup(html, "lxml")
    results: list[SearchResult] = []
    for card in soup.select("[data-search-product], .p-card-wrppr, .product-card"):
        link = card.select_one("a[href*='-p-'], a[href*='/p-']") or card.find(
            "a", href=re.compile(r"p-\d+", re.I)
        )
        if not link:
            continue
        url = _abs_url("trendyol", link.get("href", ""))
        if not url:
            continue
        name_el = card.select_one(".prdct-desc-cntnr-name, .product-name")
        title = name_el.get_text(strip=True) if name_el else link.get_text(strip=True)
        price_el = card.select_one(".prc-box-dscntd, .price-item, [class*='price']")
        price = parse_price_text(price_el.get_text()) if price_el else None
        if title:
            results.append(SearchResult(title=title, url=url, price=price))
    return _dedupe(results + _parse_trendyol_search_links(soup))


def _parse_trendyol_search_links(soup: BeautifulSoup) -> list[SearchResult]:
    out: list[SearchResult] = []
    for link in soup.select("a.product-link[href]"):
        url = _abs_url("trendyol", link.get("href", ""))
        if not url:
            continue
        title_el = link.select_one(".product-title") or link
        title = title_el.get_text(strip=True)
        price_el = link.select_one(".product-price")
        price = parse_price_text(price_el.get_text()) if price_el else None
        if title:
            out.append(SearchResult(title=title, url=url, price=price))
    return out


def parse_hepsiburada_search(html: str) -> list[SearchResult]:
    soup = BeautifulSoup(html, "lxml")
    results: list[SearchResult] = []
    for item in soup.select("[data-test-id='product-card'], li.search-item, .productListContent-item"):
        link = item.select_one("a[href*='/p-'], a.hb-pp")
        if not link:
            continue
        url = _abs_url("hepsiburada", link.get("href", ""))
        if not url:
            continue
        title_el = item.select_one("[data-test-id='product-name'], h3, .title")
        title = title_el.get_text(strip=True) if title_el else link.get_text(strip=True)
        price_el = item.select_one("[data-test-id='price-current-price'], .price")
        price = parse_price_text(price_el.get_text()) if price_el else None
        if title:
            results.append(SearchResult(title=title, url=url, price=price))
    extra: list[SearchResult] = []
    for link in soup.select("a.hb-search-item[href]"):
        url = _abs_url("hepsiburada", link.get("href", ""))
        if not url:
            continue
        title = link.select_one(".title").get_text(strip=True) if link.select_one(".title") else link.get_text(strip=True)
        price_el = link.select_one(".price-value")
        price = parse_price_text(price_el.get_text()) if price_el else None
        extra.append(SearchResult(title=title, url=url, price=price))
    return _dedupe(results + extra)


def parse_akakce_search(html: str) -> list[SearchResult]:
    soup = BeautifulSoup(html, "lxml")
    results: list[SearchResult] = []
    for row in soup.select("ul#APL li, .p_w_v9, tr[data-pr]"):
        link = row.select_one("a[href*='.html']")
        if not link:
            continue
        url = _abs_url("akakce", link.get("href", ""))
        if not url:
            continue
        title_el = row.select_one(".pn_v8, .p_n_v8, a")
        title = title_el.get_text(strip=True) if title_el else link.get_text(strip=True)
        price_el = row.select_one(".pt_v8, .price, .p_v8")
        price = parse_price_text(price_el.get_text()) if price_el else None
        if title:
            results.append(SearchResult(title=title, url=url, price=price))
    extra: list[SearchResult] = []
    for link in soup.select("a.akakce-search-hit[href]"):
        url = _abs_url("akakce", link.get("href", ""))
        if not url:
            continue
        title = link.get_text(strip=True)
        price_el = link.find_next(class_="hit-price")
        price = parse_price_text(price_el.get_text()) if price_el else None
        extra.append(SearchResult(title=title, url=url, price=price))
    return _dedupe(results + extra)


def parse_cimri_search(html: str) -> list[SearchResult]:
    soup = BeautifulSoup(html, "lxml")
    results: list[SearchResult] = []
    for card in soup.select("[data-testid='product-card'], .o-card, .search-result-item"):
        link = card.select_one("a[href*='/urun/'], a.product-link")
        if not link:
            continue
        url = _abs_url("cimri", link.get("href", ""))
        if not url:
            continue
        title_el = card.select_one("[data-testid='product-title'], h3, .product-name")
        title = title_el.get_text(strip=True) if title_el else link.get_text(strip=True)
        price_el = card.select_one("[data-testid='product-price'], .price")
        price = parse_price_text(price_el.get_text()) if price_el else None
        if title:
            results.append(SearchResult(title=title, url=url, price=price))
    extra: list[SearchResult] = []
    for link in soup.select("a.cimri-search-card[href]"):
        url = _abs_url("cimri", link.get("href", ""))
        if not url:
            continue
        title_el = link.select_one(".card-title")
        title = title_el.get_text(strip=True) if title_el else link.get_text(strip=True)
        price_el = link.select_one(".card-price")
        price = parse_price_text(price_el.get_text()) if price_el else None
        extra.append(SearchResult(title=title, url=url, price=price))
    return _dedupe(results + extra)


SEARCH_PARSERS = {
    "trendyol": parse_trendyol_search,
    "hepsiburada": parse_hepsiburada_search,
    "akakce": parse_akakce_search,
    "cimri": parse_cimri_search,
}


def parse_search_html(site: str, html: str) -> list[SearchResult]:
    parser = SEARCH_PARSERS.get(site)
    if not parser:
        raise ValueError(f"Bilinmeyen site: {site}")
    return parser(html)


def search(site: str, query: str, user_agent: str, *, timeout: float = 15.0) -> list[SearchResult]:
    site = normalize_site(site) or site
    if site not in SEARCH_PARSERS:
        raise ValueError(f"Bilinmeyen site: {site}")
    url = build_search_url(site, query)
    html = fetch_html(url, user_agent, timeout=timeout)
    results = parse_search_html(site, html)
    if not results:
        raise ValueError(f"Arama sonucu bulunamadı ({site}): {query}")
    return results

from __future__ import annotations

import re

from bs4 import BeautifulSoup

import re

import requests

from scrapers.pricing import PriceResult, extract_json_ld_price, extract_meta_price, parse_price_text


def url_matches(url: str) -> bool:
    from scrapers.hepsiburada_url import is_hepsiburada_url

    return is_hepsiburada_url(url)


def parse_html(html: str) -> PriceResult:
    soup = BeautifulSoup(html, "lxml")
    title_tag = soup.find("h1", id="product-name") or soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else "Hepsiburada ürün"

    price: float | None = None
    ld_title, ld_price = extract_json_ld_price(soup)
    if ld_price is not None:
        price = ld_price
        if ld_title:
            title = ld_title

    if price is None:
        price = extract_meta_price(soup)

    if price is None:
        el = soup.select_one("[data-test-id='price-current-price']") or soup.select_one(
            ".product-price"
        )
        if el:
            price = parse_price_text(el.get_text())

    if price is None:
        m = re.search(r'"price"\s*:\s*"?([\d.,]+)"?', html)
        if m:
            price = parse_price_text(m.group(1))

    if price is None:
        raise ValueError("Hepsiburada fiyat bulunamadı")

    return PriceResult(title=title, price=price)


def _is_security_page(html: str) -> bool:
    return bool(re.search(r"HBBlockandCaptcha|Hepsiburada\s*\|\s*Güvenlik", html))


def fetch_price(url: str, user_agent: str, page_url: str | None = None) -> PriceResult:
    from scrapers.hepsiburada_akakce_fallback import fetch_via_akakce

    target = page_url or url
    errors: list[str] = []
    if "hepsiburada.com" in target.lower():
        headers = {
            "User-Agent": user_agent,
            "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml",
            "Referer": target,
            "Origin": "https://www.hepsiburada.com",
        }
        try:
            resp = requests.get(target, headers=headers, timeout=15.0)
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding or "utf-8"
            if not _is_security_page(resp.text):
                return parse_html(resp.text)
            errors.append("Hepsiburada güvenlik sayfası")
        except requests.RequestException as exc:
            errors.append(str(exc))
    try:
        return fetch_via_akakce(target, user_agent)
    except (requests.RequestException, ValueError) as exc:
        errors.append(str(exc))
    raise ValueError(
        "Hepsiburada fiyat bulunamadı" + (f" ({'; '.join(errors[:3])})" if errors else "")
    )

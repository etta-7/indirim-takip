from __future__ import annotations

import re

from bs4 import BeautifulSoup

from scrapers.pricing import PriceResult, extract_json_ld_price, parse_price_text


def url_matches(url: str) -> bool:
    return "cimri.com" in url.lower()


def parse_html(html: str) -> PriceResult:
    soup = BeautifulSoup(html, "lxml")
    title_tag = soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else "Cimri ürün"

    price: float | None = None
    ld_title, ld_price = extract_json_ld_price(soup)
    if ld_price is not None:
        price = ld_price
        if ld_title:
            title = ld_title

    if price is None:
        el = soup.select_one("[data-testid='product-price']") or soup.select_one(".lowest-price")
        if el:
            price = parse_price_text(el.get_text())

    if price is None:
        m = re.search(r'"price"\s*:\s*([\d.]+)', html)
        if m:
            price = float(m.group(1))

    if price is None:
        raise ValueError("Cimri fiyat bulunamadı")

    return PriceResult(title=title, price=price)

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from scrapers.pricing import PriceResult, extract_json_ld_price, extract_meta_price, parse_price_text


def url_matches(url: str) -> bool:
    return "trendyol.com" in url.lower()


def parse_html(html: str) -> PriceResult:
    soup = BeautifulSoup(html, "lxml")
    title_tag = soup.find("h1", class_=re.compile("pr-new-br"))
    if not title_tag:
        title_tag = soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else "Trendyol ürün"

    price: float | None = None
    ld_title, ld_price = extract_json_ld_price(soup)
    if ld_price is not None:
        price = ld_price
        if ld_title:
            title = ld_title

    if price is None:
        price = extract_meta_price(soup)

    if price is None:
        for sel in (
            ".prc-dsc",
            ".prc-slg",
            "[class*='price']",
        ):
            el = soup.select_one(sel)
            if el:
                p = parse_price_text(el.get_text())
                if p is not None:
                    price = p
                    break

    if price is None:
        m = re.search(r'"sellingPrice"\s*:\s*([\d.]+)', html)
        if m:
            price = float(m.group(1))

    if price is None:
        raise ValueError("Trendyol fiyat bulunamadı")

    return PriceResult(title=title, price=price)

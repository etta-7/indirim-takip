from __future__ import annotations

import json
import re

from bs4 import BeautifulSoup
from dataclasses import dataclass


@dataclass(frozen=True)
class PriceResult:
    title: str
    price: float
    currency: str = "TRY"


PRICE_TEXT_RE = re.compile(r"[\d.,]+")


def parse_price_text(text: str) -> float | None:
    text = text.strip()
    if not text:
        return None
    cleaned = re.sub(r"[^\d,.\s]", "", text)
    cleaned = cleaned.replace(" ", "")
    if not cleaned:
        return None
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        parts = cleaned.split(",")
        if len(parts) == 2 and len(parts[1]) <= 2:
            cleaned = parts[0].replace(".", "") + "." + parts[1]
        else:
            cleaned = cleaned.replace(",", "")
    else:
        if cleaned.count(".") == 1 and len(cleaned.split(".")[-1]) == 3:
            cleaned = cleaned.replace(".", "")
    try:
        value = float(cleaned)
    except ValueError:
        return None
    return value if value > 0 else None


def extract_json_ld_price(soup: BeautifulSoup) -> tuple[str | None, float | None]:
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            title = item.get("name")
            offers = item.get("offers")
            if isinstance(offers, dict):
                price = offers.get("price") or offers.get("lowPrice")
                if price is not None:
                    p = parse_price_text(str(price))
                    if p is not None:
                        return title, p
            if item.get("price") is not None:
                p = parse_price_text(str(item["price"]))
                if p is not None:
                    return title, p
    return None, None


def extract_meta_price(soup: BeautifulSoup) -> float | None:
    for prop in ("product:price:amount", "og:price:amount"):
        tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            p = parse_price_text(tag["content"])
            if p is not None:
                return p
    tag = soup.find("meta", itemprop="price")
    if tag and tag.get("content"):
        p = parse_price_text(tag["content"])
        if p is not None:
            return p
    return None

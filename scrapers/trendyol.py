from __future__ import annotations

import re
from urllib.parse import parse_qs, urlencode, urlparse

import requests
from bs4 import BeautifulSoup

from scrapers.pricing import PriceResult, extract_json_ld_price, extract_meta_price, parse_price_text
from scrapers.hepsiburada_url import is_hepsiburada_short_url
from scrapers.trendyol_url import (
    canonical_trendyol_product_url,
    extract_trendyol_content_id,
    is_trendyol_url,
    normalize_trendyol_url,
)

API_BASE = "https://apigw.trendyol.com/discovery-web-productgw-service/api/productDetail"


def url_matches(url: str) -> bool:
    return is_trendyol_url(url)


def trendyol_request_headers(referer: str | None = None) -> dict[str, str]:
    return {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "Origin": "https://www.trendyol.com",
        "Referer": referer or "https://www.trendyol.com/",
        "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
    }


def _numeric_price(value: object) -> float | None:
    if isinstance(value, (int, float)) and value > 0:
        return float(value)
    if isinstance(value, dict) and value.get("value") is not None:
        val = float(value["value"])
        if val > 0:
            return val
    return None


def _pick_price_from_result(res: dict) -> float | None:
    price_block = res.get("price")
    if isinstance(price_block, dict):
        for key in ("discountedPrice", "sellingPrice", "originalPrice", "salePrice", "buyingPrice"):
            p = _numeric_price(price_block.get(key))
            if p is not None:
                return p
        current = price_block.get("current")
        if isinstance(current, (int, float)) and current > 0:
            return float(current)
    for key in ("lowestPrice", "price"):
        p = _numeric_price(res.get(key))
        if p is not None:
            return p
    listings = res.get("merchantListing")
    if isinstance(listings, dict) and isinstance(listings.get("price"), dict):
        p = _pick_price_from_result({"price": listings["price"]})
        if p is not None:
            return p
    return None


def parse_api_payload(body: dict) -> PriceResult:
    res = body.get("result")
    if not isinstance(res, dict):
        raise ValueError("Trendyol API yanıtı geçersiz")
    title = str(res.get("name") or "Trendyol ürün")
    price = _pick_price_from_result(res)
    if price is None:
        raise ValueError("Trendyol fiyat bulunamadı")
    return PriceResult(title=title, price=price)


def _listing_params(page_url: str | None) -> dict[str, str]:
    if not page_url:
        return {}
    try:
        parsed = urlparse(page_url)
        out: dict[str, str] = {}
        q = parse_qs(parsed.query)
        if q.get("merchantId"):
            out["merchantId"] = q["merchantId"][0]
        if q.get("boutiqueId"):
            out["boutiqueId"] = q["boutiqueId"][0]
        return out
    except ValueError:
        return {}


def fetch_via_api(
    content_id: int,
    user_agent: str,
    page_url: str | None = None,
    timeout: float = 15.0,
) -> PriceResult:
    params = {
        "sav": "false",
        "storefrontId": "1",
        "culture": "tr-TR",
        "linearVariants": "true",
        "isLegalRequirementConfirmed": "false",
        **_listing_params(page_url),
    }
    qs = urlencode(params)
    referer = (
        page_url
        if page_url and is_trendyol_url(page_url)
        else canonical_trendyol_product_url(content_id)
    )
    headers = {"User-Agent": user_agent, **trendyol_request_headers(referer)}
    resp = requests.get(f"{API_BASE}/{content_id}?{qs}", headers=headers, timeout=timeout)
    resp.raise_for_status()
    return parse_api_payload(resp.json())


def resolve_redirects(url: str, user_agent: str, timeout: float = 15.0, max_hops: int = 6) -> str:
    headers = {
        "User-Agent": user_agent,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "tr-TR,tr;q=0.9",
        **trendyol_request_headers(url if "trendyol" in url.lower() else None),
    }
    current = url
    session = requests.Session()
    for _ in range(max_hops):
        resp = session.get(current, headers=headers, allow_redirects=False, timeout=timeout)
        if resp.status_code in (301, 302, 303, 307, 308):
            loc = resp.headers.get("Location")
            if not loc:
                break
            current = requests.compat.urljoin(current, loc)
            continue
        break
    return current


def resolve_product_url(url: str, user_agent: str) -> str:
    u = url.strip()
    if not u:
        return u
    if u.startswith("ty://"):
        return normalize_trendyol_url(u)
    if re.search(r"ty\.gl/", u, re.I):
        try:
            u = resolve_redirects(u, user_agent)
        except requests.RequestException:
            pass
    if is_hepsiburada_short_url(u):
        try:
            u = resolve_redirects(u, user_agent)
        except requests.RequestException:
            pass
    return normalize_trendyol_url(u)


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
        patterns = (
            r'"discountedPrice"\s*:\s*\{[^}]*"value"\s*:\s*([\d.]+)',
            r'"sellingPrice"\s*:\s*\{[^}]*"value"\s*:\s*([\d.]+)',
            r'"sellingPrice"\s*:\s*([\d.]+)',
            r'"discountedPrice"\s*:\s*([\d.]+)',
        )
        for pat in patterns:
            m = re.search(pat, html)
            if m:
                val = float(m.group(1))
                if val > 0:
                    price = val
                    break

    if price is None:
        raise ValueError("Trendyol fiyat bulunamadı")

    return PriceResult(title=title, price=price)


def fetch_price(url: str, user_agent: str) -> PriceResult:
    from scrapers.trendyol_akakce_fallback import fetch_via_akakce

    resolved = resolve_product_url(url, user_agent)
    page_url = resolved if is_trendyol_url(resolved) else url
    content_id = extract_trendyol_content_id(page_url)
    errors: list[str] = []
    if content_id is not None:
        try:
            return fetch_via_api(content_id, user_agent, page_url)
        except (requests.RequestException, ValueError) as exc:
            errors.append(str(exc))
    headers = {
        "User-Agent": user_agent,
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml",
        **trendyol_request_headers(page_url),
    }
    try:
        resp = requests.get(page_url, headers=headers, timeout=15.0)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding or "utf-8"
        return parse_html(resp.text)
    except requests.RequestException as exc:
        errors.append(str(exc))
    try:
        return fetch_via_akakce(page_url, user_agent)
    except (requests.RequestException, ValueError) as exc:
        errors.append(str(exc))
    raise ValueError(
        "Trendyol fiyat bulunamadı" + (f" ({'; '.join(errors[:3])})" if errors else "")
    )

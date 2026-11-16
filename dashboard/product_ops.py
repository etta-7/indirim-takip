from __future__ import annotations

from dataclasses import dataclass

from alert_rules import NO_ABSOLUTE_TARGET, normalize_alert_text, parse_percent_token, split_alert_args
from db import Product, ProductRepository
from scrapers.base import detect_site
from scrapers.trendyol import resolve_product_url


@dataclass
class AddProductRequest:
    url: str
    target_price: float | None = None
    target_drop_percent: float | None = None
    target_text: str | None = None


def parse_target_text(text: str) -> tuple[float | None, float | None]:
    text = normalize_alert_text(text)
    tokens, drop_pct = split_alert_args(text.split())
    target: float | None = None
    if tokens:
        if parse_percent_token(tokens[0]) is not None:
            target = NO_ABSOLUTE_TARGET
        else:
            try:
                target = float(tokens[0].replace(",", "."))
            except ValueError:
                return None, None
    if drop_pct is None and len(tokens) > 1:
        drop_pct = parse_percent_token(tokens[1])
    if target is None and drop_pct is None:
        return None, None
    if target is None and drop_pct is not None:
        target = NO_ABSOLUTE_TARGET
    return target, drop_pct


def resolve_targets(req: AddProductRequest) -> tuple[float, float | None] | str:
    target = req.target_price
    drop = req.target_drop_percent
    if req.target_text:
        parsed_target, parsed_drop = parse_target_text(req.target_text)
        if parsed_target is None and parsed_drop is None:
            return "Geçersiz hedef. Örnek: 2500, 10% veya 2500 10%"
        if target is None:
            target = parsed_target
        if drop is None:
            drop = parsed_drop
    if target is None and drop is None:
        return "En az bir uyarı eşiği gerekli (TL hedefi veya yüzde)."
    if target is None:
        target = NO_ABSOLUTE_TARGET
    if target < 0 and drop is None:
        return "En az bir uyarı eşiği gerekli (TL hedefi veya yüzde)."
    return target, drop


DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def add_product(
    repo: ProductRepository,
    req: AddProductRequest,
    http_user_agent: str | None = None,
) -> Product | str:
    raw = req.url.strip()
    if not raw:
        return "URL gerekli."
    ua = http_user_agent or DEFAULT_UA
    url = resolve_product_url(raw, ua)
    resolved = resolve_targets(req)
    if isinstance(resolved, str):
        return resolved
    target, drop = resolved
    site = detect_site(url)
    if site == "unknown":
        return "URL tanınamadı. Trendyol, Hepsiburada, Akakçe veya Cimri linki gerekli."
    try:
        return repo.add_product(
            url,
            site,
            target,
            target_drop_percent=drop,
        )
    except Exception:
        return "Bu URL zaten listede veya kayıt başarısız."


def product_to_dict(p: Product) -> dict:
    return {
        "id": p.id,
        "url": p.url,
        "site": p.site,
        "title": p.title,
        "target_price": p.target_price,
        "last_price": p.last_price,
        "last_checked_at": p.last_checked_at,
        "target_drop_percent": p.target_drop_percent,
        "baseline_price": p.baseline_price,
    }

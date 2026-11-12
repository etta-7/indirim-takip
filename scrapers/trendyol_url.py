from __future__ import annotations

import re
from urllib.parse import urlparse

PRODUCT_ID_IN_PATH = re.compile(r"(?:^|[/?&-])p-(\d{6,})", re.I)
CONTENT_ID_DEEPLINK = re.compile(r"ContentId=(\d{6,})", re.I)
CONTENT_ID_QUERY = re.compile(r"[?&]contentId=(\d{6,})", re.I)


def is_trendyol_url(url: str) -> bool:
    u = url.strip().lower()
    if not u:
        return False
    if u.startswith("ty://"):
        return True
    if "ty.gl" in u:
        return True
    if "trendyol" in u:
        return True
    try:
        host = urlparse(url.strip()).netloc.lower()
        return "trendyol" in host or host == "ty.gl"
    except ValueError:
        return False


def extract_trendyol_content_id(url: str) -> int | None:
    u = url.strip()
    m = CONTENT_ID_DEEPLINK.search(u)
    if m:
        return int(m.group(1))
    m = CONTENT_ID_QUERY.search(u)
    if m:
        return int(m.group(1))
    m = PRODUCT_ID_IN_PATH.search(u)
    if m:
        return int(m.group(1))
    return None


def canonical_trendyol_product_url(content_id: int) -> str:
    return f"https://www.trendyol.com/-p-{content_id}"


def normalize_trendyol_url(url: str) -> str:
    trimmed = url.strip()
    if trimmed.startswith("ty://"):
        cid = extract_trendyol_content_id(trimmed)
        if cid is not None:
            return canonical_trendyol_product_url(cid)
        return trimmed
    cid = extract_trendyol_content_id(trimmed)
    if cid is not None and ("ty.gl" in trimmed.lower() or "trendyol.com" not in trimmed.lower()):
        return canonical_trendyol_product_url(cid)
    return trimmed

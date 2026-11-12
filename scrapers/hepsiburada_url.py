from __future__ import annotations

import re
from urllib.parse import urlparse


def is_hepsiburada_short_url(url: str) -> bool:
    u = url.strip().lower()
    if not u:
        return False
    if "hb.biz" in u:
        return True
    try:
        host = urlparse(url.strip()).netloc.lower()
        return host == "hb.biz" or host.endswith(".hb.biz")
    except ValueError:
        return False


def is_hepsiburada_url(url: str) -> bool:
    u = url.strip().lower()
    if not u:
        return False
    if "hepsiburada.com" in u:
        return True
    return is_hepsiburada_short_url(url)


def extract_hepsiburada_sku(url: str) -> str | None:
    slug_m = re.search(r"-p[m]?-(HB[CV][A-Z0-9]+)", url, re.I)
    if slug_m:
        return slug_m.group(1).upper()
    try:
        path = urlparse(url.strip()).path.lstrip("/")
        segment = [s for s in path.split("/") if s][-1] if path else ""
        if segment and re.match(r"^HB[CV]", segment, re.I):
            return segment.upper()
    except ValueError:
        pass
    loose = re.search(r"(HB[CV][A-Z0-9]{10,})", url, re.I)
    return loose.group(1).upper() if loose else None


def is_failed_hepsiburada_short_resolve(resolved: str, original: str) -> bool:
    if not is_hepsiburada_short_url(original):
        return False
    r = resolved.strip().lower().rstrip("/")
    if r in ("https://hb.biz", "http://hb.biz"):
        return True
    return "hepsiburada.com" not in resolved.lower()

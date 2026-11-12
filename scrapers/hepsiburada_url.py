from __future__ import annotations

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

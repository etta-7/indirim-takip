"""Fiyat uyarısı kuralları (mutlak hedef ve yüzdelik düşüş)."""

from __future__ import annotations

import re

PERCENT_TOKEN_RE = re.compile(r"^(\d+(?:[.,]\d+)?)\s*%$", re.I)

# Yalnızca yüzde eşiği: mutlak TL kontrolü devre dışı
NO_ABSOLUTE_TARGET = -1.0


def absolute_target_active(target_price: float) -> bool:
    return target_price >= 0


def percent_drop_from_baseline(baseline: float, current: float) -> float:
    """Baseline'dan current'a düşüş yüzdesi (pozitif = ucuzladı)."""
    if baseline <= 0:
        return 0.0
    return max(0.0, (baseline - current) / baseline * 100.0)


def should_alert_absolute(current: float, target_price: float) -> bool:
    if not absolute_target_active(target_price):
        return False
    return current <= target_price


def parse_percent_token(text: str) -> float | None:
    m = PERCENT_TOKEN_RE.match(text.strip())
    if not m:
        return None
    return float(m.group(1).replace(",", "."))


def split_alert_args(args: list[str]) -> tuple[list[str], float | None]:
    """--percent N ve N% biçimlerini ayırır; kalan argümanları döner."""
    percent: float | None = None
    rest: list[str] = []
    i = 0
    while i < len(args):
        token = args[i]
        if token == "--percent" and i + 1 < len(args):
            try:
                percent = float(args[i + 1].replace(",", "."))
            except ValueError:
                rest.extend(args[i:])
                break
            i += 2
            continue
        pct = parse_percent_token(token)
        if pct is not None:
            percent = pct
            i += 1
            continue
        rest.append(token)
        i += 1
    return rest, percent


def should_alert_percent_drop(
    current: float,
    baseline: float | None,
    target_drop_percent: float | None,
) -> bool:
    if target_drop_percent is None or target_drop_percent <= 0:
        return False
    if baseline is None or baseline <= 0:
        return False
    drop = percent_drop_from_baseline(baseline, current)
    return drop >= target_drop_percent

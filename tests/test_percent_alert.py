from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from alert_rules import (
    NO_ABSOLUTE_TARGET,
    percent_drop_from_baseline,
    should_alert_absolute,
    should_alert_percent_drop,
    split_alert_args,
)
from db import Product, ProductRepository
from price_checker import PriceChecker


def test_percent_drop_calculation():
    assert percent_drop_from_baseline(1000, 900) == pytest.approx(10.0)
    assert percent_drop_from_baseline(1000, 1000) == 0.0
    assert percent_drop_from_baseline(1000, 1100) == 0.0


def test_should_alert_percent_trigger():
    assert should_alert_percent_drop(850, 1000, 10) is True
    assert should_alert_percent_drop(950, 1000, 10) is False
    assert should_alert_percent_drop(850, None, 10) is False


def test_should_alert_absolute_sentinel():
    assert should_alert_absolute(100, NO_ABSOLUTE_TARGET) is False
    assert should_alert_absolute(100, 150) is True
    assert should_alert_absolute(200, 150) is False


def test_split_alert_args():
    rest, pct = split_alert_args(["2500", "--percent", "10", "mont"])
    assert pct == 10
    assert rest == ["2500", "mont"]
    rest2, pct2 = split_alert_args(["10%", "urun"])
    assert pct2 == 10
    assert rest2 == ["urun"]


@pytest.mark.asyncio
async def test_percent_notify_updates_baseline(tmp_path):
    db_path = str(tmp_path / "t.db")
    repo = ProductRepository(db_path)
    repo.init_db()
    product = repo.add_product(
        "https://www.trendyol.com/x",
        "trendyol",
        NO_ABSOLUTE_TARGET,
        target_drop_percent=10.0,
        baseline_price=1000.0,
    )
    bot = MagicMock()
    bot.send_message = AsyncMock()
    settings = MagicMock()
    settings.telegram_chat_id = 1
    settings.http_user_agent = "test"

    checker = PriceChecker(settings, repo, bot)
    fetch_result = MagicMock(title="Test", price=850.0)

    import price_checker as pc

    original = pc.fetch_price
    pc.fetch_price = lambda *a, **k: fetch_result
    try:
        await checker._check_product(product)
    finally:
        pc.fetch_price = original

    updated = repo.get_product(product.id)
    assert updated is not None
    assert updated.baseline_price == pytest.approx(850.0)
    assert bot.send_message.await_count == 1

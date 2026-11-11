from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from telegram import Bot
from telegram.constants import ParseMode

from alert_rules import (
    absolute_target_active,
    percent_drop_from_baseline,
    should_alert_absolute,
    should_alert_percent_drop,
)
from config import Settings
from db import Product, ProductRepository
from scrapers.base import fetch_price

logger = logging.getLogger(__name__)

NOTIFY_COOLDOWN_HOURS = 24


def _parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts)
    except ValueError:
        return None


def format_price(amount: float) -> str:
    return f"{amount:,.2f} TL".replace(",", "X").replace(".", ",").replace("X", ".")


def format_percent(value: float) -> str:
    if value == int(value):
        return f"%{int(value)}"
    return f"%{value:g}"


class PriceChecker:
    def __init__(self, settings: Settings, repo: ProductRepository, bot: Bot) -> None:
        self.settings = settings
        self.repo = repo
        self.bot = bot
        self._last_run: datetime | None = None

    @property
    def last_run(self) -> datetime | None:
        return self._last_run

    async def check_all(self) -> tuple[int, int]:
        products = self.repo.list_products()
        ok, failed = 0, 0
        for product in products:
            try:
                await self._check_product(product)
                ok += 1
            except Exception as exc:
                failed += 1
                logger.exception("Ürün kontrol hatası id=%s: %s", product.id, exc)
            await asyncio.sleep(1)
        self._last_run = datetime.now(timezone.utc)
        return ok, failed

    async def _check_product(self, product: Product) -> None:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None, lambda: fetch_price(product.url, self.settings.http_user_agent)
        )

        old_price = product.last_price
        now = datetime.now(timezone.utc)

        baseline = product.baseline_price
        if baseline is None:
            baseline = result.price

        abs_hit = should_alert_absolute(result.price, product.target_price)
        pct_hit = should_alert_percent_drop(
            result.price, baseline, product.target_drop_percent
        )

        cooldown_until: str | None = None
        baseline_update: float | None = None

        cd = _parse_iso(product.notify_cooldown_until)
        on_cooldown = cd is not None and now < cd

        if product.baseline_price is None:
            baseline_update = result.price

        if (abs_hit or pct_hit) and not on_cooldown:
            if abs_hit:
                await self._send_absolute_alert(
                    product, result.title, old_price, result.price
                )
            if pct_hit:
                drop = percent_drop_from_baseline(baseline, result.price)
                await self._send_percent_alert(
                    product,
                    result.title,
                    baseline,
                    old_price,
                    result.price,
                    drop,
                )
                baseline_update = result.price
            until = now + timedelta(hours=NOTIFY_COOLDOWN_HOURS)
            cooldown_until = until.replace(microsecond=0).isoformat()

        self.repo.update_after_check(
            product.id,
            title=result.title,
            last_price=result.price,
            notify_cooldown_until=cooldown_until,
            baseline_price=baseline_update,
        )

    async def _send_absolute_alert(
        self,
        product: Product,
        title: str,
        old_price: float | None,
        new_price: float,
    ) -> None:
        if not absolute_target_active(product.target_price):
            return
        old_s = format_price(old_price) if old_price is not None else "—"
        text = (
            f"🔻 *Fiyat hedefin altında*\n\n"
            f"*{title}*\n"
            f"Yeni: `{format_price(new_price)}`\n"
            f"Önceki: `{old_s}`\n"
            f"Hedef: `{format_price(product.target_price)}`\n"
            f"[Ürüne git]({product.url})"
        )
        await self.bot.send_message(
            chat_id=self.settings.telegram_chat_id,
            text=text,
            parse_mode=ParseMode.MARKDOWN,
            disable_web_page_preview=False,
        )

    async def _send_percent_alert(
        self,
        product: Product,
        title: str,
        baseline: float,
        old_price: float | None,
        new_price: float,
        drop_pct: float,
    ) -> None:
        old_s = format_price(old_price) if old_price is not None else "—"
        threshold = product.target_drop_percent or 0
        text = (
            f"📉 *Yüzdelik düşüş hedefine ulaşıldı*\n\n"
            f"*{title}*\n"
            f"Yeni: `{format_price(new_price)}`\n"
            f"Önceki kontrol: `{old_s}`\n"
            f"Referans (baz): `{format_price(baseline)}`\n"
            f"Düşüş: `{drop_pct:.1f}%` (eşik: {format_percent(threshold)})\n"
            f"[Ürüne git]({product.url})"
        )
        await self.bot.send_message(
            chat_id=self.settings.telegram_chat_id,
            text=text,
            parse_mode=ParseMode.MARKDOWN,
            disable_web_page_preview=False,
        )

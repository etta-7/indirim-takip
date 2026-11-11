from __future__ import annotations

import logging
import re

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from config import Settings
from db import ProductRepository
from price_checker import PriceChecker, format_price
from scrapers.base import detect_site

logger = logging.getLogger(__name__)

URL_RE = re.compile(r"https?://\S+", re.I)


def user_allowed(settings: Settings, user_id: int | None) -> bool:
    if not settings.allowed_telegram_user_ids:
        return True
    return user_id is not None and user_id in settings.allowed_telegram_user_ids


async def _reject_unauthorized(update: Update) -> bool:
    if update.effective_user is None:
        return True
    return False


def build_handlers(
    settings: Settings,
    repo: ProductRepository,
    checker: PriceChecker,
) -> list[CommandHandler]:
    async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not user_allowed(settings, update.effective_user and update.effective_user.id):
            await update.message.reply_text("Bu botu kullanma yetkiniz yok.")
            return
        await update.message.reply_text(
            "İndirim takip botu\n\n"
            "/add <url> <hedef_fiyat> — ürün ekle\n"
            "/list — listele\n"
            "/remove <id> — sil\n"
            "/check — hemen fiyat kontrolü\n"
            "/status — durum"
        )

    async def add_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not user_allowed(settings, update.effective_user and update.effective_user.id):
            await update.message.reply_text("Bu botu kullanma yetkiniz yok.")
            return
        args = context.args or []
        if len(args) < 2:
            await update.message.reply_text("Kullanım: /add <url> <hedef_fiyat>")
            return
        url = args[0]
        try:
            target = float(args[1].replace(",", "."))
        except ValueError:
            await update.message.reply_text("Geçersiz hedef fiyat.")
            return
        site = detect_site(url)
        if site == "unknown":
            await update.message.reply_text(
                "URL tanınamadı. Trendyol, Hepsiburada, Akakçe veya Cimri linki kullanın."
            )
            return
        try:
            product = repo.add_product(url, site, target)
        except Exception:
            await update.message.reply_text("Bu URL zaten listede veya kayıt başarısız.")
            return
        await update.message.reply_text(
            f"Eklendi #{product.id} ({site}) hedef {format_price(target)}"
        )

    async def list_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not user_allowed(settings, update.effective_user and update.effective_user.id):
            await update.message.reply_text("Bu botu kullanma yetkiniz yok.")
            return
        products = repo.list_products()
        if not products:
            await update.message.reply_text("Liste boş.")
            return
        lines = []
        for p in products:
            last = format_price(p.last_price) if p.last_price is not None else "—"
            name = (p.title or p.url)[:60]
            lines.append(
                f"#{p.id} [{p.site}] {name}\n  Son: {last} | Hedef: {format_price(p.target_price)}"
            )
        await update.message.reply_text("\n\n".join(lines))

    async def remove_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not user_allowed(settings, update.effective_user and update.effective_user.id):
            await update.message.reply_text("Bu botu kullanma yetkiniz yok.")
            return
        args = context.args or []
        if not args:
            await update.message.reply_text("Kullanım: /remove <id>")
            return
        try:
            pid = int(args[0])
        except ValueError:
            await update.message.reply_text("Geçersiz id.")
            return
        if repo.remove_product(pid):
            await update.message.reply_text(f"#{pid} silindi.")
        else:
            await update.message.reply_text("Ürün bulunamadı.")

    async def check_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not user_allowed(settings, update.effective_user and update.effective_user.id):
            await update.message.reply_text("Bu botu kullanma yetkiniz yok.")
            return
        await update.message.reply_text("Fiyat kontrolü başlıyor…")
        ok, failed = await checker.check_all()
        await update.message.reply_text(f"Tamamlandı: {ok} başarılı, {failed} hata.")

    async def status_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not user_allowed(settings, update.effective_user and update.effective_user.id):
            await update.message.reply_text("Bu botu kullanma yetkiniz yok.")
            return
        count = repo.count()
        last_db = repo.latest_check_time()
        last_job = checker.last_run
        last_job_s = last_job.isoformat() if last_job else "henüz yok"
        await update.message.reply_text(
            f"Ürün sayısı: {count}\n"
            f"Son DB kontrolü: {last_db or '—'}\n"
            f"Son job çalışması: {last_job_s}\n"
            f"Aralık: {settings.check_interval_minutes} dk"
        )

    return [
        CommandHandler("start", start),
        CommandHandler("add", add_cmd),
        CommandHandler("list", list_cmd),
        CommandHandler("remove", remove_cmd),
        CommandHandler("check", check_cmd),
        CommandHandler("status", status_cmd),
    ]


async def scheduled_check(context: ContextTypes.DEFAULT_TYPE) -> None:
    checker: PriceChecker = context.application.bot_data["checker"]
    logger.info("Zamanlanmış fiyat kontrolü başladı")
    ok, failed = await checker.check_all()
    logger.info("Zamanlanmış kontrol bitti: ok=%s failed=%s", ok, failed)

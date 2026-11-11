from __future__ import annotations

import asyncio
import logging
import re

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from config import Settings
from db import ProductRepository, UserSessionRepository
from price_checker import PriceChecker, format_price
from scrapers.base import detect_site
from scrapers.search import (
    SEARCH_LIMIT,
    SITE_ALIASES,
    SUPPORTED_SITES,
    SearchResult,
    normalize_site,
    search,
)

logger = logging.getLogger(__name__)

URL_RE = re.compile(r"https?://\S+", re.I)
PRICE_ONLY_RE = re.compile(r"^\s*[\d]+([.,]\d+)?\s*$")

SITE_LABELS = {
    "trendyol": "Trendyol",
    "hepsiburada": "Hepsiburada",
    "akakce": "Akakçe",
    "cimri": "Cimri",
}


def user_allowed(settings: Settings, user_id: int | None) -> bool:
    if not settings.allowed_telegram_user_ids:
        return True
    return user_id is not None and user_id in settings.allowed_telegram_user_ids


def _site_keyboard(prefix: str = "site") -> InlineKeyboardMarkup:
    row = [
        InlineKeyboardButton(SITE_LABELS[s], callback_data=f"{prefix}:{s}")
        for s in SUPPORTED_SITES
    ]
    return InlineKeyboardMarkup([row])


def _parse_site_and_rest(args: list[str]) -> tuple[str | None, list[str]]:
    if not args:
        return None, []
    site = normalize_site(args[0])
    if site:
        return site, args[1:]
    return None, args


def _parse_optional_price(args: list[str]) -> tuple[float | None, list[str]]:
    if not args:
        return None, []
    try:
        value = float(args[0].replace(",", "."))
    except ValueError:
        return None, args
    return value, args[1:]


def _results_to_dict(results: list[SearchResult]) -> list[dict]:
    return [
        {"title": r.title, "url": r.url, "price": r.price}
        for r in results
    ]


def _format_result_line(index: int, item: dict) -> str:
    price = item.get("price")
    price_s = format_price(price) if price is not None else "—"
    title = (item.get("title") or "?")[:70]
    return f"{index + 1}. {title}\n   {price_s}\n   {item.get('url', '')}"


async def _finalize_add(
    update: Update,
    repo: ProductRepository,
    sessions: UserSessionRepository,
    user_id: int,
    url: str,
    target: float,
    *,
    title_hint: str | None = None,
) -> None:
    site = detect_site(url)
    if site == "unknown":
        await update.effective_message.reply_text(
            "URL tanınamadı. Trendyol, Hepsiburada, Akakçe veya Cimri linki gerekli."
        )
        return
    try:
        product = repo.add_product(url, site, target)
    except Exception:
        await update.effective_message.reply_text(
            "Bu URL zaten listede veya kayıt başarısız."
        )
        return
    sessions.clear_after_add(user_id)
    name = title_hint or url
    await update.effective_message.reply_text(
        f"Eklendi #{product.id} ({site}) {name[:50]}\nHedef: {format_price(target)}"
    )


async def _run_search_flow(
    update: Update,
    settings: Settings,
    sessions: UserSessionRepository,
    user_id: int,
    site: str,
    query: str,
    target_price: float | None,
) -> None:
    await update.effective_message.reply_text(f"{SITE_LABELS[site]} aranıyor: {query}…")
    try:
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None,
            lambda: search(site, query, settings.http_user_agent),
        )
    except Exception as exc:
        logger.exception("Arama hatası: %s", exc)
        await update.effective_message.reply_text(f"Arama başarısız: {exc}")
        return

    payload = _results_to_dict(results[:SEARCH_LIMIT])
    sessions.store_search_results(user_id, site, query, payload, target_price)

    lines = [_format_result_line(i, item) for i, item in enumerate(payload)]
    keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    f"{i + 1}. {(item['title'] or '?')[:28]}",
                    callback_data=f"sr:{i}",
                )
            ]
            for i, item in enumerate(payload)
        ]
    )
    hint = ""
    if target_price is not None:
        hint = f"\n\nHedef fiyat: {format_price(target_price)} (ürün seçince eklenecek)"
    else:
        hint = "\n\nÜrün seçin; hedef fiyat yoksa sorulacak."
    await update.effective_message.reply_text(
        f"Sonuçlar ({SITE_LABELS[site]}):\n\n" + "\n\n".join(lines) + hint,
        reply_markup=keyboard,
        disable_web_page_preview=True,
    )


def build_handlers(
    settings: Settings,
    repo: ProductRepository,
    checker: PriceChecker,
    sessions: UserSessionRepository,
) -> list:
    async def unauthorized_reply(update: Update) -> bool:
        uid = update.effective_user and update.effective_user.id
        if not user_allowed(settings, uid):
            if update.message:
                await update.message.reply_text("Bu botu kullanma yetkiniz yok.")
            elif update.callback_query:
                await update.callback_query.answer("Yetkiniz yok.", show_alert=True)
            return True
        return False

    async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if await unauthorized_reply(update):
            return
        await update.message.reply_text(
            "İndirim takip botu\n\n"
            "/add <url> <hedef_fiyat> — link ile ekle\n"
            "/add <hedef_fiyat> <arama> — isimle ekle\n"
            "/add <site> <hedef_fiyat> <arama> — site + isim (ör. trendyol)\n"
            "/ekle — /add ile aynı\n"
            "/ara [site] <arama> — arama (site yoksa /kategori)\n"
            "/kategori — varsayılan mağaza seç\n"
            "/list — listele\n"
            "/remove <id> — sil\n"
            "/check — hemen fiyat kontrolü\n"
            "/status — durum"
        )

    async def kategori_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if await unauthorized_reply(update):
            return
        await update.message.reply_text(
            "Varsayılan mağaza seçin:",
            reply_markup=_site_keyboard("pref"),
        )

    async def ara_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if await unauthorized_reply(update):
            return
        user_id = update.effective_user.id
        args = context.args or []
        site, rest = _parse_site_and_rest(args)
        query = " ".join(rest).strip()
        if not query:
            await update.message.reply_text(
                "Kullanım: /ara [trendyol|hepsiburada|akakce|cimri] <arama metni>"
            )
            return
        if not site:
            sess = sessions.get(user_id)
            site = sess.preferred_site
        if not site:
            sessions.set_pending_search(user_id, query, None)
            await update.message.reply_text(
                "Önce mağaza seçin:",
                reply_markup=_site_keyboard("arasite"),
            )
            return
        await _run_search_flow(update, settings, sessions, user_id, site, query, None)

    async def add_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if await unauthorized_reply(update):
            return
        user_id = update.effective_user.id
        args = context.args or []
        joined = " ".join(args)

        if URL_RE.search(joined):
            if len(args) < 2:
                await update.message.reply_text("Kullanım: /add <url> <hedef_fiyat>")
                return
            url = next((a for a in args if URL_RE.match(a)), None)
            price_args = [a for a in args if a != url]
            if not url or not price_args:
                await update.message.reply_text("Kullanım: /add <url> <hedef_fiyat>")
                return
            try:
                target = float(price_args[0].replace(",", "."))
            except ValueError:
                await update.message.reply_text("Geçersiz hedef fiyat.")
                return
            await _finalize_add(update, repo, sessions, user_id, url, target)
            return

        site, rest = _parse_site_and_rest(args)
        target, rest = _parse_optional_price(rest)
        query = " ".join(rest).strip()
        if not query:
            await update.message.reply_text(
                "Kullanım:\n"
                "/add <url> <hedef_fiyat>\n"
                "/add <hedef_fiyat> <arama metni>\n"
                "/add trendyol 2500 ck erkek mont xl"
            )
            return
        if not site:
            sess = sessions.get(user_id)
            site = sess.preferred_site
        if not site:
            sessions.set_pending_search(user_id, query, target)
            await update.message.reply_text(
                "Mağaza seçin veya /kategori ile varsayılan ayarlayın:",
                reply_markup=_site_keyboard("addsite"),
            )
            return
        await _run_search_flow(update, settings, sessions, user_id, site, query, target)

    async def list_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if await unauthorized_reply(update):
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
        if await unauthorized_reply(update):
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
        if await unauthorized_reply(update):
            return
        await update.message.reply_text("Fiyat kontrolü başlıyor…")
        ok, failed = await checker.check_all()
        await update.message.reply_text(f"Tamamlandı: {ok} başarılı, {failed} hata.")

    async def status_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if await unauthorized_reply(update):
            return
        count = repo.count()
        last_db = repo.latest_check_time()
        last_job = checker.last_run
        last_job_s = last_job.isoformat() if last_job else "henüz yok"
        sess = sessions.get(update.effective_user.id)
        pref = SITE_LABELS.get(sess.preferred_site, "—") if sess.preferred_site else "—"
        await update.message.reply_text(
            f"Ürün sayısı: {count}\n"
            f"Varsayılan mağaza: {pref}\n"
            f"Son DB kontrolü: {last_db or '—'}\n"
            f"Son job çalışması: {last_job_s}\n"
            f"Aralık: {settings.check_interval_minutes} dk"
        )

    async def callback_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        query = update.callback_query
        await query.answer()
        if await unauthorized_reply(update):
            return
        user_id = update.effective_user.id
        data = query.data or ""
        sess = sessions.get(user_id)

        if data.startswith("pref:"):
            site = data.split(":", 1)[1]
            sessions.set_preferred_site(user_id, site)
            await query.edit_message_text(f"Varsayılan mağaza: {SITE_LABELS.get(site, site)}")
            return

        if data.startswith(("site:", "addsite:", "arasite:")):
            site = data.split(":", 1)[1]
            mode = data.split(":", 1)[0]
            if mode == "site":
                sessions.set_preferred_site(user_id, site)
                await query.edit_message_text(f"Seçilen mağaza: {SITE_LABELS.get(site, site)}")
                return

            pending_q = sess.pending_query
            pending_price = sess.pending_target_price
            if not pending_q:
                sessions.set_preferred_site(user_id, site)
                await query.edit_message_text(f"Mağaza: {SITE_LABELS.get(site, site)}")
                return
            await query.edit_message_text(
                f"{SITE_LABELS.get(site, site)} aranıyor: {pending_q}…"
            )
            await _run_search_flow(
                update,
                settings,
                sessions,
                user_id,
                site,
                pending_q,
                pending_price,
            )
            return

        if data.startswith("sr:"):
            try:
                idx = int(data.split(":", 1)[1])
            except ValueError:
                await query.edit_message_text("Geçersiz seçim.")
                return
            sess = sessions.get(user_id)
            if idx < 0 or idx >= len(sess.search_results):
                await query.edit_message_text("Oturum süresi doldu; aramayı yenileyin.")
                return
            item = sess.search_results[idx]
            url = item["url"]
            title = item.get("title") or url
            target = sess.pending_target_price
            if target is None:
                sessions.set_pending_product(
                    user_id, url, title, None, awaiting_price=True
                )
                await query.edit_message_text(
                    f"Seçildi: {title[:80]}\n\nHedef fiyatı yazın (ör. 2500 veya 2499,99):"
                )
                return
            await _finalize_add(
                update,
                repo,
                sessions,
                user_id,
                url,
                target,
                title_hint=title,
            )
            try:
                await query.edit_message_text(f"Eklendi: {title[:80]}")
            except Exception:
                pass
            return

    async def price_reply(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if await unauthorized_reply(update):
            return
        user_id = update.effective_user.id
        sess = sessions.get(user_id)
        if not sess.awaiting_price or not sess.pending_url:
            return
        text = (update.message.text or "").strip()
        if not PRICE_ONLY_RE.match(text):
            return
        try:
            target = float(text.replace(",", "."))
        except ValueError:
            await update.message.reply_text("Geçersiz fiyat.")
            return
        await _finalize_add(
            update,
            repo,
            sessions,
            user_id,
            sess.pending_url,
            target,
            title_hint=sess.pending_title,
        )

    return [
        CommandHandler("start", start),
        CommandHandler("add", add_cmd),
        CommandHandler("ekle", add_cmd),
        CommandHandler("ara", ara_cmd),
        CommandHandler("kategori", kategori_cmd),
        CommandHandler("list", list_cmd),
        CommandHandler("remove", remove_cmd),
        CommandHandler("check", check_cmd),
        CommandHandler("status", status_cmd),
        CallbackQueryHandler(callback_cmd),
        MessageHandler(filters.TEXT & ~filters.COMMAND, price_reply),
    ]


async def scheduled_check(context: ContextTypes.DEFAULT_TYPE) -> None:
    checker: PriceChecker = context.application.bot_data["checker"]
    logger.info("Zamanlanmış fiyat kontrolü başladı")
    ok, failed = await checker.check_all()
    logger.info("Zamanlanmış kontrol bitti: ok=%s failed=%s", ok, failed)

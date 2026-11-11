from __future__ import annotations

import logging

from telegram.ext import Application

from config import load_settings
from db import ProductRepository, UserSessionRepository
from price_checker import PriceChecker
from telegram_handlers import build_handlers, scheduled_check

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def main() -> None:
    settings = load_settings()
    repo = ProductRepository(settings.database_path)
    repo.init_db()
    sessions = UserSessionRepository(settings.database_path)

    app = (
        Application.builder()
        .token(settings.telegram_bot_token)
        .build()
    )
    bot = app.bot
    checker = PriceChecker(settings, repo, bot)
    app.bot_data["checker"] = checker
    app.bot_data["repo"] = repo
    app.bot_data["settings"] = settings
    app.bot_data["sessions"] = sessions

    for handler in build_handlers(settings, repo, checker, sessions):
        app.add_handler(handler)

    app.job_queue.run_repeating(
        scheduled_check,
        interval=settings.check_interval_seconds,
        first=10,
        name="price_check",
    )

    logger.info(
        "Bot başlıyor (kontrol aralığı: %s dk)",
        settings.check_interval_minutes,
    )
    app.run_polling(allowed_updates=["message", "callback_query"])


if __name__ == "__main__":
    main()

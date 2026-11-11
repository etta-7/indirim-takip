from __future__ import annotations

import os
import sys
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class DashboardSettings:
    database_path: str
    http_user_agent: str
    dashboard_token: str
    dashboard_host: str
    dashboard_port: int
    telegram_bot_token: str | None
    telegram_chat_id: int | None
    check_interval_minutes: int

    @property
    def telegram_configured(self) -> bool:
        return bool(self.telegram_bot_token and self.telegram_chat_id is not None)


def load_dashboard_settings() -> DashboardSettings:
    token = os.getenv("DASHBOARD_TOKEN", "").strip()
    if not token:
        print(
            "DASHBOARD_TOKEN is required for the web panel. "
            "Copy .env.example to .env and set a strong random token.",
            file=sys.stderr,
        )
        sys.exit(1)

    chat_raw = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    chat_id: int | None = None
    if chat_raw:
        try:
            chat_id = int(chat_raw)
        except ValueError:
            chat_id = None

    return DashboardSettings(
        database_path=os.getenv("DATABASE_PATH", "data/tracker.db").strip(),
        http_user_agent=os.getenv(
            "HTTP_USER_AGENT",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ).strip(),
        dashboard_token=token,
        dashboard_host=os.getenv("DASHBOARD_HOST", "127.0.0.1").strip(),
        dashboard_port=int(os.getenv("DASHBOARD_PORT", "8787")),
        telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", "").strip() or None,
        telegram_chat_id=chat_id,
        check_interval_minutes=max(1, int(os.getenv("CHECK_INTERVAL_MINUTES", "30"))),
    )


def as_bot_settings(ds: DashboardSettings):
    """Settings instance for PriceChecker (minimal fields used)."""
    from config import Settings

    token = ds.telegram_bot_token or "unused"
    chat_id = ds.telegram_chat_id if ds.telegram_chat_id is not None else 0
    return Settings(
        telegram_bot_token=token,
        telegram_chat_id=chat_id,
        check_interval_minutes=ds.check_interval_minutes,
        database_path=ds.database_path,
        http_user_agent=ds.http_user_agent,
        allowed_telegram_user_ids=frozenset(),
    )

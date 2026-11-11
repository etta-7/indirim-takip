from __future__ import annotations

import os
import sys
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    telegram_bot_token: str
    telegram_chat_id: int
    check_interval_minutes: int
    database_path: str
    http_user_agent: str
    allowed_telegram_user_ids: frozenset[int]

    @property
    def check_interval_seconds(self) -> int:
        return self.check_interval_minutes * 60


def _parse_allowed_ids(raw: str | None) -> frozenset[int]:
    if not raw or not raw.strip():
        return frozenset()
    ids: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if part:
            ids.add(int(part))
    return frozenset(ids)


def load_settings() -> Settings:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id_raw = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token:
        print("TELEGRAM_BOT_TOKEN is required. Copy .env.example to .env and fill it in.", file=sys.stderr)
        sys.exit(1)
    if not chat_id_raw:
        print("TELEGRAM_CHAT_ID is required.", file=sys.stderr)
        sys.exit(1)

    interval = int(os.getenv("CHECK_INTERVAL_MINUTES", "30"))
    db_path = os.getenv("DATABASE_PATH", "data/tracker.db").strip()
    ua = os.getenv(
        "HTTP_USER_AGENT",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ).strip()

    return Settings(
        telegram_bot_token=token,
        telegram_chat_id=int(chat_id_raw),
        check_interval_minutes=max(1, interval),
        database_path=db_path,
        http_user_agent=ua,
        allowed_telegram_user_ids=_parse_allowed_ids(os.getenv("ALLOWED_TELEGRAM_USER_IDS")),
    )

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    site TEXT NOT NULL,
    title TEXT,
    target_price REAL NOT NULL,
    last_price REAL,
    last_checked_at TEXT,
    notify_cooldown_until TEXT,
    target_drop_percent REAL,
    baseline_price REAL
);

CREATE TABLE IF NOT EXISTS user_sessions (
    user_id INTEGER PRIMARY KEY,
    preferred_site TEXT,
    pending_query TEXT,
    pending_target_price REAL,
    pending_url TEXT,
    pending_title TEXT,
    search_results_json TEXT,
    awaiting_price INTEGER NOT NULL DEFAULT 0,
    pending_target_drop_percent REAL,
    updated_at TEXT
);
"""


@dataclass
class Product:
    id: int
    url: str
    site: str
    title: str | None
    target_price: float
    last_price: float | None
    last_checked_at: str | None
    notify_cooldown_until: str | None
    target_drop_percent: float | None
    baseline_price: float | None


class ProductRepository:
    def __init__(self, database_path: str) -> None:
        self.database_path = database_path
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.database_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def init_db(self) -> None:
        with self._conn() as conn:
            conn.executescript(SCHEMA)
            self._migrate(conn)

    def _migrate(self, conn: sqlite3.Connection) -> None:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(products)")}
        if "target_drop_percent" not in cols:
            conn.execute("ALTER TABLE products ADD COLUMN target_drop_percent REAL")
        if "baseline_price" not in cols:
            conn.execute("ALTER TABLE products ADD COLUMN baseline_price REAL")
        sess_cols = {row[1] for row in conn.execute("PRAGMA table_info(user_sessions)")}
        if "pending_target_drop_percent" not in sess_cols:
            conn.execute(
                "ALTER TABLE user_sessions ADD COLUMN pending_target_drop_percent REAL"
            )

    def _row_to_product(self, row: sqlite3.Row) -> Product:
        return Product(
            id=row["id"],
            url=row["url"],
            site=row["site"],
            title=row["title"],
            target_price=row["target_price"],
            last_price=row["last_price"],
            last_checked_at=row["last_checked_at"],
            notify_cooldown_until=row["notify_cooldown_until"],
            target_drop_percent=row["target_drop_percent"],
            baseline_price=row["baseline_price"],
        )

    def add_product(
        self,
        url: str,
        site: str,
        target_price: float,
        *,
        target_drop_percent: float | None = None,
        baseline_price: float | None = None,
    ) -> Product:
        with self._conn() as conn:
            cur = conn.execute(
                """
                INSERT INTO products (
                    url, site, target_price, target_drop_percent, baseline_price
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (url, site, target_price, target_drop_percent, baseline_price),
            )
            row = conn.execute("SELECT * FROM products WHERE id = ?", (cur.lastrowid,)).fetchone()
        return self._row_to_product(row)

    def list_products(self) -> list[Product]:
        with self._conn() as conn:
            rows = conn.execute("SELECT * FROM products ORDER BY id").fetchall()
        return [self._row_to_product(r) for r in rows]

    def get_product(self, product_id: int) -> Product | None:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        return self._row_to_product(row) if row else None

    def remove_product(self, product_id: int) -> bool:
        with self._conn() as conn:
            cur = conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
        return cur.rowcount > 0

    def update_after_check(
        self,
        product_id: int,
        *,
        title: str | None,
        last_price: float,
        notify_cooldown_until: str | None = None,
        baseline_price: float | None = None,
    ) -> None:
        now = utc_now_iso()
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE products
                SET title = COALESCE(?, title),
                    last_price = ?,
                    last_checked_at = ?,
                    notify_cooldown_until = COALESCE(?, notify_cooldown_until),
                    baseline_price = COALESCE(?, baseline_price)
                WHERE id = ?
                """,
                (
                    title,
                    last_price,
                    now,
                    notify_cooldown_until,
                    baseline_price,
                    product_id,
                ),
            )

    def count(self) -> int:
        with self._conn() as conn:
            row = conn.execute("SELECT COUNT(*) AS c FROM products").fetchone()
        return int(row["c"])

    def latest_check_time(self) -> str | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT MAX(last_checked_at) AS t FROM products"
            ).fetchone()
        t = row["t"]
        return str(t) if t else None


@dataclass
class UserSession:
    user_id: int
    preferred_site: str | None
    pending_query: str | None
    pending_target_price: float | None
    pending_url: str | None
    pending_title: str | None
    search_results: list[dict]
    awaiting_price: bool
    pending_target_drop_percent: float | None


class UserSessionRepository:
    def __init__(self, database_path: str) -> None:
        self.database_path = database_path

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.database_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _row_to_session(self, row: sqlite3.Row | None, user_id: int) -> UserSession:
        if row is None:
            return UserSession(
                user_id=user_id,
                preferred_site=None,
                pending_query=None,
                pending_target_price=None,
                pending_url=None,
                pending_title=None,
                search_results=[],
                awaiting_price=False,
                pending_target_drop_percent=None,
            )
        raw = row["search_results_json"]
        results = json.loads(raw) if raw else []
        return UserSession(
            user_id=user_id,
            preferred_site=row["preferred_site"],
            pending_query=row["pending_query"],
            pending_target_price=row["pending_target_price"],
            pending_url=row["pending_url"],
            pending_title=row["pending_title"],
            search_results=results,
            awaiting_price=bool(row["awaiting_price"]),
            pending_target_drop_percent=row["pending_target_drop_percent"],
        )

    def get(self, user_id: int) -> UserSession:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM user_sessions WHERE user_id = ?", (user_id,)
            ).fetchone()
        return self._row_to_session(row, user_id)

    def _upsert(
        self,
        user_id: int,
        *,
        preferred_site: str | None = None,
        pending_query: str | None = None,
        pending_target_price: float | None = None,
        pending_url: str | None = None,
        pending_title: str | None = None,
        search_results: list[dict] | None = None,
        awaiting_price: bool | None = None,
        pending_target_drop_percent: float | None = None,
        clear_search: bool = False,
        clear_pending_product: bool = False,
    ) -> UserSession:
        now = utc_now_iso()
        current = self.get(user_id)
        if preferred_site is not None:
            current.preferred_site = preferred_site
        if pending_query is not None:
            current.pending_query = pending_query
        if pending_target_price is not None:
            current.pending_target_price = pending_target_price
        if pending_url is not None:
            current.pending_url = pending_url
        if pending_title is not None:
            current.pending_title = pending_title
        if search_results is not None:
            current.search_results = search_results
        if awaiting_price is not None:
            current.awaiting_price = awaiting_price
        if pending_target_drop_percent is not None:
            current.pending_target_drop_percent = pending_target_drop_percent
        if clear_search:
            current.search_results = []
            current.pending_query = None
            current.pending_target_price = None
            current.pending_target_drop_percent = None
        if clear_pending_product:
            current.pending_url = None
            current.pending_title = None
            current.awaiting_price = False

        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO user_sessions (
                    user_id, preferred_site, pending_query, pending_target_price,
                    pending_url, pending_title, search_results_json, awaiting_price,
                    pending_target_drop_percent, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    preferred_site = excluded.preferred_site,
                    pending_query = excluded.pending_query,
                    pending_target_price = excluded.pending_target_price,
                    pending_url = excluded.pending_url,
                    pending_title = excluded.pending_title,
                    search_results_json = excluded.search_results_json,
                    awaiting_price = excluded.awaiting_price,
                    pending_target_drop_percent = excluded.pending_target_drop_percent,
                    updated_at = excluded.updated_at
                """,
                (
                    user_id,
                    current.preferred_site,
                    current.pending_query,
                    current.pending_target_price,
                    current.pending_url,
                    current.pending_title,
                    json.dumps(current.search_results, ensure_ascii=False),
                    int(current.awaiting_price),
                    current.pending_target_drop_percent,
                    now,
                ),
            )
        return current

    def set_preferred_site(self, user_id: int, site: str) -> UserSession:
        return self._upsert(user_id, preferred_site=site)

    def set_pending_search(
        self,
        user_id: int,
        query: str,
        target_price: float | None,
        *,
        site: str | None = None,
        target_drop_percent: float | None = None,
    ) -> UserSession:
        kwargs: dict = {
            "pending_query": query,
            "pending_target_price": target_price,
            "pending_target_drop_percent": target_drop_percent,
        }
        if site is not None:
            kwargs["preferred_site"] = site
        return self._upsert(user_id, **kwargs)

    def store_search_results(
        self,
        user_id: int,
        site: str,
        query: str,
        results: list[dict],
        target_price: float | None,
        target_drop_percent: float | None = None,
    ) -> UserSession:
        return self._upsert(
            user_id,
            preferred_site=site,
            pending_query=query,
            pending_target_price=target_price,
            pending_target_drop_percent=target_drop_percent,
            search_results=results,
        )

    def set_pending_product(
        self,
        user_id: int,
        url: str,
        title: str,
        target_price: float | None,
        *,
        awaiting_price: bool,
        target_drop_percent: float | None = None,
    ) -> UserSession:
        return self._upsert(
            user_id,
            pending_url=url,
            pending_title=title,
            pending_target_price=target_price,
            pending_target_drop_percent=target_drop_percent,
            awaiting_price=awaiting_price,
            clear_search=True,
        )

    def clear_after_add(self, user_id: int) -> None:
        now = utc_now_iso()
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE user_sessions SET
                    pending_query = NULL,
                    pending_target_price = NULL,
                    pending_target_drop_percent = NULL,
                    pending_url = NULL,
                    pending_title = NULL,
                    search_results_json = '[]',
                    awaiting_price = 0,
                    updated_at = ?
                WHERE user_id = ?
                """,
                (now, user_id),
            )

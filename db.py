from __future__ import annotations

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
    notify_cooldown_until TEXT
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
        )

    def add_product(self, url: str, site: str, target_price: float) -> Product:
        with self._conn() as conn:
            cur = conn.execute(
                """
                INSERT INTO products (url, site, target_price)
                VALUES (?, ?, ?)
                """,
                (url, site, target_price),
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
    ) -> None:
        now = utc_now_iso()
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE products
                SET title = COALESCE(?, title),
                    last_price = ?,
                    last_checked_at = ?,
                    notify_cooldown_until = COALESCE(?, notify_cooldown_until)
                WHERE id = ?
                """,
                (title, last_price, now, notify_cooldown_until, product_id),
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

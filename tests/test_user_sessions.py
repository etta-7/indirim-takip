from __future__ import annotations

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from db import ProductRepository, UserSessionRepository


def test_user_session_store_results():
    with tempfile.TemporaryDirectory() as tmp:
        db_path = str(Path(tmp) / "t.db")
        ProductRepository(db_path).init_db()
        sessions = UserSessionRepository(db_path)
        sessions.store_search_results(
            42,
            "trendyol",
            "ck erkek mont",
            [{"title": "Mont", "url": "https://example.com/p-1", "price": 100.0}],
            2500.0,
        )
        sess = sessions.get(42)
        assert sess.preferred_site == "trendyol"
        assert sess.pending_query == "ck erkek mont"
        assert sess.pending_target_price == 2500.0
        assert len(sess.search_results) == 1
        sessions.set_pending_product(
            42,
            "https://example.com/p-1",
            "Mont",
            None,
            awaiting_price=True,
        )
        sess = sessions.get(42)
        assert sess.awaiting_price is True
        assert sess.pending_url.endswith("p-1")
        sessions.clear_after_add(42)
        sess = sessions.get(42)
        assert not sess.awaiting_price
        assert sess.pending_url is None

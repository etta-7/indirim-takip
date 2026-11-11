from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

TEST_TOKEN = "test-dashboard-secret"


@pytest.fixture()
def client(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        db_path = str(Path(tmp) / "tracker.db")
        monkeypatch.setenv("DASHBOARD_TOKEN", TEST_TOKEN)
        monkeypatch.setenv("DATABASE_PATH", db_path)
        monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
        monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
        from dashboard.server import create_app

        with TestClient(create_app()) as c:
            yield c


def auth_headers():
    return {"X-Dashboard-Token": TEST_TOKEN}


def test_health_no_auth(client: TestClient):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_products_require_auth(client: TestClient):
    r = client.get("/api/products")
    assert r.status_code == 401


def test_add_list_remove(client: TestClient):
    body = {
        "url": "https://www.trendyol.com/x-p-123",
        "target_text": "10%",
    }
    r = client.post("/api/products", json=body, headers=auth_headers())
    assert r.status_code == 200
    data = r.json()
    assert data["id"] >= 1
    assert data["site"] == "trendyol"

    r = client.get("/api/products", headers=auth_headers())
    assert r.status_code == 200
    products = r.json()["products"]
    assert len(products) == 1
    assert products[0]["url"] == body["url"]

    pid = products[0]["id"]
    r = client.delete(f"/api/products/{pid}", headers=auth_headers())
    assert r.status_code == 200

    r = client.get("/api/products", headers=auth_headers())
    assert r.json()["products"] == []


def test_add_invalid_url(client: TestClient):
    r = client.post(
        "/api/products",
        json={"url": "https://example.com/item", "target_text": "10%"},
        headers=auth_headers(),
    )
    assert r.status_code == 400

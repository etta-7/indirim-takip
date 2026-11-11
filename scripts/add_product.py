#!/usr/bin/env python3
"""CLI: add a product to the tracker DB (for Project chat / VPS use)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow running from repo root
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

import os

from db import ProductRepository
from scrapers.base import detect_site


def main() -> None:
    parser = argparse.ArgumentParser(description="Takip listesine ürün ekle")
    parser.add_argument("url", help="Ürün URL")
    parser.add_argument("target_price", type=float, help="Hedef fiyat (TL)")
    args = parser.parse_args()

    site = detect_site(args.url)
    if site == "unknown":
        print("Desteklenmeyen URL", file=sys.stderr)
        sys.exit(1)

    db_path = os.getenv("DATABASE_PATH", "data/tracker.db")
    repo = ProductRepository(db_path)
    repo.init_db()
    product = repo.add_product(args.url, site, args.target_price)
    print(f"Eklendi #{product.id} site={site} hedef={args.target_price}")


if __name__ == "__main__":
    main()

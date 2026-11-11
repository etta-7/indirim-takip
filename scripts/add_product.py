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

from alert_rules import NO_ABSOLUTE_TARGET
from db import ProductRepository
from scrapers.base import detect_site


def main() -> None:
    parser = argparse.ArgumentParser(description="Takip listesine ürün ekle")
    parser.add_argument("url", help="Ürün URL")
    parser.add_argument(
        "target_price",
        type=float,
        nargs="?",
        help="Hedef fiyat (TL); --percent ile birlikte isteğe bağlı",
    )
    parser.add_argument(
        "--percent",
        type=float,
        dest="drop_percent",
        help="Yüzdelik düşüş eşiği (ör. 10)",
    )
    args = parser.parse_args()
    if args.target_price is None and args.drop_percent is None:
        parser.error("target_price veya --percent gerekli")

    site = detect_site(args.url)
    if site == "unknown":
        print("Desteklenmeyen URL", file=sys.stderr)
        sys.exit(1)

    db_path = os.getenv("DATABASE_PATH", "data/tracker.db")
    repo = ProductRepository(db_path)
    repo.init_db()
    target = args.target_price if args.target_price is not None else NO_ABSOLUTE_TARGET
    product = repo.add_product(
        args.url,
        site,
        target,
        target_drop_percent=args.drop_percent,
    )
    parts = []
    if target >= 0:
        parts.append(f"hedef={target}")
    if args.drop_percent is not None:
        parts.append(f"yuzde={args.drop_percent}")
    print(f"Eklendi #{product.id} site={site} " + " ".join(parts))


if __name__ == "__main__":
    main()

import { sql } from "@vercel/postgres";
import { unstable_noStore as noStore } from "next/cache";
import type { Product } from "./types";

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: Number(row.id),
    url: String(row.url),
    site: String(row.site),
    title: row.title != null ? String(row.title) : null,
    target_price: Number(row.target_price),
    last_price: row.last_price != null ? Number(row.last_price) : null,
    last_checked_at: row.last_checked_at != null ? String(row.last_checked_at) : null,
    notify_cooldown_until:
      row.notify_cooldown_until != null ? String(row.notify_cooldown_until) : null,
    target_drop_percent:
      row.target_drop_percent != null ? Number(row.target_drop_percent) : null,
    baseline_price: row.baseline_price != null ? Number(row.baseline_price) : null,
  };
}

export async function listProducts(): Promise<Product[]> {
  noStore(); // Sorgu sonuçları Next.js veri önbelleğine alınmasın.
  const { rows } = await sql`SELECT * FROM products ORDER BY id`;
  return rows.map((r) => rowToProduct(r as Record<string, unknown>));
}

export async function getProduct(id: number): Promise<Product | null> {
  noStore(); // Sorgu sonuçları Next.js veri önbelleğine alınmasın.
  const { rows } = await sql`SELECT * FROM products WHERE id = ${id}`;
  if (!rows.length) return null;
  return rowToProduct(rows[0] as Record<string, unknown>);
}

export async function addProduct(
  url: string,
  site: string,
  targetPrice: number,
  opts: {
    target_drop_percent?: number | null;
    baseline_price?: number | null;
  } = {}
): Promise<Product> {
  noStore(); // Sorgu sonuçları Next.js veri önbelleğine alınmasın.
  const { rows } = await sql`
    INSERT INTO products (url, site, target_price, target_drop_percent, baseline_price)
    VALUES (
      ${url},
      ${site},
      ${targetPrice},
      ${opts.target_drop_percent ?? null},
      ${opts.baseline_price ?? null}
    )
    RETURNING *
  `;
  return rowToProduct(rows[0] as Record<string, unknown>);
}

export async function removeProduct(id: number): Promise<boolean> {
  noStore(); // Sorgu sonuçları Next.js veri önbelleğine alınmasın.
  const { rowCount } = await sql`DELETE FROM products WHERE id = ${id}`;
  return (rowCount ?? 0) > 0;
}

export async function countProducts(): Promise<number> {
  noStore(); // Sorgu sonuçları Next.js veri önbelleğine alınmasın.
  const { rows } = await sql`SELECT COUNT(*)::int AS c FROM products`;
  return Number(rows[0]?.c ?? 0);
}

export async function latestCheckTime(): Promise<string | null> {
  noStore(); // Sorgu sonuçları Next.js veri önbelleğine alınmasın.
  const { rows } = await sql`SELECT MAX(last_checked_at) AS t FROM products`;
  const t = rows[0]?.t;
  return t != null ? String(t) : null;
}

export async function updateAfterCheck(
  productId: number,
  data: {
    title?: string | null;
    last_price: number;
    notify_cooldown_until?: string | null;
    baseline_price?: number | null;
  }
): Promise<void> {
  noStore(); // Sorgu sonuçları Next.js veri önbelleğine alınmasın.
  const now = new Date().toISOString();
  await sql`
    UPDATE products
    SET
      title = COALESCE(${data.title ?? null}, title),
      last_price = ${data.last_price},
      last_checked_at = ${now}::timestamptz,
      notify_cooldown_until = COALESCE(
        ${data.notify_cooldown_until ?? null}::timestamptz,
        notify_cooldown_until
      ),
      baseline_price = COALESCE(${data.baseline_price ?? null}, baseline_price)
    WHERE id = ${productId}
  `;
}

export async function updateProductTargets(
  id: number,
  data: {
    target_price: number;
    target_drop_percent: number | null;
    reset_baseline?: boolean;
  }
): Promise<Product | null> {
  noStore(); // Sorgu sonuçları Next.js veri önbelleğine alınmasın.
  // Hedef değişince eski bildirim beklemesini kaldır; yeni hedef hemen tetiklenebilsin.
  const { rows } = await sql`
    UPDATE products
    SET
      target_price = ${data.target_price},
      target_drop_percent = ${data.target_drop_percent},
      notify_cooldown_until = NULL,
      baseline_price = CASE
        WHEN ${data.reset_baseline ? true : false}::boolean AND last_price IS NOT NULL
        THEN last_price
        ELSE baseline_price
      END
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows.length) return null;
  return rowToProduct(rows[0] as Record<string, unknown>);
}

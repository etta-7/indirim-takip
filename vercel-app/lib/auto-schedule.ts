import { sql } from "@vercel/postgres";
import { listProductsResilient, productDbStats } from "./db/products";
import { checkAllPrices } from "./price-checker";

const LOCK_KEY = 9142277;
const DEFAULT_MAX_AGE_MS = 28 * 60 * 1000;

export type StaleCheckStatus = "ran" | "skipped" | "locked";

export type StaleCheckResult = {
  status: StaleCheckStatus;
  product_count: number;
  check_ok?: number;
  check_failed?: number;
  check_duration_ms?: number;
  /** MAX(last_checked_at) from a fresh product list after a run (when reads lag behind writes). */
  latest_check?: string | null;
};

function maxLastCheckedAt(products: { last_checked_at: string | null }[]): string | null {
  let latest: string | null = null;
  for (const p of products) {
    if (!p.last_checked_at) continue;
    if (!latest || p.last_checked_at > latest) latest = p.last_checked_at;
  }
  return latest;
}

/** Run price check when last DB check is older than maxAgeMs (serverless-safe advisory lock). */
export async function runCheckIfStale(
  maxAgeMs = DEFAULT_MAX_AGE_MS
): Promise<StaleCheckResult> {
  const stats = await productDbStats(maxAgeMs);
  const product_count = stats.count;
  if (product_count === 0) {
    return { status: "skipped", product_count: 0 };
  }
  if (!stats.checkStale) {
    return { status: "skipped", product_count };
  }

  const { rows } = await sql`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS locked`;
  const locked = Boolean(rows[0]?.locked);
  if (!locked) {
    return { status: "locked", product_count };
  }

  try {
    const still = await productDbStats(maxAgeMs);
    if (!still.checkStale) {
      return { status: "skipped", product_count: still.count };
    }
    const products = await listProductsResilient();
    if (products.length === 0) {
      console.error(
        `runCheckIfStale: stats.count=${still.count} but product list is empty after resilient load`
      );
      return { status: "skipped", product_count: still.count };
    }
    const t0 = Date.now();
    const { ok, failed } = await checkAllPrices(products);
    const reloaded = await listProductsResilient();
    return {
      status: "ran",
      product_count: products.length,
      check_ok: ok,
      check_failed: failed,
      check_duration_ms: Date.now() - t0,
      latest_check: maxLastCheckedAt(reloaded),
    };
  } finally {
    await sql`SELECT pg_advisory_unlock(${LOCK_KEY})`;
  }
}

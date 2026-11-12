import { sql } from "@vercel/postgres";
import { listProducts, productDbStats } from "./db/products";
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
};

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
    const products = await listProducts();
    const t0 = Date.now();
    const { ok, failed } = await checkAllPrices(products);
    return {
      status: "ran",
      product_count: products.length || still.count,
      check_ok: ok,
      check_failed: failed,
      check_duration_ms: Date.now() - t0,
    };
  } finally {
    await sql`SELECT pg_advisory_unlock(${LOCK_KEY})`;
  }
}

import { sql } from "@vercel/postgres";
import { latestCheckTime, countProducts } from "./db/products";
import { checkAllPrices } from "./price-checker";

const LOCK_KEY = 9142277;
const DEFAULT_MAX_AGE_MS = 28 * 60 * 1000;

function ageMs(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Date.now() - t;
}

/** Run price check when last DB check is older than maxAgeMs (serverless-safe advisory lock). */
export async function runCheckIfStale(
  maxAgeMs = DEFAULT_MAX_AGE_MS
): Promise<"ran" | "skipped" | "locked"> {
  const n = await countProducts();
  if (n === 0) return "skipped";

  const latest = await latestCheckTime();
  if (ageMs(latest) < maxAgeMs) return "skipped";

  const { rows } = await sql`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS locked`;
  const locked = Boolean(rows[0]?.locked);
  if (!locked) return "locked";

  try {
    const stillLatest = await latestCheckTime();
    if (ageMs(stillLatest) < maxAgeMs) return "skipped";
    await checkAllPrices();
    return "ran";
  } finally {
    await sql`SELECT pg_advisory_unlock(${LOCK_KEY})`;
  }
}

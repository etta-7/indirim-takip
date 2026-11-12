import { NextResponse } from "next/server";
import { runCheckIfStale } from "@/lib/auto-schedule";
import { latestCheckTime } from "@/lib/db/products";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Public liveness probe; runs a price check when the last DB check is stale (≈28m). Safe for cron-job.org / uptime pings without CRON_SECRET. */
export async function GET() {
  const stale = await runCheckIfStale();
  const latest_check = await latestCheckTime();
  return NextResponse.json({
    ok: true,
    stale_check: stale.status,
    latest_check,
    product_count: stale.product_count,
    ...(stale.status === "ran"
      ? {
          check_ok: stale.check_ok ?? 0,
          check_failed: stale.check_failed ?? 0,
          check_duration_ms: stale.check_duration_ms ?? 0,
          prices_updated: (stale.check_ok ?? 0) > 0,
        }
      : {}),
    deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}

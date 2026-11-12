import { NextResponse } from "next/server";
import { runCheckIfStale } from "@/lib/auto-schedule";
import { latestCheckTime } from "@/lib/db/products";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Public liveness probe; runs a price check when the last DB check is stale (≈28m). Safe for cron-job.org / uptime pings without CRON_SECRET. */
export async function GET() {
  const stale_check = await runCheckIfStale();
  const latest_check = await latestCheckTime();
  return NextResponse.json({ ok: true, stale_check, latest_check });
}

import { NextRequest, NextResponse } from "next/server";
import { runCheckIfStale } from "@/lib/auto-schedule";
import { latestCheckTime } from "@/lib/db/products";
import { requireDashboardToken } from "@/lib/auth/dashboard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Panel or PWA: trigger price check if last run is stale (complements external cron). */
export async function POST(req: NextRequest) {
  if (!requireDashboardToken(req)) {
    return NextResponse.json({ detail: "Geçersiz veya eksik panel anahtarı." }, { status: 401 });
  }
  const stale = await runCheckIfStale();
  const latest_check = await latestCheckTime();
  return NextResponse.json({
    result: stale.status,
    latest_check,
    product_count: stale.product_count,
    check_ok: stale.check_ok,
    check_failed: stale.check_failed,
    check_duration_ms: stale.check_duration_ms,
  });
}

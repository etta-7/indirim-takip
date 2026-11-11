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
  const result = await runCheckIfStale();
  const latest_check = await latestCheckTime();
  return NextResponse.json({ result, latest_check });
}

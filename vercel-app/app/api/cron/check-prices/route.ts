import { NextRequest, NextResponse } from "next/server";
import { getCronSecret } from "@/lib/env";
import { checkAllPrices, getLastRun } from "@/lib/price-checker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? "";
  let secret: string;
  try {
    secret = getCronSecret();
  } catch {
    return NextResponse.json({ detail: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (bearer !== secret && headerSecret !== secret) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const { ok, failed } = await checkAllPrices();
  const lastRun = getLastRun();
  return NextResponse.json({
    ok_count: ok,
    failed_count: failed,
    last_run: lastRun ? lastRun.toISOString() : null,
  });
}

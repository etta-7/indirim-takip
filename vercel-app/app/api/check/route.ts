import { NextRequest, NextResponse } from "next/server";
import { requireDashboardToken } from "@/lib/auth/dashboard";
import { countProducts } from "@/lib/db/products";
import { checkAllPrices, getLastRun } from "@/lib/price-checker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!requireDashboardToken(req)) {
    return NextResponse.json({ detail: "Geçersiz veya eksik panel anahtarı." }, { status: 401 });
  }
  const { ok, failed } = await checkAllPrices();
  const lastRun = getLastRun();
  return NextResponse.json({
    ok_count: ok,
    failed_count: failed,
    product_count: await countProducts(),
    last_run: lastRun ? lastRun.toISOString() : null,
  });
}

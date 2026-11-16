import { NextRequest, NextResponse } from "next/server";
import { requireDashboardToken } from "@/lib/auth/dashboard";
import { getHttpUserAgent } from "@/lib/env";
import { detectSite, fetchPrice, resolveProductUrl } from "@/lib/scrapers/base";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!requireDashboardToken(req)) {
    return NextResponse.json({ detail: "Geçersiz veya eksik panel anahtarı." }, { status: 401 });
  }
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz JSON." }, { status: 400 });
  }
  const raw = (body.url ?? "").trim();
  if (!raw) {
    return NextResponse.json({ detail: "URL gerekli." }, { status: 400 });
  }
  const userAgent = getHttpUserAgent();
  const url = await resolveProductUrl(raw, userAgent);
  const site = detectSite(url);
  if (site === "unknown") {
    return NextResponse.json({ detail: "URL tanınamadı." }, { status: 400 });
  }
  try {
    const quote = await fetchPrice(url, userAgent);
    return NextResponse.json({
      ok: true,
      resolved_url: url,
      site,
      title: quote.title,
      price: quote.price,
      currency: quote.currency,
      price_source: quote.priceSource ?? site,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        resolved_url: url,
        site,
        error: message,
      },
      { status: 502 }
    );
  }
}

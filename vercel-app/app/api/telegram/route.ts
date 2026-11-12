import { NextRequest, NextResponse } from "next/server";
import { runCheckIfStale } from "@/lib/auto-schedule";
import { handleTelegramUpdate } from "@/lib/telegram-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const stale = await runCheckIfStale();
    if (stale.status === "ran") {
      console.info("auto-schedule: price check completed (telegram)");
    }
    await handleTelegramUpdate(update as Parameters<typeof handleTelegramUpdate>[0]);
  } catch (e) {
    console.error("Telegram handler error", e);
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, webhook: true });
}

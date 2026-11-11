import { NextRequest, NextResponse } from "next/server";
import { requireDashboardToken } from "@/lib/auth/dashboard";
import { removeProduct } from "@/lib/db/products";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireDashboardToken(req)) {
    return NextResponse.json({ detail: "Geçersiz veya eksik panel anahtarı." }, { status: 401 });
  }
  const { id } = await params;
  const pid = parseInt(id, 10);
  if (Number.isNaN(pid)) {
    return NextResponse.json({ detail: "Geçersiz id." }, { status: 400 });
  }
  if (!(await removeProduct(pid))) {
    return NextResponse.json({ detail: "Ürün bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id: pid });
}

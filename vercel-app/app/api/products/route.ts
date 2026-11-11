import { NextRequest, NextResponse } from "next/server";
import { requireDashboardToken } from "@/lib/auth/dashboard";
import { listProducts } from "@/lib/db/products";
import { productToDict } from "@/lib/db/types";
import { addProductFromRequest } from "@/lib/product-ops";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireDashboardToken(req)) {
    return NextResponse.json({ detail: "Geçersiz veya eksik panel anahtarı." }, { status: 401 });
  }
  const products = await listProducts();
  return NextResponse.json({ products: products.map(productToDict) });
}

export async function POST(req: NextRequest) {
  if (!requireDashboardToken(req)) {
    return NextResponse.json({ detail: "Geçersiz veya eksik panel anahtarı." }, { status: 401 });
  }
  let body: {
    url?: string;
    target_price?: number | null;
    target_drop_percent?: number | null;
    target_text?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz JSON." }, { status: 400 });
  }
  const result = await addProductFromRequest({
    url: body.url ?? "",
    target_price: body.target_price,
    target_drop_percent: body.target_drop_percent,
    target_text: body.target_text,
  });
  if (typeof result === "string") {
    return NextResponse.json({ detail: result }, { status: 400 });
  }
  return NextResponse.json(productToDict(result));
}

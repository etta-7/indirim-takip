import { loadCheerio } from "./base";
import { extractJsonLdPrice, parsePriceText, type PriceResult } from "./pricing";

export function parseCimri(html: string): PriceResult {
  const $ = loadCheerio(html);
  let title = $("h1").first().text().trim() || "Cimri ürün";
  let price: number | null = null;
  const ld = extractJsonLdPrice($);
  if (ld.price != null) {
    price = ld.price;
    if (ld.title) title = ld.title;
  }
  if (price == null) {
    const el = $("[data-testid='product-price']").first().length
      ? $("[data-testid='product-price']").first()
      : $(".lowest-price").first();
    if (el.length) price = parsePriceText(el.text());
  }
  if (price == null) {
    const m = html.match(/"price"\s*:\s*([\d.]+)/);
    if (m) price = parseFloat(m[1]);
  }
  if (price == null) throw new Error("Cimri fiyat bulunamadı");
  return { title, price, currency: "TRY" };
}

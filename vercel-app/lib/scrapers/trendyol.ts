import { loadCheerio } from "./base";
import { extractJsonLdPrice, extractMetaPrice, parsePriceText, type PriceResult } from "./pricing";

export function parseTrendyol(html: string): PriceResult {
  const $ = loadCheerio(html);
  let title =
    $("h1[class*='pr-new-br']").first().text().trim() || $("h1").first().text().trim() || "Trendyol ürün";
  let price: number | null = null;
  const ld = extractJsonLdPrice($);
  if (ld.price != null) {
    price = ld.price;
    if (ld.title) title = ld.title;
  }
  if (price == null) price = extractMetaPrice($);
  if (price == null) {
    for (const sel of [".prc-dsc", ".prc-slg", "[class*='price']"]) {
      const el = $(sel).first();
      if (el.length) {
        const p = parsePriceText(el.text());
        if (p != null) {
          price = p;
          break;
        }
      }
    }
  }
  if (price == null) {
    const m = html.match(/"sellingPrice"\s*:\s*([\d.]+)/);
    if (m) price = parseFloat(m[1]);
  }
  if (price == null) throw new Error("Trendyol fiyat bulunamadı");
  return { title, price, currency: "TRY" };
}

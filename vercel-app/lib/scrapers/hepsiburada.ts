import { loadCheerio } from "./base";
import { extractJsonLdPrice, extractMetaPrice, parsePriceText, type PriceResult } from "./pricing";

export function parseHepsiburada(html: string): PriceResult {
  const $ = loadCheerio(html);
  let title =
    ($("#product-name").first().text().trim() || $("h1").first().text().trim()) || "Hepsiburada ürün";
  let price: number | null = null;
  const ld = extractJsonLdPrice($);
  if (ld.price != null) {
    price = ld.price;
    if (ld.title) title = ld.title;
  }
  if (price == null) price = extractMetaPrice($);
  if (price == null) {
    const el = $("[data-test-id='price-current-price']").first().length
      ? $("[data-test-id='price-current-price']").first()
      : $(".product-price").first();
    if (el.length) price = parsePriceText(el.text());
  }
  if (price == null) {
    const m = html.match(/"price"\s*:\s*"?([\d.,]+)"?/);
    if (m) price = parsePriceText(m[1]);
  }
  if (price == null) throw new Error("Hepsiburada fiyat bulunamadı");
  return { title, price, currency: "TRY" };
}

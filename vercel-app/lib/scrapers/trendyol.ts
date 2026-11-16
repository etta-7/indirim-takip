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
    // Sayfaya gömülü ürün verisi: indirimli fiyat önce, yoksa satış fiyatı.
    for (const re of [
      /"discountedPrice"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/,
      /"sellingPrice"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/,
      /"sellingPrice"\s*:\s*([\d.]+)/,
    ]) {
      const m = html.match(re);
      if (m && parseFloat(m[1]) > 0) {
        price = parseFloat(m[1]);
        break;
      }
    }
  }
  if (price == null) {
    // Teşhis için: gelen sayfanın başlığı ve boyutu (bot doğrulama sayfası mı?)
    const pageTitle = $("title").first().text().trim().slice(0, 80) || "başlıksız";
    throw new Error(`Trendyol fiyat bulunamadı (sayfa: "${pageTitle}", ${html.length} bayt)`);
  }
  return { title, price, currency: "TRY" };
}

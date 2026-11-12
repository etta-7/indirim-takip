import { loadCheerio } from "./base";
import { extractJsonLdPrice, parsePriceText, type PriceResult } from "./pricing";

export function parseAkakce(html: string): PriceResult {
  const $ = loadCheerio(html);
  let title = $("h1").first().text().trim() || "Akakçe ürün";
  let price: number | null = null;
  const ld = extractJsonLdPrice($);
  if (ld.price != null) {
    price = ld.price;
    if (ld.title) title = ld.title;
  }
  if (price == null) {
    const el = $(".pt_v8").first().length
      ? $(".pt_v8").first()
      : $("#CPL").first().length
        ? $("#CPL").first()
        : $(".price").first();
    if (el.length) price = parsePriceText(el.text());
  }
  if (price == null) {
    const m =
      html.match(/minOfSortPrice['\"]?\s*:\s*\[0,([\d.]+)\]/) ??
      html.match(/lowPrice['\"]?\s*:\s*([\d.]+)/);
    if (m) price = parseFloat(m[1]);
  }
  if (price == null) throw new Error("Akakçe fiyat bulunamadı");
  return { title, price, currency: "TRY" };
}

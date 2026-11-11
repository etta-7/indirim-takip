import * as cheerio from "cheerio";

export type PriceResult = { title: string; price: number; currency: string };

export function parsePriceText(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  let cleaned = t.replace(/[^\d,.\s]/g, "").replace(/\s/g, "");
  if (!cleaned) return null;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = parts[0].replace(/\./g, "") + "." + parts[1];
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.split(".").length === 2 && cleaned.split(".")[1].length === 3) {
    cleaned = cleaned.replace(/\./g, "");
  }
  const value = parseFloat(cleaned);
  return value > 0 && !Number.isNaN(value) ? value : null;
}

export function extractJsonLdPrice(
  $: cheerio.CheerioAPI
): { title: string | null; price: number | null } {
  let foundTitle: string | null = null;
  let foundPrice: number | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (foundPrice != null) return;
    const raw = $(el).html();
    if (!raw) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const title = typeof record.name === "string" ? record.name : null;
      const offers = record.offers;
      if (offers && typeof offers === "object") {
        const o = offers as Record<string, unknown>;
        const priceRaw = o.price ?? o.lowPrice;
        if (priceRaw != null) {
          const p = parsePriceText(String(priceRaw));
          if (p != null) {
            foundTitle = title;
            foundPrice = p;
            return;
          }
        }
      }
      if (record.price != null) {
        const p = parsePriceText(String(record.price));
        if (p != null) {
          foundTitle = title;
          foundPrice = p;
          return;
        }
      }
    }
  });
  return { title: foundTitle, price: foundPrice };
}

export function extractMetaPrice($: cheerio.CheerioAPI): number | null {
  for (const prop of ["product:price:amount", "og:price:amount"]) {
    const tag =
      $(`meta[property="${prop}"]`).first() || $(`meta[name="${prop}"]`).first();
    const content = tag.attr("content");
    if (content) {
      const p = parsePriceText(content);
      if (p != null) return p;
    }
  }
  const itemprop = $('meta[itemprop="price"]').first();
  const c = itemprop.attr("content");
  if (c) {
    const p = parsePriceText(c);
    if (p != null) return p;
  }
  return null;
}

import { fetchHtml, loadCheerio } from "./base";
import { parseAkakce } from "./akakce";
import type { PriceResult } from "./pricing";

const COLOR_TOKENS = new Set([
  "bej",
  "siyah",
  "beyaz",
  "lacivert",
  "haki",
  "mavi",
  "gri",
  "yesil",
  "yeşil",
  "kirmizi",
  "kırmızı",
  "lila",
  "pembe",
  "turuncu",
  "kahve",
  "bordo",
]);

export function buildAkakceQueryFromTrendyolUrl(pageUrl: string): string {
  try {
    const u = new URL(pageUrl);
    const segments = u.pathname.split("/").filter(Boolean);
    const brand = segments[0]?.replace(/-/g, " ") ?? "";
    const slug = segments[segments.length - 1] ?? "";
    const skuMatch = slug.match(/-b(\d+)-p-/i) ?? pageUrl.match(/b(\d{4,})/i);
    const sku = skuMatch ? `b${skuMatch[1]}` : "";
    const slugBody = slug.replace(/-p-\d+$/, "");
    const tokens = slugBody.split("-").filter((t) => t.length > 1);
    const color = tokens.find((t) => COLOR_TOKENS.has(t.toLowerCase()));
    const parts = [brand, color, sku].filter(Boolean);
    if (parts.length) return parts.join(" ");
    return [brand, ...tokens.slice(0, 4)].join(" ");
  } catch {
    return "trendyol";
  }
}

export function trendyolColorToken(pageUrl: string): string | null {
  try {
    const segments = new URL(pageUrl).pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] ?? "";
    const tokens = slug.replace(/-p-\d+$/, "").split("-");
    for (const t of tokens) {
      if (COLOR_TOKENS.has(t.toLowerCase())) return t.toLowerCase();
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function scoreAkakceProductHref(href: string, pageUrl: string): number {
  let score = 0;
  const skuMatch = pageUrl.match(/-b(\d+)-p-/i) ?? pageUrl.match(/b(\d{4,})/i);
  const sku = skuMatch ? skuMatch[1] : "";
  const lower = href.toLowerCase();
  if (sku && lower.includes(`b${sku}`)) score += 50;
  const color = trendyolColorToken(pageUrl);
  if (color && lower.includes(color)) score += 20;
  try {
    const path = new URL(pageUrl).pathname.toLowerCase();
    const brand = path.split("/").filter(Boolean)[0];
    if (brand && lower.includes(brand)) score += 10;
  } catch {
    /* ignore */
  }
  if (lower.includes("fiyati,")) score += 5;
  return score;
}

export function pickBestAkakceProductLink(searchHtml: string, pageUrl: string): string | null {
  const hrefs = new Set<string>();
  for (const m of searchHtml.matchAll(/href="(\/[^"]+,\d+\.html)"/g)) {
    hrefs.add(m[1]);
  }
  let best: { href: string; score: number } | null = null;
  for (const href of hrefs) {
    const score = scoreAkakceProductHref(href, pageUrl);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { href, score };
  }
  return best?.href ?? null;
}

export function extractAkakceTrendyolOfferPrice(html: string): number | null {
  const re = /"vdName":\[0,"Trendyol"\][\s\S]*?"price":\[0,([\d.]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const price = parseFloat(m[1]);
    if (price > 0 && !Number.isNaN(price)) return price;
  }
  const minTrendyol = html.match(
    /"vdName":\[0,"Trendyol"\][\s\S]*?"minOfSortPrice":\[0,([\d.]+)\]/
  );
  if (minTrendyol) {
    const price = parseFloat(minTrendyol[1]);
    if (price > 0 && !Number.isNaN(price)) return price;
  }
  return null;
}

function extractAkakceTitle(html: string): string {
  const $ = loadCheerio(html);
  return $("h1").first().text().trim() || "Akakçe ürün";
}

export async function fetchTrendyolViaAkakce(
  pageUrl: string,
  userAgent: string
): Promise<PriceResult> {
  const query = buildAkakceQueryFromTrendyolUrl(pageUrl);
  const searchHtml = await fetchHtml(
    `https://www.akakce.com/arama/?q=${encodeURIComponent(query)}`,
    userAgent,
    20000
  );
  const productPath = pickBestAkakceProductLink(searchHtml, pageUrl);
  if (!productPath) {
    throw new Error("Akakçe'de eşleşen ürün bulunamadı");
  }
  const productUrl = productPath.startsWith("http")
    ? productPath
    : `https://www.akakce.com${productPath}`;
  const html = await fetchHtml(productUrl, userAgent, 20000);
  const trendyolPrice = extractAkakceTrendyolOfferPrice(html);
  const title = extractAkakceTitle(html);
  if (trendyolPrice != null) {
    return {
      title,
      price: trendyolPrice,
      currency: "TRY",
      priceSource: "akakce-trendyol",
    };
  }
  const parsed = parseAkakce(html);
  return {
    title: `${parsed.title} (piyasa — Akakçe)`,
    price: parsed.price,
    currency: "TRY",
    priceSource: "akakce-fallback",
  };
}

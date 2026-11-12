import { fetchHtml, loadCheerio } from "./base";
import { parseAkakce } from "./akakce";
import { extractHepsiburadaSku } from "./hepsiburada-url";
import type { PriceResult } from "./pricing";

export function buildAkakceQueryFromHepsiburadaUrl(pageUrl: string): string {
  try {
    const segments = new URL(pageUrl.trim()).pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] ?? "";
    const name = slug.replace(/-p[m]?-(HB[CV][A-Z0-9]+)$/i, "").replace(/-/g, " ");
    if (name.trim().length > 3) return name.trim();
  } catch {
    /* ignore */
  }
  const sku = extractHepsiburadaSku(pageUrl);
  if (sku) return sku;
  return "hepsiburada";
}

export function scoreAkakceHrefForHepsiburada(href: string, pageUrl: string): number {
  let score = 0;
  const lower = href.toLowerCase();
  const sku = extractHepsiburadaSku(pageUrl);
  if (sku && lower.includes(sku.toLowerCase())) score += 80;
  try {
    const slug = new URL(pageUrl.trim()).pathname.split("/").filter(Boolean).pop() ?? "";
    const tokens = slug
      .replace(/-p[m]?-(HB[CV][A-Z0-9]+)$/i, "")
      .split("-")
      .filter((t) => t.length > 2);
    for (const token of tokens.slice(0, 6)) {
      if (lower.includes(token.toLowerCase())) score += 8;
    }
  } catch {
    /* ignore */
  }
  if (lower.includes("fiyati,")) score += 5;
  return score;
}

export function pickAkakceProductLinksForHepsiburada(
  searchHtml: string,
  pageUrl: string,
  limit = 6
): string[] {
  const hrefs = new Set<string>();
  const linkRe = /href="(\/[^"]+,\d+\.html)"/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(searchHtml)) !== null) {
    hrefs.add(m[1]);
  }
  const ranked = Array.from(hrefs)
    .map((href) => ({ href, score: scoreAkakceHrefForHepsiburada(href, pageUrl) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map((row) => row.href);
}

const VARIANT_DRIFT = ["plus", "pro", "max", "mini", "ultra", "se"];

export function akakcePageMatchesHepsiburadaUrl(html: string, pageUrl: string): boolean {
  const lower = html.toLowerCase();
  const sku = extractHepsiburadaSku(pageUrl);
  if (sku && lower.includes(sku.toLowerCase())) return true;
  try {
    const slug = new URL(pageUrl.trim()).pathname.split("/").filter(Boolean).pop() ?? "";
    const stem = slug.replace(/-p[m]?-(HB[CV][A-Z0-9]+)$/i, "").toLowerCase();
    const tokens = stem.split("-").filter((t) => t.length > 1);
    if (tokens.length < 2) return false;
    const title = extractAkakceTitle(html).toLowerCase();
    const hay = `${title} ${lower}`;
    for (const token of tokens) {
      if (!hay.includes(token)) return false;
    }
    for (const variant of VARIANT_DRIFT) {
      if (!stem.includes(variant) && title.includes(variant)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Minimum Hepsiburada listing price on an Akakçe product page. */
export function extractAkakceHepsiburadaOfferPrice(html: string): number | null {
  const normalized = html.replace(/&quot;/g, '"');
  const re =
    /"vdName":\[0,"Hepsiburada"\][\s\S]*?"price":\[0,([\d.]+)\]/gi;
  let m: RegExpExecArray | null;
  let best: number | null = null;
  while ((m = re.exec(normalized)) !== null) {
    const price = parseFloat(m[1]);
    if (price > 0 && !Number.isNaN(price)) {
      if (best == null || price < best) best = price;
    }
  }
  return best;
}

function extractAkakceTitle(html: string): string {
  const $ = loadCheerio(html);
  return $("h1").first().text().trim() || "Akakçe ürün";
}

export async function fetchHepsiburadaViaAkakce(
  pageUrl: string,
  userAgent: string
): Promise<PriceResult> {
  const query = buildAkakceQueryFromHepsiburadaUrl(pageUrl);
  const searchHtml = await fetchHtml(
    `https://www.akakce.com/arama/?q=${encodeURIComponent(query)}`,
    userAgent,
    20000
  );
  let productPaths = pickAkakceProductLinksForHepsiburada(searchHtml, pageUrl);
  const sku = extractHepsiburadaSku(pageUrl);
  if (!productPaths.length && sku && sku !== query) {
    const retryHtml = await fetchHtml(
      `https://www.akakce.com/arama/?q=${encodeURIComponent(sku)}`,
      userAgent,
      20000
    );
    productPaths = pickAkakceProductLinksForHepsiburada(retryHtml, pageUrl);
  }
  if (!productPaths.length) {
    throw new Error("Akakçe'de eşleşen ürün bulunamadı");
  }
  let lastError: string | null = null;
  for (const productPath of productPaths) {
    const productUrl = productPath.startsWith("http")
      ? productPath
      : `https://www.akakce.com${productPath}`;
    const html = await fetchHtml(productUrl, userAgent, 20000);
    if (!akakcePageMatchesHepsiburadaUrl(html, pageUrl)) {
      lastError = "Akakçe ürünü HB URL ile eşleşmedi";
      continue;
    }
    const hbPrice = extractAkakceHepsiburadaOfferPrice(html);
    const title = extractAkakceTitle(html);
    if (hbPrice != null) {
      return {
        title,
        price: hbPrice,
        currency: "TRY",
        priceSource: "akakce-hepsiburada",
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
  throw new Error(lastError ?? "Akakçe'de eşleşen ürün bulunamadı");
}

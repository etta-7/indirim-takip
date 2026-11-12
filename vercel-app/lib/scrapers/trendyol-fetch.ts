import { fetchHtml } from "./base";
import { parseTrendyol } from "./trendyol";
import {
  canonicalTrendyolProductUrl,
  extractTrendyolContentId,
  isTrendyolUrl,
  normalizeTrendyolUrl,
} from "./trendyol-url";
import type { PriceResult } from "./pricing";

const API_BASE =
  "https://apigw.trendyol.com/discovery-web-productgw-service/api/productDetail";

export function trendyolRequestHeaders(referer?: string): Record<string, string> {
  return {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    Origin: "https://www.trendyol.com",
    Referer: referer ?? "https://www.trendyol.com/",
    "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
  };
}

function numericPrice(value: unknown): number | null {
  if (typeof value === "number" && value > 0) return value;
  if (value && typeof value === "object" && "value" in value) {
    const n = Number((value as { value?: unknown }).value);
    if (n > 0 && !Number.isNaN(n)) return n;
  }
  return null;
}

function pickTrendyolPriceFromResult(res: Record<string, unknown>): number | null {
  const priceBlock = res.price as Record<string, unknown> | undefined;
  if (priceBlock && typeof priceBlock === "object") {
    for (const key of ["discountedPrice", "sellingPrice", "originalPrice", "salePrice", "buyingPrice"]) {
      const p = numericPrice(priceBlock[key]);
      if (p != null) return p;
    }
    if (typeof priceBlock.current === "number" && priceBlock.current > 0) return priceBlock.current;
  }
  for (const key of ["lowestPrice", "price"]) {
    const p = numericPrice(res[key]);
    if (p != null) return p;
  }
  const listings = res.merchantListing as Record<string, unknown> | undefined;
  if (listings?.price && typeof listings.price === "object") {
    const p = pickTrendyolPriceFromResult({ price: listings.price });
    if (p != null) return p;
  }
  return null;
}

export function parseTrendyolApiPayload(body: unknown): PriceResult {
  const root = body as { result?: Record<string, unknown> };
  const res = root?.result;
  if (!res || typeof res !== "object") {
    throw new Error("Trendyol API yanıtı geçersiz");
  }
  const title = typeof res.name === "string" ? res.name : "Trendyol ürün";
  const price = pickTrendyolPriceFromResult(res);
  if (price == null || price <= 0) throw new Error("Trendyol fiyat bulunamadı");
  return { title, price, currency: "TRY" };
}

export function extractTrendyolListingParams(
  url: string
): { merchantId?: string; boutiqueId?: string } {
  try {
    const u = new URL(url.trim());
    return {
      merchantId: u.searchParams.get("merchantId") ?? undefined,
      boutiqueId: u.searchParams.get("boutiqueId") ?? undefined,
    };
  } catch {
    return {};
  }
}

export async function fetchTrendyolApi(
  contentId: number,
  userAgent: string,
  pageUrl?: string
): Promise<PriceResult> {
  const qs = new URLSearchParams({
    sav: "false",
    storefrontId: "1",
    culture: "tr-TR",
    linearVariants: "true",
    isLegalRequirementConfirmed: "false",
  });
  const listing = pageUrl ? extractTrendyolListingParams(pageUrl) : {};
  if (listing.merchantId) qs.set("merchantId", listing.merchantId);
  if (listing.boutiqueId) qs.set("boutiqueId", listing.boutiqueId);
  const referer =
    pageUrl && isTrendyolUrl(pageUrl) ? pageUrl : canonicalTrendyolProductUrl(contentId);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(`${API_BASE}/${contentId}?${qs}`, {
      headers: { "User-Agent": userAgent, ...trendyolRequestHeaders(referer) },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Trendyol API HTTP ${resp.status}`);
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      throw new Error("Trendyol API JSON değil");
    }
    const json = await resp.json();
    return parseTrendyolApiPayload(json);
  } finally {
    clearTimeout(t);
  }
}

export async function resolveRedirects(url: string, userAgent: string, max = 6): Promise<string> {
  let current = url;
  for (let i = 0; i < max; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    try {
      const resp = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "tr-TR,tr;q=0.9",
          ...trendyolRequestHeaders(current.includes("trendyol") ? current : undefined),
        },
        signal: controller.signal,
      });
      if (resp.status >= 300 && resp.status < 400) {
        const loc = resp.headers.get("location");
        if (!loc) break;
        current = new URL(loc, current).href;
        continue;
      }
      break;
    } finally {
      clearTimeout(t);
    }
  }
  return current;
}

export async function resolveProductUrl(url: string, userAgent: string): Promise<string> {
  let u = url.trim();
  if (!u) return u;
  if (u.startsWith("ty://")) {
    return normalizeTrendyolUrl(u);
  }
  if (/ty\.gl\//i.test(u)) {
    try {
      u = await resolveRedirects(u, userAgent);
    } catch {
      /* keep original */
    }
  }
  return normalizeTrendyolUrl(u);
}

export async function fetchTrendyolPrice(url: string, userAgent: string): Promise<PriceResult> {
  const resolved = await resolveProductUrl(url, userAgent);
  const pageUrl = isTrendyolUrl(resolved) ? resolved : url;
  const contentId = extractTrendyolContentId(pageUrl);
  if (contentId != null) {
    try {
      return await fetchTrendyolApi(contentId, userAgent, pageUrl);
    } catch {
      /* fall through to HTML */
    }
  }
  const html = await fetchHtml(pageUrl, userAgent, 15000, trendyolRequestHeaders(pageUrl));
  return parseTrendyol(html);
}

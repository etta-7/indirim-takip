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

export function parseTrendyolApiPayload(body: unknown): PriceResult {
  const root = body as { result?: Record<string, unknown> };
  const res = root?.result;
  if (!res || typeof res !== "object") {
    throw new Error("Trendyol API yanıtı geçersiz");
  }
  const title = typeof res.name === "string" ? res.name : "Trendyol ürün";
  const priceBlock = res.price as Record<string, unknown> | undefined;
  let price: number | null = null;
  const discounted = priceBlock?.discountedPrice as { value?: number } | undefined;
  const selling = priceBlock?.sellingPrice as { value?: number } | undefined;
  const original = priceBlock?.originalPrice as { value?: number } | undefined;
  if (discounted?.value != null && discounted.value > 0) price = Number(discounted.value);
  else if (selling?.value != null && selling.value > 0) price = Number(selling.value);
  else if (original?.value != null && original.value > 0) price = Number(original.value);
  if (price == null || price <= 0) throw new Error("Trendyol fiyat bulunamadı");
  return { title, price, currency: "TRY" };
}

export async function fetchTrendyolApi(
  contentId: number,
  userAgent: string
): Promise<PriceResult> {
  const qs = new URLSearchParams({
    sav: "false",
    storefrontId: "1",
    culture: "tr-TR",
    linearVariants: "true",
    isLegalRequirementConfirmed: "false",
  });
  const referer = canonicalTrendyolProductUrl(contentId);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(`${API_BASE}/${contentId}?${qs}`, {
      headers: { "User-Agent": userAgent, ...trendyolRequestHeaders(referer) },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Trendyol API HTTP ${resp.status}`);
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
  const contentId = extractTrendyolContentId(resolved);
  if (contentId != null) {
    try {
      return await fetchTrendyolApi(contentId, userAgent);
    } catch {
      /* fall through to HTML */
    }
  }
  const pageUrl = isTrendyolUrl(resolved) ? resolved : url;
  const html = await fetchHtml(pageUrl, userAgent, 15000, trendyolRequestHeaders(pageUrl));
  return parseTrendyol(html);
}

import { fetchHtml } from "./base";
import { parseTrendyol } from "./trendyol";
import { fetchTrendyolViaAkakce } from "./trendyol-akakce-fallback";
import { isFailedHepsiburadaShortResolve, isHepsiburadaShortUrl } from "./hepsiburada-url";
import {
  canonicalTrendyolProductUrl,
  extractTrendyolContentId,
  isTrendyolUrl,
  normalizeTrendyolUrl,
} from "./trendyol-url";
import type { PriceResult } from "./pricing";

const API_PATH = "/discovery-web-productgw-service/api/productDetail";
const API_BASES = [
  `https://apigw.trendyol.com${API_PATH}`,
  `https://www.trendyol.com/api${API_PATH}`,
];
const MOBILE_APP_ID = "4aeffe4c-5887-11e8-a657-3787f655e34c";

export function trendyolRequestHeaders(
  referer?: string,
  opts: { mobile?: boolean } = {}
): Record<string, string> {
  const base: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    Origin: "https://www.trendyol.com",
    Referer: referer ?? "https://www.trendyol.com/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
  };
  if (opts.mobile) {
    return {
      ...base,
      "x-application-id": MOBILE_APP_ID,
      "x-channel": "android",
    };
  }
  return {
    ...base,
    "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
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

async function fetchTrendyolApiOnce(
  apiBase: string,
  contentId: number,
  userAgent: string,
  referer: string,
  qs: URLSearchParams,
  headerOpts: { mobile?: boolean }
): Promise<PriceResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(`${apiBase}/${contentId}?${qs}`, {
      headers: {
        "User-Agent": userAgent,
        ...trendyolRequestHeaders(referer, headerOpts),
      },
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`Trendyol API HTTP ${resp.status} (${apiBase})`);
    }
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      throw new Error(`Trendyol API JSON değil (${apiBase})`);
    }
    const json = await resp.json();
    const result = parseTrendyolApiPayload(json);
    return { ...result, priceSource: "trendyol-api" };
  } finally {
    clearTimeout(t);
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
  const errors: string[] = [];
  for (const apiBase of API_BASES) {
    for (const mobile of [false, true]) {
      try {
        return await fetchTrendyolApiOnce(apiBase, contentId, userAgent, referer, qs, { mobile });
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
  throw new Error(errors.join("; ") || "Trendyol API başarısız");
}

export async function resolveRedirects(
  url: string,
  userAgent: string,
  max = 6
): Promise<string> {
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
  if (isHepsiburadaShortUrl(u)) {
    const short = u;
    try {
      u = await resolveRedirects(u, userAgent);
    } catch {
      /* keep original */
    }
    if (isFailedHepsiburadaShortResolve(u, short)) {
      u = short;
    }
  }
  return normalizeTrendyolUrl(u);
}

export async function fetchTrendyolPrice(url: string, userAgent: string): Promise<PriceResult> {
  const resolved = await resolveProductUrl(url, userAgent);
  const pageUrl = isTrendyolUrl(resolved) ? resolved : url;
  const contentId = extractTrendyolContentId(pageUrl);
  const errors: string[] = [];
  if (contentId != null) {
    try {
      return await fetchTrendyolApi(contentId, userAgent, pageUrl);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  try {
    const html = await fetchHtml(pageUrl, userAgent, 15000, trendyolRequestHeaders(pageUrl));
    const parsed = parseTrendyol(html);
    return { ...parsed, priceSource: "trendyol-html" };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  try {
    return await fetchTrendyolViaAkakce(pageUrl, userAgent);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  throw new Error(
    errors.length
      ? `Trendyol fiyat bulunamadı (${errors.slice(0, 3).join(" · ")})`
      : "Trendyol fiyat bulunamadı"
  );
}

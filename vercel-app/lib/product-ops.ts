import {
  NO_ABSOLUTE_TARGET,
  normalizeAlertText,
  parsePercentToken,
  splitAlertArgs,
} from "./alert-rules";
import { addProduct, getProduct, updateAfterCheck } from "./db/products";
import type { Product } from "./db/types";
import { detectSite, fetchPrice, resolveProductUrl } from "./scrapers/base";
import { getHttpUserAgent } from "./env";

export type AddProductOutcome = {
  product: Product;
  scrape_warning?: string;
};

function scrapeWarningFromSource(source: string | undefined, errMsg?: string): string | undefined {
  if (errMsg) return errMsg;
  if (source === "akakce-trendyol") {
    return "Trendyol doğrudan erişilemedi; fiyat Akakçe Trendyol satıcısından alındı.";
  }
  if (source === "akakce-fallback") {
    return "Trendyol erişimi engellendi; gösterilen fiyat Akakçe piyasa özetidir (Trendyol dışı satıcı olabilir).";
  }
  return undefined;
}

export type AddProductRequest = {
  url: string;
  target_price?: number | null;
  target_drop_percent?: number | null;
  target_text?: string | null;
};

export function parseTargetText(text: string): { target: number | null; dropPct: number | null } {
  const normalized = normalizeAlertText(text);
  const { rest, percent: splitPct } = splitAlertArgs(normalized.split(/\s+/));
  let target: number | null = null;
  let dropPct = splitPct;
  if (rest.length > 0) {
    if (parsePercentToken(rest[0]) !== null) target = NO_ABSOLUTE_TARGET;
    else {
      const n = parseFloat(rest[0].replace(",", "."));
      if (Number.isNaN(n)) return { target: null, dropPct: null };
      target = n;
    }
  }
  if (dropPct == null && rest.length > 1) dropPct = parsePercentToken(rest[1]);
  if (target == null && dropPct == null) return { target: null, dropPct: null };
  if (target == null && dropPct != null) target = NO_ABSOLUTE_TARGET;
  return { target, dropPct };
}

export function resolveTargets(
  req: AddProductRequest
): { target: number; drop: number | null } | string {
  let target = req.target_price ?? null;
  let drop = req.target_drop_percent ?? null;
  if (req.target_text) {
    const parsed = parseTargetText(req.target_text);
    if (parsed.target == null && parsed.dropPct == null) {
      return "Geçersiz hedef. Örnek: 2500, 10% veya 2500 10%";
    }
    if (target == null) target = parsed.target;
    if (drop == null) drop = parsed.dropPct;
  }
  if (target == null && drop == null) {
    return "En az bir uyarı eşiği gerekli (TL hedefi veya yüzde).";
  }
  if (target == null) target = NO_ABSOLUTE_TARGET;
  if (target < 0 && drop == null) {
    return "En az bir uyarı eşiği gerekli (TL hedefi veya yüzde).";
  }
  return { target, drop };
}

export async function addProductFromRequest(
  req: AddProductRequest
): Promise<AddProductOutcome | string> {
  const raw = req.url.trim();
  if (!raw) return "URL gerekli.";
  const url = await resolveProductUrl(raw, getHttpUserAgent());
  const resolved = resolveTargets(req);
  if (typeof resolved === "string") return resolved;
  const { target, drop } = resolved;
  const site = detectSite(url);
  if (site === "unknown") {
    return "URL tanınamadı. Trendyol, Hepsiburada, Akakçe veya Cimri linki gerekli.";
  }
  let product: Product;
  try {
    product = await addProduct(url, site, target, { target_drop_percent: drop });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return "Bu URL zaten listede veya kayıt başarısız.";
    }
    throw e;
  }
  const userAgent = getHttpUserAgent();
  try {
    const quote = await fetchPrice(url, userAgent);
    await updateAfterCheck(product.id, {
      title: quote.title,
      last_price: quote.price,
      baseline_price: quote.price,
    });
    const fresh = (await getProduct(product.id)) ?? product;
    return {
      product: fresh,
      scrape_warning: scrapeWarningFromSource(quote.priceSource),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      product,
      scrape_warning: `Fiyat şimdi alınamadı: ${msg}. «Şimdi kontrol et» ile tekrar deneyin.`,
    };
  }
}

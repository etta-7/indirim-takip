import * as cheerio from "cheerio";
import { parseHepsiburada } from "./hepsiburada";
import { parseAkakce } from "./akakce";
import { parseCimri } from "./cimri";
import { parseTrendyol } from "./trendyol";
import { fetchTrendyolPrice, resolveProductUrl } from "./trendyol-fetch";
import { isHepsiburadaUrl } from "./hepsiburada-url";
import { isTrendyolUrl } from "./trendyol-url";
import type { PriceResult } from "./pricing";

const PARSERS: Record<string, (html: string) => PriceResult> = {
  hepsiburada: parseHepsiburada,
  akakce: parseAkakce,
  cimri: parseCimri,
};

export function detectSite(url: string): string {
  if (isTrendyolUrl(url)) return "trendyol";
  if (isHepsiburadaUrl(url)) return "hepsiburada";
  const u = url.toLowerCase();
  if (u.includes("trendyol")) return "trendyol";
  if (u.includes("hepsiburada")) return "hepsiburada";
  if (u.includes("akakce") || u.includes("akakçe")) return "akakce";
  if (u.includes("cimri")) return "cimri";
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("trendyol")) return "trendyol";
    if (host.includes("hepsiburada")) return "hepsiburada";
    if (host.includes("akakce")) return "akakce";
    if (host.includes("cimri")) return "cimri";
  } catch {
    /* ignore */
  }
  return "unknown";
}

export async function fetchHtml(
  url: string,
  userAgent: string,
  timeoutMs = 15000,
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        Accept: "text/html,application/xhtml+xml",
        ...extraHeaders,
      },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchPrice(url: string, userAgent: string): Promise<PriceResult> {
  const resolved = await resolveProductUrl(url, userAgent);
  const site = detectSite(resolved);
  if (site === "unknown") {
    throw new Error(`Desteklenmeyen veya tanınamayan URL: ${url}`);
  }
  if (site === "trendyol") {
    const result = await fetchTrendyolPrice(resolved, userAgent);
    if (result.price <= 0) throw new Error(`Fiyat okunamadı: ${url}`);
    return result;
  }
  const parser = PARSERS[site];
  if (!parser) throw new Error(`Desteklenmeyen veya tanınamayan URL: ${url}`);
  const html = await fetchHtml(resolved, userAgent);
  const result = parser(html);
  if (result.price <= 0) throw new Error(`Fiyat okunamadı: ${url}`);
  return result;
}

export { resolveProductUrl } from "./trendyol-fetch";

export function parseHtmlForSite(site: string, html: string): PriceResult {
  if (site === "trendyol") return parseTrendyol(html);
  const parser = PARSERS[site];
  if (!parser) throw new Error(`Bilinmeyen site: ${site}`);
  return parser(html);
}

export function loadCheerio(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

import * as cheerio from "cheerio";
import { parseTrendyol } from "./trendyol";
import { parseHepsiburada } from "./hepsiburada";
import { parseAkakce } from "./akakce";
import { parseCimri } from "./cimri";
import type { PriceResult } from "./pricing";

const PARSERS: Record<string, (html: string) => PriceResult> = {
  trendyol: parseTrendyol,
  hepsiburada: parseHepsiburada,
  akakce: parseAkakce,
  cimri: parseCimri,
};

export function detectSite(url: string): string {
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

export async function fetchHtml(url: string, userAgent: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        Accept: "text/html,application/xhtml+xml",
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
  const site = detectSite(url);
  if (site === "unknown" || !PARSERS[site]) {
    throw new Error(`Desteklenmeyen veya tanınamayan URL: ${url}`);
  }
  const html = await fetchHtml(url, userAgent);
  const result = PARSERS[site](html);
  if (result.price <= 0) throw new Error(`Fiyat okunamadı: ${url}`);
  return result;
}

export function parseHtmlForSite(site: string, html: string): PriceResult {
  const parser = PARSERS[site];
  if (!parser) throw new Error(`Bilinmeyen site: ${site}`);
  return parser(html);
}

export function loadCheerio(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

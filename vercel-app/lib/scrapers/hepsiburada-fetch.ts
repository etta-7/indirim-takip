import { fetchHtml } from "./base";
import { parseHepsiburada } from "./hepsiburada";
import { fetchHepsiburadaViaAkakce } from "./hepsiburada-akakce-fallback";
import type { PriceResult } from "./pricing";

export function hepsiburadaRequestHeaders(referer?: string): Record<string, string> {
  return {
    Referer: referer ?? "https://www.hepsiburada.com/",
    Origin: "https://www.hepsiburada.com",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
  };
}

export function isHepsiburadaSecurityPage(html: string): boolean {
  return /HBBlockandCaptcha|Hepsiburada\s*\|\s*Güvenlik/i.test(html);
}

export async function fetchHepsiburadaPrice(
  userAgent: string,
  pageUrl: string
): Promise<PriceResult> {
  const errors: string[] = [];
  if (pageUrl.includes("hepsiburada.com")) {
    try {
      const html = await fetchHtml(
        pageUrl,
        userAgent,
        15000,
        hepsiburadaRequestHeaders(pageUrl)
      );
      if (!isHepsiburadaSecurityPage(html)) {
        const parsed = parseHepsiburada(html);
        return { ...parsed, priceSource: "hepsiburada-html" };
      }
      errors.push("Hepsiburada güvenlik sayfası");
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  try {
    return await fetchHepsiburadaViaAkakce(pageUrl, userAgent);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  throw new Error(
    errors.length
      ? `Hepsiburada fiyat bulunamadı (${errors.slice(0, 3).join(" · ")})`
      : "Hepsiburada fiyat bulunamadı"
  );
}

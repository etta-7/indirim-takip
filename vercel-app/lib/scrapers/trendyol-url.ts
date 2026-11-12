/** Trendyol product URL / deeplink helpers. */

const PRODUCT_ID_IN_PATH = /(?:^|[/?&-])p-(\d{6,})/i;

export function isTrendyolUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  if (u.startsWith("ty://")) return true;
  if (u.includes("ty.gl")) return true;
  if (u.includes("trendyol")) return true;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host.includes("trendyol") || host === "ty.gl";
  } catch {
    return false;
  }
}

export function extractTrendyolContentId(url: string): number | null {
  const u = url.trim();
  const fromDeeplink = u.match(/ContentId=(\d{6,})/i);
  if (fromDeeplink) return parseInt(fromDeeplink[1], 10);
  const fromQuery = u.match(/[?&]contentId=(\d{6,})/i);
  if (fromQuery) return parseInt(fromQuery[1], 10);
  const fromPath = u.match(PRODUCT_ID_IN_PATH);
  if (fromPath) return parseInt(fromPath[1], 10);
  return null;
}

export function canonicalTrendyolProductUrl(contentId: number): string {
  return `https://www.trendyol.com/-p-${contentId}`;
}

export function normalizeTrendyolUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("ty://")) {
    const id = extractTrendyolContentId(trimmed);
    if (id != null) return canonicalTrendyolProductUrl(id);
    return trimmed;
  }
  const id = extractTrendyolContentId(trimmed);
  if (id != null && (trimmed.includes("ty.gl") || !trimmed.includes("trendyol.com"))) {
    return canonicalTrendyolProductUrl(id);
  }
  return trimmed;
}

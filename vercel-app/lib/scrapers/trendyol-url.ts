/** Trendyol product URL / deeplink helpers. */

const PATH_CONTENT_IDS = /-p-(\d{6,})/gi;

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

function lastPathContentId(pathOrUrl: string): number | null {
  let last: string | null = null;
  const re = new RegExp(PATH_CONTENT_IDS.source, PATH_CONTENT_IDS.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(pathOrUrl)) !== null) {
    last = m[1];
  }
  return last != null ? parseInt(last, 10) : null;
}

export function extractTrendyolContentId(url: string): number | null {
  const u = url.trim();
  const fromDeeplink = u.match(/ContentId=(\d{6,})/i);
  if (fromDeeplink) return parseInt(fromDeeplink[1], 10);
  const fromQuery = u.match(/[?&]contentId=(\d{6,})/i);
  if (fromQuery) return parseInt(fromQuery[1], 10);
  try {
    const parsed = new URL(u.includes("://") ? u : `https://www.trendyol.com${u.startsWith("/") ? u : `/${u}`}`);
    const fromPath = lastPathContentId(parsed.pathname);
    if (fromPath != null) return fromPath;
  } catch {
    /* ignore */
  }
  return lastPathContentId(u.split(/[?#]/)[0] ?? u);
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

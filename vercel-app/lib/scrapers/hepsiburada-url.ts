/** Hepsiburada product / short-link helpers. */

export function isHepsiburadaShortUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  if (u.includes("hb.biz")) return true;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host === "hb.biz" || host.endsWith(".hb.biz");
  } catch {
    return false;
  }
}

export function isHepsiburadaUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  if (u.includes("hepsiburada.com")) return true;
  return isHepsiburadaShortUrl(url);
}

const HB_SKU_RE = /(HB[CV][A-Z0-9]{10,})/i;

/** Variant / share SKU from canonical URL or hb.biz short link path. */
export function extractHepsiburadaSku(url: string): string | null {
  const slugSku = url.match(/-p[m]?-(HB[CV][A-Z0-9]+)/i);
  if (slugSku) return slugSku[1].toUpperCase();
  try {
    const path = new URL(url.trim()).pathname.replace(/^\//, "");
    const segment = path.split("/").filter(Boolean).pop() ?? "";
    if (/^HB[CV]/i.test(segment)) return segment.toUpperCase();
  } catch {
    /* ignore */
  }
  const loose = url.match(HB_SKU_RE);
  return loose ? loose[1].toUpperCase() : null;
}

/** hb.biz often collapses to site root when bots are detected. */
export function isFailedHepsiburadaShortResolve(resolved: string, original: string): boolean {
  if (!isHepsiburadaShortUrl(original)) return false;
  const r = resolved.trim().toLowerCase().replace(/\/$/, "");
  if (r === "https://hb.biz" || r === "http://hb.biz") return true;
  return !resolved.toLowerCase().includes("hepsiburada.com");
}

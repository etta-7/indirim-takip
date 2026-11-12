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

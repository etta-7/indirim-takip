import { afterEach, describe, expect, it, vi } from "vitest";
import { detectSite } from "./base";
import { isHepsiburadaShortUrl, isHepsiburadaUrl } from "./hepsiburada-url";
import { resolveProductUrl } from "./trendyol-fetch";

const EXAMPLE_SHORT = "https://hb.biz/HBV00000Y1NON";
const CANONICAL =
  "https://www.hepsiburada.com/apple-iphone-15-128gb-p-HBCV00004X9X2I";

describe("Hepsiburada short links", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects hb.biz before redirect expansion", () => {
    expect(isHepsiburadaShortUrl(EXAMPLE_SHORT)).toBe(true);
    expect(isHepsiburadaUrl(EXAMPLE_SHORT)).toBe(true);
    expect(detectSite(EXAMPLE_SHORT)).toBe("hepsiburada");
  });

  it("follows redirect from hb.biz to canonical product URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 301,
        headers: { get: (k: string) => (k === "location" ? CANONICAL : null) },
      })
    );
    const out = await resolveProductUrl(EXAMPLE_SHORT, "Mozilla/5.0 (test)");
    expect(out).toBe(CANONICAL);
  });
});

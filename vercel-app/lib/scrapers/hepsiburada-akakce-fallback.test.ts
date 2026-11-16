import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAkakceQueryFromHepsiburadaUrl,
  extractAkakceHepsiburadaOfferPrice,
  pickAkakceProductLinksForHepsiburada,
  scoreAkakceHrefForHepsiburada,
} from "./hepsiburada-akakce-fallback";
import { extractHepsiburadaSku, isFailedHepsiburadaShortResolve } from "./hepsiburada-url";

const canonical =
  "https://www.hepsiburada.com/apple-iphone-15-128gb-p-HBCV00004X9X2I";
const shortLink = "https://hb.biz/HBV00000Y1NON";

describe("Hepsiburada Akakçe fallback", () => {
  it("extracts SKU from canonical and short URLs", () => {
    expect(extractHepsiburadaSku(canonical)).toBe("HBCV00004X9X2I");
    expect(extractHepsiburadaSku(shortLink)).toBe("HBV00000Y1NON");
  });

  it("detects failed hb.biz bot redirect", () => {
    expect(isFailedHepsiburadaShortResolve("https://hb.biz", shortLink)).toBe(true);
    expect(isFailedHepsiburadaShortResolve(canonical, shortLink)).toBe(false);
  });

  it("builds Akakçe query from slug or SKU", () => {
    expect(buildAkakceQueryFromHepsiburadaUrl(canonical)).toBe("apple iphone 15 128gb");
    expect(buildAkakceQueryFromHepsiburadaUrl(shortLink)).toBe("HBV00000Y1NON");
  });

  it("prefers links that mention the HB SKU", () => {
    const good =
      "/cep-telefonu/en-ucuz-apple-iphone-15-hbcv00004x9x2i-fiyati,1.html";
    const weak = "/cep-telefonu/en-ucuz-rastgele-fiyati,2.html";
    expect(scoreAkakceHrefForHepsiburada(good, canonical)).toBeGreaterThan(
      scoreAkakceHrefForHepsiburada(weak, canonical)
    );
    const searchHtml = `<a href="${good}">a</a><a href="${weak}">b</a>`;
    expect(pickAkakceProductLinksForHepsiburada(searchHtml, canonical)[0]).toBe(good);
  });

  it("reads minimum Hepsiburada vendor price from fixture", () => {
    const html = fs.readFileSync(
      path.join(__dirname, "../../../tests/fixtures/akakce_hepsiburada_offer.html"),
      "utf8"
    );
    expect(extractAkakceHepsiburadaOfferPrice(html)).toBe(57499);
  });
});

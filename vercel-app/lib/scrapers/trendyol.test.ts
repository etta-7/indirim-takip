import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectSite } from "./base";
import { parseTrendyolApiPayload } from "./trendyol-fetch";
import {
  canonicalTrendyolProductUrl,
  extractTrendyolContentId,
  isTrendyolUrl,
  normalizeTrendyolUrl,
} from "./trendyol-url";
import { parseTrendyol } from "./trendyol";

describe("Trendyol URL detection", () => {
  it("detects ty.gl short links", () => {
    expect(isTrendyolUrl("https://ty.gl/abc123")).toBe(true);
    expect(detectSite("https://ty.gl/abc123")).toBe("trendyol");
  });

  it("detects ty:// deeplinks", () => {
    const deeplink = "ty://?Page=Product&ContentId=1925865";
    expect(detectSite(deeplink)).toBe("trendyol");
    expect(normalizeTrendyolUrl(deeplink)).toBe(canonicalTrendyolProductUrl(1925865));
  });

  it("extracts content id from product path", () => {
    expect(extractTrendyolContentId("https://www.trendyol.com/foo-p-762254881?boutiqueId=1")).toBe(
      762254881
    );
  });

  const avvaUrl =
    "https://www.trendyol.com/avva/erkek-bej-beli-lastikli-100-keten-relaxed-fit-pantolon-b003032-p-926542786";

  it("extracts trailing content id for SKU-style slugs (b003032-p-926542786)", () => {
    expect(extractTrendyolContentId(avvaUrl)).toBe(926542786);
    expect(detectSite(avvaUrl)).toBe("trendyol");
  });

  it("prefers last -p-id when slug contains multiple segments", () => {
    expect(
      extractTrendyolContentId("https://www.trendyol.com/x/clearance-p-111222333-sku-b003032-p-926542786")
    ).toBe(926542786);
  });
});

describe("Trendyol parsers", () => {
  it("parses product HTML fixture", () => {
    const html = fs.readFileSync(
      path.join(__dirname, "../../../tests/fixtures/trendyol_product.html"),
      "utf8"
    );
    const result = parseTrendyol(html);
    expect(result.price).toBe(1299.99);
  });

  it("parses embedded JSON object price from HTML", () => {
    const html = fs.readFileSync(
      path.join(__dirname, "../../../tests/fixtures/trendyol_embedded_price.html"),
      "utf8"
    );
    expect(parseTrendyol(html).price).toBe(899.99);
  });

  it("parses API JSON fixture", () => {
    const json = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../../tests/fixtures/trendyol_api.json"), "utf8")
    );
    const result = parseTrendyolApiPayload(json);
    expect(result.title).toContain("Test Trendyol");
    expect(result.price).toBe(57249);
  });
});

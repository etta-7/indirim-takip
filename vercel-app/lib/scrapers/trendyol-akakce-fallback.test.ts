import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAkakceQueryFromTrendyolUrl,
  pickBestAkakceProductLink,
  scoreAkakceProductHref,
} from "./trendyol-akakce-fallback";

const avvaUrl =
  "https://www.trendyol.com/avva/erkek-bej-beli-lastikli-100-keten-relaxed-fit-pantolon-b003032-p-926542786";

describe("Trendyol Akakçe fallback helpers", () => {
  it("builds search query from SKU slug", () => {
    const q = buildAkakceQueryFromTrendyolUrl(avvaUrl);
    expect(q.toLowerCase()).toContain("avva");
    expect(q.toLowerCase()).toContain("b003032");
    expect(q.toLowerCase()).toContain("bej");
  });

  it("ranks matching SKU links higher", () => {
    const good = "/pantolon/en-ucuz-avva-erkek-bej-relaxed-fit-beli-lastikli-100-keten-b003032-fiyati,1182091777.html";
    const weak = "/pantolon/en-ucuz-avva-erkek-siyah-relaxed-fit-beli-lastikli-100-keten-b003032-fiyati,1129212157.html";
    expect(scoreAkakceProductHref(good, avvaUrl)).toBeGreaterThan(
      scoreAkakceProductHref(weak, avvaUrl)
    );
  });

  it("picks bej variant from search HTML fixture", () => {
    const html = fs.readFileSync(
      path.join(__dirname, "../../../tests/fixtures/akakce_search.html"),
      "utf8"
    );
    const extra = `${html}<a href="/pantolon/en-ucuz-avva-erkek-bej-relaxed-fit-beli-lastikli-100-keten-b003032-fiyati,1182091777.html">x</a>`;
    const href = pickBestAkakceProductLink(extra, avvaUrl);
    expect(href).toContain("b003032");
    expect(href).toContain("bej");
  });
});

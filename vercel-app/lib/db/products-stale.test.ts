import { describe, expect, it } from "vitest";
import { isCheckStale } from "./products";

describe("isCheckStale", () => {
  const maxAge = 28 * 60 * 1000;
  const now = Date.parse("2026-11-12T04:30:00.000Z");

  it("returns false when no products", () => {
    expect(isCheckStale(0, null, maxAge, now)).toBe(false);
  });

  it("returns true when never checked", () => {
    expect(isCheckStale(3, null, maxAge, now)).toBe(true);
  });

  it("returns true when latest older than threshold", () => {
    expect(isCheckStale(4, "2026-11-12T03:13:33.644Z", maxAge, now)).toBe(true);
  });

  it("returns false when latest is fresh", () => {
    expect(isCheckStale(4, "2026-11-12T04:20:00.000Z", maxAge, now)).toBe(false);
  });
});

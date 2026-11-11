import { describe, expect, it } from "vitest";
import {
  NO_ABSOLUTE_TARGET,
  normalizeAlertText,
  percentDropFromBaseline,
  shouldAlertAbsolute,
  shouldAlertPercentDrop,
  splitAlertArgs,
  parsePriceMessage,
} from "./alert-rules";

describe("alert-rules", () => {
  it("percent drop", () => {
    expect(percentDropFromBaseline(1000, 900)).toBeCloseTo(10);
    expect(percentDropFromBaseline(1000, 1100)).toBe(0);
  });

  it("should alert percent", () => {
    expect(shouldAlertPercentDrop(850, 1000, 10)).toBe(true);
    expect(shouldAlertPercentDrop(950, 1000, 10)).toBe(false);
  });

  it("absolute sentinel", () => {
    expect(shouldAlertAbsolute(100, NO_ABSOLUTE_TARGET)).toBe(false);
    expect(shouldAlertAbsolute(100, 150)).toBe(true);
  });

  it("split and parse", () => {
    const { rest, percent } = splitAlertArgs(["2500", "--percent", "10"]);
    expect(percent).toBe(10);
    expect(rest).toEqual(["2500"]);
    expect(normalizeAlertText("5 %")).toBe("5%");
    const parsed = parsePriceMessage("2500 10%");
    expect(parsed.target).toBe(2500);
    expect(parsed.dropPct).toBe(10);
  });
});

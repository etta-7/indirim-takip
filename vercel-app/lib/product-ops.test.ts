import { describe, expect, it } from "vitest";
import { validateTargetUpdate } from "./product-ops";
import { NO_ABSOLUTE_TARGET } from "./alert-rules";

describe("validateTargetUpdate", () => {
  it("accepts price only", () => {
    expect(validateTargetUpdate({ target_price: 2500 })).toEqual({
      target: 2500,
      drop: null,
      reset_baseline: false,
    });
  });
  it("accepts percent only and clears absolute target", () => {
    expect(validateTargetUpdate({ target_price: null, target_drop_percent: 10, reset_baseline: true })).toEqual({
      target: NO_ABSOLUTE_TARGET,
      drop: 10,
      reset_baseline: true,
    });
  });
  it("rejects empty and invalid values", () => {
    expect(typeof validateTargetUpdate({})).toBe("string");
    expect(typeof validateTargetUpdate({ target_price: -5 })).toBe("string");
    expect(typeof validateTargetUpdate({ target_drop_percent: 100 })).toBe("string");
    expect(typeof validateTargetUpdate({ target_price: "abc" as unknown as number })).toBe("string");
  });
});

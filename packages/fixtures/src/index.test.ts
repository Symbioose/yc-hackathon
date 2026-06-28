import { describe, it, expect } from "vitest";
import { fuseConfidence } from "./index";

describe("fuseConfidence (noisy-OR)", () => {
  it("returns 0 for no sources", () => {
    expect(fuseConfidence([])).toBe(0);
  });

  it("returns the single source reliability", () => {
    expect(fuseConfidence([{ name: "a", type: "press", reliability: 0.6, observed_at: "t" }])).toBeCloseTo(0.6, 4);
  });

  it("fuses independent sources: 1 - (1-0.7)(1-0.6) = 0.88", () => {
    expect(
      fuseConfidence([
        { name: "a", type: "tor_forum", reliability: 0.7, observed_at: "t" },
        { name: "b", type: "breach_api", reliability: 0.6, observed_at: "t" },
      ]),
    ).toBeCloseTo(0.88, 4);
  });
});

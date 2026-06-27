import { describe, it, expect } from "vitest";
import { heroSourcesFor } from "./breach";

describe("heroSourcesFor", () => {
  it("returns the verified fixture sources for the hero ticker (deterministic)", () => {
    const s = heroSourcesFor("LYV");
    expect(s).not.toBeNull();
    expect(s!.length).toBeGreaterThanOrEqual(2);
    expect(s!.map((x) => x.name)).toContain("BreachForums");
    expect(s!.every((x) => x.reliability > 0 && x.reliability <= 1)).toBe(true);
  });

  it("returns null for a non-hero ticker", () => {
    expect(heroSourcesFor("AAPL")).toBeNull();
  });
});

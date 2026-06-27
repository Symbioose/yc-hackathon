import { describe, it, expect } from "vitest";
import { SignalSchema } from "@periscope/contracts";
import { heroSignal, heroCase } from "./index";

describe("fixtures", () => {
  it("primary case has the locked Ticketmaster dates and a non-empty price series", () => {
    expect(heroCase.primary.ticker).toBe("LYV");
    expect(heroCase.primary.observed_at).toBe("2024-05-27");
    expect(heroCase.primary.disclosed_at).toBe("2024-05-31");
    expect(heroCase.primary.price_series.length).toBeGreaterThan(0);
  });

  it("heroSignal() produces a contract-valid Signal", () => {
    const s = heroSignal();
    expect(() => SignalSchema.parse(s)).not.toThrow();
    expect(s.lead_time_days).toBe(4);
    expect(s.confidence).toBeGreaterThan(0);
    expect(s.confidence).toBeLessThanOrEqual(1);
  });
});

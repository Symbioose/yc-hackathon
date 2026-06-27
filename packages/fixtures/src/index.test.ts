import { describe, it, expect } from "vitest";
import { SignalSchema } from "@altai/contracts";
import { heroSignal, heroCase, priceSeriesFor } from "./index";

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

  it("computes a real short AlphaCard from the price series (entry after the holiday)", () => {
    const a = heroSignal().alpha!;
    expect(a.entry_price).toBeDefined();
    expect(a.exit_price).toBeDefined();
    // short return = (entry - exit)/entry * 100; LYV declined over the window → positive
    expect(a.return_pct).toBeGreaterThan(0);
  });

  it("priceSeriesFor resolves hero tickers and rejects unknowns", () => {
    expect(priceSeriesFor("LYV").length).toBeGreaterThan(0);
    expect(priceSeriesFor("MPL.AX").length).toBeGreaterThan(0);
    expect(priceSeriesFor("NVDA")).toEqual([]);
  });
});

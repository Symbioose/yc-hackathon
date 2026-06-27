import { describe, it, expect } from "vitest";
import { COLD_ROUTE, WARM_ROUTE, evaluateRoute, noisyOr } from "./cost";

describe("cost model (deterministic before/after)", () => {
  it("noisy-OR fuses independent reliabilities", () => {
    expect(noisyOr([0.8, 0.7])).toBeCloseTo(0.94, 5);
    expect(noisyOr([0.3, 0.6])).toBeCloseTo(0.72, 5);
    expect(noisyOr([])).toBe(0);
  });

  it("COLD route lands exactly on the headline baseline (#1)", () => {
    const m = evaluateRoute(COLD_ROUTE, "cold");
    expect(m).toEqual({ hops: 7, latency_ms: 38000, cost_usd: 0.41, confidence: 0.72 });
  });

  it("WARM route lands exactly on the headline recalled run", () => {
    const m = evaluateRoute(WARM_ROUTE, "warm");
    expect(m).toEqual({ hops: 2, latency_ms: 6000, cost_usd: 0.04, confidence: 0.94 });
  });

  it("the warmed run strictly dominates the cold run on every axis", () => {
    const cold = evaluateRoute(COLD_ROUTE, "cold");
    const warm = evaluateRoute(WARM_ROUTE, "warm");
    expect(warm.hops).toBeLessThan(cold.hops);
    expect(warm.latency_ms).toBeLessThan(cold.latency_ms);
    expect(warm.cost_usd).toBeLessThan(cold.cost_usd);
    expect(warm.confidence).toBeGreaterThan(cold.confidence);
  });
});

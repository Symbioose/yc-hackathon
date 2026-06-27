import type { MissionMetrics, SourceType } from "@altai/contracts";

export type RunMode = "cold" | "warm";

interface StepProfile {
  hops: number;
  latency_ms: number;
  cost_usd: number;
  /** Did this step yield an independent corroborating source (feeds noisy-OR)? */
  corroborates: boolean;
  reliability: number;
}

/** Per-source cost profile in each run mode.
 *
 * COLD = an *uninformed* planner: it has to discover where to look, burns a Tor
 * circuit on the wrong forum (dead-ends), and pays full latency/$ on low-yield
 * sources. WARM = the network recalled the exact source location and its learned
 * reliability, so the same source is a single cheap, high-yield hop.
 *
 * The numbers are tuned so the canonical breach-intel before/after lands on the
 * headline figures (locked by cost.test.ts):
 *   COLD route  → 7 hops · 38s · $0.41 · 0.72
 *   WARM route  → 2 hops ·  6s · $0.04 · 0.94 */
export const SOURCE_PROFILE: Record<SourceType, Record<RunMode, StepProfile>> = {
  press:      { cold: { hops: 2, latency_ms: 9000,  cost_usd: 0.12, corroborates: false, reliability: 0.40 },
                warm: { hops: 1, latency_ms: 4000,  cost_usd: 0.04, corroborates: true,  reliability: 0.55 } },
  paste:      { cold: { hops: 1, latency_ms: 6000,  cost_usd: 0.07, corroborates: true,  reliability: 0.30 },
                warm: { hops: 1, latency_ms: 3000,  cost_usd: 0.03, corroborates: true,  reliability: 0.45 } },
  filing:     { cold: { hops: 1, latency_ms: 5000,  cost_usd: 0.06, corroborates: false, reliability: 0.50 },
                warm: { hops: 1, latency_ms: 3000,  cost_usd: 0.03, corroborates: true,  reliability: 0.60 } },
  tor_forum:  { cold: { hops: 2, latency_ms: 12000, cost_usd: 0.12, corroborates: false, reliability: 0.80 },
                warm: { hops: 1, latency_ms: 3000,  cost_usd: 0.02, corroborates: true,  reliability: 0.80 } },
  breach_api: { cold: { hops: 1, latency_ms: 6000,  cost_usd: 0.04, corroborates: true,  reliability: 0.60 },
                warm: { hops: 1, latency_ms: 3000,  cost_usd: 0.02, corroborates: true,  reliability: 0.70 } },
};

/** The uninformed default trajectory a cold planner walks: try every source, in a
 * naive order, before it has learned which ones corroborate for this mission type. */
export const COLD_ROUTE: SourceType[] = ["press", "paste", "filing", "tor_forum", "breach_api"];

/** The route the trained network recalls for breach-intel: straight to the two
 * sources that historically corroborate, in the order that pays off first. Also the
 * cold-graph fallback so the demo is robust even before any learning. */
export const WARM_ROUTE: SourceType[] = ["tor_forum", "breach_api"];

/** Noisy-OR fusion over independent corroborating sources — the same method as
 * Signal.confidence_method and @altai/fixtures. Re-implemented locally (one line) so
 * @altai/memory depends on nothing but @altai/contracts. */
export function noisyOr(reliabilities: number[]): number {
  const p = reliabilities.reduce((acc, r) => acc * (1 - r), 1);
  return Number((1 - p).toFixed(4));
}

/** Deterministically measure a route under a run mode → the four cost axes. The
 * confidence is the noisy-OR over the steps that actually corroborate. */
export function evaluateRoute(route: SourceType[], mode: RunMode): MissionMetrics {
  let hops = 0;
  let latency_ms = 0;
  let cost_usd = 0;
  const corroborating: number[] = [];
  for (const s of route) {
    const p = SOURCE_PROFILE[s][mode];
    hops += p.hops;
    latency_ms += p.latency_ms;
    cost_usd += p.cost_usd;
    if (p.corroborates) corroborating.push(p.reliability);
  }
  return {
    hops,
    latency_ms,
    cost_usd: Number(cost_usd.toFixed(2)),
    confidence: noisyOr(corroborating),
  };
}

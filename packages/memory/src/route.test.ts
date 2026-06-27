import { describe, it, expect } from "vitest";
import { RouteGraph, reward } from "./route";
import type { Genome } from "./types";

function g(partial: Partial<Genome>): Genome {
  return {
    id: Math.random().toString(36).slice(2),
    mission_type: "breach_intel",
    sector: "finance",
    source_sequence: ["tor_forum", "breach_api"],
    corroborating_types: ["tor_forum", "breach_api"],
    hops: 2, latency_ms: 6000, cost_usd: 0.04, confidence: 0.9, outcome: "signed",
    ...partial,
  };
}

describe("reward — the membrane is the oracle", () => {
  it("reinforces only corroborated + signed missions, scaled by confidence", () => {
    expect(reward(g({ confidence: 0.94 }))).toBeCloseTo(0.94);
    expect(reward(g({ confidence: 0.8 }))).toBeCloseTo(0.8);
  });

  it("a signed-but-uncorroborated mission barely moves the route", () => {
    expect(reward(g({ corroborating_types: ["press"], confidence: 0.55 }))).toBe(0.1);
  });

  it("penalizes quarantine hard and down-weights dead ends", () => {
    expect(reward(g({ outcome: "quarantine", confidence: 0.2 }))).toBe(-1);
    expect(reward(g({ outcome: "dead_end", confidence: 0.4 }))).toBe(-0.25);
  });
});

describe("RouteGraph — learns the winning trajectory", () => {
  it("greedily recovers the reinforced route", () => {
    const graph = new RouteGraph();
    for (let i = 0; i < 5; i++) graph.observe(g({ source_sequence: ["tor_forum", "breach_api"] }));
    expect(graph.bestRoute("breach_intel")).toEqual(["tor_forum", "breach_api"]);
  });

  it("down-weights a poisoned route so it is never recalled", () => {
    const graph = new RouteGraph();
    // a few corroborated wins via Tor→Breach…
    for (let i = 0; i < 4; i++) graph.observe(g({ source_sequence: ["tor_forum", "breach_api"] }));
    // …and many quarantines that entered via paste
    for (let i = 0; i < 6; i++)
      graph.observe(g({ source_sequence: ["paste", "press"], corroborating_types: [], outcome: "quarantine", confidence: 0.1 }));

    const route = graph.bestRoute("breach_intel");
    expect(route[0]).toBe("tor_forum"); // never starts with the poisoned paste
    expect(route).not.toContain("paste");

    const edges = graph.edgesReport("breach_intel");
    const startTor = edges.find((e) => e.from === "START" && e.to === "tor_forum")!;
    const startPaste = edges.find((e) => e.from === "START" && e.to === "paste")!;
    expect(startTor.reward).toBeGreaterThan(0);
    expect(startPaste.reward).toBeLessThan(0);
    expect(startTor.success_rate).toBe(1);
    expect(startPaste.success_rate).toBe(0);
  });

  it("scopes routes per mission_type", () => {
    const graph = new RouteGraph();
    graph.observe(g({ mission_type: "breach_intel", source_sequence: ["tor_forum", "breach_api"] }));
    graph.observe(g({ mission_type: "fraud_intel", source_sequence: ["breach_api", "press"], corroborating_types: ["breach_api", "press"] }));
    expect(graph.bestRoute("breach_intel")).toEqual(["tor_forum", "breach_api"]);
    expect(graph.bestRoute("fraud_intel")[0]).toBe("breach_api");
  });
});

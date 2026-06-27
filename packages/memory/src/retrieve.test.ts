import { describe, it, expect } from "vitest";
import { MemoryStore } from "./store";
import type { Genome } from "./types";

const store = new MemoryStore();

const breachQuery: Genome = {
  id: "q-breach", mission_type: "breach_intel", sector: "entertainment",
  source_sequence: [], corroborating_types: [], hops: 0, latency_ms: 0, cost_usd: 0, confidence: 0, outcome: "signed",
};
const ransomQuery: Genome = { ...breachQuery, id: "q-ransom", mission_type: "ransomware_intel", sector: "healthcare" };

describe("retrieve — cosine over the deterministic feature vector", () => {
  it("seeds ~20 trained missions", () => {
    expect(store.size()).toBe(20);
  });

  it("returns nearest neighbors of the same mission_type, sector-best first", () => {
    const hits = store.retrieve(breachQuery, 5);
    expect(hits).toHaveLength(5);
    expect(hits.every((h) => h.genome.mission_type === "breach_intel")).toBe(true);
    // the one entertainment breach in the corpus is the single closest match
    expect(hits[0].genome.sector).toBe("entertainment");
    // similarity is sorted descending
    expect(hits[0].similarity).toBeGreaterThanOrEqual(hits[4].similarity);
  });

  it("retrieves the right neighborhood for a different mission_type", () => {
    const hits = store.retrieve(ransomQuery, 3);
    expect(hits.every((h) => h.genome.mission_type === "ransomware_intel")).toBe(true);
  });

  it("recalls the learned route for breach-intel from 13 similar missions", () => {
    const recall = store.recall({ query: "Has Live Nation been breached?", ticker: "LYV", target_entity: "Live Nation" });
    expect(recall.recalled).toBe(true);
    expect(recall.recalled_from).toBe(13);
    expect(recall.route).toEqual(["tor_forum", "breach_api"]);
    expect(recall.reason).toMatch(/Tor→Breach/);
  });

  it("reports cumulative ROI from the trained corpus", () => {
    const roi = store.roi();
    expect(roi.missions).toBeGreaterThan(10); // the seed has many signed missions
    expect(roi.saved_usd).toBeGreaterThan(0);
    expect(roi.saved_latency_ms).toBeGreaterThan(0);
    expect(roi.saved_hops).toBeGreaterThan(0);
    // and it shows up on the report the ops-center renders
    expect(store.compareColdWarm({ query: "breach?", ticker: "LYV" }).roi?.missions).toBe(roi.missions);
  });

  it("cold-starts gracefully when nothing is comparable", () => {
    const empty = new MemoryStore([]);
    const recall = empty.recall({ query: "anything", ticker: "ZZZ" });
    expect(recall.recalled).toBe(false);
    expect(recall.recalled_from).toBe(0);
  });

  it("produces the locked WOW before/after for the hero mission", () => {
    const r = store.compareColdWarm({ query: "Has Live Nation been breached?", ticker: "LYV", target_entity: "Live Nation" }, "m-hero");
    expect(r.recalled_from).toBe(13);
    expect(r.run_index).toBe(14);
    expect(r.route).toEqual(["tor_forum", "breach_api"]);
    expect(r.cold).toEqual({ hops: 7, latency_ms: 38000, cost_usd: 0.41, confidence: 0.72 });
    expect(r.warmed).toEqual({ hops: 2, latency_ms: 6000, cost_usd: 0.04, confidence: 0.94 });
    // the learned graph exposes the winning first hop
    expect(r.edges[0].from).toBe("START");
    expect(r.edges[0].to).toBe("tor_forum");
  });

  it("keeps learning: a new sealed mission increments the run index and corpus", () => {
    const s = new MemoryStore();
    const before = s.compareColdWarm({ query: "breach?", ticker: "LYV" }).run_index;
    s.learn(
      { query: "breach?", ticker: "LYV", target_entity: "Acme" },
      {
        entity: "Acme", ticker: "LYV", event_type: "credential_dump",
        sources: [
          { name: "x", type: "tor_forum", reliability: 0.8, observed_at: "t" },
          { name: "y", type: "breach_api", reliability: 0.7, observed_at: "t" },
        ],
        confidence: 0.94, confidence_method: "noisy_or", observed_at: "t", summary: "s",
      },
      [{ mission_id: "m2", ts: "t", layer: "dispatch", agent: "Gateway", level: "info", msg: "x" }],
      { hops: 2, latency_ms: 6000, cost_usd: 0.04, confidence: 0.94 },
    );
    expect(s.size()).toBe(21);
    expect(s.compareColdWarm({ query: "breach?", ticker: "LYV" }).run_index).toBe(before + 1);
  });
});

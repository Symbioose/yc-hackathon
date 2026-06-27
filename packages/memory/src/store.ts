import { createRequire } from "node:module";
import type { MemoryRecall, MemoryReport, MissionMetrics, NetworkRoi, Signal, SourceType, TraceEvent } from "@altai/contracts";
import { GenomeSchema, type Genome } from "./types";
import { featureVector, cosine } from "./features";
import { RouteGraph } from "./route";
import { COLD_ROUTE, WARM_ROUTE, evaluateRoute } from "./cost";
import { deriveMissionType, deriveSector, fingerprint, type MissionLike } from "./fingerprint";

const require = createRequire(import.meta.url);

/** ~20 entity-stripped past missions so the network is already "trained" at demo
 * time. Validated against the Genome contract on load. */
export function loadSeedGenomes(): Genome[] {
  const raw = require("../seed/missions.json") as unknown[];
  return raw.map((g) => GenomeSchema.parse(g));
}

export interface RetrievalHit {
  genome: Genome;
  similarity: number;
}

const DEFAULT_SIMILARITY = 0.5;

const SOURCE_LABEL: Record<SourceType, string> = {
  tor_forum: "Tor",
  breach_api: "Breach",
  paste: "Paste",
  press: "Press",
  filing: "Filing",
};

function label(route: SourceType[]): string {
  return route.map((s) => SOURCE_LABEL[s]).join("→");
}

/**
 * The Intelligence Network. Holds the corpus of genomes (procedural memory), a
 * deterministic retrieval index, and the learned route graph. Pure: depends only on
 * @altai/contracts, so it can be embedded in the gateway, a test, or (later) the MCP
 * server unchanged.
 */
export class MemoryStore {
  // genome + its precomputed feature vector are co-located so retrieval can never
  // mismatch a vector to the wrong genome (even on a duplicate id).
  private entries: { genome: Genome; vector: number[] }[] = [];
  readonly graph = new RouteGraph();

  constructor(seed: Genome[] = loadSeedGenomes()) {
    for (const g of seed) this.add(g);
  }

  /** Fold a genome into the corpus, the retrieval index, and the route graph.
   * Re-adding the same id replaces the prior entry (idempotent), but the graph still
   * counts the observation — re-running a mission is a real, repeated signal. */
  add(g: Genome): void {
    const i = this.entries.findIndex((e) => e.genome.id === g.id);
    const entry = { genome: g, vector: featureVector(g) };
    if (i >= 0) this.entries[i] = entry;
    else this.entries.push(entry);
    this.graph.observe(g);
  }

  size(): number {
    return this.entries.length;
  }

  countFor(missionType: string): number {
    return this.entries.filter((e) => e.genome.mission_type === missionType).length;
  }

  /** k nearest past missions by cosine over the deterministic feature vector. */
  retrieve(query: Genome, k = 8): RetrievalHit[] {
    const qv = featureVector(query);
    return this.entries
      .filter((e) => e.genome.id !== query.id)
      .map((e) => ({ genome: e.genome, similarity: cosine(qv, e.vector) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  /** How many stored missions are genuinely similar (cosine ≥ threshold). Drives the
   * "recalled from N similar missions" counter. */
  similarCount(query: Genome, threshold = DEFAULT_SIMILARITY): number {
    const qv = featureVector(query);
    let n = 0;
    for (const e of this.entries) {
      if (e.genome.id === query.id) continue;
      if (cosine(qv, e.vector) >= threshold) n++;
    }
    return n;
  }

  /** Cumulative value the network has delivered: for every signed mission in the
   * corpus, how much cheaper/faster/shorter it was than an uninformed cold run. A
   * pure function of the corpus, so it grows naturally as missions are learned. */
  roi(): NetworkRoi {
    const cold = evaluateRoute(COLD_ROUTE, "cold");
    let missions = 0, usd = 0, ms = 0, hops = 0;
    for (const { genome: g } of this.entries) {
      if (g.outcome !== "signed") continue;
      missions++;
      usd += Math.max(0, cold.cost_usd - g.cost_usd);
      ms += Math.max(0, cold.latency_ms - g.latency_ms);
      hops += Math.max(0, cold.hops - g.hops);
    }
    return { missions, saved_usd: Number(usd.toFixed(2)), saved_latency_ms: Math.round(ms), saved_hops: hops };
  }

  /** The learned route for this kind of mission (graph greedy), or the breach-intel
   * default if the network is still cold. */
  bestRoute(missionType: string): SourceType[] {
    const r = this.graph.bestRoute(missionType);
    return r.length ? r : WARM_ROUTE;
  }

  /** Warm-start prior for the Planner, built from a mission's (entity-stripped)
   * query genome: the route to walk first and how many missions taught it. */
  recall(mission: MissionLike): MemoryRecall {
    const q = this.queryGenome(mission);
    const n = this.similarCount(q);
    if (n === 0) {
      return {
        recalled: false,
        route: [],
        recalled_from: 0,
        reason: "Cold start — no comparable prior missions; exploring all sources.",
      };
    }
    const route = this.bestRoute(q.mission_type);
    return {
      recalled: true,
      route,
      recalled_from: n,
      reason: `Recalled route from ${n} similar missions → query ${label(route)} first.`,
    };
  }

  /** The deterministic before/after the ops-center renders. Cold = the uninformed
   * mission #1 (constant baseline); warmed = today's recalled route. Pure — no run
   * required, so the demo can show the transformation before a single scout fires. */
  compareColdWarm(mission: MissionLike, missionId?: string): MemoryReport {
    const q = this.queryGenome(mission);
    const n = this.similarCount(q);
    const route = this.bestRoute(q.mission_type);
    return {
      mission_id: missionId,
      mission_type: q.mission_type,
      sector: q.sector,
      recalled_from: n,
      run_index: this.countFor(q.mission_type) + 1,
      route,
      cold: evaluateRoute(COLD_ROUTE, "cold"),
      warmed: evaluateRoute(route, "warm"),
      edges: this.graph.edgesReport(q.mission_type),
      roi: this.roi(),
    };
  }

  /** Learn from a finished, sealed mission: fingerprint → reinforce the graph → emit
   * the updated report. Called after seal, because the membrane is the oracle. */
  learn(
    mission: MissionLike,
    signal: Signal,
    trace: TraceEvent[],
    metrics?: Partial<MissionMetrics>,
  ): MemoryReport {
    const g = fingerprint(mission, signal, trace, metrics);
    const before = this.countFor(g.mission_type);
    this.add(g);
    return {
      mission_id: trace[0]?.mission_id,
      mission_type: g.mission_type,
      sector: g.sector,
      recalled_from: before,
      run_index: before + 1,
      route: this.bestRoute(g.mission_type),
      cold: evaluateRoute(COLD_ROUTE, "cold"),
      warmed: { hops: g.hops, latency_ms: g.latency_ms, cost_usd: g.cost_usd, confidence: g.confidence },
      edges: this.graph.edgesReport(g.mission_type),
      roi: this.roi(),
    };
  }

  /** A zero-run genome carrying only the mission's bucket (type + sector), used for
   * retrieval/recall before anything has executed. */
  private queryGenome(mission: MissionLike): Genome {
    return {
      id: "__query__",
      mission_type: deriveMissionType(undefined, mission.query),
      sector: deriveSector({ ticker: mission.ticker, entity: mission.target_entity }),
      source_sequence: [],
      corroborating_types: [],
      hops: 0,
      latency_ms: 0,
      cost_usd: 0,
      confidence: 0,
      outcome: "signed",
    };
  }
}

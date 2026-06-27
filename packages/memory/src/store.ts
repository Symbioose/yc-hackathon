import { createRequire } from "node:module";
import type { MemoryRecall, MemoryReport, MissionMetrics, Signal, SourceType, TraceEvent } from "@altai/contracts";
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
  private genomes: Genome[] = [];
  private vectors = new Map<string, number[]>();
  readonly graph = new RouteGraph();

  constructor(seed: Genome[] = loadSeedGenomes()) {
    for (const g of seed) this.add(g);
  }

  /** Fold a genome into the corpus, the retrieval index, and the route graph. */
  add(g: Genome): void {
    this.genomes.push(g);
    this.vectors.set(g.id, featureVector(g));
    this.graph.observe(g);
  }

  size(): number {
    return this.genomes.length;
  }

  countFor(missionType: string): number {
    return this.genomes.filter((g) => g.mission_type === missionType).length;
  }

  /** k nearest past missions by cosine over the deterministic feature vector. */
  retrieve(query: Genome, k = 8): RetrievalHit[] {
    const qv = featureVector(query);
    return this.genomes
      .filter((g) => g.id !== query.id)
      .map((g) => ({ genome: g, similarity: cosine(qv, this.vectors.get(g.id)!) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  /** How many stored missions are genuinely similar (cosine ≥ threshold). Drives the
   * "recalled from N similar missions" counter. */
  similarCount(query: Genome, threshold = DEFAULT_SIMILARITY): number {
    const qv = featureVector(query);
    let n = 0;
    for (const g of this.genomes) {
      if (g.id === query.id) continue;
      if (cosine(qv, this.vectors.get(g.id)!) >= threshold) n++;
    }
    return n;
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

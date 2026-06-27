import { MISSION_TYPES, SECTORS, SOURCE_TYPES, type Genome } from "./types";

const OUTCOMES = ["signed", "quarantine", "dead_end"] as const;

/** Block weights. mission_type dominates — you recall a route for the *kind* of
 * investigation first; sector refines it; the source/corroboration shape and the
 * cost signature refine it further. Chosen so same-mission_type genomes always
 * separate cleanly (cosine ≥ 0.5) from different-mission_type ones. */
const W = {
  missionType: 3.0,
  sector: 1.6,
  sequence: 1.0,
  corroborating: 1.2,
  metrics: 0.6,
  outcome: 0.5,
} as const;

function oneHot(vocab: readonly string[], v: string, weight: number): number[] {
  return vocab.map((x) => (x === v ? weight : 0));
}
function multiHot(vocab: readonly string[], vs: readonly string[], weight: number): number[] {
  return vocab.map((x) => (vs.includes(x) ? weight : 0));
}

/** Deterministic, fixed-length feature vector for a Genome. It is pure structure —
 * there is nothing entity-specific to embed, which is exactly the privacy guarantee:
 * the network reasons over plan shapes, not identities. */
export function featureVector(g: Genome): number[] {
  return [
    ...oneHot(MISSION_TYPES, g.mission_type, W.missionType),
    ...oneHot(SECTORS, g.sector, W.sector),
    ...multiHot(SOURCE_TYPES, g.source_sequence, W.sequence),
    ...multiHot(SOURCE_TYPES, g.corroborating_types, W.corroborating),
    // cost signature, squashed to ~0..1 so axes are comparable
    W.metrics * Math.min(1, g.hops / 8),
    W.metrics * Math.min(1, g.latency_ms / 40000),
    W.metrics * Math.min(1, g.cost_usd / 0.5),
    W.metrics * g.confidence,
    ...oneHot(OUTCOMES, g.outcome, W.outcome),
  ];
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

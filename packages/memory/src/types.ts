import { z } from "zod";
import { SourceTypeSchema, type SourceType } from "@altai/contracts";

export type { SourceType };

/** The internal swarm specialists a source_type maps onto (for warm-start). */
export type ScoutKind = "web" | "tor" | "breach";

/** Mission outcome as judged by the membrane — the only trustworthy reward oracle.
 *  - signed:     corroborated (noisy-OR) + passed the Judge + Ed25519-signed → reinforce.
 *  - dead_end:   no/weak corroboration, never reached a signed brief        → down-weight.
 *  - quarantine: route walked into poison/injection the membrane rejected   → penalize hard. */
export type Outcome = "signed" | "quarantine" | "dead_end";

/** A Genome is the *entity-stripped* DNA of a finished mission. It records HOW a
 * signal was found — never WHAT was asked. There is, by construction, no field for
 * the raw query, target entity, ticker, URL, or any source name: identity isolation
 * applied to memory. Two missions about completely different companies in the same
 * sector produce near-identical genomes. */
export interface Genome {
  id: string;
  mission_type: string;
  sector: string;
  /** The order source_types were queried (the trajectory the planner actually walked). */
  source_sequence: SourceType[];
  /** The source_types that independently corroborated the signal (fed noisy-OR). */
  corroborating_types: SourceType[];
  hops: number;
  latency_ms: number;
  cost_usd: number;
  confidence: number;
  outcome: Outcome;
}

export const GenomeSchema = z.object({
  id: z.string(),
  mission_type: z.string(),
  sector: z.string(),
  source_sequence: z.array(SourceTypeSchema),
  corroborating_types: z.array(SourceTypeSchema),
  hops: z.number(),
  latency_ms: z.number(),
  cost_usd: z.number(),
  confidence: z.number().min(0).max(1),
  outcome: z.enum(["signed", "quarantine", "dead_end"]),
});

// ---- Fixed vocabularies (a stable basis keeps the feature vector deterministic) ----
export const MISSION_TYPES = [
  "breach_intel", "ransomware_intel", "leak_intel", "fraud_intel", "exposure_intel",
] as const;

export const SECTORS = [
  "entertainment", "finance", "healthcare", "retail", "telecom", "energy", "gaming",
  "airline", "hospitality", "education", "crypto", "media", "saas", "government",
  "defense", "manufacturing", "logistics", "fintech", "unknown",
] as const;

export const SOURCE_TYPES: SourceType[] = ["tor_forum", "breach_api", "paste", "press", "filing"];

/** The virtual origin node of the route graph (every route starts here). */
export const START = "START" as const;

// ---- source_type ↔ scout specialist (warm-start ordering / selection) ----
export const SOURCE_TO_SCOUT: Record<SourceType, ScoutKind> = {
  tor_forum: "tor",
  breach_api: "breach",
  paste: "web",
  press: "web",
  filing: "web",
};

/** The ordered, de-duplicated set of scouts a recalled route asks the planner to run. */
export function scoutsForRoute(route: SourceType[]): ScoutKind[] {
  const out: ScoutKind[] = [];
  for (const s of route) {
    const scout = SOURCE_TO_SCOUT[s];
    if (!out.includes(scout)) out.push(scout);
  }
  return out;
}

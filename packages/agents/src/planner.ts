import type { Mission, Signal, SourceContribution, MemoryRecall } from "@altai/contracts";
import { fuseConfidence } from "@altai/fixtures";
import { scoutsForRoute, type ScoutKind } from "@altai/memory";
import { webScout, torScout, breachScout, type Snippet } from "./scouts";
import type { Trace } from "./trace";

const SCOUT_LABEL: Record<ScoutKind, string> = { web: "Web", tor: "Tor", breach: "Breach" };

/** Build the final Signal from the sources the scouts actually corroborated.
 * No hardcoding: with zero corroboration the signal is honestly `inconclusive`
 * at confidence 0; otherwise confidence is the noisy-OR fusion of real sources. */
export function synthesizeSignal(
  mission: Pick<Mission, "ticker" | "target_entity" | "query">,
  sources: SourceContribution[],
): Signal {
  const entity = mission.target_entity ?? mission.query;
  const observed = new Date().toISOString().slice(0, 10);
  if (sources.length === 0) {
    return {
      entity,
      ticker: mission.ticker,
      event_type: "inconclusive",
      sources: [],
      confidence: 0,
      confidence_method: "noisy_or",
      observed_at: observed,
      summary: `No corroborating evidence found for ${entity} across the sources queried.`,
    };
  }
  return {
    entity,
    ticker: mission.ticker,
    event_type: "suspected_breach",
    sources,
    confidence: fuseConfidence(sources),
    confidence_method: "noisy_or",
    observed_at: sources[0]?.observed_at ?? observed,
    summary: `${sources.length} independent source(s) corroborate a suspected breach of ${entity}: ${sources.map((s) => s.name).join(", ")}.`,
  };
}

/** Run the full swarm: warm-start from memory → plan → scouts (parallel) → synthesize.
 * Emits TraceEvents and returns the candidate signal plus every fetched snippet, so the
 * membrane can scan the ACTUAL retrieved content for injection before signing.
 *
 * The Intelligence Network supplies an optional `recall`: the route that worked on similar
 * past missions. We use it as a PRIOR to order the scouts (recalled ones first) and to make
 * the learning visible — but a real mission always runs every scout for full coverage. The
 * cost savings of a warmed route are demonstrated in the deterministic demo, never by
 * crippling a live investigation. Backward-compatible: with no recall it explores all three. */
export async function runSwarm(
  mission: Mission,
  trace: Trace,
  recall?: MemoryRecall,
): Promise<{ signal: Signal; snippets: Snippet[] }> {
  const order: ScoutKind[] = ["web", "tor", "breach"];
  if (recall?.recalled && recall.route.length) {
    const pref = scoutsForRoute(recall.route);
    // Stable sort: recalled scouts first, the rest after — still run them all.
    order.sort((a, b) => (pref.includes(b) ? 1 : 0) - (pref.includes(a) ? 1 : 0));
    trace("memory", "IntelligenceNetwork", "action", recall.reason, {
      route: recall.route, recalled_from: recall.recalled_from, warm_start: true,
    });
  } else {
    trace("memory", "IntelligenceNetwork", "info",
      recall?.reason ?? "Cold start — no procedural memory; exploring all sources.", { warm_start: false });
  }

  trace("execution", "Planner", "action", `Decomposing mission → ${order.map((s) => SCOUT_LABEL[s]).join("/")} scouts`);
  // Resilient fan-out: one scout failing (no LLM key, Tor down, an API 429) must NOT sink
  // the mission — the others still contribute. allSettled keeps the swarm up.
  const settled = await Promise.allSettled(
    order.map((k) => (k === "web" ? webScout(mission, trace) : k === "tor" ? torScout(mission, trace) : breachScout(mission, trace))),
  );
  const sources: SourceContribution[] = [];
  const snippets: Snippet[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sources.push(...r.value.sources);
      snippets.push(...r.value.snippets);
    } else {
      trace("execution", SCOUT_LABEL[order[i]] + "Scout", "warn", `Scout failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    }
  });
  trace("execution", "Planner", "success", `Synthesizing signal from ${sources.length} corroborating source(s) across ${order.length} scouts`);
  return { signal: synthesizeSignal(mission, sources), snippets };
}

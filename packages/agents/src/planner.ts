import type { Mission, Signal, SourceContribution } from "@altai/contracts";
import { fuseConfidence } from "@altai/fixtures";
import { webScout, torScout, breachScout, type Snippet } from "./scouts";
import type { Trace } from "./trace";

type ScoutKind = "web" | "tor" | "breach";
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

/** Run the swarm: plan → scouts (parallel) → synthesize. Emits TraceEvents and returns the
 * candidate signal plus every fetched snippet, so the membrane can scan the ACTUAL retrieved
 * content for injection before signing. Resilient: one scout failing (no LLM key, Tor down,
 * an API 429) must NOT sink the mission — the others still contribute. */
export async function runSwarm(
  mission: Mission,
  trace: Trace,
): Promise<{ signal: Signal; snippets: Snippet[] }> {
  const order: ScoutKind[] = ["web", "tor", "breach"];
  trace("execution", "Planner", "action", `Decomposing mission → ${order.map((s) => SCOUT_LABEL[s]).join("/")} scouts`);
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

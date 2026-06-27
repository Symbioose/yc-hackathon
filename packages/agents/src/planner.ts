import type { Mission, Signal, SourceContribution, MemoryRecall } from "@altai/contracts";
import { heroCase, heroSignal, fuseConfidence } from "@altai/fixtures";
import { scoutsForRoute, type ScoutKind } from "@altai/memory";
import { webScout, torScout, breachScout } from "./scouts";
import type { Trace } from "./trace";

const SCOUT_LABEL: Record<ScoutKind, string> = { web: "Web", tor: "Tor", breach: "Breach" };

/** Build the final Signal from collected sources. Hero ticker → pinned verified
 * fixture Signal (deterministic climax). Otherwise → live synthesis from sources. */
export function synthesizeSignal(
  mission: Pick<Mission, "ticker" | "target_entity" | "query">,
  sources: SourceContribution[],
): Signal {
  const isHero = mission.ticker?.toUpperCase() === heroCase.primary.ticker.toUpperCase();
  if (isHero) {
    // Pin entity/dates/alpha from the verified fixture; confidence fuses the
    // actually-collected sources (falls back to fixture sources if scouts found none).
    const base = heroSignal();
    const used = sources.length ? sources : base.sources;
    return { ...base, sources: used, confidence: fuseConfidence(used) };
  }
  return {
    entity: mission.target_entity ?? mission.query,
    ticker: mission.ticker,
    event_type: "suspected_breach",
    sources,
    confidence: fuseConfidence(sources),
    confidence_method: "noisy_or",
    observed_at: sources[0]?.observed_at ?? new Date().toISOString().slice(0, 10),
    summary: `Corroboration from ${sources.length} source(s) for ${mission.target_entity ?? mission.query}.`,
  };
}

/** Run the full swarm: warm-start from memory → plan → scouts (parallel) →
 * synthesize. Emits TraceEvents.
 *
 * The Intelligence Network supplies an optional `recall`: the route that worked on
 * similar past missions. When present, the Planner uses it as a prior to select and
 * order the scouts (e.g. Tor→Breach first, skip the web crawl) so a warmed mission
 * touches fewer sources than a cold one. Backward-compatible: with no recall it
 * behaves exactly as before and explores all three scouts. */
export async function runSwarm(mission: Mission, trace: Trace, recall?: MemoryRecall): Promise<Signal> {
  let scouts: ScoutKind[] = ["web", "tor", "breach"];
  if (recall?.recalled && recall.route.length) {
    const picked = scoutsForRoute(recall.route);
    if (picked.length) scouts = picked;
    trace("memory", "IntelligenceNetwork", "action", recall.reason, {
      route: recall.route, recalled_from: recall.recalled_from, warm_start: true,
    });
  } else {
    trace("memory", "IntelligenceNetwork", "info",
      recall?.reason ?? "Cold start — no procedural memory; exploring all sources.", { warm_start: false });
  }

  trace("execution", "Planner", "action", `Decomposing mission → ${scouts.map((s) => SCOUT_LABEL[s]).join("/")} scouts`);
  const results = await Promise.all(scouts.map((k) =>
    k === "web" ? webScout(mission, trace) : k === "tor" ? torScout(mission, trace) : breachScout(mission, trace),
  ));
  const sources = results.flatMap((r) => r.sources);
  trace("execution", "Planner", "success", `Synthesizing signal from ${sources.length} source(s) across ${scouts.length} scout(s)`);
  return synthesizeSignal(mission, sources);
}

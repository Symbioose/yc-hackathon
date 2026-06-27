import type { Mission, Signal, SourceContribution } from "@altai/contracts";
import { heroCase, heroSignal, fuseConfidence } from "@altai/fixtures";
import { webScout, torScout, breachScout } from "./scouts";
import type { Trace } from "./trace";

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

/** Run the full swarm: plan → scouts (parallel) → synthesize. Emits TraceEvents. */
export async function runSwarm(mission: Mission, trace: Trace): Promise<Signal> {
  trace("execution", "Planner", "action", "Decomposing mission → Web/Tor/Breach scouts");
  const [web, tor, breach] = await Promise.all([
    webScout(mission, trace),
    torScout(mission, trace),
    breachScout(mission, trace),
  ]);
  const sources = [...web.sources, ...tor.sources, ...breach.sources];
  trace("execution", "Planner", "success", `Synthesizing signal from ${sources.length} source(s) across 3 scouts`);
  return synthesizeSignal(mission, sources);
}

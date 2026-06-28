import type { Mission, Signal, SourceContribution } from "@altai/contracts";
import { fuseConfidence } from "@altai/fixtures";
import { webScout, torScout, breachScout, synthesizeAnswer, refineQuery, isSecurityQuery, type ScoutOut, type Snippet } from "./scouts";
import type { Trace } from "./trace";

/** Build the final Signal from what the research actually found. No hardcoding: with no
 * readable sources or no answer it is honestly `inconclusive` at confidence 0; otherwise
 * the summary IS the cited answer and confidence is the noisy-OR fusion of its sources. */
export function synthesizeSignal(
  mission: Pick<Mission, "ticker" | "target_entity" | "query">,
  sources: SourceContribution[],
  answer?: string,
): Signal {
  const entity = mission.target_entity ?? mission.query;
  const observed = new Date().toISOString().slice(0, 10);
  const clean = (answer ?? "").trim();
  const noAnswer = !clean || /don'?t contain a clear answer/i.test(clean);

  if (!sources.length || noAnswer) {
    return {
      entity,
      ticker: mission.ticker,
      event_type: "inconclusive",
      sources: [],
      confidence: 0,
      confidence_method: "noisy_or",
      observed_at: observed,
      summary: clean || `No answer found for "${entity}" in the sources searched.`,
    };
  }
  return {
    entity,
    ticker: mission.ticker,
    event_type: "research_finding",
    sources,
    confidence: fuseConfidence(sources),
    confidence_method: "noisy_or",
    observed_at: observed,
    summary: clean,
  };
}

/** Run the research: web search (always) + — for security/breach/dark-web questions —
 * a live Tor (.onion) scout and breach APIs, in parallel. Read the real pages, then
 * synthesize one cited answer grounded in everything fetched. Returns the signal plus
 * every snippet so the membrane can scan the ACTUAL retrieved content before signing. */
export async function runSwarm(
  mission: Mission,
  trace: Trace,
): Promise<{ signal: Signal; snippets: Snippet[] }> {
  const question = (mission.query?.trim() || mission.target_entity || "").trim();
  const security = isSecurityQuery(question);
  trace("execution", "Planner", "action", security
    ? "Security question — decomposing → open web + dark web (Tor) + breach APIs"
    : "Decomposing → open-web research");

  // Turn the natural-language question into a focused search query (better results).
  const searchQuery = await refineQuery(question, trace);

  const tasks: Promise<ScoutOut>[] = [webScout(mission, trace, searchQuery)];
  if (security) tasks.push(torScout(mission, trace, searchQuery), breachScout(mission, trace));
  const settled = await Promise.allSettled(tasks);

  const sources: SourceContribution[] = [];
  const snippets: Snippet[] = [];
  const contexts: string[] = [];
  settled.forEach((r) => {
    if (r.status === "fulfilled") {
      sources.push(...r.value.sources);
      snippets.push(...r.value.snippets);
      contexts.push(...r.value.contexts);
    } else {
      trace("execution", "Planner", "warn", `A scout failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    }
  });

  const answer = await synthesizeAnswer(question, contexts, trace);
  trace("execution", "Planner", "success", `Synthesizing signal from ${sources.length} source(s)`);
  return { signal: synthesizeSignal(mission, sources, answer), snippets };
}

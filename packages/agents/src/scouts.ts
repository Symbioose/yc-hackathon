import type { SourceContribution } from "@altai/contracts";
import { fetchUrl, webSearch, ahmiaSearch, torFetch, getExitIp, hibpLookup, intelxSearch } from "@altai/tools";
import type { Trace } from "./trace";

/** A piece of fetched content, kept so the membrane can scan the ACTUAL bytes we
 * retrieved (not a planted fixture) for prompt-injection before anything is signed. */
export interface Snippet {
  source: string;
  content: string;
}

export interface ScoutResult {
  sources: SourceContribution[];
  snippets: Snippet[];
  notes: string;
}

/** Relevance gate: a fetched page only counts as corroboration if it actually
 * references the target. Without this, any 200 (a random .onion, an off-topic
 * article) would be miscounted as a "source" and inflate confidence. */
export function mentionsEntity(text: string, entity?: string): boolean {
  if (!entity) return false;
  const t = text.toLowerCase();
  const e = entity.toLowerCase().trim();
  if (!e) return false;
  if (t.includes(e)) return true;
  // fall back to the most distinctive token (>=5 chars) so multi-word names still match
  const token = e
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5)
    .sort((a, b) => b.length - a.length)[0];
  return token ? t.includes(token) : false;
}

const today = () => new Date().toISOString().slice(0, 10);

// A page only corroborates a *breach* if it talks about one (not just mentions the entity).
const BREACH_RE = /breach|leak|hack|exposed|exposure|compromis|stolen|ransom|dump|credential|data\s*theft/i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// --- Web Scout: REAL search → fetch real results → relevance/breach gate ----
// No LLM-guessed URLs (those hallucinate and 404). We run an actual web search, fetch the
// real top results, and only count a source if the fetched page both references the target
// AND describes a breach/leak. Honest by construction.
export async function webScout(
  mission: { query: string; target_entity?: string },
  trace: Trace,
): Promise<ScoutResult> {
  const entity = mission.target_entity ?? mission.query;
  trace("execution", "WebScout", "action", `Searching the open web for "${entity} data breach"`);
  const found: SourceContribution[] = [];
  const snippets: Snippet[] = [];

  const results = await webSearch(`${entity} data breach`, 6);
  if (!results.length) {
    trace("execution", "WebScout", "info", `No web search results for ${entity}`);
    return { sources: found, snippets, notes: "no search results" };
  }
  trace("execution", "WebScout", "action", `Search returned ${results.length} result(s); fetching the top matches`);

  const top = results.slice(0, 4);
  const pages = await Promise.all(top.map((r) => fetchUrl(r.url)));
  pages.forEach((page, i) => {
    const r = top[i];
    const host = hostOf(r.url);
    if (!page.ok) {
      trace("execution", "WebScout", "info", `GET ${host} → ${page.status || page.error}`);
      return;
    }
    snippets.push({ source: host, content: page.text.slice(0, 2000) });
    const blob = `${r.title} ${page.title ?? ""} ${page.text}`;
    if (mentionsEntity(blob, entity) && BREACH_RE.test(blob)) {
      found.push({ name: host, type: "press", reliability: 0.45, observed_at: today(), url: r.url });
      trace("execution", "WebScout", "action", `Corroboration found at ${host}`);
    } else {
      trace("execution", "WebScout", "info", `${host} fetched — not breach-relevant for ${entity}`);
    }
  });

  trace("execution", "WebScout", found.length ? "success" : "info", `${found.length} corroborating web source(s) for ${entity}`);
  return { sources: found, snippets, notes: `${results.length} results, ${found.length} corroborating` };
}

// --- Tor Scout: live .onion fetch over a real circuit ----------------------
export async function torScout(
  mission: { target_entity?: string; query: string },
  trace: Trace,
): Promise<ScoutResult> {
  trace("execution", "TorScout", "action", "Establishing Tor circuit");
  const entity = mission.target_entity ?? mission.query;
  const exit = await getExitIp();
  if (exit.ip) trace("execution", "TorScout", "success", "Tor exit established", { exit_ip: exit.ip, country: exit.country });
  else trace("execution", "TorScout", "warn", `Tor exit unavailable: ${exit.error}`);

  const sources: SourceContribution[] = [];
  const snippets: Snippet[] = [];
  const hits = await ahmiaSearch(`${entity} breach`, 3);
  if (hits.length) {
    trace("execution", "TorScout", "action", `Ahmia returned ${hits.length} .onion candidate(s); fetching one live`, { onion_url: hits[0].onion });
    const r = await torFetch(hits[0].onion);
    if (r.ok) {
      snippets.push({ source: hits[0].onion, content: r.text.slice(0, 2000) });
      trace("execution", "TorScout", "success", `Live .onion fetch OK (${r.status})`, { onion_url: hits[0].onion, exit_ip: exit.ip, country: exit.country });
      // Only corroborating if the fetched forum content actually references the target.
      if (mentionsEntity(`${hits[0].title ?? ""} ${r.text}`, entity)) {
        sources.push({ name: hits[0].title || "tor_forum", type: "tor_forum", reliability: 0.7, observed_at: today(), url: hits[0].onion });
      } else {
        trace("execution", "TorScout", "info", `.onion content not relevant to ${entity} — not counted as corroboration`);
      }
    } else {
      trace("execution", "TorScout", "warn", `.onion fetch failed: ${r.error ?? r.status}`);
    }
  } else {
    trace("execution", "TorScout", "info", `No .onion candidates from Ahmia for ${entity}`);
  }
  return { sources, snippets, notes: `tor exit ${exit.ip ?? "n/a"}, ${sources.length} relevant onion source(s)` };
}

// --- Breach Scout: real breach APIs (HIBP / IntelX) ------------------------
export async function breachScout(
  mission: { ticker?: string; target_entity?: string },
  trace: Trace,
): Promise<ScoutResult> {
  trace("execution", "BreachScout", "action", "Querying breach APIs (HIBP/IntelX)");
  const domain = (mission.target_entity ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
  const [hibp, ix] = await Promise.all([hibpLookup(domain), intelxSearch(mission.target_entity ?? "")]);
  const sources = [...hibp, ...ix];
  trace("execution", "BreachScout", sources.length ? "success" : "info", `Breach APIs returned ${sources.length} source(s)`);
  return { sources, snippets: [], notes: `${sources.length} breach-api sources` };
}

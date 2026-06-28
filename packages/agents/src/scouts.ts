import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import type { SourceContribution } from "@altai/contracts";
import { fetchUrl, ahmiaSearch, torFetch, getExitIp, hibpLookup, intelxSearch } from "@altai/tools";
import { fastModel } from "./provider";
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

// --- Web Scout: open + blocked web -----------------------------------------
export async function webScout(
  mission: { query: string; target_entity?: string },
  trace: Trace,
): Promise<ScoutResult> {
  trace("execution", "WebScout", "action", "Searching open + blocked web sources");
  const entity = mission.target_entity ?? mission.query;
  const found: SourceContribution[] = [];
  const snippets: Snippet[] = [];
  const res = await generateText({
    model: fastModel(),
    stopWhen: stepCountIs(4),
    tools: {
      fetch_url: tool({
        description: "Fetch a web page (open or firewall-blocked). Returns status + text.",
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) => {
          trace("execution", "WebScout", "action", `GET ${url}`);
          const r = await fetchUrl(url);
          if (r.ok) {
            const host = new URL(url).hostname;
            snippets.push({ source: host, content: r.text.slice(0, 2000) });
            // Only corroborating if the page actually mentions the target.
            if (mentionsEntity(`${r.title} ${r.text}`, entity)) {
              found.push({ name: host, type: "press", reliability: 0.4, observed_at: today(), url });
            } else {
              trace("execution", "WebScout", "info", `${host} fetched but off-topic for ${entity} — not counted`);
            }
          }
          return { ok: r.ok, status: r.status, title: r.title, text: r.text.slice(0, 1500) };
        },
      }),
    },
    prompt: `You are a web-research scout. Find press or forum corroboration that "${entity}" suffered a data breach or exposure. Fetch 1-3 relevant URLs, then stop and summarize in one sentence. If you find nothing credible, say so plainly.`,
  });
  trace("execution", "WebScout", found.length ? "success" : "info", `${found.length} corroborating web source(s) for ${entity}`);
  return { sources: found, snippets, notes: res.text };
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

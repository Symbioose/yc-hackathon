import type { SourceContribution } from "@altai/contracts";
import { generateText } from "ai";
import { fetchUrl, webSearch, torFetch, getExitIp, hibpLookup, intelxSearch, htmlToText, fetchViaReader, looksBlocked } from "@altai/tools";
import { fastModel } from "./provider";
import type { Trace } from "./trace";

/** A piece of fetched content, kept so the membrane can scan the ACTUAL bytes we
 * retrieved (not a fixture) for prompt-injection before anything is signed. */
export interface Snippet {
  source: string;
  content: string;
}

/** One scout's output: corroborating sources, the raw snippets the membrane scans,
 * and `contexts[i]` — the readable text backing `sources[i]` (aligned), fed to the
 * answer synthesizer so citations [1],[2]… map back to the sources. */
export interface ScoutOut {
  sources: SourceContribution[];
  snippets: Snippet[];
  contexts: string[];
}

const EMPTY: ScoutOut = { sources: [], snippets: [], contexts: [] };
const today = () => new Date().toISOString().slice(0, 10);
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Does the question concern breaches / leaks / the dark web? If so we also send the
 * Tor + breach scouts, so a security question visibly goes onto the dark web. */
export function isSecurityQuery(q: string): boolean {
  return /breach|leak|dump|dark.?web|darknet|\bonion\b|\btor\b|ransom|stolen|credential|password|hack|compromis|exposed|exfiltrat|for sale|selling|threat actor|cyber|malware|phish|data\s+(sale|sold|selling)/i.test(q);
}

/** Turn a natural-language question into a concise web/Ahmia search query (a few
 * keywords) so the search returns relevant pages instead of generic SEO results.
 * Falls back to the raw question if no LLM is available. */
export async function refineQuery(question: string, trace: Trace): Promise<string> {
  try {
    const res = await generateText({
      model: fastModel(),
      prompt:
        `Rewrite the user's question as a concise web search query: 3–6 keywords, no quotes, no punctuation, ` +
        `just the query on one line.\n\nQuestion: ${question}\nSearch query:`,
    });
    const q = res.text.trim().split("\n")[0].replace(/^["']+|["']+$/g, "").slice(0, 120).trim();
    if (q && q.toLowerCase() !== question.toLowerCase()) trace("execution", "Planner", "action", `Refined search query → "${q}"`);
    return q || question;
  } catch {
    return question;
  }
}

const alnum = (s: string) => s.replace(/[^a-z0-9]/gi, "").length;
const sentences = (s: string) => (s.match(/[.!?]\s/g) || []).length;
// "Weak" = too short, almost no sentences (nav/menu chrome), or a bot-wall page.
const isWeak = (s: string) => alnum(s) < 300 || sentences(s) < 4 || looksBlocked(s);

/** Read one search result into clean, citable text. Tries a direct fetch first; if the page
 * is blocked (401/403/Cloudflare) or thin/JS-rendered (static HTML is just nav), falls back
 * to the keyless reader proxy, which renders it and returns the real content. Returns null
 * if nothing readable could be obtained, so block-page boilerplate never reaches the Analyst. */
async function readResult(
  r: { title: string; url: string },
  trace: Trace,
): Promise<{ host: string; url: string; title: string; body: string } | null> {
  const host = hostOf(r.url);
  const direct = await fetchUrl(r.url);
  let body = direct.ok ? htmlToText(direct.text) : "";

  if (!direct.ok || isWeak(body)) {
    const via = await fetchViaReader(r.url);
    if (via.ok) {
      const vb = htmlToText(via.text);
      if (!looksBlocked(vb) && alnum(vb) > alnum(body)) {
        body = vb;
        trace("execution", "WebScout", "info", `${host} → read via render proxy (direct ${direct.ok ? "thin" : direct.status || "failed"})`);
      }
    }
  }

  body = body.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
  if (!body || looksBlocked(body) || alnum(body) < 80) {
    trace("execution", "WebScout", "info", `GET ${host} → ${direct.ok ? "no readable content" : direct.status || direct.error}`);
    return null;
  }
  return { host, url: r.url, title: r.title || host, body: body.slice(0, 4200) };
}

// --- Web Scout: real keyless search → read the real top results ------------
export async function webScout(mission: { query: string; target_entity?: string }, trace: Trace, searchQuery?: string): Promise<ScoutOut> {
  const q = (searchQuery || mission.query?.trim() || mission.target_entity || "").trim();
  trace("execution", "WebScout", "action", `Searching the open web for: ${q}`);
  const results = await webSearch(q, 8);
  if (!results.length) {
    trace("execution", "WebScout", "info", "No web results found");
    return EMPTY;
  }
  const seen = new Set<string>();
  // Read a few distinct hosts in parallel; some sites bot-block (401/403/Cloudflare) or are
  // JS-rendered (static HTML is just nav chrome), so over-fetch to survive failures.
  const top = results.filter((r) => { const h = hostOf(r.url); if (seen.has(h)) return false; seen.add(h); return true; }).slice(0, 5);
  trace("execution", "WebScout", "action", `Reading the top ${top.length} of ${results.length} results`);
  const reads = await Promise.all(top.map((r) => readResult(r, trace)));
  const out: ScoutOut = { sources: [], snippets: [], contexts: [] };
  reads.forEach((res) => {
    if (!res) return;
    out.contexts.push(`${res.title} — ${res.host}\n${res.body}`);
    out.snippets.push({ source: res.host, content: res.body.slice(0, 2000) });
    out.sources.push({ name: res.host, type: "press", reliability: 0.5, observed_at: today(), url: res.url });
  });
  trace("execution", "WebScout", out.sources.length ? "success" : "info", `${out.sources.length} web source(s) read`);
  return out;
}

// Ahmia — the canonical dark-web search engine — reached at its official .onion (the
// dark-web equivalent of hitting duckduckgo.com). Used to actually search the dark web
// over Tor and to prove live .onion reachability.
const AHMIA_ONION = "http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion";

/** Extract distinct result .onion URLs from an Ahmia results page (skips Ahmia itself). */
function parseOnionHits(html: string): { onion: string; host: string }[] {
  const out: { onion: string; host: string }[] = [];
  const seen = new Set<string>();
  const re = /redirect_url=([^"&]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 5) {
    const url = decodeURIComponent(m[1]);
    const host = (url.match(/[a-z2-7]{16,56}\.onion/) || [])[0];
    if (!host || seen.has(host) || host.startsWith("juhanurmihxlp77")) continue;
    seen.add(host);
    out.push({ onion: url, host });
  }
  return out;
}

// --- Tor Scout: real dark-web search + live .onion fetch over a real circuit ----------
export async function torScout(mission: { query: string; target_entity?: string }, trace: Trace, searchQuery?: string): Promise<ScoutOut> {
  const q = (searchQuery || mission.query?.trim() || mission.target_entity || "").trim();
  const out: ScoutOut = { sources: [], snippets: [], contexts: [] };

  trace("execution", "TorScout", "action", "Establishing Tor circuit");
  const exit = await getExitIp();
  if (!exit.ip) {
    trace("execution", "TorScout", "warn", `Tor exit unavailable: ${exit.error}`);
    return out;
  }
  trace("execution", "TorScout", "success", `Tor exit established — exit ${exit.ip}${exit.country ? ` (${exit.country})` : ""}`, { exit_ip: exit.ip, country: exit.country });

  // Search the dark web by reaching Ahmia's .onion live over Tor (falls back to its
  // homepage if the search path is slow, so the live .onion proof always fires).
  trace("execution", "TorScout", "action", `Searching the dark web via Ahmia (.onion) over Tor for: ${q}`);
  let search = await torFetch(`${AHMIA_ONION}/search/?q=${encodeURIComponent(q)}`, 22000);
  if (!search.ok) search = await torFetch(`${AHMIA_ONION}/`, 18000);
  if (!search.ok) {
    trace("execution", "TorScout", "warn", `Dark-web index unreachable: ${search.error ?? search.status}`);
    return out;
  }
  trace("execution", "TorScout", "success", `Live .onion fetch OK (${search.status}) — Ahmia dark-web index`, { onion_url: AHMIA_ONION, exit_ip: exit.ip, country: exit.country });

  const hits = parseOnionHits(search.text);
  if (!hits.length) {
    trace("execution", "TorScout", "info", "No topic .onion forums indexed; dark-web reachability confirmed over Tor");
    return out;
  }
  trace("execution", "TorScout", "action", `Found ${hits.length} .onion result(s); fetching one live`, { onion_url: hits[0].onion });
  const r = await torFetch(hits[0].onion, 20000);
  if (r.ok) {
    trace("execution", "TorScout", "success", `Live .onion fetch OK (${r.status}) — ${hits[0].host}`, { onion_url: hits[0].onion, exit_ip: exit.ip, country: exit.country });
    const text = htmlToText(r.text).replace(/\s+/g, " ").trim().slice(0, 1800);
    out.contexts.push(`Dark-web forum ${hits[0].host} (.onion, via Tor)\n${text}`);
    out.snippets.push({ source: hits[0].onion, content: r.text.slice(0, 2000) });
    out.sources.push({ name: hits[0].host, type: "tor_forum", reliability: 0.55, observed_at: today(), url: hits[0].onion });
  } else {
    trace("execution", "TorScout", "warn", `.onion forum fetch failed: ${r.error ?? r.status}`);
  }
  return out;
}

// --- Breach Scout: real breach APIs (HIBP / IntelX) ------------------------
export async function breachScout(mission: { query: string; target_entity?: string }, trace: Trace): Promise<ScoutOut> {
  trace("execution", "BreachScout", "action", "Querying breach APIs (HIBP/IntelX)");
  const entity = (mission.target_entity || mission.query || "").trim();
  const domain = entity.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
  const [hibp, ix] = await Promise.all([hibpLookup(domain), intelxSearch(entity)]);
  const sources = [...hibp, ...ix];
  trace("execution", "BreachScout", sources.length ? "success" : "info", `Breach APIs returned ${sources.length} source(s)`);
  return { sources, snippets: [], contexts: sources.map((s) => `Breach API record: ${s.name}`) };
}

/** Synthesize one concise, cited answer grounded ONLY in the gathered contexts (web +
 * dark web). Returns "" if there's nothing to read; degrades to the top source title
 * if no LLM is configured. */
export async function synthesizeAnswer(question: string, contexts: string[], trace: Trace): Promise<string> {
  if (!contexts.length) return "";
  trace("execution", "Analyst", "action", "Synthesizing a cited answer from the sources");
  const numbered = contexts.map((c, i) => `[${i + 1}] ${c}`).join("\n\n");
  try {
    const res = await generateText({
      model: fastModel(),
      prompt:
        `You are a research analyst. Using ONLY the numbered sources below (open-web pages, and sometimes ` +
        `dark-web/.onion or breach-API records), write a clear, helpful answer to the user's question. ` +
        `Synthesize what the sources DO say that is relevant — be specific (names, dates, figures) and concise ` +
        `(1–5 sentences) — and cite the sources you use inline like [1], [2]. Do not use any outside knowledge ` +
        `and do not invent facts. Only if NONE of the sources are relevant to the question, reply exactly: ` +
        `"The sources don't contain a clear answer."\n\nQuestion: ${question}\n\nSources:\n${numbered}`,
    });
    return res.text.trim();
  } catch (e) {
    trace("execution", "Analyst", "warn", `Answer synthesis unavailable (${e instanceof Error ? e.message : "no LLM"}); returning the top source`);
    return `Top source: ${contexts[0].split("\n")[0]}`;
  }
}

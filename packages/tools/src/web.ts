export interface FetchResult {
  url: string;
  ok: boolean;
  status: number;
  text: string; // truncated to 8000 chars
  title?: string;
  error?: string;
}

const MAX = 60000; // raw HTML kept; htmlToText() extracts the readable text from it
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";

export async function fetchUrl(url: string, timeoutMs = 10000): Promise<FetchResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const body = await res.text();
    const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    return { url, ok: res.ok, status: res.status, text: body.slice(0, MAX), title };
  } catch (e) {
    return { url, ok: false, status: 0, text: "", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

/** Heuristic: does this fetched text look like a bot-wall / JS-required interstitial rather
 * than the real page? Used to discard block pages so their boilerplate never reaches the Analyst. */
export function looksBlocked(text: string): boolean {
  return /attention required|cloudflare|please enable (javascript|js|cookies)|enable cookies to continue|access denied|are you a human|verify you are (a )?human|captcha|unusual traffic|bot detection|just a moment|checking your browser|enable js and disable/i.test(
    text.slice(0, 900),
  );
}

/** Keyless reader-proxy fallback (r.jina.ai). Renders JS-heavy pages server-side and gets
 * past many bot walls, returning the page's real readable text — used only when a direct
 * fetch is blocked or yields thin/boilerplate content, so the Analyst can cite real sources. */
export async function fetchViaReader(url: string, timeoutMs = 24000): Promise<FetchResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "text/plain", "x-retain-images": "none" },
    });
    let text = await res.text();
    const title = /^Title:\s*(.+)$/m.exec(text.slice(0, 600))?.[1]?.trim();
    const marker = text.indexOf("Markdown Content:");
    if (marker >= 0) text = text.slice(marker + "Markdown Content:".length);
    return { url, ok: res.ok && text.trim().length > 0, status: res.status, text: text.slice(0, MAX), title };
  } catch (e) {
    return { url, ok: false, status: 0, text: "", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

/** Strip an HTML document down to its readable text: drop scripts/styles/comments,
 * turn block-closers into line breaks, remove the remaining tags, and decode the
 * common HTML entities. This is what the Analyst actually reads, so a real cited
 * answer can be synthesized from a page instead of raw markup. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(Number(n)); } catch { return " "; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCharCode(parseInt(n, 16)); } catch { return " "; } })
    .replace(/[ \t\r\f]+/g, " ")
    .replace(/\n[ \n]+/g, "\n")
    .trim();
}

export interface SearchResult {
  title: string;
  url: string;
}

const SEARCH_HEADERS = {
  "user-agent": UA,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

async function getHtml(url: string, timeoutMs: number, extra?: Record<string, string>): Promise<{ status: number; html: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { ...SEARCH_HEADERS, ...extra } });
    return { status: res.status, html: await res.text() };
  } catch {
    return { status: 0, html: "" };
  } finally {
    clearTimeout(t);
  }
}

function addResult(out: SearchResult[], title: string, url: string, n: number) {
  if (out.length >= n || !/^https?:\/\//.test(url)) return;
  if (/duckduckgo\.com|bing\.com|microsoft\.com|msn\.com|go\.microsoft|yahoo\.com/.test(url)) return;
  if (out.some((r) => r.url === url)) return;
  out.push({ title: title.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || url, url });
}

const decodeUddg = (u: string) => {
  const m = /[?&]uddg=([^&]+)/.exec(u);
  let url = m ? decodeURIComponent(m[1]) : u;
  if (url.startsWith("//")) url = "https:" + url;
  return url;
};

/** Parse a DuckDuckGo HTML / Lite results page (both use uddg redirect links). */
function parseDuck(html: string, n: number): SearchResult[] {
  const out: SearchResult[] = [];
  let m: RegExpExecArray | null;
  const reA = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  while ((m = reA.exec(html)) && out.length < n) addResult(out, m[2], decodeUddg(m[1]), n);
  if (out.length) return out;
  // Lite + fallback: any uddg redirect anchor
  const reU = /<a[^>]*href="([^"]*uddg=[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  while ((m = reU.exec(html)) && out.length < n) addResult(out, m[2], decodeUddg(m[1]), n);
  return out;
}

/** Parse a Bing results page (h2 > a result links). */
function parseBing(html: string, n: number): SearchResult[] {
  const out: SearchResult[] = [];
  let m: RegExpExecArray | null;
  const re = /<li class="b_algo"[\s\S]*?<h2>\s*<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  while ((m = re.exec(html)) && out.length < n) addResult(out, m[2], m[1], n);
  if (out.length) return out;
  const re2 = /<h2[^>]*>\s*<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  while ((m = re2.exec(html)) && out.length < n) addResult(out, m[2], m[1], n);
  return out;
}

/** Real, keyless web search. Returns actual result URLs so scouts read real pages.
 * Resilient by design: DuckDuckGo HTML rate-limits scrapers (HTTP 202 "challenge"), so we
 * fall through DDG HTML → DDG Lite → Bing and return the first non-empty result set.
 * Graceful: [] if every provider is blocked (the swarm then degrades to an honest result). */
export async function webSearch(query: string, n = 6, timeoutMs = 12000): Promise<SearchResult[]> {
  const q = encodeURIComponent(query);
  const providers: Array<() => Promise<SearchResult[]>> = [
    async () => {
      const { status, html } = await getHtml(`https://html.duckduckgo.com/html/?q=${q}`, timeoutMs);
      return status === 200 ? parseDuck(html, n) : [];
    },
    async () => {
      const { status, html } = await getHtml(`https://lite.duckduckgo.com/lite/?q=${q}`, timeoutMs);
      return status === 200 ? parseDuck(html, n) : [];
    },
    async () => {
      // consent cookie nudges Bing past its EU-style "agree" interstitial
      const { status, html } = await getHtml(`https://www.bing.com/search?q=${q}&setlang=en-us&cc=us`, timeoutMs, {
        cookie: "SRCHHPGUSR=SRCHLANG=en; _EDGE_S=ui=en-us; _EDGE_CD=m=en-us",
      });
      return status === 200 ? parseBing(html, n) : [];
    },
  ];
  for (const run of providers) {
    try {
      const r = await run();
      if (r.length) return r;
    } catch {
      /* try next provider */
    }
  }
  return [];
}

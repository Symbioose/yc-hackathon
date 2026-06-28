export interface FetchResult {
  url: string;
  ok: boolean;
  status: number;
  text: string; // truncated to 8000 chars
  title?: string;
  error?: string;
}

const MAX = 8000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";

export async function fetchUrl(url: string, timeoutMs = 10000): Promise<FetchResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": UA } });
    const body = await res.text();
    const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    return { url, ok: res.ok, status: res.status, text: body.slice(0, MAX), title };
  } catch (e) {
    return { url, ok: false, status: 0, text: "", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

export interface SearchResult {
  title: string;
  url: string;
}

/** Real, keyless web search via the DuckDuckGo HTML endpoint. Returns the actual result
 * URLs so scouts fetch real pages instead of LLM-hallucinated links. Graceful: [] on error. */
export async function webSearch(query: string, n = 6, timeoutMs = 12000): Promise<SearchResult[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "text/html" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const out: SearchResult[] = [];
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && out.length < n) {
      let url = m[1];
      const uddg = /[?&]uddg=([^&]+)/.exec(url);
      if (uddg) url = decodeURIComponent(uddg[1]);
      if (url.startsWith("//")) url = "https:" + url;
      const title = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (/^https?:\/\//.test(url) && !/duckduckgo\.com/.test(url)) out.push({ title, url });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

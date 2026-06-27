export interface FetchResult {
  url: string;
  ok: boolean;
  status: number;
  text: string; // truncated to 8000 chars
  title?: string;
  error?: string;
}

const MAX = 8000;

export async function fetchUrl(url: string, timeoutMs = 10000): Promise<FetchResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "AltaiBot/0.1" } });
    const body = await res.text();
    const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    return { url, ok: res.ok, status: res.status, text: body.slice(0, MAX), title };
  } catch (e) {
    return { url, ok: false, status: 0, text: "", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

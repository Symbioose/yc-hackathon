import { socksDispatcher } from "fetch-socks";

const HOST = process.env.TOR_SOCKS_HOST ?? "127.0.0.1";
const PORT = Number(process.env.TOR_SOCKS_PORT ?? 9050);

function dispatcher() {
  return socksDispatcher({ type: 5, host: HOST, port: PORT });
}

export interface TorResult {
  url: string;
  ok: boolean;
  status: number;
  text: string;
  error?: string;
}

/** Fetch any URL (incl. .onion) through the Tor SOCKS5 proxy. */
export async function torFetch(url: string, timeoutMs = 30000): Promise<TorResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      // @ts-expect-error undici dispatcher is accepted at runtime by Node fetch
      dispatcher: dispatcher(),
      signal: ctrl.signal,
      headers: { "user-agent": "AltaiBot/0.1" },
    });
    const body = await res.text();
    return { url, ok: res.ok, status: res.status, text: body.slice(0, 8000) };
  } catch (e) {
    return { url, ok: false, status: 0, text: "", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

/** The Tor exit-node IP + country as seen by the outside world (proves foreign egress). */
export async function getExitIp(): Promise<{ ip?: string; country?: string; error?: string }> {
  // ip-api returns IP + country in one call; fall back to ipify for the IP alone.
  const geo = await torFetch("http://ip-api.com/json/?fields=query,countryCode", 30000);
  if (geo.ok) {
    try {
      const j = JSON.parse(geo.text);
      if (j.query) return { ip: j.query, country: j.countryCode };
    } catch {
      /* fall through */
    }
  }
  const r = await torFetch("https://api.ipify.org?format=json", 30000);
  if (!r.ok) return { error: r.error ?? `status ${r.status}` };
  try {
    return { ip: JSON.parse(r.text).ip };
  } catch {
    return { error: "parse" };
  }
}

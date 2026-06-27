import { fetchUrl } from "./web";

export interface OnionHit {
  title: string;
  onion: string;
}

/** Query the Ahmia clearnet index; parse .onion result links. Returns [] on failure. */
export async function ahmiaSearch(query: string, limit = 5): Promise<OnionHit[]> {
  const r = await fetchUrl(`https://ahmia.fi/search/?q=${encodeURIComponent(query)}`, 12000);
  if (!r.ok) return [];
  const hits: OnionHit[] = [];
  const re =
    /<a[^>]+href="(?:\/search\/redirect\?[^"]*redirect_url=)?(https?:\/\/[a-z2-7]{16,56}\.onion[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(r.text)) && hits.length < limit) {
    hits.push({ onion: decodeURIComponent(m[1]), title: m[2].trim() });
  }
  return hits;
}

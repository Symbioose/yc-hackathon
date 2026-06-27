import type { SourceContribution } from "@periscope/contracts";
import { heroCase } from "@periscope/fixtures";

/** Hero pinning: for the demo ticker, return the verified fixture sources so the
 * final Signal is reproducible regardless of live API availability (spec §10). */
export function heroSourcesFor(ticker: string): SourceContribution[] | null {
  if (ticker?.toUpperCase() === heroCase.primary.ticker.toUpperCase()) {
    return heroCase.primary.sources;
  }
  return null;
}

/** Live HIBP breaches for a domain. Returns [] if no key or on failure (graceful). */
export async function hibpLookup(domain: string): Promise<SourceContribution[]> {
  const key = process.env.HIBP_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(domain)}`, {
      headers: { "hibp-api-key": key, "user-agent": "PeriscopeBot/0.1" },
    });
    if (!res.ok) return [];
    const list = (await res.json()) as Array<{ Name: string; BreachDate: string }>;
    return list.slice(0, 3).map((b) => ({
      name: `HIBP:${b.Name}`,
      type: "breach_api" as const,
      reliability: 0.6,
      observed_at: b.BreachDate,
    }));
  } catch {
    return [];
  }
}

/** Live IntelX search. Returns [] if no key or on failure (graceful). */
export async function intelxSearch(term: string): Promise<SourceContribution[]> {
  const key = process.env.INTELX_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://2.intelx.io/intelligent/search?term=${encodeURIComponent(term)}`, {
      headers: { "x-key": key, "user-agent": "PeriscopeBot/0.1" },
    });
    if (!res.ok) return [];
    return [
      {
        name: "IntelX",
        type: "breach_api",
        reliability: 0.55,
        observed_at: new Date().toISOString().slice(0, 10),
      },
    ];
  } catch {
    return [];
  }
}

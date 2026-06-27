import type { MissionMetrics, Signal, SourceType, TraceEvent } from "@altai/contracts";
import { evaluateRoute, WARM_ROUTE } from "./cost";
import type { Genome, Outcome } from "./types";

/** Just enough of a Mission to bucket it — the only fields fingerprint() reads, and
 * none of them are stored. */
export interface MissionLike {
  query?: string;
  target_entity?: string;
  ticker?: string;
}

// ---- mission_type: the *kind* of investigation, from the event type / query ----
// Order matters: more specific families win. "credential_dump" is a breach, not a
// generic leak, so breach/credential is tested before leak/dump/paste.
const EVENT_TYPE_FAMILY: Array<[RegExp, string]> = [
  [/ransom/i, "ransomware_intel"],
  [/fraud|scam|phish/i, "fraud_intel"],
  [/breach|credential|compromis|intrusion|hack/i, "breach_intel"],
  [/expos|misconfig|open[\s_-]*bucket|unsecured/i, "exposure_intel"],
  [/leak|dump|paste/i, "leak_intel"],
];

export function deriveMissionType(eventType?: string, query?: string): string {
  const hay = `${eventType ?? ""} ${query ?? ""}`;
  for (const [re, t] of EVENT_TYPE_FAMILY) if (re.test(hay)) return t;
  return "breach_intel";
}

// ---- sector: a coarse, non-identifying bucket derived from the entity, which is
// then discarded. We store "entertainment", never "Live Nation". ----
const SECTOR_BY_TICKER: Record<string, string> = {
  LYV: "entertainment",
  MPL: "healthcare",
};

const SECTOR_KEYWORDS: Array<[RegExp, string]> = [
  [/bank|capital|financ|securit|asset|invest|fund/i, "finance"],
  [/health|medi|pharma|hospital|care|bio/i, "healthcare"],
  [/air|airline|aviation/i, "airline"],
  [/hotel|hospitalit|resort/i, "hospitality"],
  [/game|gaming|studio/i, "gaming"],
  [/tele|telecom|mobile|wireless/i, "telecom"],
  [/energy|oil|gas|power|utility|grid/i, "energy"],
  [/retail|shop|store|commerce|mart/i, "retail"],
  [/media|news|entertain|music|ticket/i, "entertainment"],
  [/edu|universit|school|academy|college/i, "education"],
  [/crypto|coin|chain|web3|exchange|defi/i, "crypto"],
  [/gov|ministry|federal|agency|municipal/i, "government"],
  [/defen[cs]e|military|arms|aerospace/i, "defense"],
  [/logistic|shipping|freight|supply/i, "logistics"],
  [/fintech|payments?|wallet|neobank/i, "fintech"],
  [/cloud|software|saas|systems|data|platform/i, "saas"],
];

export function deriveSector(opts: { ticker?: string; entity?: string }): string {
  const t = opts.ticker?.toUpperCase().split(".")[0];
  if (t && SECTOR_BY_TICKER[t]) return SECTOR_BY_TICKER[t];
  const e = opts.entity ?? "";
  for (const [re, s] of SECTOR_KEYWORDS) if (re.test(e)) return s;
  return "unknown";
}

const AGENT_SOURCE: Record<string, SourceType> = {
  WebScout: "press",
  TorScout: "tor_forum",
  BreachScout: "breach_api",
};

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** Order the scouts were first seen acting in the trace → an attempted source route. */
function sourceSeqFromTrace(trace: TraceEvent[]): SourceType[] {
  const seq: SourceType[] = [];
  for (const ev of trace) {
    if (ev.layer !== "execution") continue;
    const s = AGENT_SOURCE[ev.agent];
    if (s && !seq.includes(s)) seq.push(s);
  }
  return seq;
}

function latencyFromTrace(trace: TraceEvent[]): number | undefined {
  if (trace.length < 2) return undefined;
  const first = +new Date(trace[0].ts);
  const last = +new Date(trace[trace.length - 1].ts);
  const d = last - first;
  return Number.isFinite(d) && d > 0 ? d : undefined;
}

/**
 * Compress a finished mission into its entity-stripped Genome — the DNA of HOW the
 * signal was found. By construction there is no field for the raw query, target
 * entity, ticker, URL, or source name: identity isolation applied to memory.
 *
 * The route that "worked" is the corroborating order (what actually fed noisy-OR);
 * if nothing corroborated we fall back to the attempted trace order so failures are
 * still learnable. Metrics may be supplied by a deterministic fleet, else estimated.
 */
export function fingerprint(
  mission: MissionLike,
  signal: Signal,
  trace: TraceEvent[],
  metrics?: Partial<MissionMetrics>,
): Genome {
  const mission_type = deriveMissionType(signal.event_type, mission.query);
  const sector = deriveSector({ ticker: signal.ticker ?? mission.ticker, entity: mission.target_entity });
  const corroborating_types = uniq(signal.sources.map((s) => s.type));
  const outcome: Outcome =
    corroborating_types.length === 0 || signal.confidence < 0.5 ? "dead_end" : "signed";
  const source_sequence = corroborating_types.length ? corroborating_types : sourceSeqFromTrace(trace);
  const est = evaluateRoute(source_sequence.length ? source_sequence : WARM_ROUTE, "warm");

  return {
    id: trace[0]?.mission_id ?? `${mission_type}:${sector}:${Date.now()}`,
    mission_type,
    sector,
    source_sequence,
    corroborating_types,
    hops: metrics?.hops ?? est.hops,
    latency_ms: metrics?.latency_ms ?? latencyFromTrace(trace) ?? est.latency_ms,
    cost_usd: metrics?.cost_usd ?? est.cost_usd,
    confidence: metrics?.confidence ?? signal.confidence,
    outcome,
  };
}

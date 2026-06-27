import { createRequire } from "node:module";
import type { Signal, SourceContribution } from "@periscope/contracts";

const require = createRequire(import.meta.url);
export const heroCase = require("../hero_case.json") as HeroCase;

interface PricePoint { date: string; close: number; }
interface HeroPrimary {
  entity: string; ticker: string; exchange: string; event_type: string;
  observed_at: string; disclosed_at: string; lead_time_days: number;
  sources: SourceContribution[]; evidence_url: string; summary: string;
  alpha: { strategy: string; entry_date: string; exit_date: string; note?: string };
  price_series: PricePoint[];
}
interface HeroCase { primary: HeroPrimary; secondary: { ticker: string; price_series: PricePoint[] } & Record<string, unknown>; }

/** Noisy-OR fusion over independent sources (mirrors spec §7.4). */
export function fuseConfidence(sources: SourceContribution[]): number {
  const p = sources.reduce((acc, s) => acc * (1 - s.reliability), 1);
  return Number((1 - p).toFixed(4));
}

export function heroSignal(): Signal {
  const c = heroCase.primary;
  return {
    entity: c.entity,
    ticker: c.ticker,
    event_type: c.event_type,
    sources: c.sources,
    confidence: fuseConfidence(c.sources),
    confidence_method: "noisy_or",
    observed_at: c.observed_at,
    disclosed_at: c.disclosed_at,
    lead_time_days: c.lead_time_days,
    alpha: { strategy: c.alpha.strategy, entry_date: c.alpha.entry_date, exit_date: c.alpha.exit_date, note: c.alpha.note },
    summary: c.summary,
  };
}

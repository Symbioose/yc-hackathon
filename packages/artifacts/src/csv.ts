import type { SignedBrief } from "@altai/contracts";
import { csvRow } from "./util";

/** The corroborating sources as a clean RFC-4180 table (CRLF, quoted cells) — opens
 * straight into Excel/Sheets and ingests into any pipeline. */
export function briefToCSV(brief: SignedBrief): string {
  const { signal } = brief;
  const header = ["name", "type", "reliability", "observed_at", "url"];
  const rows = signal.sources.map((s) => csvRow([s.name, s.type, s.reliability, s.observed_at, s.url ?? ""]));
  return [csvRow(header), ...rows].join("\r\n") + "\r\n";
}

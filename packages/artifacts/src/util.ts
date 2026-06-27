import { createHash } from "node:crypto";
import type { Signal } from "@altai/contracts";

/** URL/filename-safe slug from an entity name. */
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "signal";
}

/** Base filename (no extension) for a brief's artifacts. */
export function briefBasename(signal: Signal): string {
  const t = signal.ticker ? `-${slug(signal.ticker)}` : "";
  return `altai-brief-${slug(signal.entity)}${t}`;
}

/** A deterministic, RFC-4122-shaped UUID derived from a seed — so STIX object ids
 * are stable for a given brief (round-trippable, testable) without a random source. */
export function deterministicUuid(seed: string): string {
  const h = createHash("sha256").update(seed).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Escape a single CSV cell per RFC 4180 (quote if it contains comma/quote/newline). */
export function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

export const pct = (n: number): string => `${Math.round(n * 100)}%`;
export const money = (n?: number): string => (n == null ? "—" : `$${n.toFixed(2)}`);

/** Short, human display of a long hex/base64 token (audit roots, signatures). */
export function shorten(token: string, head = 16, tail = 6): string {
  return token.length > head + tail + 1 ? `${token.slice(0, head)}…${token.slice(-tail)}` : token;
}

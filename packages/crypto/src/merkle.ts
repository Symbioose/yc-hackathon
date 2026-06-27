import { createHash } from "node:crypto";
import type { AuditEntry } from "@periscope/contracts";
import { canonical } from "./canonical";

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export interface RawEntry {
  ts: string;
  actor: string;
  action: string;
  source?: string;
  target?: string;
}

function entryHash(e: Omit<AuditEntry, "hash">): string {
  return sha256(
    canonical({
      seq: e.seq,
      ts: e.ts,
      actor: e.actor,
      action: e.action,
      source: e.source,
      target: e.target,
      prev_hash: e.prev_hash,
    }),
  );
}

/** Hash-chain a list of raw events into AuditEntry leaves. */
export function buildLedger(raw: RawEntry[]): AuditEntry[] {
  const out: AuditEntry[] = [];
  let prev = "GENESIS";
  raw.forEach((r, i) => {
    const base = { seq: i, ts: r.ts, actor: r.actor, action: r.action, source: r.source, target: r.target, prev_hash: prev };
    const hash = entryHash(base);
    out.push({ ...base, hash });
    prev = hash;
  });
  return out;
}

/** Binary sha256 Merkle tree over leaf hashes (duplicate last if odd). */
export function merkleRoot(entries: AuditEntry[]): string {
  if (entries.length === 0) return sha256("EMPTY");
  let level = entries.map((e) => e.hash);
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = level[i + 1] ?? level[i];
      next.push(sha256(a + b));
    }
    level = next;
  }
  return level[0];
}

/** Tamper-demo: patch a field and recompute that entry's hash, so the recomputed
 * Merkle root diverges from the signed root. */
export function tamperEntry(
  entries: AuditEntry[],
  idx: number,
  patch: Partial<Pick<AuditEntry, "action" | "actor" | "target">>,
): AuditEntry[] {
  return entries.map((e, i) => {
    if (i !== idx) return e;
    const mutated = { ...e, ...patch };
    return { ...mutated, hash: entryHash(mutated) };
  });
}

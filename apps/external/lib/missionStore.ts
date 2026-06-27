import { EventEmitter } from "node:events";
import type { AuditEntry, MemoryReport, Signal, SignedBrief, TraceEvent } from "@altai/contracts";
import { tamperEntry } from "@altai/crypto";

interface MissionState {
  id: string;
  events: TraceEvent[];
  signal?: Signal;
  brief?: SignedBrief;
  entries?: AuditEntry[];
  done: boolean;
}

// Next.js dev mode re-evaluates route modules per request; anchor singletons on globalThis
// so all routes share the same bus + missions map.
declare global {
  // eslint-disable-next-line no-var
  var __altaiMissions: Map<string, MissionState> | undefined;
  // eslint-disable-next-line no-var
  var __altaiBus: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __altaiLastMemory: MemoryReport | undefined;
}

const missions: Map<string, MissionState> =
  globalThis.__altaiMissions ?? (globalThis.__altaiMissions = new Map());

export const bus: EventEmitter = globalThis.__altaiBus ?? (globalThis.__altaiBus = new EventEmitter());

bus.setMaxListeners(100);

export function createMission(id: string): MissionState {
  const m: MissionState = { id, events: [], done: false };
  missions.set(id, m);
  return m;
}

export function emitTrace(ev: TraceEvent): void {
  missions.get(ev.mission_id)?.events.push(ev);
  bus.emit("trace", ev);
}

/** Publish an Intelligence Network snapshot (before/after + learned graph) to the
 * ops-center. Cached so a client that connects mid-demo still gets the latest state. */
export function emitMemory(report: MemoryReport): void {
  globalThis.__altaiLastMemory = report;
  bus.emit("memory", report);
}

export function getLastMemoryReport(): MemoryReport | undefined {
  return globalThis.__altaiLastMemory;
}

export function getEvents(id: string): TraceEvent[] {
  return missions.get(id)?.events ?? [];
}

/** Finalize a mission with its sanitized signal + signed brief + audit ledger. */
export function sealMission(id: string, signal: Signal, brief: SignedBrief, entries: AuditEntry[]): void {
  const m = missions.get(id);
  if (m) {
    m.signal = signal;
    m.brief = brief;
    m.entries = entries;
    m.done = true;
  }
  bus.emit("signal", { id, signal });
}

export function getSignal(id: string): Signal | undefined {
  return missions.get(id)?.signal;
}
export function getBrief(id: string): SignedBrief | undefined {
  return missions.get(id)?.brief;
}
export function getEntries(id: string): AuditEntry[] | undefined {
  return missions.get(id)?.entries;
}

/** Tamper-demo: mutate one stored audit entry so the recomputed Merkle root diverges. */
export function tamperMission(
  id: string,
  idx: number,
  patch: Partial<Pick<AuditEntry, "action" | "actor" | "target">>,
): AuditEntry[] | undefined {
  const m = missions.get(id);
  if (!m?.entries) return undefined;
  m.entries = tamperEntry(m.entries, idx, patch);
  return m.entries;
}

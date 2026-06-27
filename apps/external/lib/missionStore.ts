import { EventEmitter } from "node:events";
import type { Signal, TraceEvent } from "@periscope/contracts";

interface MissionState { id: string; events: TraceEvent[]; signal?: Signal; done: boolean; }

// Next.js dev mode re-evaluates route modules per request; anchor singletons on globalThis
// so all routes share the same bus + missions map.
declare global {
  // eslint-disable-next-line no-var
  var __periscopeMissions: Map<string, MissionState> | undefined;
  // eslint-disable-next-line no-var
  var __periscopeBus: EventEmitter | undefined;
}

const missions: Map<string, MissionState> =
  globalThis.__periscopeMissions ?? (globalThis.__periscopeMissions = new Map());

export const bus: EventEmitter =
  globalThis.__periscopeBus ?? (globalThis.__periscopeBus = new EventEmitter());

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
export function completeMission(id: string, signal: Signal): void {
  const m = missions.get(id);
  if (m) { m.signal = signal; m.done = true; }
  bus.emit("signal", { id, signal });
}
export function getSignal(id: string): Signal | undefined {
  return missions.get(id)?.signal;
}

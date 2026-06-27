import { MemoryStore } from "@altai/memory";

// The Intelligence Network lives ONLY on the gateway (this app) — never on the
// sealed side. Like the mission bus, anchor it on globalThis so every route module
// (which Next re-evaluates per request in dev) shares one trained network. Seeded
// with ~20 entity-stripped past missions in the constructor.
declare global {
  // eslint-disable-next-line no-var
  var __altaiMemory: MemoryStore | undefined;
}

export const memory: MemoryStore =
  globalThis.__altaiMemory ?? (globalThis.__altaiMemory = new MemoryStore());

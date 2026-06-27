import type { Mission, TraceEvent } from "@altai/contracts";
import { heroSignal } from "@altai/fixtures";
import { COLD_ROUTE } from "@altai/memory";
import { emitMemory, emitTrace } from "./missionStore";
import { membraneAndSeal } from "./seal";
import { memory } from "./memory";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function trace(
  id: string,
  layer: TraceEvent["layer"],
  agent: string,
  level: TraceEvent["level"],
  msg: string,
  meta?: Record<string, unknown>,
): void {
  emitTrace({ mission_id: id, ts: new Date().toISOString(), layer, agent, level, msg, meta });
}

/**
 * The Intelligence Network demo — the jaw-dropping beat. It replays the SAME mission
 * twice, deterministically (no LLM required):
 *
 *   PHASE 1 — COLD  : the network has never seen this mission. The planner explores
 *                     all five source types blind, burns a Tor circuit on the wrong
 *                     forum, and limps to a weak signal → 7 hops · 38s · $0.41 · 0.72.
 *   PHASE 2 — WARMED: the network recalls the route 13 similar missions taught it and
 *                     goes straight to Tor→Breach → 2 hops · 6s · $0.04 · 0.94.
 *
 * The ops-center INTELLIGENCE NETWORK panel animates from the cold column to the
 * warmed column live; the membrane then signs the brief and the route is reinforced
 * (run #14 → #15 → …), so each demo run visibly compounds.
 */
export async function runDemoFleet(mission: Mission): Promise<void> {
  const id = mission.id;
  const cmp = memory.compareColdWarm(mission, id);

  // ---------------------------- PHASE 1 · COLD ----------------------------
  trace(id, "dispatch", "Gateway", "info", "Mission received via sealed egress");
  // Panel snapshot: what mission #1 cost before any learning (warmed == cold).
  emitMemory({ ...cmp, run_index: 1, recalled_from: 0, route: COLD_ROUTE, warmed: cmp.cold });
  await sleep(1100);

  trace(id, "policy", "PolicyAgent", "success", "Mission within tenant policy (osint_readonly)");
  await sleep(700);
  trace(id, "identity", "IdentityIsolation", "info", "Client identity stripped; acting under Altai egress");
  await sleep(900);

  trace(id, "memory", "IntelligenceNetwork", "warn",
    "COLD START — no recalled route; planner must explore all 5 source types blind", { warm_start: false, route: COLD_ROUTE });
  await sleep(1100);
  trace(id, "execution", "WebScout", "warn", "Press/paste/filing crawl → no corroboration (3 dead hops)");
  await sleep(800);
  trace(id, "execution", "TorScout", "warn", "Ahmia guess → wrong forum, circuit wasted (2 dead hops)");
  await sleep(900);
  trace(id, "execution", "BreachScout", "info", "Breach API finally corroborates — 7 hops, 38s, $0.41, conf 0.72");
  await sleep(1300);

  // ---------------------------- PHASE 2 · WARMED ----------------------------
  const recall = memory.recall(mission);
  trace(id, "memory", "IntelligenceNetwork", "action", recall.reason,
    { route: recall.route, recalled_from: recall.recalled_from, warm_start: true });
  await sleep(1500);

  trace(id, "execution", "Planner", "action", "Decomposing mission → Tor/Breach scouts (warm-started)");
  await sleep(1400);
  trace(id, "execution", "TorScout", "success", "Straight to the known forum — live .onion fetch OK",
    { exit_ip: "185.220.101.4", country: "DE", circuit: ["FR-guard", "DE-relay", "NL-exit"] });
  await sleep(1000);
  trace(id, "execution", "BreachScout", "success", "Breach API corroborates on first hit");
  await sleep(900);
  trace(id, "execution", "Planner", "success", "Candidate signal synthesized from 2 independent sources");
  await sleep(1400);

  // Seal + reinforce. Passing the exact warmed metrics pins the headline #14 numbers;
  // membraneAndSeal emits the warmed snapshot, so the panel animates cold → warmed.
  membraneAndSeal(mission, heroSignal(), [], cmp.warmed);
}

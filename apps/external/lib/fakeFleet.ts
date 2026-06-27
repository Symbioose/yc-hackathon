import type { Mission, TraceEvent } from "@altai/contracts";
import { heroSignal } from "@altai/fixtures";
import { emitTrace } from "./missionStore";
import { membraneAndSeal } from "./seal";
import { memory } from "./memory";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Step = Pick<TraceEvent, "layer" | "agent" | "level" | "msg"> & { meta?: Record<string, unknown> };

export async function runFakeFleet(mission: Mission): Promise<void> {
  // Intelligence Network warm-start (also visible on the scripted fallback path).
  const recall = memory.recall(mission);
  const memStep: Step = recall.recalled
    ? { layer: "memory", agent: "IntelligenceNetwork", level: "action", msg: recall.reason, meta: { route: recall.route, recalled_from: recall.recalled_from, warm_start: true } }
    : { layer: "memory", agent: "IntelligenceNetwork", level: "info", msg: recall.reason, meta: { warm_start: false } };

  const script: Step[] = [
    { layer: "dispatch", agent: "Gateway", level: "info", msg: "Mission received via sealed egress" },
    { layer: "policy", agent: "PolicyAgent", level: "success", msg: "Mission within tenant policy (osint_readonly)" },
    { layer: "identity", agent: "IdentityIsolation", level: "info", msg: "Client identity stripped; acting under Altai egress" },
    memStep,
    { layer: "execution", agent: "Planner", level: "action", msg: "Decomposing mission → Web/Tor/Breach scouts" },
    { layer: "execution", agent: "WebScout", level: "action", msg: "Fetching open + blocked sources" },
    { layer: "execution", agent: "TorScout", level: "action", msg: "Tor circuit established; fetching .onion", meta: { exit_ip: "185.220.101.4", country: "DE", circuit: ["FR-guard", "DE-relay", "NL-exit"] } },
    { layer: "execution", agent: "BreachScout", level: "action", msg: "Cross-checking breach APIs (HIBP/IntelX)" },
    { layer: "execution", agent: "Planner", level: "success", msg: "Candidate signal synthesized from 2 independent sources" },
  ];

  for (const step of script) {
    emitTrace({ mission_id: mission.id, ts: new Date().toISOString(), ...step });
    await sleep(600);
  }
  // Membrane + crypto attestation seal the mission, then teach the network (same path
  // as the real fleet).
  membraneAndSeal(mission, heroSignal(), []);
}

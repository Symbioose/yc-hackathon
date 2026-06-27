import type { Mission, TraceEvent } from "@altai/contracts";
import { heroSignal } from "@altai/fixtures";
import { emitTrace } from "./missionStore";
import { membraneAndSeal } from "./seal";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Step = Pick<TraceEvent, "layer" | "agent" | "level" | "msg"> & { meta?: Record<string, unknown> };

const SCRIPT: Step[] = [
  { layer: "dispatch", agent: "Gateway", level: "info", msg: "Mission received via sealed egress" },
  { layer: "policy", agent: "PolicyAgent", level: "success", msg: "Mission within tenant policy (osint_readonly)" },
  { layer: "identity", agent: "IdentityIsolation", level: "info", msg: "Client identity stripped; acting under Altai egress" },
  { layer: "execution", agent: "Planner", level: "action", msg: "Decomposing mission → Web/Tor/Breach scouts" },
  { layer: "execution", agent: "WebScout", level: "action", msg: "Fetching open + blocked sources" },
  { layer: "execution", agent: "TorScout", level: "action", msg: "Tor circuit established; fetching .onion", meta: { exit_ip: "185.220.101.4", country: "DE", circuit: ["FR-guard", "DE-relay", "NL-exit"] } },
  { layer: "execution", agent: "BreachScout", level: "action", msg: "Cross-checking breach APIs (HIBP/IntelX)" },
  { layer: "execution", agent: "Planner", level: "success", msg: "Candidate signal synthesized from 2 independent sources" },
];

export async function runFakeFleet(mission: Mission): Promise<void> {
  for (const step of SCRIPT) {
    emitTrace({ mission_id: mission.id, ts: new Date().toISOString(), ...step });
    await sleep(600);
  }
  // Membrane + crypto attestation seal the mission (same path as the real fleet).
  membraneAndSeal(mission, heroSignal(), []);
}

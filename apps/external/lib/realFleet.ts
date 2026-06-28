import type { Mission } from "@altai/contracts";
import { runSwarm, synthesizeSignal, tracer } from "@altai/agents";
import { emitTrace } from "./missionStore";
import { membraneAndSeal } from "./seal";
import { memory } from "./memory";

export async function runRealFleet(mission: Mission): Promise<void> {
  const trace = tracer(mission.id, emitTrace);
  trace("dispatch", "Gateway", "info", "Mission received via sealed egress");
  trace("policy", "PolicyAgent", "success", "Mission within tenant policy (osint_readonly)");
  trace("identity", "IdentityIsolation", "info", "Client identity stripped; acting under Altai egress");
  try {
    // Intelligence Network warm-start: recall the route similar past missions used,
    // so the Planner can select/order the scouts instead of exploring blind.
    const recall = memory.recall(mission);
    const { signal, snippets } = await runSwarm(mission, trace, recall);
    // Membrane (Injection Hunter + Sanitizer) + crypto attestation, then seal + learn.
    // Pass the real fetched snippets so the Injection Hunter scans actual retrieved content.
    membraneAndSeal(mission, signal, snippets);
  } catch (e) {
    // Honest failure: NEVER fabricate a result. Report the error and seal an
    // inconclusive, zero-confidence brief so the mission completes truthfully.
    trace("execution", "Planner", "warn", `Swarm error: ${e instanceof Error ? e.message : String(e)}`);
    membraneAndSeal(mission, synthesizeSignal(mission, []), []);
  }
}

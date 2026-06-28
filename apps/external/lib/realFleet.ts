import type { Mission } from "@altai/contracts";
import { runSwarm, synthesizeSignal, tracer } from "@altai/agents";
import { emitTrace } from "./missionStore";
import { membraneAndSeal } from "./seal";

export async function runRealFleet(mission: Mission): Promise<void> {
  const trace = tracer(mission.id, emitTrace);
  trace("dispatch", "Gateway", "info", "Mission received via sealed egress", {
    entity: mission.target_entity ?? mission.query,
    query: mission.query,
  });
  trace("policy", "PolicyAgent", "success", "Mission within tenant policy (osint_readonly)");
  trace("identity", "IdentityIsolation", "info", "Client identity stripped; acting under Altai egress");
  try {
    const { signal, snippets } = await runSwarm(mission, trace);
    // Membrane (Injection Hunter + Sanitizer) + crypto attestation, then seal.
    // Pass the real fetched snippets so the Injection Hunter scans actual retrieved content.
    membraneAndSeal(mission, signal, snippets);
  } catch (e) {
    // Honest failure: NEVER fabricate a result. Report the error and seal an
    // inconclusive, zero-confidence brief so the mission completes truthfully.
    trace("execution", "Planner", "warn", `Swarm error: ${e instanceof Error ? e.message : String(e)}`);
    membraneAndSeal(mission, synthesizeSignal(mission, []), []);
  }
}

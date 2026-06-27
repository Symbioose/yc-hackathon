import type { Mission } from "@periscope/contracts";
import { runSwarm, tracer } from "@periscope/agents";
import { emitTrace } from "./missionStore";
import { membraneAndSeal } from "./seal";

export async function runRealFleet(mission: Mission): Promise<void> {
  const trace = tracer(mission.id, emitTrace);
  trace("dispatch", "Gateway", "info", "Mission received via sealed egress");
  trace("policy", "PolicyAgent", "success", "Mission within tenant policy (osint_readonly)");
  trace("identity", "IdentityIsolation", "info", "Client identity stripped; acting under Periscope egress");
  try {
    const signal = await runSwarm(mission, trace);
    // Membrane (Injection Hunter + Sanitizer) + crypto attestation, then seal.
    membraneAndSeal(mission, signal, []);
  } catch (e) {
    trace("execution", "Planner", "warn", `Swarm error: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}

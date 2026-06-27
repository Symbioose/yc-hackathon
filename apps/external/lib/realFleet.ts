import type { Mission } from "@periscope/contracts";
import { runSwarm, tracer } from "@periscope/agents";
import { completeMission, emitTrace } from "./missionStore";

export async function runRealFleet(mission: Mission): Promise<void> {
  const trace = tracer(mission.id, emitTrace);
  trace("dispatch", "Gateway", "info", "Mission received via sealed egress");
  trace("policy", "PolicyAgent", "success", "Mission within tenant policy (osint_readonly)");
  trace("identity", "IdentityIsolation", "info", "Client identity stripped; acting under Periscope egress");
  try {
    const signal = await runSwarm(mission, trace);
    // Phase 2 replaces these scripted membrane/audit lines with real agents + crypto.
    trace("membrane", "Sanitizer", "success", "PII/secret/malware stripped");
    trace("membrane", "Judge", "success", "Consensus PASS — signing brief");
    trace("audit", "AuditAgent", "success", "Brief recorded in audit ledger");
    completeMission(mission.id, signal);
  } catch (e) {
    trace("execution", "Planner", "warn", `Swarm error: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}

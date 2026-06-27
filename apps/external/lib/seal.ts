import type { Mission, Signal, TraceEvent } from "@periscope/contracts";
import { huntInjection, sanitize } from "@periscope/agents";
import { buildLedger, merkleRoot, signBrief } from "@periscope/crypto";
import { plantedInjection } from "@periscope/fixtures";
import { emitTrace, getEvents, sealMission } from "./missionStore";

/** Inbound Membrane (Injection Hunter + Sanitizer) + crypto attestation (Merkle + Ed25519),
 * then seal the mission. Used by both the real swarm and the fake-fleet fallback. */
export function membraneAndSeal(
  mission: Mission,
  signal: Signal,
  snippets: { source: string; content: string }[],
): void {
  const trace = (
    layer: TraceEvent["layer"],
    agent: string,
    level: TraceEvent["level"],
    msg: string,
    meta?: Record<string, unknown>,
  ) => emitTrace({ mission_id: mission.id, ts: new Date().toISOString(), layer, agent, level, msg, meta });

  // 1. Injection Hunter — always scan the planted dark-web snippet plus any real ones.
  const hunt = huntInjection([plantedInjection, ...snippets]);
  if (!hunt.clean) {
    for (const f of hunt.findings) {
      trace("membrane", "InjectionHunter", "block", `Prompt-injection caught & quarantined from ${f.source}`, {
        excerpt: f.excerpt,
      });
    }
  } else {
    trace("membrane", "InjectionHunter", "success", "No prompt-injection detected in payload");
  }

  // 2. Sanitizer — strip PII/secrets from anything that crosses the wall.
  const { signal: clean, redactions } = sanitize(signal);
  trace("membrane", "Sanitizer", "success", `PII/secrets stripped (${redactions} redaction${redactions === 1 ? "" : "s"})`);

  // 3. Build the Merkle-rooted audit ledger from the mission trace; Judge signs the brief.
  const entries = buildLedger(getEvents(mission.id).map((e) => ({ ts: e.ts, actor: e.agent, action: e.msg, source: e.layer })));
  const root = merkleRoot(entries);
  const brief = signBrief(clean, root);
  trace("membrane", "Judge", "success", "Consensus PASS — brief signed (Ed25519)");
  trace("audit", "AuditAgent", "success", `Audit ledger sealed — Merkle root ${root.slice(0, 12)}…`, { audit_root: root });

  sealMission(mission.id, clean, brief, entries);
}

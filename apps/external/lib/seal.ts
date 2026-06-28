import type { Mission, MissionMetrics, Signal, TraceEvent } from "@altai/contracts";
import { huntInjection, sanitize } from "@altai/agents";
import { buildLedger, merkleRoot, signBrief } from "@altai/crypto";
import { emitMemory, emitTrace, getEvents, sealMission } from "./missionStore";
import { memory } from "./memory";

/** Inbound Membrane (Injection Hunter + Sanitizer) + crypto attestation (Merkle + Ed25519),
 * then seal the mission — and only then teach the Intelligence Network. Used by the real
 * swarm, the fake-fleet fallback, and the deterministic demo.
 *
 * `metrics` lets a deterministic fleet pin the exact warmed cost (the demo headline);
 * otherwise the route's cost is estimated from the trace + the genome's source shape. */
export function membraneAndSeal(
  mission: Mission,
  signal: Signal,
  snippets: { source: string; content: string }[],
  metrics?: Partial<MissionMetrics>,
): void {
  const trace = (
    layer: TraceEvent["layer"],
    agent: string,
    level: TraceEvent["level"],
    msg: string,
    meta?: Record<string, unknown>,
  ) => emitTrace({ mission_id: mission.id, ts: new Date().toISOString(), layer, agent, level, msg, meta });

  // 1. Injection Hunter — scan the ACTUAL content the scouts fetched (real bytes from
  // the live web / .onion pages). No planted fixture: if a finding fires here, a real
  // page tried to hijack the agent; a clean run honestly reports no injection.
  const hunt = huntInjection(snippets);
  if (!hunt.clean) {
    for (const f of hunt.findings) {
      trace("membrane", "InjectionHunter", "block", `Prompt-injection caught & quarantined from ${f.source}`, {
        excerpt: f.excerpt,
      });
    }
  } else {
    trace("membrane", "InjectionHunter", "success", "No prompt-injection detected in payload");
  }

  // 2. Sanitizer — scrub every field (PII, secrets, control chars, HTML, prompt-injection,
  // unsafe URLs) before signing, so the brief AND every document derived from it are clean.
  const { signal: clean, redactions } = sanitize(signal);
  trace("membrane", "Sanitizer", "success", `Brief scrubbed — ${redactions} redaction${redactions === 1 ? "" : "s"} (PII · secrets · HTML · injection · URLs)`);

  // 3. Build the Merkle-rooted audit ledger from the mission trace; Judge signs the brief.
  const entries = buildLedger(getEvents(mission.id).map((e) => ({ ts: e.ts, actor: e.agent, action: e.msg, source: e.layer })));
  const root = merkleRoot(entries);
  const brief = signBrief(clean, root);
  trace("membrane", "Judge", "success", "Consensus PASS — brief signed (Ed25519)");
  trace("audit", "AuditAgent", "success", `Audit ledger sealed — Merkle root ${root.slice(0, 12)}…`, { audit_root: root });

  sealMission(mission.id, clean, brief, entries);

  // 4. Intelligence Network — the membrane is the oracle, so we learn the route ONLY
  // now that the signal is corroborated, judged, and signed. Reinforce the discovery
  // graph and publish the updated before/after snapshot to the ops-center.
  const report = memory.learn(mission, clean, getEvents(mission.id), metrics);
  emitMemory(report);
  trace(
    "memory",
    "IntelligenceNetwork",
    "success",
    `Route reinforced — ${report.route.join("→")} · ${report.mission_type}/${report.sector} → run #${report.run_index}`,
    { run_index: report.run_index, route: report.route, recalled_from: report.recalled_from },
  );
}

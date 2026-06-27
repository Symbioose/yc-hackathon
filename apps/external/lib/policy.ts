import type { Mission } from "@altai/contracts";

// Policy & governance layer (defensive / OSINT read-only).
// Enforced at the single mission ingress (POST /api/missions), so EVERY caller
// is covered: the sealed internal agent, the research MCP adapter, and any
// future agent. Out-of-policy missions are rejected before any execution.
const FORBIDDEN_INTENT = [
  "buy",
  "purchase",
  "acquire credentials",
  "download dump",
  "exfiltrate",
  "exploit",
  "ddos",
  "deface",
  "ransom",
  "malware",
  "phish",
  "credit card",
  "social security",
  "hack into",
  "break into",
  "transact",
];

export interface PolicyResult {
  ok: boolean;
  reason?: string;
}

export function checkPolicy(mission: Pick<Mission, "query" | "target_entity" | "scope">): PolicyResult {
  if (mission.scope && mission.scope !== "osint_readonly") {
    return { ok: false, reason: `Scope "${mission.scope}" not permitted — Altai is osint_readonly only.` };
  }
  const haystack = `${mission.target_entity ?? ""} ${mission.query}`.toLowerCase();
  const hit = FORBIDDEN_INTENT.find((kw) => haystack.includes(kw));
  if (hit) {
    return { ok: false, reason: `Out-of-scope intent detected ("${hit}"). Altai is defensive, read-only OSINT only.` };
  }
  return { ok: true };
}

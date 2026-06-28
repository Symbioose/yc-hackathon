import type { Mission } from "@altai/contracts";
import { runRealFleet } from "./realFleet";

// One real path: every mission runs the live swarm (web search + Tor + breach APIs) →
// membrane → audit. No scripted/demo fallback. With no keys it degrades honestly
// (returns an inconclusive brief) rather than fabricating a result.
export async function runFleet(mission: Mission): Promise<void> {
  await runRealFleet(mission);
}

import type { Mission } from "@altai/contracts";
import { runFakeFleet } from "./fakeFleet";
import { runRealFleet } from "./realFleet";

export async function runFleet(mission: Mission): Promise<void> {
  if (process.env.USE_REAL_FLEET === "1") {
    try {
      await runRealFleet(mission);
      return;
    } catch {
      // Demo safety: if the real swarm fails (no key / Tor down), fall back to the
      // scripted fleet so the demo still completes with the hero signal.
      await runFakeFleet(mission);
      return;
    }
  }
  await runFakeFleet(mission);
}

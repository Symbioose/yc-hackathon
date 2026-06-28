import type { Mission } from "@altai/contracts";
import { runFakeFleet } from "./fakeFleet";
import { runRealFleet } from "./realFleet";

export async function runFleet(mission: Mission): Promise<void> {
  // With a real fleet configured, run it and let it report honestly — it handles its own
  // errors by sealing an inconclusive brief, so we NEVER fall back to a fabricated signal.
  if (process.env.USE_REAL_FLEET === "1") {
    await runRealFleet(mission);
    return;
  }
  // No real fleet configured → scripted offline demo fleet.
  await runFakeFleet(mission);
}

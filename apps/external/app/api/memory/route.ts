import { getLastMemoryReport } from "@/lib/missionStore";
import { memory } from "@/lib/memory";

/** Resting snapshot of the Intelligence Network so the ops-center panel is populated
 * on first load (before any mission runs): the trained graph + the hero before/after.
 * Returns the last live report if one exists, else the canonical breach-intel view. */
export async function GET() {
  const last = getLastMemoryReport();
  const resting = memory.compareColdWarm({
    query: "Has the company suffered a credential breach?",
    target_entity: "Live Nation Entertainment",
    ticker: "LYV",
  });
  return Response.json({ report: last ?? resting, resting, size: memory.size() });
}

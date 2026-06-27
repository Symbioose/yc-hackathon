import { randomUUID } from "node:crypto";
import { MissionSchema } from "@altai/contracts";
import { createMission } from "@/lib/missionStore";
import { runDemoFleet } from "@/lib/demoFleet";

/** The canonical hero mission for the Intelligence Network demo (Ticketmaster / LYV).
 * The body may override it, but it defaults to the verified case so the demo always
 * lands on the locked before/after. */
const HERO_MISSION = {
  query: "Has Live Nation (Ticketmaster) suffered a credential breach?",
  target_entity: "Live Nation Entertainment",
  ticker: "LYV",
  allowed_sources: ["BreachForums", "HIBP", "IntelX"],
  data_classes: ["breach"],
  max_spend_usd: 5,
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = MissionSchema.safeParse({ ...HERO_MISSION, ...body, id: body?.id ?? randomUUID() });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const mission = parsed.data;
  createMission(mission.id);
  void runDemoFleet(mission); // fire-and-forget; deterministic cold → warmed replay
  return Response.json({ id: mission.id });
}

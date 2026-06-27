import { randomUUID } from "node:crypto";
import { MissionSchema } from "@altai/contracts";
import { createMission } from "@/lib/missionStore";
import { runFleet } from "@/lib/fleet";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = MissionSchema.safeParse({ ...body, id: body?.id ?? randomUUID() });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const mission = parsed.data;
  createMission(mission.id);
  void runFleet(mission); // fire-and-forget; real swarm or fake fleet per USE_REAL_FLEET
  return Response.json({ id: mission.id });
}

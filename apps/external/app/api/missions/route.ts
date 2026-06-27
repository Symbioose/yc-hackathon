import { randomUUID } from "node:crypto";
import { MissionSchema } from "@periscope/contracts";
import { createMission } from "@/lib/missionStore";
import { runFakeFleet } from "@/lib/fakeFleet";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = MissionSchema.safeParse({ ...body, id: body?.id ?? randomUUID() });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const mission = parsed.data;
  createMission(mission.id);
  void runFakeFleet(mission); // fire-and-forget; trace streams over /api/events
  return Response.json({ id: mission.id });
}

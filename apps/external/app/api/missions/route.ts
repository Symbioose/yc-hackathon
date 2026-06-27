import { randomUUID } from "node:crypto";
import { MissionSchema } from "@altai/contracts";
import { createMission } from "@/lib/missionStore";
import { runFleet } from "@/lib/fleet";
import { checkPolicy } from "@/lib/policy";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = MissionSchema.safeParse({ ...body, id: body?.id ?? randomUUID() });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const mission = parsed.data;

  // Policy & governance layer — reject out-of-policy missions before execution.
  const policy = checkPolicy(mission);
  if (!policy.ok) {
    return Response.json({ id: mission.id, status: "blocked", blocked_reason: policy.reason }, { status: 403 });
  }

  createMission(mission.id);
  void runFleet(mission); // fire-and-forget; real swarm or fake fleet per USE_REAL_FLEET
  return Response.json({ id: mission.id });
}

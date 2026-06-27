import { randomUUID } from "node:crypto";
import { MissionSchema } from "@periscope/contracts";

const GATEWAY = process.env.EXTERNAL_URL ?? "http://localhost:3000";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mission = MissionSchema.parse({
    id: randomUUID(),
    query: String(body?.query ?? ""),
    ticker: body?.ticker,
    target_entity: body?.target_entity,
    allowed_sources: ["BreachForums", "HIBP", "Ahmia"],
    data_classes: ["breach", "press"],
    max_spend_usd: 5,
  });
  const res = await fetch(`${GATEWAY}/api/missions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mission),
  });
  const json = await res.json();
  return Response.json(json, { status: res.status });
}

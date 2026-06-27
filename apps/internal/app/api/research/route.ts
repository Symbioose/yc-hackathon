import { runResearchMission } from "../../../lib/researchClient";

// The sealed agent's MCP egress for governed OSINT research. Drives the three
// MCP tools (dispatch → status → fetch_signal) against the research MCP adapter,
// which forwards to the real external pipeline. Returns the sealed brief, a
// policy block, or a timeout.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const entity = String(body?.entity ?? "");
  const question = String(body?.question ?? "");
  const ticker = body?.ticker ? String(body.ticker) : undefined;
  const allowed_sources = Array.isArray(body?.allowed_sources) ? body.allowed_sources.map(String) : undefined;

  try {
    const result = await runResearchMission({ entity, question, allowed_sources, ticker });
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { status: "error", error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

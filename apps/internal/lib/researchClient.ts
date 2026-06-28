// MCP client for the sealed internal agent → research MCP layer.
// Runs server-side inside the internal-app container, whose ONLY reachable
// services are on the sealed `internal` Docker network (external-app + research-mcp).
// The MCP server is a thin adapter; the real research pipeline lives in external-app.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.RESEARCH_MCP_URL ?? "http://localhost:3200/mcp";

export interface DispatchArgs {
  entity: string;
  question: string;
  allowed_sources?: string[];
  ticker?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parse(res: any): any {
  const content = (res?.content ?? []) as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: "altai-internal", version: "0.2.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  try {
    await client.connect(transport);
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Full round-trip over the three MCP tools:
 *   dispatch_research_mission → get_mission_status (poll) → fetch_signal.
 * Returns the blocked result, the sealed brief, or a timeout marker.
 */
export async function runResearchMission(args: DispatchArgs): Promise<any> {
  return withClient(async (client) => {
    const dispatched = parse(
      await client.callTool({
        name: "dispatch_research_mission",
        arguments: {
          entity: args.entity,
          question: args.question,
          allowed_sources: args.allowed_sources,
          ticker: args.ticker,
        },
      }),
    );
    if (dispatched.status !== "dispatched") return dispatched; // blocked / error
    const id = dispatched.mission_id as string;

    // Poll up to ~120s: a dark-web run does query-refinement + answer synthesis (2 LLM
    // calls) plus live Tor + page fetches, which can take well over 30s.
    for (let i = 0; i < 120; i++) {
      await sleep(1000);
      const st = parse(await client.callTool({ name: "get_mission_status", arguments: { mission_id: id } }));
      if (st.status === "completed") {
        return parse(await client.callTool({ name: "fetch_signal", arguments: { mission_id: id } }));
      }
    }
    return { mission_id: id, status: "timeout" };
  });
}

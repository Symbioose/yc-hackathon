// Altai — Research MCP server.
// Thin MCP-to-HTTP adapter over the EXISTING external research pipeline
// (apps/external). It owns no research logic, no fleet, no mock data, no audit —
// every tool call is forwarded to the external gateway over EXTERNAL_URL, so the
// MCP path and the direct HTTP path run the exact same governed pipeline.
//
// Transport: Streamable HTTP, so it runs as a normal Docker Compose service and
// any MCP-capable agent can dispatch missions.

import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const PORT = Number(process.env.MCP_PORT ?? 3200);
const EXTERNAL_URL = process.env.EXTERNAL_URL ?? "http://localhost:3000";

// Wrap any JSON payload as an MCP text result.
function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}
function err(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }], isError: true };
}

function buildServer(): McpServer {
  const server = new McpServer({ name: "altai-research-mcp", version: "0.2.0" });

  server.registerTool(
    "dispatch_research_mission",
    {
      title: "Dispatch a research mission",
      description:
        "Launch a governed OSINT research mission on the Altai external fleet. Forwards to the external " +
        "gateway, which runs policy → identity isolation → web/Tor/breach scouts → membrane → audit. " +
        "Policy is enforced server-side: out-of-scope/unsafe missions are blocked. Returns a mission_id.",
      inputSchema: {
        entity: z.string().describe("The entity/company to research."),
        question: z.string().describe("The research objective, e.g. 'is this issuer compromised?'."),
        allowed_sources: z.array(z.string()).optional().describe("Source allow-list, e.g. ['HIBP','Ahmia','press']."),
        ticker: z.string().optional().describe("Optional stock ticker (enables the lead-time/alpha overlay)."),
      },
    },
    async ({ entity, question, allowed_sources, ticker }) => {
      const res = await fetch(`${EXTERNAL_URL}/api/missions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: question,
          target_entity: entity,
          ticker,
          allowed_sources: allowed_sources ?? ["open_web", "press"],
          data_classes: ["breach", "press"],
          max_spend_usd: 5,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; blocked_reason?: string; error?: unknown };
      if (res.status === 403) {
        return ok({ status: "blocked", mission_id: json.id, blocked_reason: json.blocked_reason });
      }
      if (!res.ok) {
        return err({ status: "error", http_status: res.status, error: json.error ?? "gateway error" });
      }
      return ok({ status: "dispatched", mission_id: json.id });
    },
  );

  server.registerTool(
    "get_mission_status",
    {
      title: "Get mission status",
      description: "Check whether a dispatched mission has finished. Polls the external gateway's signal endpoint.",
      inputSchema: {
        mission_id: z.string().describe("Mission id returned by dispatch_research_mission."),
      },
    },
    async ({ mission_id }) => {
      const res = await fetch(`${EXTERNAL_URL}/api/missions/${mission_id}/signal`);
      const status = res.status === 200 ? "completed" : res.status === 202 ? "running" : "unknown";
      return ok({ mission_id, status });
    },
  );

  server.registerTool(
    "fetch_signal",
    {
      title: "Fetch the sanitized signal/brief",
      description:
        "Fetch the sanitized, signed brief for a completed mission (signal + Ed25519 attestation) plus its " +
        "Merkle-rooted audit ledger, from the external gateway.",
      inputSchema: {
        mission_id: z.string().describe("Mission id returned by dispatch_research_mission."),
      },
    },
    async ({ mission_id }) => {
      const sigRes = await fetch(`${EXTERNAL_URL}/api/missions/${mission_id}/signal`);
      if (sigRes.status === 202) return ok({ mission_id, status: "running" });
      if (!sigRes.ok) return err({ mission_id, status: "unknown", http_status: sigRes.status });
      const brief = await sigRes.json();
      let audit: unknown = undefined;
      const auditRes = await fetch(`${EXTERNAL_URL}/api/missions/${mission_id}/audit`);
      if (auditRes.ok) audit = await auditRes.json();
      return ok({ mission_id, status: "completed", brief, audit });
    },
  );

  server.registerTool(
    "export_brief_document",
    {
      title: "Export the brief as a document",
      description:
        "Generate a downloadable, provenance-stamped document from a completed mission's signed brief — " +
        "Excel (xlsx), CSV (csv), Markdown (md), the raw signed brief (json), or a STIX 2.1 bundle (stix). " +
        "Forwards to the external gateway, which sanitizes + signs the brief before rendering, so the file is " +
        "safe to open (no formula/HTML injection) and independently verifiable. Text formats return as text; " +
        "xlsx returns as an embedded base64 resource.",
      inputSchema: {
        mission_id: z.string().describe("Mission id returned by dispatch_research_mission."),
        format: z.enum(["xlsx", "csv", "md", "json", "stix"]).describe("Document format to generate."),
      },
    },
    async ({ mission_id, format }) => {
      const res = await fetch(`${EXTERNAL_URL}/api/missions/${mission_id}/export?format=${format}`);
      if (res.status === 202) return ok({ mission_id, status: "running", note: "brief not sealed yet" });
      if (!res.ok) return err({ mission_id, status: "error", http_status: res.status });

      const mime = res.headers.get("content-type") ?? "application/octet-stream";
      const disposition = res.headers.get("content-disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `altai-brief.${format}`;

      // Binary (xlsx) → embedded base64 resource; text formats → text content.
      if (format === "xlsx") {
        const blob = Buffer.from(await res.arrayBuffer()).toString("base64");
        return {
          content: [
            {
              type: "resource" as const,
              resource: { uri: `altai://mission/${mission_id}/${filename}`, mimeType: mime, blob },
            },
          ],
        };
      }
      return { content: [{ type: "text" as const, text: await res.text() }] };
    },
  );

  return server;
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "altai-research-mcp", upstream: EXTERNAL_URL });
});

// Stateless Streamable HTTP: a fresh server+transport per request.
app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});

const methodNotAllowed = (_req: express.Request, res: express.Response) =>
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.listen(PORT, () => {
  console.log(`[altai-research-mcp] MCP adapter listening on :${PORT} → upstream ${EXTERNAL_URL} (POST /mcp, GET /health)`);
});

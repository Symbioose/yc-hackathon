import { createOpenAI } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { SignedBrief } from "@altai/contracts";
import { runResearchMission } from "../../../lib/researchClient";

// Meridian Copilot — a deliberately "basic" desk agent. It has no internet and no
// market data; its ONLY real capability is the altai_research tool, which dispatches a
// governed mission to Altai (web + dark-web/Tor + breach APIs) and gets back a sanitized,
// source-cited, Ed25519-signed brief. The model decides when to call it (real tool use).
export const dynamic = "force-dynamic";
export const maxDuration = 300; // a dark-web mission (Tor + page fetches + 2 LLM calls) can run long

const openai = createOpenAI({
  // Locally the key is used directly; in Docker OPENAI_BASE_URL points at the gateway
  // proxy, which injects the real key — so the sealed container can stay keyless.
  apiKey: process.env.OPENAI_API_KEY || "sealed-proxy",
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

interface AuditEntry { seq: number; ts: string; actor: string; action: string; source?: string }
interface ResearchResult {
  mission_id?: string;
  status: "completed" | "blocked" | "timeout" | "error" | string;
  blocked_reason?: string;
  error?: string;
  brief?: SignedBrief;
  audit?: { entries: AuditEntry[]; signature_valid: boolean; ledger_ok: boolean };
}

const SYSTEM = `You are Meridian Copilot, the research assistant embedded in Meridian Capital's buy-side research terminal.

You have no direct access to the internet, to live market data, or to any external source, and your built-in knowledge is stale. You must NOT answer questions about real companies, people, prices, current events, security incidents, breaches, or leaks from memory.

You have two capabilities:
1. altai_research — dispatch a governed research mission to Altai's external fleet. It searches the open web, and for security / breach / dark-web questions also goes onto the dark web over Tor and queries breach APIs, returning a sanitized, source-cited brief signed with Ed25519 over a tamper-evident audit ledger.
2. altai_export — turn the most recent research brief into a downloadable, Ed25519-signed document: Excel (xlsx), CSV (csv), Markdown (md), JSON (json), or a STIX 2.1 bundle (stix).

Rules:
- You receive the FULL conversation history. Always use it to keep continuity and to resolve references ("it", "that one", "the France Travail one", "which one", "he"). Each prior assistant turn carries the research evidence it was based on (event type, confidence, sources) — treat that as established context.
- Answer directly from the conversation, WITHOUT calling the tool, ONLY when: it is small talk or about how you work; it is a question about the conversation itself; or the specific fact asked for is already explicitly established in an earlier turn or its research evidence (e.g. "which of those sources is official?", "what did I ask first?").
- Treat your own world knowledge as UNTRUSTED and outdated. If answering needs any real-world fact about a company, person, product, market, or event that is not already backed by research evidence in THIS conversation, you MUST call altai_research — even if you are certain you know it. Being a follow-up does NOT exempt you: e.g. after "who is the CEO of Tesla?", the follow-up "is he also running a space company?" introduces a NEW fact (SpaceX) → you must research it (query: "Elon Musk space company"), not answer from memory. Never cite [n] for anything you did not actually research this turn (refer to earlier findings in prose instead, e.g. "as found earlier, …").
- When you call the tool, call it once with a clear, self-contained query that folds in the conversation context — resolve pronouns into explicit entities (e.g. "he" → "Elon Musk"). Pass "entity" and "ticker" when relevant.
- After research returns, write a concise answer (1-4 sentences) grounded ONLY in the returned brief, citing sources inline as [1], [2] in the brief's source order. Do not re-list the sources — the terminal renders them.
- If the brief is "inconclusive" or has no sources, say plainly the sources did not confirm it. Do not fabricate. If a question is inherently speculative (e.g. exactly which stock will move), say what the evidence supports and flag the uncertainty rather than inventing specifics.
- If the mission was "blocked", explain it was blocked by Altai's policy and give the reason. If it "timed out" or "errored", say the research could not complete.
- DOCUMENTS: when the user asks for a document, file, spreadsheet, Excel, report, or export of a research result, call altai_export with the requested format(s) (default to ["xlsx"] if unspecified; map "Excel"→xlsx, "spreadsheet"→xlsx, "report"→md). NEVER say you cannot create documents — you can, via altai_export. If no research has been run yet in this conversation, ask the user to run a search first. After exporting, tell the user the document(s) are ready to download (a download button is shown); do not paste file contents.
- Be precise and professional, in the tone of a buy-side research desk. No hype, no filler.`;

/** Compact, model-facing view of a mission result (the rich brief goes to the UI separately). */
function modelView(r: ResearchResult | null) {
  if (!r) return { status: "error", error: "no result" };
  if (r.status === "blocked") return { status: "blocked", reason: r.blocked_reason ?? "policy" };
  if (r.status === "timeout") return { status: "timeout" };
  if (r.status !== "completed" || !r.brief) return { status: r.status || "error", error: r.error };
  const s = r.brief.signal;
  return {
    status: "completed",
    event_type: s.event_type,
    finding: s.summary,
    confidence: Math.round((s.confidence ?? 0) * 100) / 100,
    signature_valid: r.audit?.signature_valid ?? null,
    ledger_intact: r.audit?.ledger_ok ?? null,
    sources: (s.sources ?? []).map((src, i) => ({ ref: i + 1, name: src.name, kind: src.type, url: src.url })),
  };
}

const EXPORT_FORMATS = ["xlsx", "csv", "md", "json", "stix"] as const;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  // The mission_id of the most recent completed research in this conversation (from the
  // client) — altai_export turns that brief into downloadable documents.
  const lastMissionId = typeof body?.lastMissionId === "string" ? body.lastMissionId : "";

  // Captured from the tools' execute() closures (TS doesn't track closure assignments,
  // so a holder object keeps the declared types when read after generateText).
  const captured: {
    research: ResearchResult | null;
    toolInput: { query: string; entity?: string; ticker?: string } | null;
    exports: { format: string; url: string }[];
  } = { research: null, toolInput: null, exports: [] };

  try {
    const result = await generateText({
      model: openai.chat(process.env.OPENAI_MODEL_FAST || "gpt-4o-mini"),
      system: SYSTEM,
      messages,
      stopWhen: stepCountIs(4), // tool call → final cited answer (+ headroom)
      tools: {
        altai_research: tool({
          description:
            "Dispatch a governed OSINT research mission to Altai's external fleet (open web + dark web over Tor + breach APIs). " +
            "Returns a sanitized, source-cited, Ed25519-signed brief. Use this for any question that needs external or current facts.",
          inputSchema: z.object({
            query: z.string().describe("Full, self-contained natural-language research question."),
            entity: z.string().optional().describe("Primary company or person, e.g. 'Ticketmaster'."),
            ticker: z.string().optional().describe("Stock ticker if the entity is a public company, e.g. 'LYV'."),
          }),
          execute: async ({ query, entity, ticker }) => {
            captured.toolInput = { query, entity, ticker };
            captured.research = (await runResearchMission({
              entity: entity ?? query,
              question: query,
              ticker,
            })) as ResearchResult;
            return modelView(captured.research);
          },
        }),
        altai_export: tool({
          description:
            "Turn the most recent research brief into downloadable, Ed25519-signed documents (Excel/CSV/Markdown/JSON/STIX 2.1). " +
            "Use when the user asks for a document, file, spreadsheet, report or export of a research result.",
          inputSchema: z.object({
            formats: z
              .array(z.enum(EXPORT_FORMATS))
              .min(1)
              .describe("One or more document formats to generate (e.g. ['xlsx'] for Excel)."),
          }),
          execute: async ({ formats }) => {
            if (!lastMissionId) {
              return { ok: false, error: "No research brief to export yet — run a research mission first." };
            }
            const made = [...new Set(formats)].map((format) => {
              const url = `/bank/api/export?mission_id=${encodeURIComponent(lastMissionId)}&format=${format}`;
              captured.exports.push({ format, url });
              return format;
            });
            return { ok: true, formats: made, note: "Documents generated; download buttons are shown to the user." };
          },
        }),
      },
    });

    const text =
      result.text?.trim() || captured.research?.brief?.signal?.summary || "I couldn't produce an answer.";
    return Response.json({ text, toolInput: captured.toolInput, research: captured.research, exports: captured.exports });
  } catch (e) {
    return Response.json({
      text: `The copilot hit an error reaching the model: ${e instanceof Error ? e.message : String(e)}`,
      error: true,
      toolInput: captured.toolInput,
      research: captured.research,
      exports: captured.exports,
    });
  }
}

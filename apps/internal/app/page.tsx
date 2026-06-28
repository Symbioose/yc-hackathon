"use client";
import { useState } from "react";
import type { SignedBrief } from "@altai/contracts";

interface AuditEntry {
  seq: number;
  ts: string;
  actor: string;
  action: string;
  source?: string;
}
interface ResearchResult {
  mission_id?: string;
  status: "completed" | "blocked" | "timeout" | "error";
  blocked_reason?: string;
  error?: string;
  brief?: SignedBrief;
  audit?: {
    entries: AuditEntry[];
    signature_valid: boolean;
    ledger_ok: boolean;
  };
}

export default function SealedAgent() {
  const [q, setQ] = useState("Who is the CEO of OpenAI?");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);

  async function dispatch() {
    if (!q.trim() || busy) return;
    setResult(null);
    setBusy(true);
    setStatus("Sealed agent has no internet — researching via MCP through Altai (search → read sources → answer)…");
    try {
      const r = await fetch("/bank/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity: q, question: q }),
      });
      const json = (await r.json()) as ResearchResult;
      setResult(json);
      setStatus(
        json.status === "blocked"
          ? "Request BLOCKED by policy."
          : json.status === "completed"
            ? "Sourced, signed answer received via MCP."
            : json.status === "timeout"
              ? "Timed out waiting for the answer."
              : `Error: ${json.error ?? "unknown"}`,
      );
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const s = result?.status === "completed" ? result.brief?.signal : undefined;
  const audit = result?.status === "completed" ? result.audit : undefined;
  const missionId = result?.mission_id;
  const answered = !!s && s.event_type !== "inconclusive" && s.sources.length > 0;

  return (
    <main style={{ maxWidth: 680, margin: "40px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20 }}>🏦 Meridian Capital — Sealed Internal Agent</h1>
      <p style={{ color: "#667", fontSize: 13 }}>
        This environment has no internet. Its only egress is Altai. Ask any question — it is dispatched over MCP
        to the external pipeline (policy → web search → read sources → membrane → audit), which returns a
        sourced, signed answer.
      </p>

      <textarea
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) dispatch(); }}
        rows={2}
        placeholder="Ask anything — e.g. who is the president of France?"
        style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 8, border: "1px solid #ccd", fontSize: 15, resize: "vertical" }}
      />
      <button
        onClick={dispatch}
        disabled={busy}
        style={{
          marginTop: 10, padding: "10px 18px", borderRadius: 8, border: 0,
          background: busy ? "#9aa" : "#1a1f2b", color: "white", cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Researching…" : "Research"}
      </button>
      {status && <p style={{ marginTop: 12, color: "#445", fontSize: 13 }}>{status}</p>}

      {result?.status === "blocked" && (
        <div style={{ marginTop: 12, border: "1px solid #f3c", borderRadius: 8, padding: 16, background: "#fdecec", color: "#c0362c" }}>
          <b>⛔ BLOCKED by policy</b>
          <p style={{ margin: "6px 0 0", fontSize: 13 }}>{result.blocked_reason}</p>
        </div>
      )}

      {s && (
        <div style={{ marginTop: 12, border: "1px solid #dde", borderRadius: 8, padding: 16, background: "white" }}>
          <div style={{ fontSize: 12, color: "#889" }}>Q: {s.entity}</div>
          <p style={{ fontSize: 16, color: "#1a1f2b", margin: "8px 0 0", lineHeight: 1.5 }}>
            {answered ? s.summary : <span style={{ color: "#a05a00" }}>{s.summary}</span>}
          </p>

          {s.sources.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "#889", marginTop: 12 }}>
                Sources · confidence {(s.confidence * 100).toFixed(0)}%
              </div>
              <ol style={{ fontSize: 13, color: "#36c", margin: "4px 0 0", paddingLeft: 18 }}>
                {s.sources.map((src, i) => (
                  <li key={i}>
                    {src.url ? <a href={src.url} target="_blank" rel="noreferrer" style={{ color: "#36c" }}>{src.name}</a> : src.name}
                  </li>
                ))}
              </ol>
            </>
          )}

          {audit && (
            <div
              style={{
                marginTop: 12, padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                background: audit.signature_valid ? "#e7f6ec" : "#fdecec",
                color: audit.signature_valid ? "#1a7f37" : "#c0362c",
              }}
            >
              {audit.signature_valid
                ? `✓ Ed25519 signature valid · ledger ${audit.ledger_ok ? "intact" : "TAMPERED"}`
                : "✗ signature INVALID — do not trust this answer"}
            </div>
          )}
          {audit && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "#556" }}>
                Audit log ({audit.entries.length} entries) · {missionId}
              </summary>
              <ol style={{ fontSize: 12, color: "#667", marginTop: 6 }}>
                {audit.entries.map((e) => (
                  <li key={e.seq}><b>{e.source}</b> · {e.actor} · {e.action}</li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </main>
  );
}

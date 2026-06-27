"use client";
import { useState } from "react";
import type { SignedBrief } from "@altai/contracts";

interface BriefResult {
  brief: SignedBrief;
  verified: boolean;
}

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

export default function SealedChat() {
  const [q, setQ] = useState("Is issuer Live Nation (LYV) compromised?");
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<BriefResult | null>(null);

  // --- Research mission (MCP dispatch) state ---
  const [entity, setEntity] = useState("Live Nation");
  const [question, setQuestion] = useState("is this issuer compromised?");
  const [ticker, setTicker] = useState("LYV");
  const [rStatus, setRStatus] = useState<string>("");
  const [research, setResearch] = useState<ResearchResult | null>(null);

  async function dispatchResearch() {
    setResearch(null);
    setRStatus("Sealed agent: no internet — dispatching via MCP (dispatch → status → fetch_signal)…");
    try {
      const r = await fetch("/bank/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity,
          question,
          ticker: ticker || undefined,
          allowed_sources: ["HIBP", "Ahmia", "press"],
        }),
      });
      const json = (await r.json()) as ResearchResult;
      setResearch(json);
      setRStatus(
        json.status === "blocked"
          ? "Mission BLOCKED by policy."
          : json.status === "completed"
            ? "Sanitized, signed brief received via MCP."
            : json.status === "timeout"
              ? "Timed out waiting for brief."
              : `Error: ${json.error ?? "unknown"}`,
      );
    } catch (e) {
      setRStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function ask() {
    setResult(null);
    setStatus("Sealed agent: no internet — dispatching mission to Altai…");
    const r = await fetch("/bank/api/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: q, ticker: "LYV", target_entity: "Live Nation" }),
    });
    const { id } = await r.json();
    setStatus("Mission dispatched. Awaiting sanitized, signed brief…");
    for (let i = 0; i < 40; i++) {
      await new Promise((res) => setTimeout(res, 800));
      const sr = await fetch(`/bank/api/signal/${id}`);
      if (sr.status === 200) {
        setResult(await sr.json());
        setStatus("Brief received.");
        return;
      }
    }
    setStatus("Timed out waiting for brief.");
  }

  const s = result?.brief.signal;

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 24 }}>
      <h1 style={{ fontSize: 18 }}>🏦 Meridian Capital — Sealed Internal Agent</h1>
      <p style={{ color: "#667", fontSize: 13 }}>This environment has no internet. Its only egress is Altai.</p>
      <textarea
        value={q}
        onChange={(e) => setQ(e.target.value)}
        rows={3}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccd" }}
      />
      <button
        onClick={ask}
        style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, border: 0, background: "#1a1f2b", color: "white", cursor: "pointer" }}
      >
        Ask sealed agent
      </button>
      {status && <p style={{ marginTop: 12, color: "#445" }}>{status}</p>}
      {s && result && (
        <div style={{ marginTop: 16, border: "1px solid #dde", borderRadius: 8, padding: 16, background: "white" }}>
          <b>{s.entity} ({s.ticker})</b> — {s.event_type}
          <div>
            confidence {(s.confidence * 100).toFixed(0)}% · {s.lead_time_days} days before public disclosure
          </div>
          <p style={{ color: "#556", fontSize: 13 }}>{s.summary}</p>
          <div
            style={{
              marginTop: 8,
              padding: "6px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              background: result.verified ? "#e7f6ec" : "#fdecec",
              color: result.verified ? "#1a7f37" : "#c0362c",
            }}
          >
            {result.verified
              ? "✓ Ed25519 signature valid — provably from Altai, untampered"
              : "✗ signature INVALID — do not trust this brief"}
          </div>
        </div>
      )}

      <hr style={{ margin: "28px 0", border: 0, borderTop: "1px solid #e3e6ef" }} />

      <h2 style={{ fontSize: 16 }}>🔭 Research mission (MCP dispatch)</h2>
      <p style={{ color: "#667", fontSize: 13 }}>
        Dispatches over MCP to the research adapter, which runs the real external pipeline (policy → fleet →
        membrane → audit). Returns the sanitized, signed brief.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          placeholder="entity"
          style={{ flex: 2, padding: 8, borderRadius: 8, border: "1px solid #ccd" }}
        />
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="ticker"
          style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ccd" }}
        />
      </div>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="question"
        style={{ width: "100%", marginTop: 8, padding: 8, borderRadius: 8, border: "1px solid #ccd" }}
      />
      <button
        onClick={dispatchResearch}
        style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, border: 0, background: "#1a1f2b", color: "white", cursor: "pointer" }}
      >
        Dispatch research mission
      </button>
      {rStatus && <p style={{ marginTop: 12, color: "#445" }}>{rStatus}</p>}

      {research && research.status === "blocked" && (
        <div style={{ marginTop: 12, border: "1px solid #f3c", borderRadius: 8, padding: 16, background: "#fdecec", color: "#c0362c" }}>
          <b>⛔ BLOCKED by policy</b>
          <p style={{ margin: "6px 0 0", fontSize: 13 }}>{research.blocked_reason}</p>
        </div>
      )}

      {research && research.status === "completed" && research.brief && (
        <div style={{ marginTop: 12, border: "1px solid #dde", borderRadius: 8, padding: 16, background: "white" }}>
          <b>
            {research.brief.signal.entity}
            {research.brief.signal.ticker ? ` (${research.brief.signal.ticker})` : ""}
          </b>{" "}
          — {research.brief.signal.event_type}
          <div>
            confidence {(research.brief.signal.confidence * 100).toFixed(0)}%
            {research.brief.signal.lead_time_days != null
              ? ` · ${research.brief.signal.lead_time_days} days before public disclosure`
              : ""}
          </div>
          <p style={{ color: "#556", fontSize: 13 }}>{research.brief.signal.summary}</p>
          {research.audit && (
            <div
              style={{
                marginTop: 8,
                padding: "6px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                background: research.audit.signature_valid ? "#e7f6ec" : "#fdecec",
                color: research.audit.signature_valid ? "#1a7f37" : "#c0362c",
              }}
            >
              {research.audit.signature_valid
                ? "✓ Ed25519 signature valid · ledger " + (research.audit.ledger_ok ? "intact" : "TAMPERED")
                : "✗ signature INVALID — do not trust this brief"}
            </div>
          )}
          {research.audit && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "#556" }}>
                Audit log ({research.audit.entries.length} entries) · {research.mission_id}
              </summary>
              <ol style={{ fontSize: 12, color: "#667", marginTop: 6 }}>
                {research.audit.entries.map((e) => (
                  <li key={e.seq}>
                    <b>{e.source}</b> · {e.actor} · {e.action}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </main>
  );
}

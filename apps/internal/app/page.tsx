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
  const [entity, setEntity] = useState("Live Nation");
  const [ticker, setTicker] = useState("LYV");
  const [question, setQuestion] = useState("Has this issuer suffered a data breach?");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);

  async function dispatch() {
    if (!entity.trim() || busy) return;
    setResult(null);
    setBusy(true);
    setStatus("Sealed agent has no internet — dispatching via MCP to Altai (dispatch → poll → fetch signal)…");
    try {
      const r = await fetch("/bank/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity,
          question,
          ticker: ticker || undefined,
          allowed_sources: ["open_web", "Ahmia", "HIBP"],
        }),
      });
      const json = (await r.json()) as ResearchResult;
      setResult(json);
      setStatus(
        json.status === "blocked"
          ? "Mission BLOCKED by policy."
          : json.status === "completed"
            ? "Sanitized, signed brief received via MCP."
            : json.status === "timeout"
              ? "Timed out waiting for the brief."
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

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20 }}>🏦 Meridian Capital — Sealed Internal Agent</h1>
      <p style={{ color: "#667", fontSize: 13 }}>
        This environment has no internet. Its only egress is Altai. Research is dispatched over MCP to the
        external pipeline (policy → web/Tor/breach scouts → membrane → audit), which returns a sanitized,
        signed brief.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          placeholder="entity (e.g. Live Nation)"
          style={{ flex: 2, padding: 10, borderRadius: 8, border: "1px solid #ccd" }}
        />
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="ticker (optional)"
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ccd" }}
        />
      </div>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="research question"
        style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 8, border: "1px solid #ccd" }}
      />
      <button
        onClick={dispatch}
        disabled={busy}
        style={{
          marginTop: 10, padding: "10px 18px", borderRadius: 8, border: 0,
          background: busy ? "#9aa" : "#1a1f2b", color: "white", cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Researching…" : "Dispatch research mission"}
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
          <b>{s.entity}{s.ticker ? ` (${s.ticker})` : ""}</b> — {s.event_type}
          <div style={{ marginTop: 4 }}>
            confidence {(s.confidence * 100).toFixed(0)}% · {s.sources.length} corroborating source(s)
          </div>
          {s.sources.length > 0 && (
            <ul style={{ fontSize: 12, color: "#667", margin: "6px 0 0", paddingLeft: 18 }}>
              {s.sources.map((src, i) => (
                <li key={i}>{src.name} · {src.type} · {src.reliability.toFixed(2)}</li>
              ))}
            </ul>
          )}
          <p style={{ color: "#556", fontSize: 13, marginTop: 8 }}>{s.summary}</p>
          {audit && (
            <div
              style={{
                marginTop: 8, padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                background: audit.signature_valid ? "#e7f6ec" : "#fdecec",
                color: audit.signature_valid ? "#1a7f37" : "#c0362c",
              }}
            >
              {audit.signature_valid
                ? `✓ Ed25519 signature valid · ledger ${audit.ledger_ok ? "intact" : "TAMPERED"}`
                : "✗ signature INVALID — do not trust this brief"}
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

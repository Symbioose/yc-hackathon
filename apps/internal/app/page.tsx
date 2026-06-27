"use client";
import { useState } from "react";
import type { SignedBrief } from "@altai/contracts";

interface BriefResult {
  brief: SignedBrief;
  verified: boolean;
}

export default function SealedChat() {
  const [q, setQ] = useState("Is issuer Live Nation (LYV) compromised?");
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<BriefResult | null>(null);

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
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";
import type { AuditEntry, Signal, TraceEvent } from "@periscope/contracts";

const LAYER_COLOR: Record<string, string> = {
  dispatch: "#7aa2f7", policy: "#e0af68", identity: "#9ece6a",
  execution: "#7dcfff", membrane: "#bb9af7", audit: "#f7768e",
};

interface AuditState {
  entries: AuditEntry[];
  audit_root: string;
  signature: string;
  signature_valid: boolean;
  ledger_ok: boolean;
}

export default function OpsCenter() {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditState | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("trace", (e) => setEvents((p) => [...p, JSON.parse((e as MessageEvent).data)]));
    es.addEventListener("signal", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setSignal(d.signal);
      setMissionId(d.id);
    });
    return () => es.close();
  }, []);

  useEffect(() => {
    if (!missionId) return;
    let tries = 0;
    const load = async () => {
      const r = await fetch(`/api/missions/${missionId}/audit`);
      if (r.status === 200) { setAudit(await r.json()); return; }
      if (tries++ < 12) setTimeout(load, 500);
    };
    void load();
  }, [missionId]);

  async function tamper() {
    if (!missionId) return;
    const idx = Math.min(1, (audit?.entries.length ?? 1) - 1);
    const r = await fetch(`/api/missions/${missionId}/tamper`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idx, patch: { action: "⚠ EVIDENCE ALTERED" } }),
    });
    if (r.ok) setAudit(await r.json());
  }

  const verified = !!audit && audit.signature_valid && audit.ledger_ok;

  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, padding: 24, minHeight: "100vh" }}>
      <section>
        <h1 style={{ fontSize: 18, letterSpacing: 2 }}>🔭 PERISCOPE — OPS CENTER</h1>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {events.map((ev, i) => (
            <div key={i} style={{ fontSize: 13 }}>
              <span style={{ color: LAYER_COLOR[ev.layer] ?? "#888", textTransform: "uppercase" }}>[{ev.layer}]</span>{" "}
              <b style={{ color: ev.level === "block" ? "#f7768e" : undefined }}>{ev.agent}</b> — {ev.msg}
              {ev.meta?.exit_ip ? (
                <span style={{ color: "#9ece6a" }}> · exit {String(ev.meta.exit_ip)}{ev.meta.country ? ` (${String(ev.meta.country)})` : ""}</span>
              ) : null}
            </div>
          ))}
          {events.length === 0 && <em style={{ color: "#566" }}>Waiting for a dispatched mission…</em>}
        </div>
      </section>

      <aside>
        <h2 style={{ fontSize: 14, color: "#888" }}>SIGNAL</h2>
        {signal ? (
          <div style={{ border: "1px solid #233", borderRadius: 8, padding: 16, background: "#0d131c" }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{signal.entity} {signal.ticker ? `(${signal.ticker})` : ""}</div>
            <div style={{ marginTop: 8 }}>event: <b>{signal.event_type}</b></div>
            <div>confidence: <b>{(signal.confidence * 100).toFixed(0)}%</b> <span style={{ color: "#566" }}>({signal.confidence_method})</span></div>
            <div>observed: {signal.observed_at} · disclosed: {signal.disclosed_at}</div>
            {signal.lead_time_days != null && (
              <div style={{ marginTop: 8, fontSize: 22, color: "#e0af68" }}>{signal.lead_time_days} days early</div>
            )}
            <p style={{ color: "#9aa", fontSize: 12 }}>{signal.summary}</p>
            <div style={{ marginTop: 8, fontSize: 11, color: "#566" }}>
              sources: {signal.sources.map((s) => `${s.name}(${s.reliability})`).join(" + ")}
            </div>
          </div>
        ) : (
          <em style={{ color: "#566" }}>No signal yet.</em>
        )}

        <h2 style={{ fontSize: 14, color: "#888", marginTop: 20 }}>AUDIT LEDGER</h2>
        {audit ? (
          <div style={{ border: `1px solid ${verified ? "#234" : "#f7768e"}`, borderRadius: 8, padding: 12, background: "#0d131c" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: verified ? "#9ece6a" : "#f7768e" }}>
              {verified ? "✓ Ed25519 valid · Merkle ledger intact" : "✗ TAMPER DETECTED — Merkle root mismatch"}
            </div>
            <div style={{ fontSize: 10, color: "#566", marginTop: 4, wordBreak: "break-all" }}>root {audit.audit_root.slice(0, 28)}…</div>
            <div style={{ marginTop: 8, maxHeight: 150, overflow: "auto", fontSize: 11 }}>
              {audit.entries.map((e) => (
                <div key={e.seq} style={{ color: e.action.includes("ALTERED") ? "#f7768e" : "#9aa" }}>
                  #{e.seq} <b>{e.actor}</b>: {e.action}
                </div>
              ))}
            </div>
            <button
              onClick={tamper}
              style={{ marginTop: 8, fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #f7768e", background: "transparent", color: "#f7768e", cursor: "pointer" }}
            >
              ⚠ Tamper with an entry (demo)
            </button>
          </div>
        ) : (
          <em style={{ color: "#566" }}>No audit yet.</em>
        )}
      </aside>
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";
import type { AuditEntry, Signal, SourceContribution, TraceEvent } from "@altai/contracts";

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
interface PricePoint { date: string; close: number; }

// --- Stock overlay: the hero beat. Closes + two markers (leak vs disclosure) ---
function StockChart({ series, observed, disclosed }: { series: PricePoint[]; observed?: string; disclosed?: string }) {
  if (series.length < 2) return null;
  const W = 380, H = 150, pad = 28;
  const ts = series.map((p) => +new Date(p.date));
  const cs = series.map((p) => p.close);
  const minT = Math.min(...ts), maxT = Math.max(...ts);
  const minC = Math.min(...cs), maxC = Math.max(...cs);
  const x = (d: string) => pad + ((+new Date(d) - minT) / (maxT - minT || 1)) * (W - 2 * pad);
  const y = (c: number) => pad + (1 - (c - minC) / (maxC - minC || 1)) * (H - 2 * pad);
  const poly = series.map((p) => `${x(p.date).toFixed(1)},${y(p.close).toFixed(1)}`).join(" ");
  const marker = (d: string | undefined, color: string, label: string) => {
    if (!d) return null;
    const mx = Math.max(pad, Math.min(W - pad, x(d)));
    return (
      <g>
        <line x1={mx} y1={pad - 6} x2={mx} y2={H - pad} stroke={color} strokeWidth={1} strokeDasharray="3 3" />
        <text x={mx} y={pad - 9} fill={color} fontSize={9} textAnchor="middle">{label}</text>
      </g>
    );
  };
  return (
    <svg width={W} height={H} style={{ background: "#0a0f17", borderRadius: 8, marginTop: 8 }}>
      <text x={pad} y={y(maxC) - 4} fill="#566" fontSize={9}>{maxC.toFixed(2)}</text>
      <text x={pad} y={y(minC) + 10} fill="#566" fontSize={9}>{minC.toFixed(2)}</text>
      <polyline points={poly} fill="none" stroke="#7dcfff" strokeWidth={1.5} />
      {marker(observed, "#e0af68", "leak")}
      {marker(disclosed, "#f7768e", "public")}
    </svg>
  );
}

// --- Confidence fusion: noisy-OR breakdown, so it reads as a signal engine ---
function FusionBars({ sources, confidence }: { sources: SourceContribution[]; confidence: number }) {
  return (
    <div style={{ marginTop: 8 }}>
      {sources.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, marginTop: 2 }}>
          <span style={{ width: 110, color: "#9aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
          <div style={{ flex: 1, height: 6, background: "#1a2230", borderRadius: 3 }}>
            <div style={{ width: `${s.reliability * 100}%`, height: 6, background: "#7dcfff", borderRadius: 3 }} />
          </div>
          <span style={{ color: "#566", width: 28, textAlign: "right" }}>{s.reliability.toFixed(2)}</span>
        </div>
      ))}
      <div style={{ marginTop: 4, fontSize: 11, color: "#9ece6a" }}>
        fused (noisy-OR) = <b>{(confidence * 100).toFixed(0)}%</b>
      </div>
    </div>
  );
}

export default function OpsCenter() {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditState | null>(null);
  const [prices, setPrices] = useState<PricePoint[]>([]);

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
    if (!signal?.ticker) return;
    fetch(`/api/prices/${encodeURIComponent(signal.ticker)}`)
      .then((r) => (r.ok ? r.json() : { series: [] }))
      .then((d) => setPrices(d.series ?? []))
      .catch(() => setPrices([]));
  }, [signal?.ticker]);

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
  const alpha = signal?.alpha;

  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 16, padding: 24, minHeight: "100vh" }}>
      <section>
        <h1 style={{ fontSize: 18, letterSpacing: 2 }}>🔭 ALTAI — OPS CENTER</h1>
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
            <div>observed: {signal.observed_at} · disclosed: {signal.disclosed_at}</div>
            {signal.lead_time_days != null && (
              <div style={{ marginTop: 8, fontSize: 22, color: "#e0af68" }}>{signal.lead_time_days} days before the market</div>
            )}

            {/* Hero overlay: closes with leak vs public-disclosure markers */}
            <StockChart series={prices} observed={signal.observed_at} disclosed={signal.disclosed_at} />

            {/* AlphaCard: turns threat-intel into a tradeable signal (QRT language) */}
            {alpha && (
              <div style={{ marginTop: 8, border: "1px solid #243", borderRadius: 6, padding: 10, background: "#0a0f17" }}>
                <div style={{ fontSize: 11, color: "#888", letterSpacing: 1 }}>ALPHA</div>
                <div style={{ fontSize: 12, color: "#9aa" }}>{alpha.strategy}</div>
                {alpha.entry_price != null && alpha.exit_price != null && (
                  <div style={{ fontSize: 12 }}>
                    {alpha.entry_date} @ {alpha.entry_price} → {alpha.exit_date} @ {alpha.exit_price}
                  </div>
                )}
                {alpha.return_pct != null && (
                  <div style={{ fontSize: 20, fontWeight: 700, color: alpha.return_pct >= 0 ? "#9ece6a" : "#f7768e" }}>
                    {alpha.return_pct >= 0 ? "+" : ""}{alpha.return_pct}% short
                  </div>
                )}
                {alpha.note && <div style={{ fontSize: 10, color: "#566", marginTop: 2 }}>{alpha.note}</div>}
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 11, color: "#888" }}>CONFIDENCE</div>
            <FusionBars sources={signal.sources} confidence={signal.confidence} />

            <p style={{ color: "#9aa", fontSize: 12, marginTop: 8 }}>{signal.summary}</p>
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

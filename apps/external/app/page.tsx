"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { AuditEntry, MemoryReport, RouteEdge, Signal, SourceContribution, TraceEvent } from "@altai/contracts";
import type { MissionControlHandle } from "./components/MissionControl";

const MissionControl = dynamic(() => import("./components/MissionControl"), { ssr: false });

const LAYER_COLOR: Record<string, string> = {
  dispatch: "#36e0ff", policy: "#ffcf4d", identity: "#5dff9b",
  execution: "#36e0ff", membrane: "#b78bff", audit: "#5dff9b", memory: "#ff6ad5",
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
  const W = 388, H = 150, pad = 28;
  const ts = series.map((p) => +new Date(p.date));
  const cs = series.map((p) => p.close);
  const minT = Math.min(...ts), maxT = Math.max(...ts);
  const minC = Math.min(...cs), maxC = Math.max(...cs);
  const x = (d: string) => pad + ((+new Date(d) - minT) / (maxT - minT || 1)) * (W - 2 * pad);
  const y = (c: number) => pad + (1 - (c - minC) / (maxC - minC || 1)) * (H - 2 * pad);
  const poly = series.map((p) => `${x(p.date).toFixed(1)},${y(p.close).toFixed(1)}`).join(" ");
  const marker = (d: string | undefined, color: string, lbl: string) => {
    if (!d) return null;
    const mx = Math.max(pad, Math.min(W - pad, x(d)));
    return (
      <g>
        <line x1={mx} y1={pad - 6} x2={mx} y2={H - pad} stroke={color} strokeWidth={1} strokeDasharray="3 3" />
        <text x={mx} y={pad - 9} fill={color} fontSize={8} textAnchor="middle" className="pixel">{lbl}</text>
      </g>
    );
  };
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: "#070b14", border: "1px solid var(--line)", marginTop: 8 }}>
      <text x={pad} y={y(maxC) - 4} fill="#5b6b8c" fontSize={9}>{maxC.toFixed(2)}</text>
      <text x={pad} y={y(minC) + 10} fill="#5b6b8c" fontSize={9}>{minC.toFixed(2)}</text>
      <polyline points={poly} fill="none" stroke="#36e0ff" strokeWidth={1.5} />
      {marker(observed, "#ffcf4d", "LEAK")}
      {marker(disclosed, "#ff4d6d", "PUBLIC")}
    </svg>
  );
}

function FusionBars({ sources, confidence }: { sources: SourceContribution[]; confidence: number }) {
  return (
    <div style={{ marginTop: 8 }}>
      {sources.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, marginTop: 3 }}>
          <span style={{ width: 110, color: "#9aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
          <div style={{ flex: 1, height: 8, background: "#0a1120", border: "1px solid var(--line)" }}>
            <div style={{ width: `${s.reliability * 100}%`, height: "100%", background: "#36e0ff" }} />
          </div>
          <span style={{ color: "#5b6b8c", width: 28, textAlign: "right" }}>{s.reliability.toFixed(2)}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: 11, color: "#5dff9b" }}>
        fused (noisy-OR) = <b>{(confidence * 100).toFixed(0)}%</b>
      </div>
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 9, color: "#5b6b8c", letterSpacing: 2, margin: "0 0 8px",
};
const card: React.CSSProperties = {
  border: "1px solid var(--line)", background: "#0a1120", padding: 14,
};

// ===================== INTELLIGENCE NETWORK ("Signal DNA") =====================
const SRC_LABEL: Record<string, string> = {
  tor_forum: "TOR", breach_api: "BREACH", paste: "PASTE", press: "PRESS", filing: "FILING", START: "START",
};
const COLD_ORDER = ["press", "paste", "filing", "tor_forum", "breach_api"];

const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 ? 1 : 0)}s` : `${ms}ms`);
const fmtCost = (c: number) => `$${c.toFixed(2)}`;
const fmtConf = (c: number) => c.toFixed(2);

// one before→after row: cold (amber) → warmed (green) + delta chip
function NetMetric({ label, cold, warmed, format, lowerBetter, pending }: {
  label: string; cold: number; warmed: number; format: (n: number) => string; lowerBetter: boolean; pending: boolean;
}) {
  const improved = lowerBetter ? warmed < cold : warmed > cold;
  const deltaPct = cold ? Math.round(((warmed - cold) / cold) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "3px 0" }}>
      <span className="pixel" style={{ width: 58, color: "#5b6b8c", fontSize: 8 }}>{label}</span>
      <span style={{ width: 52, textAlign: "right", color: "#ffcf4d" }}>{format(cold)}</span>
      <span style={{ color: "#5b6b8c" }}>→</span>
      {pending ? (
        <span style={{ flex: 1, color: "#5b6b8c" }} className="blink">recall…</span>
      ) : (
        <>
          <span key={warmed} className="pop" style={{ minWidth: 52, color: "#5dff9b", fontWeight: 700 }}>{format(warmed)}</span>
          {deltaPct !== 0 && (
            <span className="pixel" style={{
              marginLeft: "auto", fontSize: 8, padding: "2px 5px",
              color: improved ? "#5dff9b" : "#ff4d6d", border: `1px solid ${improved ? "#1f7a4d" : "#8a1f33"}`,
            }}>{deltaPct > 0 ? "+" : ""}{deltaPct}%</span>
          )}
        </>
      )}
    </div>
  );
}

// the 5 source types; warmed route lit green, skipped ones struck through
function RouteFlow({ route, cold }: { route: string[]; cold: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginTop: 4 }}>
      {COLD_ORDER.map((s) => {
        const on = cold ? true : route.includes(s);
        return (
          <span key={s} className="pixel" style={{
            fontSize: 8, padding: "4px 6px",
            color: cold ? "#ffcf4d" : on ? "#5dff9b" : "#445",
            border: `1px solid ${cold ? "#8a6a14" : on ? "#1f7a4d" : "#1b2740"}`,
            background: on && !cold ? "rgba(93,255,155,0.08)" : "transparent",
            textDecoration: !cold && !on ? "line-through" : "none",
            opacity: !cold && !on ? 0.5 : 1,
          }}>{SRC_LABEL[s]}</span>
        );
      })}
      <span style={{ marginLeft: "auto", fontSize: 9, color: cold ? "#ffcf4d" : "#5dff9b" }} className="pixel">
        {cold ? "5 BLIND" : `${route.length} RECALLED`}
      </span>
    </div>
  );
}

// the learned graph: top rewarded edges (the membrane is the reward oracle)
function EdgeBars({ edges }: { edges: RouteEdge[] }) {
  const top = edges.slice(0, 4);
  const max = Math.max(0.01, ...top.map((e) => Math.abs(e.reward)));
  return (
    <div style={{ marginTop: 6 }}>
      {top.map((e, i) => {
        const pos = e.reward >= 0;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, marginTop: 3 }}>
            <span className="pixel" style={{ width: 104, color: "#9aa", fontSize: 7 }}>
              {(SRC_LABEL[e.from] ?? e.from)}→{SRC_LABEL[e.to]}
            </span>
            <div style={{ flex: 1, height: 7, background: "#0a1120", border: "1px solid var(--line)" }}>
              <div style={{ width: `${(Math.abs(e.reward) / max) * 100}%`, height: "100%", background: pos ? "#5dff9b" : "#ff4d6d" }} />
            </div>
            <span style={{ width: 60, textAlign: "right", color: "#5b6b8c" }}>{e.reward.toFixed(2)}·{e.visits}×</span>
          </div>
        );
      })}
    </div>
  );
}

// Agent deliverables — the signed brief materialized as downloadable files. Kept as a
// plain client-side list so the server-only @altai/artifacts package (node:crypto,
// exceljs) never leaks into the browser bundle; the bytes are generated by the gateway.
const EXPORTS: { format: string; label: string; hint: string }[] = [
  { format: "xlsx", label: "Excel", hint: "Multi-sheet .xlsx workbook" },
  { format: "csv", label: "CSV", hint: "Sources table" },
  { format: "md", label: "Markdown", hint: "Human-readable brief" },
  { format: "json", label: "JSON", hint: "Full signed brief" },
  { format: "stix", label: "STIX 2.1", hint: "SIEM/TIP bundle" },
];

function Deliverables({ missionId }: { missionId: string }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="pixel" style={{ fontSize: 8, color: "#5b6b8c", marginBottom: 6 }}>DELIVERABLES — AGENT-GENERATED FILES</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {EXPORTS.map((e) => (
          <a
            key={e.format}
            href={`/api/missions/${missionId}/export?format=${e.format}`}
            title={e.hint}
            className="pixel"
            style={{
              fontSize: 8, padding: "6px 8px", textDecoration: "none", cursor: "pointer",
              color: "#36e0ff", border: "1px solid #1c7f99", background: "rgba(54,224,255,0.06)",
            }}
          >
            ↓ {e.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// "Don't trust — verify." Drop an exported brief.json and the gateway re-checks its
// Ed25519 signature against the public key embedded in the file. No mission lookup,
// no shared secret — the proof travels with the artifact.
interface VerifyResult { ok?: boolean; error?: string; signature_valid?: boolean; public_key_fingerprint?: string; entity?: string; event_type?: string; }

function VerifyBrief() {
  const [res, setRes] = useState<VerifyResult | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function verify(text: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: text });
      setRes(await r.json());
    } catch {
      setRes({ ok: false, error: "Could not read that file" });
    } finally {
      setBusy(false);
    }
  }
  const onFile = (f?: File | null) => { if (f) void f.text().then(verify); };

  const authentic = res?.ok !== false && res?.signature_valid === true;
  const forged = res?.ok !== false && res?.signature_valid === false;

  return (
    <div style={card}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
        onClick={() => fileRef.current?.click()}
        onPaste={(e) => verify(e.clipboardData.getData("text"))}
        tabIndex={0}
        style={{
          border: `1px dashed ${drag ? "#36e0ff" : "#2f4670"}`, padding: 16, textAlign: "center", cursor: "pointer",
          fontSize: 11, color: drag ? "#36e0ff" : "#8a97b5", background: drag ? "rgba(54,224,255,0.06)" : "transparent",
        }}
      >
        {busy ? "verifying…" : "⬇ drop a brief.json · click to choose · or paste"}
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} />
      {res && (
        <div style={{ marginTop: 10 }}>
          {res.ok === false ? (
            <div className="pixel" style={{ fontSize: 9, color: "#ff4d6d" }}>✗ {res.error ?? "INVALID FILE"}</div>
          ) : (
            <>
              <div className="pixel" style={{ fontSize: 10, color: authentic ? "#5dff9b" : "#ff4d6d" }}>
                {authentic ? "✓ AUTHENTIC · Ed25519 VERIFIED" : "✗ FORGED · SIGNATURE MISMATCH"}
              </div>
              {res.entity && <div style={{ fontSize: 11, color: "#9aa", marginTop: 6 }}>{res.entity} · {res.event_type}</div>}
              {res.public_key_fingerprint && (
                <div style={{ fontSize: 9, color: "#5b6b8c", marginTop: 4, wordBreak: "break-all" }}>
                  signer {res.public_key_fingerprint.slice(0, 27)}…
                </div>
              )}
              {forged && <div style={{ fontSize: 9, color: "#ff4d6d", marginTop: 4 }}>this file was altered after signing.</div>}
            </>
          )}
        </div>
      )}
      <div style={{ fontSize: 9, color: "#5b6b8c", marginTop: 8 }}>
        Tip: download a brief above, change one value, re-drop it — verification fails.
      </div>
    </div>
  );
}

function IntelNetwork({ report, onDemo, running }: { report: MemoryReport | null; onDemo: () => void; running: boolean }) {
  const cold = !!report && report.recalled_from === 0; // demo cold phase / true cold start
  return (
    <div style={{ ...card, borderColor: report && !cold ? "#1f7a4d" : "var(--line)" }} className={report && !cold ? "net-learned" : undefined}>
      {report ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="pixel" style={{ fontSize: 12, color: cold ? "#ffcf4d" : "#5dff9b" }}>
              {cold ? "RUN #1 · COLD" : `#1 → #${report.run_index}`}
            </div>
            <div style={{ fontSize: 9, color: "#5b6b8c" }}>{report.mission_type} · {report.sector}</div>
          </div>
          <div style={{ fontSize: 10, color: "#8a97b5", marginTop: 6 }}>
            {cold
              ? "no recalled route — exploring all sources blind"
              : `procedural memory recalled the route from ${report.recalled_from} similar missions`}
          </div>

          <div style={{ marginTop: 10 }}>
            <NetMetric label="HOPS" cold={report.cold.hops} warmed={report.warmed.hops} format={(n) => `${n}`} lowerBetter pending={cold} />
            <NetMetric label="LATENCY" cold={report.cold.latency_ms} warmed={report.warmed.latency_ms} format={fmtMs} lowerBetter pending={cold} />
            <NetMetric label="COST" cold={report.cold.cost_usd} warmed={report.warmed.cost_usd} format={fmtCost} lowerBetter pending={cold} />
            <NetMetric label="CONF" cold={report.cold.confidence} warmed={report.warmed.confidence} format={fmtConf} lowerBetter={false} pending={cold} />
          </div>

          <div className="pixel" style={{ marginTop: 12, fontSize: 8, color: "#5b6b8c" }}>LEARNED ROUTE</div>
          <RouteFlow route={report.route} cold={cold} />

          <div className="pixel" style={{ marginTop: 12, fontSize: 8, color: "#5b6b8c" }}>REWARDED EDGES · MEMBRANE = ORACLE</div>
          <EdgeBars edges={report.edges} />

          {report.roi && report.roi.missions > 0 && (
            <div style={{ marginTop: 12, padding: "8px 10px", border: "1px solid #1f7a4d", background: "rgba(93,255,155,0.05)", fontSize: 10, color: "#9aa" }}>
              <span className="pixel" style={{ fontSize: 8, color: "#5dff9b" }}>NETWORK ROI</span> — saved{" "}
              <b style={{ color: "#5dff9b" }}>${report.roi.saved_usd.toFixed(2)}</b> ·{" "}
              <b style={{ color: "#5dff9b" }}>{Math.round(report.roi.saved_latency_ms / 1000)}s</b> ·{" "}
              <b style={{ color: "#5dff9b" }}>{report.roi.saved_hops}</b> hops across{" "}
              <b style={{ color: "#c8d6f5" }}>{report.roi.missions}</b> signed missions
            </div>
          )}
        </>
      ) : (
        <div style={{ color: "#5b6b8c", fontSize: 12 }} className="blink">network warming up…</div>
      )}
      <button
        onClick={onDemo}
        disabled={running}
        className="pixel"
        style={{
          marginTop: 12, width: "100%", fontSize: 9, padding: "10px 12px",
          cursor: running ? "wait" : "pointer",
          border: `1px solid ${running ? "#1b2740" : "#1f7a4d"}`,
          background: running ? "transparent" : "rgba(93,255,155,0.06)",
          color: running ? "#5b6b8c" : "#5dff9b",
        }}
      >
        {running ? "▶ REPLAYING COLD → WARMED…" : "▶ RUN INTELLIGENCE DEMO · COLD → WARMED"}
      </button>
    </div>
  );
}

export default function OpsCenter() {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditState | null>(null);
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [memory, setMemory] = useState<MemoryReport | null>(null);
  const [muted, setMuted] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const mc = useRef<MissionControlHandle>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("trace", (e) => setEvents((p) => [...p, JSON.parse((e as MessageEvent).data)]));
    es.addEventListener("signal", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setSignal(d.signal);
      setMissionId(d.id);
      setDemoRunning(false); // a sealed signal ends a demo run
    });
    es.addEventListener("memory", (e) => setMemory(JSON.parse((e as MessageEvent).data)));
    return () => es.close();
  }, []);

  // resting snapshot so the network panel is populated on first load
  useEffect(() => {
    fetch("/api/memory")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.report && setMemory((m) => m ?? d.report))
      .catch(() => {});
  }, []);

  async function runDemo() {
    if (demoRunning) return;
    mc.current?.unlockAudio();
    setDemoRunning(true);
    if (demoTimer.current) clearTimeout(demoTimer.current);
    demoTimer.current = setTimeout(() => setDemoRunning(false), 20000); // safety re-enable
    await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => setDemoRunning(false));
  }

  // reset panels when a fresh mission is dispatched
  useEffect(() => {
    const last = events[events.length - 1];
    if (last?.layer === "dispatch") {
      setSignal(null);
      setAudit(null);
      setPrices([]);
    }
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [events]);

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
    mc.current?.tamper();
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
    <main
      onClick={() => mc.current?.unlockAudio()}
      style={{ display: "grid", gridTemplateColumns: "1fr 440px", height: "100vh", width: "100vw" }}
    >
      {/* ===================== LEFT: living pixel mission control ===================== */}
      <section style={{ position: "relative", overflow: "hidden", borderRight: "1px solid var(--line)" }}>
        <MissionControl ref={mc} events={events} muted={muted} />

        {/* header overlay */}
        <div style={{ position: "absolute", top: 14, left: 16, zIndex: 10, pointerEvents: "none" }}>
          <div className="pixel" style={{ fontSize: 14, color: "#36e0ff", textShadow: "0 0 12px rgba(54,224,255,.6)" }}>
            ALTAI
          </div>
          <div className="pixel" style={{ fontSize: 8, color: "#5b6b8c", marginTop: 6 }}>MISSION CONTROL</div>
        </div>

        {/* mute toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); mc.current?.unlockAudio(); setMuted((m) => !m); }}
          className="pixel"
          style={{
            position: "absolute", top: 14, right: 16, zIndex: 10, fontSize: 8,
            padding: "8px 10px", background: "#0a1120", color: muted ? "#5b6b8c" : "#5dff9b",
            border: `1px solid ${muted ? "var(--line)" : "#1f7a4d"}`, cursor: "pointer",
          }}
        >
          {muted ? "SFX OFF" : "SFX ON"}
        </button>

        {/* live event log */}
        <div
          ref={logRef}
          style={{
            position: "absolute", bottom: 14, left: 16, right: 16, maxHeight: 132, zIndex: 10,
            overflow: "auto", background: "rgba(7,11,20,.78)", border: "1px solid var(--line)",
            padding: "8px 10px", fontSize: 11, lineHeight: 1.5, backdropFilter: "blur(2px)",
          }}
        >
          {events.length === 0 ? (
            <span style={{ color: "#5b6b8c" }} className="blink">▌ awaiting dispatch from sealed environment…</span>
          ) : (
            events.slice(-30).map((ev, i) => (
              <div key={i}>
                <span className="pixel" style={{ fontSize: 7, color: LAYER_COLOR[ev.layer] ?? "#888" }}>
                  [{ev.layer.toUpperCase()}]
                </span>{" "}
                <b style={{ color: ev.level === "block" ? "#ff4d6d" : "#c8d6f5" }}>{ev.agent}</b>
                <span style={{ color: "#8a97b5" }}> — {ev.msg}</span>
                {ev.meta?.exit_ip ? (
                  <span style={{ color: "#b78bff" }}> · exit {String(ev.meta.exit_ip)}{ev.meta.country ? ` (${String(ev.meta.country)})` : ""}</span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      {/* ===================== RIGHT: sober proof panels ===================== */}
      <aside style={{ overflowY: "auto", padding: 18, background: "#070b14" }}>
        <h2 className="pixel" style={{ ...sectionTitle, color: "#5dff9b" }}>INTELLIGENCE NETWORK</h2>
        <IntelNetwork report={memory} onDemo={runDemo} running={demoRunning} />

        <h2 className="pixel" style={{ ...sectionTitle, marginTop: 22 }}>SIGNAL</h2>
        {signal ? (
          <div style={card}>
            <div className="pixel" style={{ fontSize: 13, color: "#36e0ff" }}>
              {signal.entity} {signal.ticker ? `(${signal.ticker})` : ""}
            </div>
            <div style={{ marginTop: 10, fontSize: 12 }}>event: <b>{signal.event_type}</b></div>
            <div style={{ fontSize: 12, color: "#9aa" }}>observed {signal.observed_at} · disclosed {signal.disclosed_at}</div>
            {signal.lead_time_days != null && (
              <div className="pixel" style={{ marginTop: 10, fontSize: 18, color: "#ffcf4d", lineHeight: 1.4 }}>
                {signal.lead_time_days} DAYS<br /><span style={{ fontSize: 9, color: "#8a97b5" }}>BEFORE THE MARKET</span>
              </div>
            )}

            <StockChart series={prices} observed={signal.observed_at} disclosed={signal.disclosed_at} />

            {alpha && (
              <div style={{ marginTop: 10, border: "1px solid var(--line)", padding: 10, background: "#070b14" }}>
                <div className="pixel" style={{ fontSize: 8, color: "#5b6b8c", letterSpacing: 1 }}>ALPHA</div>
                <div style={{ fontSize: 12, color: "#9aa", marginTop: 4 }}>{alpha.strategy}</div>
                {alpha.entry_price != null && alpha.exit_price != null && (
                  <div style={{ fontSize: 12 }}>{alpha.entry_date} @ {alpha.entry_price} → {alpha.exit_date} @ {alpha.exit_price}</div>
                )}
                {alpha.return_pct != null && (
                  <div className="pixel" style={{ fontSize: 16, color: alpha.return_pct >= 0 ? "#5dff9b" : "#ff4d6d", marginTop: 6 }}>
                    {alpha.return_pct >= 0 ? "+" : ""}{alpha.return_pct}% SHORT
                  </div>
                )}
                {alpha.note && <div style={{ fontSize: 10, color: "#5b6b8c", marginTop: 4 }}>{alpha.note}</div>}
              </div>
            )}

            <div className="pixel" style={{ marginTop: 12, fontSize: 8, color: "#5b6b8c" }}>CONFIDENCE</div>
            <FusionBars sources={signal.sources} confidence={signal.confidence} />
            <p style={{ color: "#9aa", fontSize: 12, marginTop: 8 }}>{signal.summary}</p>
            {missionId && <Deliverables missionId={missionId} />}
          </div>
        ) : (
          <div style={{ ...card, color: "#5b6b8c", fontSize: 12 }} className="blink">no signal yet — run the swarm.</div>
        )}

        <h2 className="pixel" style={{ ...sectionTitle, marginTop: 22 }}>AUDIT LEDGER</h2>
        {audit ? (
          <div style={{ ...card, borderColor: verified ? "var(--line)" : "#ff4d6d" }} className={verified ? undefined : "alarm"}>
            <div className="pixel" style={{ fontSize: 9, color: verified ? "#5dff9b" : "#ff4d6d", lineHeight: 1.5 }}>
              {verified ? "✓ Ed25519 VALID · MERKLE INTACT" : "✗ TAMPER DETECTED · ROOT MISMATCH"}
            </div>
            <div style={{ fontSize: 10, color: "#5b6b8c", marginTop: 6, wordBreak: "break-all" }}>root {audit.audit_root.slice(0, 30)}…</div>
            <div style={{ marginTop: 8, maxHeight: 150, overflow: "auto", fontSize: 11 }}>
              {audit.entries.map((e) => (
                <div key={e.seq} style={{ color: e.action.includes("ALTERED") ? "#ff4d6d" : "#9aa", padding: "1px 0" }}>
                  #{e.seq} <b>{e.actor}</b>: {e.action}
                </div>
              ))}
            </div>
            <button
              onClick={tamper}
              className="pixel"
              style={{ marginTop: 10, fontSize: 8, padding: "8px 12px", border: "1px solid #ff4d6d", background: "transparent", color: "#ff4d6d", cursor: "pointer" }}
            >
              ⚠ TAMPER WITH ENTRY
            </button>
          </div>
        ) : (
          <div style={{ ...card, color: "#5b6b8c", fontSize: 12 }}>no audit yet.</div>
        )}

        <h2 className="pixel" style={{ ...sectionTitle, marginTop: 22 }}>VERIFY A BRIEF</h2>
        <VerifyBrief />
      </aside>
    </main>
  );
}

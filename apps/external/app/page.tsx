"use client";
import { useEffect, useState } from "react";
import type { Signal, TraceEvent } from "@periscope/contracts";

const LAYER_COLOR: Record<string, string> = {
  dispatch: "#7aa2f7", policy: "#e0af68", identity: "#9ece6a",
  execution: "#7dcfff", membrane: "#bb9af7", audit: "#f7768e",
};

export default function OpsCenter() {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [signal, setSignal] = useState<Signal | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("trace", (e) => setEvents((p) => [...p, JSON.parse((e as MessageEvent).data)]));
    es.addEventListener("signal", (e) => setSignal(JSON.parse((e as MessageEvent).data).signal));
    return () => es.close();
  }, []);

  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, padding: 24, minHeight: "100vh" }}>
      <section>
        <h1 style={{ fontSize: 18, letterSpacing: 2 }}>🔭 PERISCOPE — OPS CENTER</h1>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {events.map((ev, i) => (
            <div key={i} style={{ fontSize: 13 }}>
              <span style={{ color: LAYER_COLOR[ev.layer] ?? "#888", textTransform: "uppercase" }}>
                [{ev.layer}]
              </span>{" "}
              <b>{ev.agent}</b> — {ev.msg}
              {ev.meta?.exit_ip ? (
                <span style={{ color: "#9ece6a" }}> · exit {String(ev.meta.exit_ip)} ({String(ev.meta.country)})</span>
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
      </aside>
    </main>
  );
}

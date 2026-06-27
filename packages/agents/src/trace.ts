import type { TraceEvent } from "@periscope/contracts";

export type TraceSink = (ev: TraceEvent) => void;

/** Bind a sink + mission_id so tools/agents emit contract-valid TraceEvents tersely. */
export function tracer(missionId: string, sink: TraceSink) {
  return (
    layer: TraceEvent["layer"],
    agent: string,
    level: TraceEvent["level"],
    msg: string,
    meta?: Record<string, unknown>,
  ) => sink({ mission_id: missionId, ts: new Date().toISOString(), layer, agent, level, msg, meta });
}

export type Trace = ReturnType<typeof tracer>;

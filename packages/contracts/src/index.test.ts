import { describe, it, expect } from "vitest";
import {
  MissionSchema, SignalSchema, AuditEntrySchema, TraceEventSchema, SignedBriefSchema,
  MemoryReportSchema,
} from "./index";

describe("contracts", () => {
  it("accepts a valid Mission and defaults scope", () => {
    const m = MissionSchema.parse({
      id: "m1", query: "Is issuer X compromised?", ticker: "LYV",
      allowed_sources: ["BreachForums"], data_classes: ["breach"], max_spend_usd: 5,
    });
    expect(m.scope).toBe("osint_readonly");
  });

  it("rejects a Mission missing required fields", () => {
    expect(() => MissionSchema.parse({ id: "m1" })).toThrow();
  });

  it("validates a Signal with fused confidence and sources", () => {
    const s = SignalSchema.parse({
      entity: "Live Nation", ticker: "LYV", event_type: "credential_dump",
      sources: [{ name: "BreachForums", type: "tor_forum", reliability: 0.7, observed_at: "2024-05-27" }],
      confidence: 0.88, confidence_method: "noisy_or",
      observed_at: "2024-05-27", disclosed_at: "2024-05-31", lead_time_days: 4,
      summary: "…",
    });
    expect(s.confidence).toBeCloseTo(0.88);
    expect(s.sources).toHaveLength(1);
  });

  it("rejects confidence outside 0..1", () => {
    expect(() => SignalSchema.parse({
      entity: "x", event_type: "y", sources: [], confidence: 1.5,
      confidence_method: "noisy_or", observed_at: "t", summary: "s",
    })).toThrow();
  });

  it("validates an AuditEntry, TraceEvent and SignedBrief", () => {
    expect(() => AuditEntrySchema.parse({
      seq: 0, ts: "t", actor: "Judge", action: "sign", hash: "h", prev_hash: "p",
    })).not.toThrow();
    expect(() => TraceEventSchema.parse({
      mission_id: "m1", ts: "t", layer: "execution", agent: "TorScout", level: "action", msg: "fetch",
    })).not.toThrow();
    expect(() => TraceEventSchema.parse({
      mission_id: "m1", ts: "t", layer: "BOGUS", agent: "x", level: "info", msg: "y",
    })).toThrow();
  });

  it("accepts the new Intelligence Network 'memory' trace layer", () => {
    expect(() => TraceEventSchema.parse({
      mission_id: "m1", ts: "t", layer: "memory", agent: "IntelligenceNetwork",
      level: "action", msg: "Recalled route from 13 similar missions",
    })).not.toThrow();
  });

  it("validates a MemoryReport (before/after + learned edges)", () => {
    const r = MemoryReportSchema.parse({
      mission_type: "breach_intel", sector: "entertainment", recalled_from: 13, run_index: 14,
      route: ["tor_forum", "breach_api"],
      cold: { hops: 7, latency_ms: 38000, cost_usd: 0.41, confidence: 0.72 },
      warmed: { hops: 2, latency_ms: 6000, cost_usd: 0.04, confidence: 0.94 },
      edges: [{
        from: "START", to: "tor_forum", visits: 9, success_rate: 0.89,
        avg_confidence: 0.91, avg_cost_usd: 0.05, avg_latency_ms: 6500, reward: 0.81,
      }],
    });
    expect(r.route).toEqual(["tor_forum", "breach_api"]);
  });
});

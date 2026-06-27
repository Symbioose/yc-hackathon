import { describe, it, expect } from "vitest";
import {
  MissionSchema, SignalSchema, AuditEntrySchema, TraceEventSchema, SignedBriefSchema,
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
});

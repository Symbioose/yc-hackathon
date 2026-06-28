import { describe, it, expect, vi } from "vitest";
import { SignalSchema } from "@altai/contracts";

// Mock the scouts so the test is deterministic and offline (avoids loading the AI SDK).
vi.mock("./scouts", () => ({
  webScout: async () => ({ sources: [], snippets: [], notes: "web" }),
  torScout: async () => ({ sources: [], snippets: [], notes: "tor" }),
  breachScout: async () => ({ sources: [], snippets: [], notes: "breach" }),
}));

import { synthesizeSignal } from "./planner";

describe("synthesizeSignal (honest — no hardcoded pinning)", () => {
  it("fuses confidence (noisy-OR) from the real corroborating sources", () => {
    const sources = [
      { name: "BreachForums", type: "tor_forum" as const, reliability: 0.7, observed_at: "2024-05-27" },
      { name: "HIBP", type: "breach_api" as const, reliability: 0.6, observed_at: "2024-05-28" },
    ];
    const s = synthesizeSignal({ ticker: "LYV", target_entity: "Live Nation", query: "x" }, sources);
    expect(() => SignalSchema.parse(s)).not.toThrow();
    expect(s.entity).toBe("Live Nation");
    expect(s.event_type).toBe("suspected_breach");
    expect(s.sources).toHaveLength(2);
    expect(s.confidence).toBeCloseTo(0.88, 2); // 1 - (0.3 * 0.4)
  });

  it("does NOT special-case the demo ticker — no pinned fixture (alpha/lead-time) leaks in", () => {
    const s = synthesizeSignal({ ticker: "LYV", target_entity: "Live Nation", query: "x" }, []);
    expect(s.event_type).toBe("inconclusive");
    expect(s.lead_time_days).toBeUndefined();
    expect(s.alpha).toBeUndefined();
  });

  it("is honest when nothing corroborates: inconclusive at confidence 0", () => {
    const s = synthesizeSignal({ ticker: "AAPL", target_entity: "Acme Corp", query: "x" }, []);
    expect(() => SignalSchema.parse(s)).not.toThrow();
    expect(s.event_type).toBe("inconclusive");
    expect(s.confidence).toBe(0);
    expect(s.summary).toMatch(/no corroborating evidence/i);
  });

  it("synthesizes a real signal for any entity from its own sources", () => {
    const s = synthesizeSignal(
      { ticker: "AAPL", target_entity: "Acme Corp", query: "x" },
      [{ name: "HIBP", type: "breach_api" as const, reliability: 0.6, observed_at: "2024-01-01" }],
    );
    expect(s.event_type).toBe("suspected_breach");
    expect(s.entity).toBe("Acme Corp");
    expect(s.confidence).toBeCloseTo(0.6, 2);
  });
});

import { describe, it, expect, vi } from "vitest";
import { SignalSchema } from "@periscope/contracts";

// Mock the scouts so the test is deterministic and offline (avoids loading the AI SDK).
vi.mock("./scouts", () => ({
  webScout: async () => ({ sources: [], notes: "web" }),
  torScout: async () => ({
    sources: [{ name: "BreachForums", type: "tor_forum", reliability: 0.7, observed_at: "2024-05-27" }],
    notes: "tor",
  }),
  breachScout: async () => ({
    sources: [{ name: "HIBP", type: "breach_api", reliability: 0.6, observed_at: "2024-05-28" }],
    notes: "breach",
  }),
}));

import { synthesizeSignal } from "./planner";

describe("synthesizeSignal (hero pinning)", () => {
  it("produces the deterministic hero Signal for the hero ticker", () => {
    const sources = [
      { name: "BreachForums", type: "tor_forum" as const, reliability: 0.7, observed_at: "2024-05-27" },
      { name: "HIBP", type: "breach_api" as const, reliability: 0.6, observed_at: "2024-05-28" },
    ];
    const s = synthesizeSignal({ ticker: "LYV", target_entity: "Live Nation", query: "x" }, sources);
    expect(() => SignalSchema.parse(s)).not.toThrow();
    expect(s.entity).toContain("Live Nation");
    expect(s.lead_time_days).toBe(4);
    expect(s.confidence).toBeCloseTo(0.88, 2); // noisy-OR of 0.7 + 0.6
  });

  it("synthesizes a generic Signal for a non-hero ticker", () => {
    const s = synthesizeSignal(
      { ticker: "AAPL", target_entity: "Acme", query: "x" },
      [{ name: "HIBP", type: "breach_api" as const, reliability: 0.6, observed_at: "2024-01-01" }],
    );
    expect(() => SignalSchema.parse(s)).not.toThrow();
    expect(s.event_type).toBe("suspected_breach");
    expect(s.confidence).toBeCloseTo(0.6, 2);
  });
});

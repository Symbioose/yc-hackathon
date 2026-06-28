import { describe, it, expect, vi } from "vitest";
import { SignalSchema } from "@altai/contracts";

// Mock the scouts so the test is deterministic and offline (avoids loading the AI SDK).
vi.mock("./scouts", () => ({
  webScout: async () => ({ sources: [], snippets: [], contexts: [] }),
  torScout: async () => ({ sources: [], snippets: [], contexts: [] }),
  breachScout: async () => ({ sources: [], snippets: [], contexts: [] }),
  synthesizeAnswer: async () => "",
  refineQuery: async (q: string) => q,
  isSecurityQuery: () => false,
}));

import { synthesizeSignal } from "./planner";

const src = [{ name: "en.wikipedia.org", type: "press" as const, reliability: 0.5, observed_at: "t" }];

describe("synthesizeSignal (general research — honest)", () => {
  it("uses the cited answer as the summary when sources back it", () => {
    const s = synthesizeSignal({ query: "who is the president of france" }, src, "Emmanuel Macron is the President [1].");
    expect(() => SignalSchema.parse(s)).not.toThrow();
    expect(s.event_type).toBe("research_finding");
    expect(s.summary).toMatch(/Macron/);
    expect(s.sources).toHaveLength(1);
    expect(s.confidence).toBeCloseTo(0.5, 4);
  });

  it("is inconclusive at confidence 0 when there are no sources", () => {
    const s = synthesizeSignal({ query: "zzzqqq" }, [], "");
    expect(() => SignalSchema.parse(s)).not.toThrow();
    expect(s.event_type).toBe("inconclusive");
    expect(s.confidence).toBe(0);
    expect(s.summary).toMatch(/no answer found/i);
  });

  it("is inconclusive when the model says the sources lack the answer", () => {
    const s = synthesizeSignal({ query: "x" }, src, "The sources don't contain a clear answer.");
    expect(s.event_type).toBe("inconclusive");
    expect(s.confidence).toBe(0);
  });
});

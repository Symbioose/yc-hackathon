import { describe, it, expect } from "vitest";
import type { Signal } from "@altai/contracts";
import { plantedInjection } from "@altai/fixtures";
import { huntInjection, sanitize } from "./membrane";

describe("membrane", () => {
  it("Injection Hunter flags the planted dark-web injection", () => {
    const r = huntInjection([plantedInjection]);
    expect(r.clean).toBe(false);
    expect(r.findings.length).toBeGreaterThanOrEqual(1);
    expect(r.findings[0].source).toBe(plantedInjection.source);
  });

  it("Injection Hunter passes clean content", () => {
    const r = huntInjection([{ source: "press.com", content: "Live Nation confirmed a breach in an SEC 8-K filing." }]);
    expect(r.clean).toBe(true);
    expect(r.findings).toHaveLength(0);
  });

  it("Sanitizer redacts PII in the signal summary", () => {
    const signal: Signal = {
      entity: "x",
      event_type: "y",
      sources: [],
      confidence: 0.5,
      confidence_method: "noisy_or",
      observed_at: "t",
      summary: "contact leak@corp.com for the dump",
    };
    const r = sanitize(signal);
    expect(r.redactions).toBeGreaterThanOrEqual(1);
    expect(r.signal.summary).toContain("[REDACTED_EMAIL]");
  });
});

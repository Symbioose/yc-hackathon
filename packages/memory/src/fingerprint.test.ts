import { describe, it, expect } from "vitest";
import type { Signal, TraceEvent } from "@altai/contracts";
import { GenomeSchema } from "./types";
import { deriveMissionType, deriveSector, fingerprint } from "./fingerprint";

const heroSignal: Signal = {
  entity: "Live Nation Entertainment (Ticketmaster)",
  ticker: "LYV",
  event_type: "credential_dump",
  sources: [
    { name: "BreachForums", type: "tor_forum", reliability: 0.7, observed_at: "2024-05-27", url: "http://darkleak7xqz.onion/thread/42" },
    { name: "HIBP", type: "breach_api", reliability: 0.6, observed_at: "2024-05-28" },
  ],
  confidence: 0.94,
  confidence_method: "noisy_or",
  observed_at: "2024-05-27",
  summary: "ShinyHunters listed 560M Ticketmaster records on the dark web.",
};

const heroMission = { query: "Has Live Nation been breached?", target_entity: "Live Nation", ticker: "LYV" };
const trace: TraceEvent[] = [
  { mission_id: "m-hero", ts: "2024-05-27T00:00:00.000Z", layer: "dispatch", agent: "Gateway", level: "info", msg: "received" },
  { mission_id: "m-hero", ts: "2024-05-27T00:00:06.000Z", layer: "audit", agent: "AuditAgent", level: "success", msg: "sealed" },
];

describe("fingerprint — entity-stripped Genome (privacy by construction)", () => {
  it("produces a contract-valid Genome", () => {
    const g = fingerprint(heroMission, heroSignal, trace, { hops: 2, latency_ms: 6000, cost_usd: 0.04 });
    expect(() => GenomeSchema.parse(g)).not.toThrow();
    expect(g.mission_type).toBe("breach_intel");
    expect(g.sector).toBe("entertainment");
    expect(g.corroborating_types).toEqual(["tor_forum", "breach_api"]);
    expect(g.outcome).toBe("signed");
  });

  it("NEVER stores the raw entity, ticker, query, URL, or source name", () => {
    const g = fingerprint(heroMission, heroSignal, trace);
    const blob = JSON.stringify(g).toLowerCase();
    expect(blob).not.toContain("live nation");
    expect(blob).not.toContain("ticketmaster");
    expect(blob).not.toContain("lyv");
    expect(blob).not.toContain("breachforums");
    expect(blob).not.toContain("hibp");
    expect(blob).not.toContain("onion");
    expect(blob).not.toContain("breached"); // no fragment of the raw query
  });

  it("classifies mission_type from the event/query, not the entity", () => {
    expect(deriveMissionType("ransomware_attack")).toBe("ransomware_intel");
    expect(deriveMissionType("credential_dump")).toBe("breach_intel");
    expect(deriveMissionType(undefined, "is there a data leak about them")).toBe("leak_intel");
    expect(deriveMissionType("unknown_thing")).toBe("breach_intel"); // default
  });

  it("buckets the sector coarsely and discards the identity", () => {
    expect(deriveSector({ ticker: "LYV" })).toBe("entertainment");
    expect(deriveSector({ entity: "Helios Regional Bank" })).toBe("finance");
    expect(deriveSector({ entity: "Northwind Pharma" })).toBe("healthcare");
    expect(deriveSector({ entity: "Totally Novel Co" })).toBe("unknown");
  });

  it("marks a no-corroboration mission as a dead_end", () => {
    const weak: Signal = { ...heroSignal, sources: [], confidence: 0.2 };
    const g = fingerprint(heroMission, weak, trace);
    expect(g.outcome).toBe("dead_end");
  });
});

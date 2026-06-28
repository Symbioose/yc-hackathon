import { describe, it, expect, vi } from "vitest";
import { hibpLookup, intelxSearch } from "./breach";

// Real breach APIs degrade gracefully: with no API key configured they return [] (never
// throw, never fabricate). This is the behaviour the swarm relies on when keys are absent.
describe("breach APIs (graceful, no fabrication)", () => {
  it("hibpLookup returns [] when HIBP_API_KEY is absent", async () => {
    vi.stubEnv("HIBP_API_KEY", "");
    expect(await hibpLookup("example.com")).toEqual([]);
    vi.unstubAllEnvs();
  });

  it("intelxSearch returns [] when INTELX_API_KEY is absent", async () => {
    vi.stubEnv("INTELX_API_KEY", "");
    expect(await intelxSearch("Acme Corp")).toEqual([]);
    vi.unstubAllEnvs();
  });
});

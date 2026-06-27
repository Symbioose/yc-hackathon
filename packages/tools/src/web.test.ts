import { describe, it, expect } from "vitest";
import { fetchUrl } from "./web";

describe("fetchUrl", () => {
  it("returns status + truncated text for a reachable page", async () => {
    const r = await fetchUrl("https://example.com");
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.text.toLowerCase()).toContain("example domain");
    expect(r.text.length).toBeLessThanOrEqual(8000);
  }, 15000);

  it("reports a failure (no throw) for an unresolvable host", async () => {
    const r = await fetchUrl("https://nonexistent.invalid.periscope");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  }, 15000);
});

import { describe, it, expect } from "vitest";

// Regression guard for the Tor egress. We don't need a real Tor daemon: pointing the
// SOCKS dispatcher at a closed local port exercises the *exact* fetch-socks → undici
// path. If the two undici versions ever drift again, undici throws
// "invalid onRequestStart method" instead of a clean connection error — which this
// test catches. (The full live .onion fetch is verified manually against a real Tor.)
describe("tor egress wiring", () => {
  it("torFetch fails gracefully through the SOCKS dispatcher (undici-compatible)", async () => {
    process.env.TOR_SOCKS_HOST = "127.0.0.1";
    process.env.TOR_SOCKS_PORT = "1"; // closed → immediate connection refusal
    const { torFetch } = await import("./tor");
    const r = await torFetch("http://example.com", 4000);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(0);
    // the dispatcher must be undici-compatible — NOT a version-skew failure
    expect(r.error ?? "").not.toMatch(/onRequestStart/i);
  });
});

import { describe, it, expect, vi } from "vitest";

// Mock the tools layer so the scouts are tested offline + deterministically.
vi.mock("@altai/tools", () => ({
  webSearch: vi.fn(),
  fetchUrl: vi.fn(),
  ahmiaSearch: vi.fn(async () => []),
  torFetch: vi.fn(),
  getExitIp: vi.fn(async () => ({ ip: "185.220.101.1", country: "DE" })),
  hibpLookup: vi.fn(async () => []),
  intelxSearch: vi.fn(async () => []),
}));

import { webScout, torScout, mentionsEntity } from "./scouts";
import * as tools from "@altai/tools";

const noTrace = (() => {}) as never;

describe("mentionsEntity", () => {
  it("matches the full name or a distinctive token, not noise", () => {
    expect(mentionsEntity("Ticketmaster owner Live Nation confirmed a breach", "Live Nation")).toBe(true);
    expect(mentionsEntity("unrelated page about cooking", "Live Nation")).toBe(false);
    expect(mentionsEntity("", "Acme")).toBe(false);
  });
});

describe("webScout — real search + relevance/breach gate (no fabrication)", () => {
  it("counts ONLY pages that mention the entity AND describe a breach", async () => {
    (tools.webSearch as ReturnType<typeof vi.fn>).mockResolvedValue([
      { title: "Live Nation breach", url: "https://news.example/a" },
      { title: "Live Nation tour dates", url: "https://promo.example/b" },
      { title: "Unrelated", url: "https://other.example/c" },
    ]);
    (tools.fetchUrl as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (url.endsWith("/a")) return { url, ok: true, status: 200, text: "Live Nation suffered a data breach exposing user records", title: "" };
      if (url.endsWith("/b")) return { url, ok: true, status: 200, text: "Live Nation concert tickets and tour dates", title: "" };
      return { url, ok: true, status: 200, text: "a totally unrelated article", title: "" };
    });
    const res = await webScout({ query: "x", target_entity: "Live Nation" }, noTrace);
    expect(res.sources.map((s) => s.url)).toEqual(["https://news.example/a"]);
    // every fetched page is still captured as a snippet so the membrane can scan it.
    expect(res.snippets.length).toBe(3);
  });

  it("is honest when search yields nothing", async () => {
    (tools.webSearch as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = await webScout({ query: "idk", target_entity: "idk" }, noTrace);
    expect(res.sources).toEqual([]);
  });
});

describe("torScout — relevance gate on live .onion content", () => {
  it("does NOT count an off-topic .onion as corroboration", async () => {
    (tools.ahmiaSearch as ReturnType<typeof vi.fn>).mockResolvedValue([{ onion: "http://x.onion", title: "market" }]);
    (tools.torFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ url: "http://x.onion", ok: true, status: 200, text: "generic darknet marketplace listings" });
    const res = await torScout({ query: "Acme Corp", target_entity: "Acme Corp" }, noTrace);
    expect(res.sources).toEqual([]);
    expect(res.snippets.length).toBe(1); // still scanned for injection
  });

  it("counts an .onion whose content references the target", async () => {
    (tools.ahmiaSearch as ReturnType<typeof vi.fn>).mockResolvedValue([{ onion: "http://y.onion", title: "leak" }]);
    (tools.torFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ url: "http://y.onion", ok: true, status: 200, text: "Acme Corp full database dump for sale" });
    const res = await torScout({ query: "Acme Corp", target_entity: "Acme Corp" }, noTrace);
    expect(res.sources.length).toBe(1);
    expect(res.sources[0].type).toBe("tor_forum");
  });
});

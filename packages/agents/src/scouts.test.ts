import { describe, it, expect, vi } from "vitest";

// Mock the tools + the LLM so the scouts are tested offline + deterministically.
vi.mock("@altai/tools", () => ({
  webSearch: vi.fn(),
  fetchUrl: vi.fn(),
  ahmiaSearch: vi.fn(async () => []),
  torFetch: vi.fn(),
  getExitIp: vi.fn(async () => ({ ip: "185.220.101.1", country: "DE" })),
  hibpLookup: vi.fn(async () => []),
  intelxSearch: vi.fn(async () => []),
  htmlToText: (s: string) => String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  looksBlocked: (s: string) => /cloudflare|captcha|attention required/i.test(String(s)),
  fetchViaReader: vi.fn(async (url: string) => ({ url, ok: false, status: 0, text: "" })),
}));
vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "Tokyo is the capital of Japan [1]." })),
}));
vi.mock("./provider", () => ({ fastModel: () => ({}) }));

import { webScout, torScout, isSecurityQuery, synthesizeAnswer } from "./scouts";
import * as tools from "@altai/tools";

const noTrace = (() => {}) as never;
const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

describe("isSecurityQuery", () => {
  it("flags breach/dark-web questions, not general ones", () => {
    expect(isSecurityQuery("is there stolen data for sale on the dark web?")).toBe(true);
    expect(isSecurityQuery("Has Live Nation been breached?")).toBe(true);
    expect(isSecurityQuery("who is the president of France?")).toBe(false);
  });
});

describe("webScout — read the real top results (distinct hosts)", () => {
  it("returns aligned sources/snippets/contexts and de-dupes by host", async () => {
    mock(tools.webSearch).mockResolvedValue([
      { title: "Japan", url: "https://en.wikipedia.org/x" },
      { title: "dup", url: "https://en.wikipedia.org/y" }, // same host → deduped
      { title: "WA", url: "https://www.worldatlas.com/z" },
    ]);
    mock(tools.fetchUrl).mockResolvedValue({
      ok: true,
      status: 200,
      title: "t",
      text: "Tokyo is the capital of Japan. It is the largest metropolitan area in the world and the economic center of the country.",
    });
    const r = await webScout({ query: "capital of japan" }, noTrace);
    expect(r.sources.map((s) => s.name)).toEqual(["en.wikipedia.org", "www.worldatlas.com"]);
    expect(r.contexts.length).toBe(2);
    expect(r.snippets.length).toBe(2);
  });

  it("is empty when there are no results", async () => {
    mock(tools.webSearch).mockResolvedValue([]);
    const r = await webScout({ query: "x" }, noTrace);
    expect(r.sources).toEqual([]);
  });
});

describe("torScout — real dark-web search + live .onion over Tor", () => {
  it("reaches the Ahmia dark-web index over Tor and fetches a result forum", async () => {
    mock(tools.torFetch).mockImplementation(async (url: string) =>
      url.includes("juhanurmihxlp77")
        ? { url, ok: true, status: 200, text: "x redirect_url=http%3A%2F%2Fabcdefghijklmnop234567.onion%2Fleak y" }
        : { url, ok: true, status: 200, text: "stolen records dump for sale" },
    );
    const r = await torScout({ query: "stolen data for sale" }, noTrace);
    expect(r.sources.length).toBe(1);
    expect(r.sources[0].type).toBe("tor_forum");
    expect(r.sources[0].name).toBe("abcdefghijklmnop234567.onion");
  });

  it("confirms reachability (no source) when no topic forum is indexed", async () => {
    mock(tools.torFetch).mockResolvedValue({ url: "x", ok: true, status: 200, text: "no results here" });
    const r = await torScout({ query: "stolen data" }, noTrace);
    expect(r.sources).toEqual([]);
  });

  it("bails out honestly when Tor has no exit", async () => {
    mock(tools.getExitIp).mockResolvedValueOnce({ ip: undefined, error: "fetch failed" });
    const r = await torScout({ query: "x" }, noTrace);
    expect(r.sources).toEqual([]);
  });
});

describe("synthesizeAnswer", () => {
  it("returns '' when there is nothing to read", async () => {
    expect(await synthesizeAnswer("q", [], noTrace)).toBe("");
  });
  it("returns the cited answer grounded in the contexts", async () => {
    const a = await synthesizeAnswer("capital of japan", ["Wikipedia — Tokyo is the capital."], noTrace);
    expect(a).toMatch(/Tokyo/);
  });
});

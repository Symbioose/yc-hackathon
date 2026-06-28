import { describe, it, expect } from "vitest";
import { fetchUrl, htmlToText } from "./web";

describe("htmlToText", () => {
  it("strips scripts/styles/tags and decodes entities into readable text", () => {
    const html =
      `<html><head><title>T</title><style>.a{color:red}</style>` +
      `<script>var x = 1 < 2;</script></head>` +
      `<body><h1>Paris</h1><p>It&#39;s sunny &amp; warm today.</p></body></html>`;
    const t = htmlToText(html);
    expect(t).toContain("Paris");
    expect(t).toContain("It's sunny & warm today.");
    expect(t).not.toMatch(/<[^>]+>/); // no markup survives
    expect(t).not.toContain("var x"); // script body removed
    expect(t).not.toContain("color:red"); // style body removed
  });
});

describe("fetchUrl", () => {
  it("returns status + truncated text for a reachable page", async () => {
    const r = await fetchUrl("https://example.com");
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.text.toLowerCase()).toContain("example domain");
    expect(r.text.length).toBeLessThanOrEqual(8000);
  }, 15000);

  it("reports a failure (no throw) for an unresolvable host", async () => {
    const r = await fetchUrl("https://nonexistent.invalid.altai");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  }, 15000);
});

import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import type { SignedBrief } from "@altai/contracts";
import { ARTIFACT_FORMATS, isArtifactFormat, buildArtifact } from "./index";
import { briefToCSV } from "./csv";
import { briefToMarkdown } from "./markdown";
import { briefToSTIX } from "./stix";
import { briefToJSON } from "./json";

const brief: SignedBrief = {
  signal: {
    entity: "Live Nation Entertainment (Ticketmaster)",
    ticker: "LYV",
    event_type: "credential_dump",
    sources: [
      { name: "BreachForums", type: "tor_forum", reliability: 0.7, observed_at: "2024-05-27", url: "http://darkleak7xqz.onion/thread/42" },
      { name: 'HIBP "quoted, comma"', type: "breach_api", reliability: 0.6, observed_at: "2024-05-28" },
    ],
    confidence: 0.94,
    confidence_method: "noisy_or",
    observed_at: "2024-05-27",
    disclosed_at: "2024-05-31",
    lead_time_days: 4,
    alpha: { strategy: "short the leak", entry_date: "2024-05-28", exit_date: "2024-05-31", entry_price: 90.12, exit_price: 88.1, return_pct: 2.24 },
    summary: "ShinyHunters listed 560M Ticketmaster records on the dark web 4 days before disclosure.",
  },
  audit_root: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
  signature: "ZmFrZS1zaWduYXR1cmUtYmFzZTY0LXZhbHVlLWZvci10ZXN0aW5n",
  public_key: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA\n-----END PUBLIC KEY-----\n",
};

describe("artifacts catalogue", () => {
  it("exposes 5 formats and a working type guard", () => {
    expect(ARTIFACT_FORMATS.map((f) => f.format)).toEqual(["xlsx", "csv", "md", "json", "stix"]);
    expect(isArtifactFormat("xlsx")).toBe(true);
    expect(isArtifactFormat("pdf")).toBe(false);
  });
});

describe("JSON", () => {
  it("round-trips the signed brief verbatim", () => {
    expect(JSON.parse(briefToJSON(brief))).toEqual(brief);
  });
});

describe("CSV", () => {
  it("emits a header + one row per source, RFC-4180 escaped", () => {
    const csv = briefToCSV(brief);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe("name,type,reliability,observed_at,url");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("BreachForums,tor_forum,0.7,2024-05-27,");
    // a name with quotes/comma must be quoted and quotes doubled
    expect(lines[2]).toContain('"HIBP ""quoted, comma"""');
  });
});

describe("Markdown", () => {
  it("renders the brief with confidence, sources and the crypto attestation", () => {
    const md = briefToMarkdown(brief);
    expect(md).toContain("# Altai Intelligence Brief");
    expect(md).toContain("Live Nation Entertainment (Ticketmaster) (LYV)");
    expect(md).toContain("94%");
    expect(md).toContain("4 days before the market");
    expect(md).toContain("BreachForums");
    expect(md).toContain("Ed25519");
  });
});

describe("STIX 2.1", () => {
  it("produces a valid, deterministic bundle with identity + indicator + report", () => {
    const a = briefToSTIX(brief, { generatedAt: "2024-06-01T00:00:00.000Z" });
    const b = briefToSTIX(brief, { generatedAt: "2024-06-01T00:00:00.000Z" });
    expect(a).toBe(b); // deterministic

    const bundle = JSON.parse(a);
    expect(bundle.type).toBe("bundle");
    expect(bundle.id).toMatch(/^bundle--[0-9a-f-]{36}$/);

    const types = bundle.objects.map((o: { type: string }) => o.type);
    expect(types).toContain("identity");
    expect(types).toContain("indicator");
    expect(types).toContain("report");
    expect(types).toContain("relationship");

    const report = bundle.objects.find((o: { type: string }) => o.type === "report");
    expect(report.spec_version).toBe("2.1");
    expect(report.confidence).toBe(94);
    expect(report.x_altai_audit_root).toBe(brief.audit_root);
    expect(report.x_altai_signature).toBe(brief.signature);

    const indicator = bundle.objects.find((o: { type: string }) => o.type === "indicator");
    expect(indicator.pattern).toBe("[url:value = 'http://darkleak7xqz.onion/thread/42']");
    // only the source WITH a url becomes an indicator
    expect(bundle.objects.filter((o: { type: string }) => o.type === "indicator")).toHaveLength(1);
  });
});

describe("buildArtifact", () => {
  it("names files and sets mime per format", async () => {
    const md = await buildArtifact(brief, "md");
    expect(md.filename).toBe("altai-brief-live-nation-entertainment-ticketmaster-lyv.md");
    expect(md.mime).toBe("text/markdown");
    expect(typeof md.body).toBe("string");

    const json = await buildArtifact(brief, "json");
    expect(json.filename.endsWith(".json")).toBe(true);
  });

  it("produces a real .xlsx that exceljs can read back (and neutralizes formula cells)", async () => {
    // fall through to the existing assertions below after a formula-injection check
    const evil: SignedBrief = {
      ...brief,
      signal: { ...brief.signal, sources: [{ name: "=cmd|' /C calc'!A0", type: "tor_forum", reliability: 0.7, observed_at: "t", url: "https://ok" }] },
    };
    const art = await buildArtifact(evil, "xlsx");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(art.body as Uint8Array) as never);
    const nameCell = wb.getWorksheet("Sources")!.getRow(2).getCell(1).value;
    expect(String(nameCell).startsWith("'=")).toBe(true); // formula defused, stored as text
  });

  it("produces a real .xlsx that exceljs can read back", async () => {
    const art = await buildArtifact(brief, "xlsx");
    expect(art.mime).toContain("spreadsheetml");
    const bytes = art.body as Uint8Array;
    expect(bytes).toBeInstanceOf(Uint8Array);
    // ZIP/OOXML magic "PK"
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const wb = new ExcelJS.Workbook();
    // cast via `never` so the read-back is immune to @types/node Buffer-generic skew
    await wb.xlsx.load(Buffer.from(bytes) as never);
    expect(wb.getWorksheet("Summary")).toBeTruthy();
    expect(wb.getWorksheet("Sources")).toBeTruthy();
    expect(wb.getWorksheet("Provenance")).toBeTruthy();
    expect(wb.getWorksheet("Alpha")).toBeTruthy();
  });
});

describe("document security (defense in depth)", () => {
  const evil: SignedBrief = {
    ...brief,
    signal: {
      ...brief.signal,
      entity: "=danger() pivot",
      sources: [
        { name: "=cmd|' /C calc'!A0", type: "tor_forum", reliability: 0.7, observed_at: "t", url: "http://evil/'; DROP--" },
        { name: "table|break <img onerror=x>", type: "press", reliability: 0.4, observed_at: "t" },
      ],
    },
  };

  it("CSV: neutralizes spreadsheet formula injection", () => {
    const csv = briefToCSV(evil);
    expect(csv).toContain("'=cmd"); // leading '=' defused with a quote
    expect(csv).not.toMatch(/(^|,)=cmd/m); // never a raw formula at a cell boundary
  });

  it("Markdown: escapes table + HTML breakouts", () => {
    const md = briefToMarkdown(evil);
    expect(md).toContain("table\\|break"); // pipe escaped → table integrity
    expect(md).toContain("&lt;img onerror=x&gt;"); // angle brackets neutralized
    expect(md).not.toContain("<img"); // no raw HTML
  });

  it("STIX: escapes the URL inside the pattern string (no grammar breakout)", () => {
    const bundle = JSON.parse(briefToSTIX(evil, { generatedAt: "2024-06-01T00:00:00.000Z" }));
    const indicator = bundle.objects.find((o: { type: string }) => o.type === "indicator");
    expect(indicator.pattern).toBe("[url:value = 'http://evil/\\'; DROP--']");
  });
});

import ExcelJS from "exceljs";
import type { SignedBrief } from "@altai/contracts";

const CYAN = "FF0A1120";
const HEADER = "FF1B2740";

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER } };
  });
}

/**
 * A real .xlsx workbook (Excel/Sheets/Numbers) with four sheets: Summary, Sources,
 * Alpha, and Provenance. The cryptographic attestation rides in the Provenance sheet
 * so the spreadsheet is self-describing. Returns the file as bytes.
 */
export async function briefToXLSX(brief: SignedBrief): Promise<Uint8Array> {
  const { signal } = brief;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Altai";
  wb.created = new Date();

  // --- Summary ---
  const summary = wb.addWorksheet("Summary", { properties: { tabColor: { argb: CYAN } } });
  summary.columns = [
    { header: "Field", key: "k", width: 24 },
    { header: "Value", key: "v", width: 70 },
  ];
  styleHeader(summary.getRow(1));
  const rows: [string, string | number | undefined][] = [
    ["Entity", signal.entity],
    ["Ticker", signal.ticker],
    ["Event type", signal.event_type],
    ["Confidence", signal.confidence],
    ["Confidence method", signal.confidence_method],
    ["Observed at", signal.observed_at],
    ["Publicly disclosed", signal.disclosed_at],
    ["Lead time (days)", signal.lead_time_days],
    ["Independent sources", signal.sources.length],
    ["Summary", signal.summary],
  ];
  for (const [k, v] of rows) {
    const r = summary.addRow({ k, v: v ?? "—" });
    if (k === "Confidence" && typeof v === "number") r.getCell("v").numFmt = "0%";
  }
  summary.getColumn("k").font = { bold: true };

  // --- Sources ---
  const sources = wb.addWorksheet("Sources");
  sources.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Type", key: "type", width: 14 },
    { header: "Reliability", key: "rel", width: 12 },
    { header: "Observed", key: "obs", width: 14 },
    { header: "URL", key: "url", width: 60 },
  ];
  styleHeader(sources.getRow(1));
  for (const s of signal.sources) {
    const r = sources.addRow({ name: s.name, type: s.type, rel: s.reliability, obs: s.observed_at, url: s.url ?? "—" });
    r.getCell("rel").numFmt = "0.00";
  }

  // --- Alpha (only if present) ---
  if (signal.alpha) {
    const a = signal.alpha;
    const alpha = wb.addWorksheet("Alpha");
    alpha.columns = [
      { header: "Field", key: "k", width: 22 },
      { header: "Value", key: "v", width: 50 },
    ];
    styleHeader(alpha.getRow(1));
    const arows: [string, string | number | undefined][] = [
      ["Strategy", a.strategy],
      ["Entry date", a.entry_date],
      ["Entry price", a.entry_price],
      ["Exit date", a.exit_date],
      ["Exit price", a.exit_price],
      ["Return %", a.return_pct],
      ["Max drawdown %", a.max_drawdown_pct],
      ["Note", a.note],
    ];
    for (const [k, v] of arows) alpha.addRow({ k, v: v ?? "—" });
    alpha.getColumn("k").font = { bold: true };
  }

  // --- Provenance ---
  const prov = wb.addWorksheet("Provenance");
  prov.columns = [
    { header: "Field", key: "k", width: 22 },
    { header: "Value", key: "v", width: 90 },
  ];
  styleHeader(prov.getRow(1));
  const prows: [string, string][] = [
    ["Signature scheme", "Ed25519"],
    ["Signature", brief.signature],
    ["Audit root (Merkle)", brief.audit_root],
    ["Public key", brief.public_key.replace(/\s+/g, " ").trim()],
    ["Integrity", "Tamper-evident: altering any audit entry breaks the recomputed Merkle root while the signature stays valid."],
  ];
  for (const [k, v] of prows) prov.addRow({ k, v });
  prov.getColumn("k").font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

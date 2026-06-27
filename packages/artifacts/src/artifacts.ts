import type { SignedBrief } from "@altai/contracts";
import { type Artifact, type ArtifactFormat, specFor } from "./types";
import { briefBasename } from "./util";
import { briefToJSON } from "./json";
import { briefToCSV } from "./csv";
import { briefToMarkdown } from "./markdown";
import { briefToSTIX } from "./stix";

export interface BuildOptions {
  /** Override "now" for deterministic STIX output (tests). */
  generatedAt?: string;
}

/**
 * Turn a signed brief into a downloadable file in any supported format. This is the
 * agent's deliverable surface — the same provenance-stamped signal, materialized as
 * the artifact the consumer needs (analyst note, spreadsheet, SIEM feed, raw signed
 * payload). The heavy xlsx path is lazily loaded so exceljs is only pulled when asked.
 */
export async function buildArtifact(
  brief: SignedBrief,
  format: ArtifactFormat,
  opts: BuildOptions = {},
): Promise<Artifact> {
  const spec = specFor(format);
  const filename = `${briefBasename(brief.signal)}.${spec.ext}`;
  let body: string | Uint8Array;
  switch (format) {
    case "json":
      body = briefToJSON(brief);
      break;
    case "csv":
      body = briefToCSV(brief);
      break;
    case "md":
      body = briefToMarkdown(brief);
      break;
    case "stix":
      body = briefToSTIX(brief, opts);
      break;
    case "xlsx": {
      const { briefToXLSX } = await import("./xlsx");
      body = await briefToXLSX(brief);
      break;
    }
  }
  return { format, filename, mime: spec.mime, body };
}

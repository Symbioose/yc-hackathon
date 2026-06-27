/** The file formats the agent can deliver a signed brief as. These mirror what real
 * threat-intelligence platforms (OpenCTI, Cyware, EclecticIQ, Cortex XSOAR) export. */
export type ArtifactFormat = "json" | "csv" | "md" | "xlsx" | "stix";

/** A generated file: a string for text formats, bytes for binary (xlsx). */
export interface Artifact {
  format: ArtifactFormat;
  filename: string;
  mime: string;
  body: string | Uint8Array;
}

export interface ArtifactSpec {
  format: ArtifactFormat;
  label: string;
  ext: string;
  mime: string;
  description: string;
}

/** Catalogue of deliverables, in the order the ops-center renders the buttons. */
export const ARTIFACT_FORMATS: ArtifactSpec[] = [
  { format: "xlsx", label: "Excel", ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", description: "Multi-sheet workbook: summary, sources, alpha, provenance." },
  { format: "csv", label: "CSV", ext: "csv", mime: "text/csv", description: "Corroborating sources table." },
  { format: "md", label: "Markdown", ext: "md", mime: "text/markdown", description: "Human-readable, provenance-stamped brief." },
  { format: "json", label: "JSON", ext: "json", mime: "application/json", description: "The full Ed25519-signed brief." },
  { format: "stix", label: "STIX 2.1", ext: "stix.json", mime: "application/stix+json", description: "STIX 2.1 bundle for SIEM/TIP ingest." },
];

export function specFor(format: ArtifactFormat): ArtifactSpec {
  const spec = ARTIFACT_FORMATS.find((s) => s.format === format);
  if (!spec) throw new Error(`Unknown artifact format: ${format}`);
  return spec;
}

export function isArtifactFormat(s: string): s is ArtifactFormat {
  return ARTIFACT_FORMATS.some((spec) => spec.format === s);
}

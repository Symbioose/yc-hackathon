import type { SignedBrief, SourceContribution } from "@altai/contracts";
import { deterministicUuid } from "./util";

export interface StixOptions {
  /** Override "now" for deterministic output (tests). */
  generatedAt?: string;
}

/** "YYYY-MM-DD" or ISO → RFC-3339 timestamp STIX requires. */
function toTimestamp(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T00:00:00.000Z`;
  const d = new Date(date);
  return Number.isNaN(+d) ? new Date(0).toISOString() : d.toISOString();
}

function stixId(type: string, brief: SignedBrief, role: string): string {
  return `${type}--${deterministicUuid(`${brief.signature}|${role}`)}`;
}

/**
 * A STIX 2.1 bundle (OASIS CTI) — the interchange format every TIP/SIEM speaks
 * (OpenCTI, MISP, Sentinel, Splunk, QRadar). Models the signal as an Identity
 * (victim) + Indicators (per corroborating source) + a Report, wired with
 * Relationships and stamped with Altai's Ed25519 attestation as custom `x_altai_*`
 * properties. Object ids are deterministic for a given brief.
 */
export function briefToSTIX(brief: SignedBrief, opts: StixOptions = {}): string {
  const { signal } = brief;
  const now = opts.generatedAt ?? new Date().toISOString();
  const base = { spec_version: "2.1" as const, created: now, modified: now };

  const objects: Record<string, unknown>[] = [];

  const identityId = stixId("identity", brief, "victim");
  objects.push({
    type: "identity",
    ...base,
    id: identityId,
    name: signal.entity,
    identity_class: "organization",
  });

  const indicatorRefs: string[] = [];
  const relationships: Record<string, unknown>[] = [];
  signal.sources.forEach((s: SourceContribution, i) => {
    if (!s.url) return;
    const indicatorId = stixId("indicator", brief, `indicator-${i}`);
    indicatorRefs.push(indicatorId);
    objects.push({
      type: "indicator",
      ...base,
      id: indicatorId,
      name: `${s.name} (${s.type})`,
      description: `Corroborating ${s.type} source for ${signal.entity} — ${signal.event_type}.`,
      indicator_types: ["compromised"],
      pattern: `[url:value = '${s.url.replace(/'/g, "\\'")}']`,
      pattern_type: "stix",
      valid_from: toTimestamp(s.observed_at),
      confidence: Math.round(s.reliability * 100),
    });
    relationships.push({
      type: "relationship",
      ...base,
      id: stixId("relationship", brief, `rel-${i}`),
      relationship_type: "related-to",
      source_ref: indicatorId,
      target_ref: identityId,
    });
  });

  const reportId = stixId("report", brief, "report");
  objects.push({
    type: "report",
    ...base,
    id: reportId,
    name: `Altai Intelligence Brief: ${signal.entity} — ${signal.event_type}`,
    description: signal.summary,
    report_types: ["threat-report"],
    published: now,
    confidence: Math.round(signal.confidence * 100),
    object_refs: [identityId, ...indicatorRefs],
    // Altai provenance — STIX 2.1 custom properties (x_ prefix).
    x_altai_event_type: signal.event_type,
    x_altai_ticker: signal.ticker,
    x_altai_observed_at: signal.observed_at,
    x_altai_disclosed_at: signal.disclosed_at,
    x_altai_lead_time_days: signal.lead_time_days,
    x_altai_confidence_method: signal.confidence_method,
    x_altai_audit_root: brief.audit_root,
    x_altai_signature: brief.signature,
    x_altai_public_key: brief.public_key,
  });

  objects.push(...relationships);

  const bundle = {
    type: "bundle",
    id: `bundle--${deterministicUuid(`${brief.signature}|bundle`)}`,
    objects,
  };
  return JSON.stringify(bundle, null, 2) + "\n";
}

import { z } from "zod";

/** The vocabulary of external source types. Shared by SourceContribution (what a
 * scout returns) and the Intelligence Network (the route graph is keyed on these). */
export const SourceTypeSchema = z.enum(["tor_forum", "breach_api", "paste", "press", "filing"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceContributionSchema = z.object({
  name: z.string(),
  type: SourceTypeSchema,
  url: z.string().optional(),
  reliability: z.number().min(0).max(1),
  observed_at: z.string(),
});
export type SourceContribution = z.infer<typeof SourceContributionSchema>;

export const AlphaCardSchema = z.object({
  strategy: z.string(),
  entry_date: z.string(),
  exit_date: z.string(),
  entry_price: z.number().optional(),
  exit_price: z.number().optional(),
  return_pct: z.number().optional(),
  max_drawdown_pct: z.number().optional(),
  note: z.string().optional(),
});
export type AlphaCard = z.infer<typeof AlphaCardSchema>;

export const MissionSchema = z.object({
  id: z.string(),
  query: z.string(),
  target_entity: z.string().optional(),
  ticker: z.string().optional(),
  allowed_sources: z.array(z.string()),
  scope: z.literal("osint_readonly").default("osint_readonly"),
  data_classes: z.array(z.string()),
  max_spend_usd: z.number(),
});
export type Mission = z.infer<typeof MissionSchema>;

export const SignalSchema = z.object({
  entity: z.string(),
  ticker: z.string().optional(),
  event_type: z.string(),
  sources: z.array(SourceContributionSchema),
  confidence: z.number().min(0).max(1),
  confidence_method: z.literal("noisy_or"),
  observed_at: z.string(),
  disclosed_at: z.string().optional(),
  lead_time_days: z.number().optional(),
  alpha: AlphaCardSchema.optional(),
  summary: z.string(),
});
export type Signal = z.infer<typeof SignalSchema>;

export const AuditEntrySchema = z.object({
  seq: z.number(),
  ts: z.string(),
  actor: z.string(),
  action: z.string(),
  source: z.string().optional(),
  target: z.string().optional(),
  hash: z.string(),
  prev_hash: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const SignedBriefSchema = z.object({
  signal: SignalSchema,
  audit_root: z.string(),
  signature: z.string(),
  public_key: z.string(),
});
export type SignedBrief = z.infer<typeof SignedBriefSchema>;

export const TraceEventSchema = z.object({
  mission_id: z.string(),
  ts: z.string(),
  // "memory" is the Intelligence Network layer (procedural memory: warm-start +
  // learning). Appended after the original six — older consumers fall back gracefully.
  layer: z.enum(["dispatch", "policy", "identity", "execution", "membrane", "audit", "memory"]),
  agent: z.string(),
  level: z.enum(["info", "action", "warn", "block", "success"]),
  msg: z.string(),
  meta: z.record(z.unknown()).optional(),
});
export type TraceEvent = z.infer<typeof TraceEventSchema>;

// ===================== Intelligence Network ("Signal DNA") =====================
// Procedural memory: it learns *how* a signal is found (routes), never *what* was
// asked (entities/queries). These wire schemas cross the SSE/API boundary to the UI.

/** The four cost axes a mission is measured on. Lower hops/latency/cost + higher
 * confidence is a better-learned route. */
export const MissionMetricsSchema = z.object({
  hops: z.number(),
  latency_ms: z.number(),
  cost_usd: z.number(),
  confidence: z.number().min(0).max(1),
});
export type MissionMetrics = z.infer<typeof MissionMetricsSchema>;

/** A warm-start prior handed to the Planner: the route recalled from similar past
 * missions, used to order/select the scouts. */
export const MemoryRecallSchema = z.object({
  recalled: z.boolean(),
  route: z.array(SourceTypeSchema),
  recalled_from: z.number(),
  reason: z.string(),
});
export type MemoryRecall = z.infer<typeof MemoryRecallSchema>;

/** One learned edge of the discovery graph: source_type → source_type with the
 * reward stats the membrane (the oracle) accumulated over many missions. */
export const RouteEdgeSchema = z.object({
  from: z.string(), // "START" or a SourceType
  to: SourceTypeSchema,
  visits: z.number(),
  success_rate: z.number().min(0).max(1),
  avg_confidence: z.number().min(0).max(1),
  avg_cost_usd: z.number(),
  avg_latency_ms: z.number(),
  reward: z.number(),
});
export type RouteEdge = z.infer<typeof RouteEdgeSchema>;

/** The snapshot the ops-center INTELLIGENCE NETWORK panel renders: the before/after
 * transformation on the same mission plus the current learned graph. */
export const MemoryReportSchema = z.object({
  mission_id: z.string().optional(),
  mission_type: z.string(),
  sector: z.string(),
  recalled_from: z.number(),
  run_index: z.number(),
  route: z.array(SourceTypeSchema),
  cold: MissionMetricsSchema,
  warmed: MissionMetricsSchema,
  edges: z.array(RouteEdgeSchema),
});
export type MemoryReport = z.infer<typeof MemoryReportSchema>;

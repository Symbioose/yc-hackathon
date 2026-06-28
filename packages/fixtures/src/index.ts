import type { SourceContribution } from "@altai/contracts";

/** Noisy-OR fusion over independent sources: confidence = 1 − Π(1 − reliabilityᵢ). */
export function fuseConfidence(sources: SourceContribution[]): number {
  const p = sources.reduce((acc, s) => acc * (1 - s.reliability), 1);
  return Number((1 - p).toFixed(4));
}

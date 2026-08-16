export const GAUNTLET_FAILURE_CLASSES = [
  "premature_stop",
  "stale_active_candidate",
  "horizon_invariant",
  "reviewer_routing",
  "mandatory_evidence_missing",
  "invalid_acceptance",
  "state_transition",
  "model_unavailable",
  "rate_limited",
  "quota_exhausted",
  "internal_error",
  "unknown",
] as const;

export type GauntletFailureClass = (typeof GAUNTLET_FAILURE_CLASSES)[number];

export function isGauntletFailureClass(value: unknown): value is GauntletFailureClass {
  return typeof value === "string" && GAUNTLET_FAILURE_CLASSES.includes(value as GauntletFailureClass);
}

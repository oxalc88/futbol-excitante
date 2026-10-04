export const GAUNTLET_STOP_REASONS = [
  "human_needed_spec",
  "human_needed_legal",
  "verification_blocked",
  "builders_exhausted",
  "explicitly_deferred",
  "quota_handoff",
] as const;

export type GauntletStopReason = (typeof GAUNTLET_STOP_REASONS)[number];

export function isAllowedStopReason(value: unknown, evidence?: { verification_blocked?: boolean; safe_objective_available?: boolean; environment_decision_required?: boolean }): value is GauntletStopReason {
  if (value === "verification_blocked") return evidence?.verification_blocked === true && evidence.safe_objective_available === false && evidence.environment_decision_required === true;
  return typeof value === "string" && GAUNTLET_STOP_REASONS.includes(value as GauntletStopReason);
}

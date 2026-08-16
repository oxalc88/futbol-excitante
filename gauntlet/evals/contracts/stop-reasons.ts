export const GAUNTLET_STOP_REASONS = [
  "human_needed_spec",
  "human_needed_legal",
  "builders_exhausted",
  "explicitly_deferred",
  "quota_handoff",
] as const;

export type GauntletStopReason = (typeof GAUNTLET_STOP_REASONS)[number];

export function isAllowedStopReason(value: unknown): value is GauntletStopReason {
  return typeof value === "string" && GAUNTLET_STOP_REASONS.includes(value as GauntletStopReason);
}

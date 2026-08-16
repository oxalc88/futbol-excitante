export const GAUNTLET_EVENT_NAMES = [
  "objective.started",
  "builder.completed",
  "critic.completed",
  "integration.completed",
  "objective.accepted",
  "objective.retried",
  "objective.blocked",
  "horizon.advanced",
  "horizon.replanned",
  "orchestrator.stopped",
] as const;

export type GauntletEventName = (typeof GAUNTLET_EVENT_NAMES)[number];

export interface GauntletEvent {
  event: GauntletEventName;
  run_id?: string;
  horizon_id?: string;
  objective_id?: string;
  attempt_id?: string;
  agent?: string;
  model?: string;
  verdict?: "ACCEPT" | "RETRY" | "REJECT" | "BLOCKED";
  failure_class?: string;
  duration_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
}

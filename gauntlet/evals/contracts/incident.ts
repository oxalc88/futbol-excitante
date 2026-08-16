import type { GauntletFailureClass } from "./failures.js";

export const INCIDENT_SOURCES = ["deterministic_eval", "prompt_gate", "model_eval", "live_run"] as const;
export type IncidentSource = (typeof INCIDENT_SOURCES)[number];

export interface GauntletIncident {
  schema_version: 1;
  incident_id: string;
  detected_at: string;
  source: IncidentSource;
  failure_class: GauntletFailureClass;
  scenario_id?: string;
  run_id?: string;
  horizon_id?: string;
  objective_id?: string;
  attempt_id?: string;
  agent?: string;
  model?: string;
  event?: string;
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
  scenario_candidate: boolean;
}

export interface IncidentInput {
  source: IncidentSource;
  failure_class: GauntletFailureClass;
  scenario_id?: string;
  agent?: string;
  model?: string;
  event?: string;
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
  scenario_candidate?: boolean;
}

function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "unknown";
}

export function createIncident(input: IncidentInput, now = new Date()): GauntletIncident {
  const source = safePart(input.source);
  const scenario = safePart(input.scenario_id ?? "unscoped");
  const timestamp = now.toISOString().replace(/[:.]/g, "-");

  return {
    schema_version: 1,
    incident_id: `${timestamp}-${source}-${scenario}`,
    detected_at: now.toISOString(),
    source: input.source,
    failure_class: input.failure_class,
    scenario_id: input.scenario_id,
    agent: input.agent,
    model: input.model,
    event: input.event,
    expected: input.expected,
    observed: input.observed,
    scenario_candidate: input.scenario_candidate ?? true,
  };
}

import type { GauntletFailureClass } from "./failures.js";
import type { GauntletStopReason } from "./stop-reasons.js";

export type ScenarioKind =
  | "evidence_gate"
  | "horizon_validation"
  | "routing_fallback"
  | "continuation";

export interface ScenarioExpectation {
  decision: string;
  failure_class?: GauntletFailureClass;
  next_objective?: string;
  next_agent?: string;
  clear_active_candidate?: boolean;
}

export interface EvidenceGateScenario {
  id: string;
  kind: "evidence_gate";
  input: {
    objective_id: string;
    gameplay_or_presentation: boolean;
    screenshot_required: boolean;
    screenshot_exists: boolean;
    critic_verdict: "ACCEPT" | "RETRY" | "REJECT";
  };
  expect: ScenarioExpectation;
}

export interface HorizonValidationScenario {
  id: string;
  kind: "horizon_validation";
  input: {
    objectives: Array<{ id: string; status: "pending" | "accepted" | "blocked" }>;
    current_index: number;
  };
  expect: ScenarioExpectation;
}

export interface RoutingFallbackScenario {
  id: string;
  kind: "routing_fallback";
  input: {
    role: "critic" | "integration-reviewer";
    failed_model: string;
    failure_class: GauntletFailureClass;
    builder_model: string;
  };
  expect: ScenarioExpectation;
}

export interface ContinuationScenario {
  id: string;
  kind: "continuation";
  input: {
    active_candidate: string | null;
    accepted: string[];
    current_index: number;
    objectives: Array<{ id: string; status: "pending" | "accepted" | "blocked" }>;
    stop_reason?: GauntletStopReason | null;
  };
  expect: ScenarioExpectation;
}

export type GauntletScenario =
  | EvidenceGateScenario
  | HorizonValidationScenario
  | RoutingFallbackScenario
  | ContinuationScenario;

export interface EvaluationResult extends ScenarioExpectation {
  scenario_id: string;
}

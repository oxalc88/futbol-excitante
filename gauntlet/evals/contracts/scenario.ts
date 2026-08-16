import type { GauntletFailureClass } from "./failures.js";
import type { GauntletStopReason } from "./stop-reasons.js";

export type ScenarioKind =
  | "evidence_gate"
  | "horizon_validation"
  | "routing_fallback"
  | "continuation"
  | "tracking_gate"
  | "composition_gate"
  | "accepted_state_gate"
  | "eval_freshness_gate"
  | "evidence_uniqueness_gate"
  | "timing_consistency_gate"
  | "acceptance_pipeline_gate";

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
  input: { objective_id: string; gameplay_or_presentation: boolean; browser_behavior?: boolean; screenshot_required: boolean; screenshot_exists: boolean; critic_verdict: "ACCEPT" | "RETRY" | "REJECT" };
  expect: ScenarioExpectation;
}

export interface HorizonValidationScenario {
  id: string;
  kind: "horizon_validation";
  input: { objectives: Array<{ id: string; status: "pending" | "accepted" | "blocked" }>; current_index: number };
  expect: ScenarioExpectation;
}

export interface RoutingFallbackScenario {
  id: string;
  kind: "routing_fallback";
  input: { role: "critic" | "integration-reviewer"; failed_model: string; failure_class: GauntletFailureClass; builder_model: string };
  expect: ScenarioExpectation;
}

export interface ContinuationScenario {
  id: string;
  kind: "continuation";
  input: { active_candidate: string | null; accepted: string[]; current_index: number; objectives: Array<{ id: string; status: "pending" | "accepted" | "blocked" }>; stop_reason?: GauntletStopReason | null };
  expect: ScenarioExpectation;
}

export interface TrackingGateScenario {
  id: string;
  kind: "tracking_gate";
  input: { objective_id: string; tracking_markers_match: boolean; per_step_usage_recorded: boolean; model_aggregates_refreshed: boolean; model_evaluation_recorded: boolean };
  expect: ScenarioExpectation;
}

export interface CompositionGateScenario {
  id: string;
  kind: "composition_gate";
  input: { objective_id: string; integrated_behavior: boolean; unit_tests_pass: boolean; screenshot_exists: boolean; integration_test_pass: boolean; trajectory_exists: boolean; critic_verdict: "ACCEPT" | "RETRY" | "REJECT" };
  expect: ScenarioExpectation;
}

export interface AcceptedStateGateScenario {
  id: string;
  kind: "accepted_state_gate";
  input: { latest_accepted_in_list: boolean; current_horizon_consistent: boolean };
  expect: ScenarioExpectation;
}

export interface EvalFreshnessGateScenario {
  id: string;
  kind: "eval_freshness_gate";
  input: { v07_records_exist: boolean; latest_accepted_has_record: boolean };
  expect: ScenarioExpectation;
}

export interface EvidenceUniquenessGateScenario {
  id: string;
  kind: "evidence_uniqueness_gate";
  input: { duplicate_sha: boolean; criterion_claims_new_evidence: boolean };
  expect: ScenarioExpectation;
}

export interface TimingConsistencyGateScenario {
  id: string;
  kind: "timing_consistency_gate";
  input: { tracking_markers_match: boolean; clock_measurement_matches: boolean; latest_rows_present: boolean };
  expect: ScenarioExpectation;
}

export interface AcceptancePipelineGateScenario {
  id: string;
  kind: "acceptance_pipeline_gate";
  input: { deterministic_audit: "PASS" | "FAIL" | "REVIEW_REQUIRED"; semantic_audit: "NOT_REQUIRED" | "VALID" | "INVALID" | "INSUFFICIENT_CONTEXT"; critic_verdict: "ACCEPT" | "RETRY" | "REJECT" | "MISSING"; integration_verdict: "ACCEPT" | "REJECT" | "MISSING" };
  expect: ScenarioExpectation;
}

export type GauntletScenario = EvidenceGateScenario | HorizonValidationScenario | RoutingFallbackScenario | ContinuationScenario | TrackingGateScenario | CompositionGateScenario | AcceptedStateGateScenario | EvalFreshnessGateScenario | EvidenceUniquenessGateScenario | TimingConsistencyGateScenario | AcceptancePipelineGateScenario;

export interface EvaluationResult extends ScenarioExpectation { scenario_id: string }

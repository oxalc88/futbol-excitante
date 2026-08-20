import type { GauntletFailureClass } from "./failures.js";
import type { GauntletStopReason } from "./stop-reasons.js";

export type MilestoneSituationOutcome = "PASS" | "FAIL" | "NOT_EVALUATED" | "NEEDS_PERCEPTUAL_REVIEW";
export type MilestoneVerdict = "PASS" | "FAIL" | "NOT_EVALUATED" | "NEEDS_PERCEPTUAL_REVIEW";
export type ValidationStatus = "PASS" | "FAIL";
export type RegressionInboxStatus = "OPEN" | "RESOLVED" | "MISSING";

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
  | "acceptance_pipeline_gate"
  | "acceptance_claim_gate"
  | "post_acceptance_continuation_gate"
  | "remote_durability_gate"
  | "acceptance_state_durability_gate"
  | "cleanup_classification_gate"
  | "milestone_playtest_gate"
  | "manifest_gate"
  | "dynamic_sequence_gate"
  | "pr_regression_classification_gate"
  | "regression_inbox_gate"
  | "regression_monitor_trigger_gate";

export interface ScenarioExpectation {
  decision: string;
  failure_class?: GauntletFailureClass;
  next_objective?: string;
  next_agent?: string;
  clear_active_candidate?: boolean;
  milestone_verdict?: MilestoneVerdict;
}

export interface EvidenceGateScenario { id: string; kind: "evidence_gate"; input: { objective_id: string; gameplay_or_presentation: boolean; browser_behavior?: boolean; screenshot_required: boolean; screenshot_exists: boolean; critic_verdict: "ACCEPT" | "RETRY" | "REJECT" }; expect: ScenarioExpectation }
export interface HorizonValidationScenario { id: string; kind: "horizon_validation"; input: { objectives: Array<{ id: string; status: "pending" | "accepted" | "blocked" }>; current_index: number }; expect: ScenarioExpectation }
export interface RoutingFallbackScenario { id: string; kind: "routing_fallback"; input: { role: "critic" | "integration-reviewer"; failed_model: string; failure_class: GauntletFailureClass; builder_model: string; compatible_fallback_agents?: string[] }; expect: ScenarioExpectation }
export interface ContinuationScenario { id: string; kind: "continuation"; input: { active_candidate: string | null; accepted: string[]; current_index: number; objectives: Array<{ id: string; status: "pending" | "accepted" | "blocked" }>; stop_reason?: GauntletStopReason | null }; expect: ScenarioExpectation }
export interface TrackingGateScenario { id: string; kind: "tracking_gate"; input: { objective_id: string; tracking_markers_match: boolean; per_step_usage_recorded: boolean; model_aggregates_refreshed: boolean; model_evaluation_recorded: boolean }; expect: ScenarioExpectation }
export interface CompositionGateScenario { id: string; kind: "composition_gate"; input: { objective_id: string; integrated_behavior: boolean; unit_tests_pass: boolean; screenshot_exists: boolean; integration_test_pass: boolean; trajectory_exists: boolean; critic_verdict: "ACCEPT" | "RETRY" | "REJECT" }; expect: ScenarioExpectation }
export interface AcceptedStateGateScenario { id: string; kind: "accepted_state_gate"; input: { latest_accepted_in_list: boolean; current_horizon_consistent: boolean }; expect: ScenarioExpectation }
export interface EvalFreshnessGateScenario { id: string; kind: "eval_freshness_gate"; input: { v07_records_exist: boolean; latest_accepted_has_record: boolean }; expect: ScenarioExpectation }
export interface EvidenceUniquenessGateScenario { id: string; kind: "evidence_uniqueness_gate"; input: { duplicate_sha: boolean; criterion_claims_new_evidence: boolean }; expect: ScenarioExpectation }
export interface TimingConsistencyGateScenario { id: string; kind: "timing_consistency_gate"; input: { tracking_markers_match: boolean; clock_measurement_matches: boolean; latest_rows_present: boolean; global_aggregates_through_latest?: boolean }; expect: ScenarioExpectation }
export interface AcceptancePipelineGateScenario { id: string; kind: "acceptance_pipeline_gate"; input: { deterministic_audit: "PASS" | "FAIL" | "REVIEW_REQUIRED"; semantic_audit: "NOT_REQUIRED" | "VALID" | "INVALID" | "INSUFFICIENT_CONTEXT"; critic_verdict: "ACCEPT" | "RETRY" | "REJECT" | "MISSING"; integration_verdict: "ACCEPT" | "REJECT" | "MISSING" }; expect: ScenarioExpectation }
export interface AcceptanceClaimGateScenario { id: string; kind: "acceptance_claim_gate"; input: { claims_fully_accepted: boolean; acceptance_record_exists: boolean; objective_manifest_exists: boolean; state_marks_accepted: boolean; candidate_commit_exists: boolean }; expect: ScenarioExpectation }
export interface PostAcceptanceContinuationGateScenario { id: string; kind: "post_acceptance_continuation_gate"; input: { acceptance_finalized: boolean; horizon_exhausted: boolean; replan_completed?: boolean; next_objective?: string | null; stop_reason?: GauntletStopReason | null }; expect: ScenarioExpectation }
export interface RemoteDurabilityGateScenario { id: string; kind: "remote_durability_gate"; input: { acceptance_finalized: boolean; remote_contains_acceptance: boolean; horizon_exhausted: boolean; next_objective?: string | null }; expect: ScenarioExpectation }
export interface AcceptanceStateDurabilityGateScenario { id: string; kind: "acceptance_state_durability_gate"; input: { acceptance_finalized: boolean; changed_bookkeeping_committed: boolean; committed_state_valid: boolean; remote_contains_acceptance: boolean; remote_state_valid: boolean; next_objective?: string | null }; expect: ScenarioExpectation }
export interface CleanupClassificationGateScenario { id: string; kind: "cleanup_classification_gate"; input: { path_class: "accepted_evidence" | "ephemeral_artifact" | "canonical_state"; newer_than_remote: boolean }; expect: ScenarioExpectation }
export interface MilestonePlaytestGateScenario { id: string; kind: "milestone_playtest_gate"; input: { milestone_id: string; entry_prerequisites_pass: boolean; exit_prerequisites_pass: boolean; required_situations: string[]; situation_outcomes: Record<string, MilestoneSituationOutcome>; critic_verdict: "ACCEPT" | "RETRY" | "REJECT" | "MISSING" }; expect: ScenarioExpectation }
export interface ManifestGateScenario { id: string; kind: "manifest_gate"; input: { gauntlet_version: string; objective_accepted: boolean; manifest_exists: boolean; artifact_commit_bound: boolean; reviews_persisted: boolean }; expect: ScenarioExpectation }
export interface DynamicSequenceGateScenario { id: string; kind: "dynamic_sequence_gate"; input: { evidence_class: string; temporal_and_visual?: boolean; frame_count: number; sequence_manifest_exists: boolean; labels_complete: boolean; event_centered_required?: boolean; event_centered?: boolean }; expect: ScenarioExpectation }
export interface PrRegressionClassificationGateScenario { id: string; kind: "pr_regression_classification_gate"; input: { base_status: ValidationStatus; head_status: ValidationStatus; base_signature: string | null; head_signature: string | null }; expect: ScenarioExpectation }
export interface RegressionInboxGateScenario { id: string; kind: "regression_inbox_gate"; input: { check_status: ValidationStatus; current_status: RegressionInboxStatus; current_signature: string | null; observed_signature: string | null }; expect: ScenarioExpectation }
export interface RegressionMonitorTriggerGateScenario { id: string; kind: "regression_monitor_trigger_gate"; input: { pushed_branch: string }; expect: ScenarioExpectation }

export type GauntletScenario = EvidenceGateScenario | HorizonValidationScenario | RoutingFallbackScenario | ContinuationScenario | TrackingGateScenario | CompositionGateScenario | AcceptedStateGateScenario | EvalFreshnessGateScenario | EvidenceUniquenessGateScenario | TimingConsistencyGateScenario | AcceptancePipelineGateScenario | AcceptanceClaimGateScenario | PostAcceptanceContinuationGateScenario | RemoteDurabilityGateScenario | AcceptanceStateDurabilityGateScenario | CleanupClassificationGateScenario | MilestonePlaytestGateScenario | ManifestGateScenario | DynamicSequenceGateScenario | PrRegressionClassificationGateScenario | RegressionInboxGateScenario | RegressionMonitorTriggerGateScenario;
export interface EvaluationResult extends ScenarioExpectation { scenario_id: string }

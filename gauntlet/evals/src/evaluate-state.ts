import { isAllowedStopReason } from "../contracts/stop-reasons.js";
import type { EvaluationResult, GauntletScenario, ContinuationScenario, EvidenceGateScenario, HorizonValidationScenario, RoutingFallbackScenario, TrackingGateScenario, CompositionGateScenario, AcceptedStateGateScenario, EvalFreshnessGateScenario, EvidenceUniquenessGateScenario, TimingConsistencyGateScenario, AcceptancePipelineGateScenario } from "../contracts/scenario.js";

function evaluateEvidence(s: EvidenceGateScenario): EvaluationResult {
  const mandatory = s.input.gameplay_or_presentation || s.input.browser_behavior === true || s.input.screenshot_required;
  if (mandatory && !s.input.screenshot_exists && s.input.critic_verdict === "ACCEPT") return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "mandatory_evidence_missing" };
  return { scenario_id: s.id, decision: "allow_review_result" };
}

function evaluateHorizon(s: HorizonValidationScenario): EvaluationResult {
  const ids = s.input.objectives.map((o) => o.id);
  if (new Set(ids).size !== ids.length) return { scenario_id: s.id, decision: "reject_state", failure_class: "horizon_invariant" };
  const firstPending = s.input.objectives.findIndex((o) => o.status === "pending");
  const expected = firstPending === -1 ? s.input.objectives.length : firstPending;
  if (s.input.current_index !== expected) return { scenario_id: s.id, decision: "reject_state", failure_class: "horizon_invariant" };
  return { scenario_id: s.id, decision: "state_valid" };
}

function evaluateRouting(s: RoutingFallbackScenario): EvaluationResult {
  const modelSpecific = ["quota_exhausted", "model_unavailable", "rate_limited"].includes(s.input.failure_class);
  if (s.input.failed_model === "deepseek-v4-flash-0731" && modelSpecific) return { scenario_id: s.id, decision: "fallback", next_agent: s.input.role === "critic" ? "critic-flash" : "integration-reviewer-flash" };
  return { scenario_id: s.id, decision: "do_not_model_fallback", failure_class: "reviewer_routing" };
}

function nextPending(s: ContinuationScenario): string | undefined {
  for (let i = s.input.current_index; i < s.input.objectives.length; i += 1) if (s.input.objectives[i]?.status === "pending") return s.input.objectives[i]?.id;
  return undefined;
}

function evaluateContinuation(s: ContinuationScenario): EvaluationResult {
  if (s.input.stop_reason && isAllowedStopReason(s.input.stop_reason)) return { scenario_id: s.id, decision: "stop" };
  const next = nextPending(s);
  const stale = s.input.active_candidate !== null && s.input.accepted.includes(s.input.active_candidate);
  if (stale && next) return { scenario_id: s.id, decision: "repair_and_continue", failure_class: "stale_active_candidate", clear_active_candidate: true, next_objective: next };
  if (next) return { scenario_id: s.id, decision: "continue", next_objective: next };
  return { scenario_id: s.id, decision: "replan" };
}

function evaluateTracking(s: TrackingGateScenario): EvaluationResult {
  const complete = s.input.tracking_markers_match && s.input.per_step_usage_recorded && s.input.model_aggregates_refreshed && s.input.model_evaluation_recorded;
  return complete ? { scenario_id: s.id, decision: "tracking_complete" } : { scenario_id: s.id, decision: "repair_tracking", failure_class: "tracking_missing" };
}

function evaluateComposition(s: CompositionGateScenario): EvaluationResult {
  const complete = !s.input.integrated_behavior || (s.input.integration_test_pass && s.input.trajectory_exists);
  if (!complete && s.input.critic_verdict === "ACCEPT") return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "composition_regression" };
  return { scenario_id: s.id, decision: "allow_review_result" };
}

function evaluateAcceptedState(s: AcceptedStateGateScenario): EvaluationResult {
  if (!s.input.latest_accepted_in_list || !s.input.current_horizon_consistent) return { scenario_id: s.id, decision: "repair_state", failure_class: "accepted_state_inconsistent" };
  return { scenario_id: s.id, decision: "state_valid" };
}

function evaluateFreshness(s: EvalFreshnessGateScenario): EvaluationResult {
  if (s.input.v07_records_exist && !s.input.latest_accepted_has_record) return { scenario_id: s.id, decision: "repair_persistence", failure_class: "eval_result_stale" };
  return { scenario_id: s.id, decision: "persistence_fresh" };
}

function evaluateUniqueness(s: EvidenceUniquenessGateScenario): EvaluationResult {
  if (s.input.duplicate_sha && s.input.criterion_claims_new_evidence) return { scenario_id: s.id, decision: "review_required", failure_class: "evidence_reuse_review" };
  return { scenario_id: s.id, decision: "evidence_clear" };
}

function evaluateTimingConsistency(s: TimingConsistencyGateScenario): EvaluationResult {
  if (!s.input.tracking_markers_match || !s.input.clock_measurement_matches || !s.input.latest_rows_present) return { scenario_id: s.id, decision: "repair_tracking", failure_class: "timing_state_inconsistent" };
  return { scenario_id: s.id, decision: "timing_consistent" };
}

function evaluateAcceptancePipeline(s: AcceptancePipelineGateScenario): EvaluationResult {
  if (s.input.deterministic_audit !== "PASS") return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "invalid_acceptance" };
  if (!["NOT_REQUIRED", "VALID"].includes(s.input.semantic_audit)) return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "invalid_acceptance" };
  if (s.input.critic_verdict === "MISSING") return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "critic_bypassed" };
  if (s.input.critic_verdict !== "ACCEPT" || s.input.integration_verdict !== "ACCEPT") return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "invalid_acceptance" };
  return { scenario_id: s.id, decision: "candidate_acceptance_ready" };
}

export function evaluateScenario(s: GauntletScenario): EvaluationResult {
  switch (s.kind) {
    case "evidence_gate": return evaluateEvidence(s);
    case "horizon_validation": return evaluateHorizon(s);
    case "routing_fallback": return evaluateRouting(s);
    case "continuation": return evaluateContinuation(s);
    case "tracking_gate": return evaluateTracking(s);
    case "composition_gate": return evaluateComposition(s);
    case "accepted_state_gate": return evaluateAcceptedState(s);
    case "eval_freshness_gate": return evaluateFreshness(s);
    case "evidence_uniqueness_gate": return evaluateUniqueness(s);
    case "timing_consistency_gate": return evaluateTimingConsistency(s);
    case "acceptance_pipeline_gate": return evaluateAcceptancePipeline(s);
  }
}

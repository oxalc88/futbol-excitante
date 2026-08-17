import { isAllowedStopReason } from "../contracts/stop-reasons.js";
import type {
  EvaluationResult,
  GauntletScenario,
  ContinuationScenario,
  EvidenceGateScenario,
  HorizonValidationScenario,
  RoutingFallbackScenario,
  TrackingGateScenario,
  CompositionGateScenario,
  AcceptedStateGateScenario,
  EvalFreshnessGateScenario,
  EvidenceUniquenessGateScenario,
  TimingConsistencyGateScenario,
  AcceptancePipelineGateScenario,
  AcceptanceClaimGateScenario,
  PostAcceptanceContinuationGateScenario,
  RemoteDurabilityGateScenario,
  MilestonePlaytestGateScenario,
  ManifestGateScenario,
  DynamicSequenceGateScenario,
} from "../contracts/scenario.js";

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

function evaluateAcceptanceClaim(s: AcceptanceClaimGateScenario): EvaluationResult {
  const durable = s.input.acceptance_record_exists && s.input.objective_manifest_exists && s.input.state_marks_accepted && s.input.candidate_commit_exists;
  if (s.input.claims_fully_accepted && !durable) return { scenario_id: s.id, decision: "reject_claim", failure_class: "acceptance_claim_unproven" };
  return { scenario_id: s.id, decision: durable ? "acceptance_claim_allowed" : "candidate_not_final" };
}

function evaluatePostAcceptanceContinuation(s: PostAcceptanceContinuationGateScenario): EvaluationResult {
  if (s.input.stop_reason && isAllowedStopReason(s.input.stop_reason)) return { scenario_id: s.id, decision: "stop" };
  if (!s.input.acceptance_finalized) return { scenario_id: s.id, decision: "finish_acceptance" };
  if (s.input.replan_completed && s.input.next_objective) return { scenario_id: s.id, decision: "delegate_and_continue", next_objective: s.input.next_objective };
  if (s.input.horizon_exhausted) return { scenario_id: s.id, decision: "replan_and_continue" };
  if (s.input.next_objective) return { scenario_id: s.id, decision: "continue", next_objective: s.input.next_objective };
  return { scenario_id: s.id, decision: "replan_and_continue" };
}

function evaluateRemoteDurability(s: RemoteDurabilityGateScenario): EvaluationResult {
  if (!s.input.acceptance_finalized) return { scenario_id: s.id, decision: "finish_acceptance" };
  if (!s.input.remote_contains_acceptance) return { scenario_id: s.id, decision: s.input.horizon_exhausted ? "publish_before_replan" : "publish_before_continue", failure_class: "remote_durability_missing" };
  if (s.input.horizon_exhausted) return { scenario_id: s.id, decision: "replan_and_continue" };
  if (s.input.next_objective) return { scenario_id: s.id, decision: "continue", next_objective: s.input.next_objective };
  return { scenario_id: s.id, decision: "replan_and_continue" };
}

export function evaluateMilestonePlaytest(s: MilestonePlaytestGateScenario): EvaluationResult {
  const missingSituation = s.input.required_situations.find((id) => !(id in s.input.situation_outcomes));
  if (!s.input.entry_prerequisites_pass || !s.input.exit_prerequisites_pass || missingSituation) return { scenario_id: s.id, decision: "milestone_not_evaluated", milestone_verdict: "NOT_EVALUATED", failure_class: "milestone_playtest_incomplete" };
  const outcomes = s.input.required_situations.map((id) => s.input.situation_outcomes[id]);
  if (outcomes.includes("FAIL")) return { scenario_id: s.id, decision: "milestone_failed", milestone_verdict: "FAIL", failure_class: "milestone_playtest_failed" };
  if (outcomes.includes("NOT_EVALUATED")) return { scenario_id: s.id, decision: "milestone_not_evaluated", milestone_verdict: "NOT_EVALUATED", failure_class: "milestone_playtest_incomplete" };
  if (outcomes.includes("NEEDS_PERCEPTUAL_REVIEW")) return { scenario_id: s.id, decision: "milestone_needs_perceptual_review", milestone_verdict: "NEEDS_PERCEPTUAL_REVIEW", failure_class: "milestone_perceptual_review_required" };
  if (s.input.critic_verdict === "MISSING") return { scenario_id: s.id, decision: "reject_milestone_verdict", milestone_verdict: "NEEDS_PERCEPTUAL_REVIEW", failure_class: "critic_bypassed" };
  if (s.input.critic_verdict !== "ACCEPT") return { scenario_id: s.id, decision: "milestone_failed", milestone_verdict: "FAIL", failure_class: "milestone_playtest_failed" };
  return { scenario_id: s.id, decision: "milestone_verdict_ready", milestone_verdict: "PASS" };
}

function evaluateManifest(s: ManifestGateScenario): EvaluationResult {
  const applies = s.input.objective_accepted && /^0\.(?:[89]|[1-9]\d+)\./.test(s.input.gauntlet_version);
  if (applies && (!s.input.manifest_exists || !s.input.artifact_commit_bound || !s.input.reviews_persisted)) return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "manifest_missing" };
  return { scenario_id: s.id, decision: "manifest_valid" };
}

function evaluateDynamicSequence(s: DynamicSequenceGateScenario): EvaluationResult {
  if (s.input.temporal_and_visual === true && s.input.evidence_class !== "DYNAMIC_VISUAL") return { scenario_id: s.id, decision: "reject_evidence_class", failure_class: "evidence_class_too_weak" };
  if (s.input.evidence_class !== "DYNAMIC_VISUAL") return { scenario_id: s.id, decision: "sequence_not_required" };
  const valid = s.input.frame_count >= 3 && s.input.frame_count <= 5 && s.input.sequence_manifest_exists && s.input.labels_complete;
  if (!valid) return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "dynamic_sequence_missing" };
  if (s.input.event_centered_required === true && s.input.event_centered !== true) return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "event_evidence_not_centered" };
  return { scenario_id: s.id, decision: "sequence_valid" };
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
    case "acceptance_claim_gate": return evaluateAcceptanceClaim(s);
    case "post_acceptance_continuation_gate": return evaluatePostAcceptanceContinuation(s);
    case "remote_durability_gate": return evaluateRemoteDurability(s);
    case "milestone_playtest_gate": return evaluateMilestonePlaytest(s);
    case "manifest_gate": return evaluateManifest(s);
    case "dynamic_sequence_gate": return evaluateDynamicSequence(s);
  }
}

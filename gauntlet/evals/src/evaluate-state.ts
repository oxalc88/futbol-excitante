import { isAllowedStopReason } from "../contracts/stop-reasons.js";
import type {
  EvaluationResult,
  GauntletScenario,
  ContinuationScenario,
  EvidenceGateScenario,
  HorizonValidationScenario,
  RoutingFallbackScenario,
  TrackingGateScenario,
} from "../contracts/scenario.js";

function evaluateEvidence(scenario: EvidenceGateScenario): EvaluationResult {
  const screenshotIsMandatory =
    scenario.input.gameplay_or_presentation ||
    scenario.input.browser_behavior === true ||
    scenario.input.screenshot_required;
  const missingRequiredScreenshot = screenshotIsMandatory && !scenario.input.screenshot_exists;

  if (missingRequiredScreenshot && scenario.input.critic_verdict === "ACCEPT") {
    return {
      scenario_id: scenario.id,
      decision: "reject_acceptance",
      failure_class: "mandatory_evidence_missing",
    };
  }

  return { scenario_id: scenario.id, decision: "allow_review_result" };
}

function evaluateHorizon(scenario: HorizonValidationScenario): EvaluationResult {
  const ids = scenario.input.objectives.map((objective) => objective.id);
  if (new Set(ids).size !== ids.length) {
    return {
      scenario_id: scenario.id,
      decision: "reject_state",
      failure_class: "horizon_invariant",
    };
  }

  const firstPending = scenario.input.objectives.findIndex((objective) => objective.status === "pending");
  const expectedIndex = firstPending === -1 ? scenario.input.objectives.length : firstPending;
  if (scenario.input.current_index !== expectedIndex) {
    return {
      scenario_id: scenario.id,
      decision: "reject_state",
      failure_class: "horizon_invariant",
    };
  }

  return { scenario_id: scenario.id, decision: "state_valid" };
}

function evaluateRouting(scenario: RoutingFallbackScenario): EvaluationResult {
  const modelSpecificFailure = ["quota_exhausted", "model_unavailable", "rate_limited"].includes(
    scenario.input.failure_class,
  );

  if (scenario.input.failed_model === "deepseek-v4-flash-0731" && modelSpecificFailure) {
    return {
      scenario_id: scenario.id,
      decision: "fallback",
      next_agent: scenario.input.role === "critic" ? "critic-flash" : "integration-reviewer-flash",
    };
  }

  return {
    scenario_id: scenario.id,
    decision: "do_not_model_fallback",
    failure_class: "reviewer_routing",
  };
}

function nextPendingObjective(scenario: ContinuationScenario): string | undefined {
  for (let index = scenario.input.current_index; index < scenario.input.objectives.length; index += 1) {
    const objective = scenario.input.objectives[index];
    if (objective?.status === "pending") return objective.id;
  }
  return undefined;
}

function evaluateContinuation(scenario: ContinuationScenario): EvaluationResult {
  if (scenario.input.stop_reason && isAllowedStopReason(scenario.input.stop_reason)) {
    return { scenario_id: scenario.id, decision: "stop" };
  }

  const nextObjective = nextPendingObjective(scenario);
  const activeIsAccepted =
    scenario.input.active_candidate !== null && scenario.input.accepted.includes(scenario.input.active_candidate);

  if (activeIsAccepted && nextObjective) {
    return {
      scenario_id: scenario.id,
      decision: "repair_and_continue",
      failure_class: "stale_active_candidate",
      clear_active_candidate: true,
      next_objective: nextObjective,
    };
  }

  if (nextObjective) {
    return {
      scenario_id: scenario.id,
      decision: "continue",
      next_objective: nextObjective,
    };
  }

  return { scenario_id: scenario.id, decision: "replan" };
}

function evaluateTracking(scenario: TrackingGateScenario): EvaluationResult {
  const complete =
    scenario.input.tracking_markers_match &&
    scenario.input.per_step_usage_recorded &&
    scenario.input.model_aggregates_refreshed &&
    scenario.input.model_evaluation_recorded;

  if (!complete) {
    return {
      scenario_id: scenario.id,
      decision: "repair_tracking",
      failure_class: "tracking_missing",
    };
  }

  return { scenario_id: scenario.id, decision: "tracking_complete" };
}

export function evaluateScenario(scenario: GauntletScenario): EvaluationResult {
  switch (scenario.kind) {
    case "evidence_gate":
      return evaluateEvidence(scenario);
    case "horizon_validation":
      return evaluateHorizon(scenario);
    case "routing_fallback":
      return evaluateRouting(scenario);
    case "continuation":
      return evaluateContinuation(scenario);
    case "tracking_gate":
      return evaluateTracking(scenario);
  }
}

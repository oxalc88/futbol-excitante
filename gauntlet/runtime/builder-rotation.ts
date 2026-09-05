import type { BuilderBudgetPolicy } from "./policy.js";

export interface BuilderUsageState {
  sessionId: string;
  model: string;
  phase: string;
  contextTokens: number;
  cumulativeSuccessfulInputTokens: number;
  generationCount: number;
  peakContextTokens: number;
}

export interface PhaseBoundary {
  safe: boolean;
  workPersisted: boolean;
  checkpointValid: boolean;
  nextPhase: string;
  materiallyDifferent: boolean;
}

export interface RotationDecision {
  rotate: boolean;
  exceeded: Array<"context" | "cumulative_input" | "generations">;
  reason: "below_budget" | "unsafe_boundary" | "same_phase" | "rotate_at_checkpoint";
}

export function decideBuilderRotation(
  usage: BuilderUsageState,
  boundary: PhaseBoundary,
  budget: BuilderBudgetPolicy,
): RotationDecision {
  const exceeded: RotationDecision["exceeded"] = [];
  if (usage.contextTokens >= budget.context_soft_limit_tokens) exceeded.push("context");
  if (usage.cumulativeSuccessfulInputTokens >= budget.cumulative_input_soft_limit_tokens) exceeded.push("cumulative_input");
  if (usage.generationCount >= budget.generation_soft_limit) exceeded.push("generations");
  if (exceeded.length === 0) return { rotate: false, exceeded, reason: "below_budget" };
  if (!boundary.safe || !boundary.workPersisted || !boundary.checkpointValid) {
    return { rotate: false, exceeded, reason: "unsafe_boundary" };
  }
  if (!boundary.materiallyDifferent || boundary.nextPhase === usage.phase) {
    return { rotate: false, exceeded, reason: "same_phase" };
  }
  return { rotate: true, exceeded, reason: "rotate_at_checkpoint" };
}

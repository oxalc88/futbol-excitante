/** @module @pes/eval/runners - Evaluation runner exports. */

export { runHeadlessMatch, makeAiMatchScenario, formatMatchTime } from "./headless-match.js";
export type { HeadlessMatchConfig, HeadlessMatchResult, MatchScore, MatchGoalEvent, GoalTeamMapping, MatchPhase, PhaseHistoryRecord } from "./headless-match.js";

// Mutant-team evaluation.
export { runMutantTeam } from "./mutant-team.js";
export type { MutantTeamOutcome, MutantTeamResult } from "./mutant-team.js";

// Team-shape evaluation.
export { runTeamShapeEvaluator } from "./team-shape-evaluator.js";
export type {
  TeamShapeOutcome,
  TeamShapeResult,
  TeamShapeTestResult,
  CommonCriterionCheck,
} from "./team-shape-evaluator.js";

// Archetype comparison (perceptual evaluation).
export { captureArchetypeArtifacts } from "./archetype-capture.js";
export type { CapturedFrame, PairCaptureResult, CaptureResult } from "./archetype-capture.js";
export {
  evaluateArchetypeComparison,
  compareFrames,
  verifyArchetypeHashUniqueness,
  computeHashDiffRatio,
  COMPARISON_PAIRS,
  RUBRIC_META,
  DETECTABILITY_THRESHOLD,
} from "./archetype-comparison.js";
export type { HashedFrame, FrameComparison } from "./archetype-comparison.js";

// ARCH-DIFF-001 perceptual rubric (archetype visual difference detection).
export {
  runArchDiff001,
  evaluateArchDiff001,
  compareGameFrames,
  evaluateArchDiff001NoEvidence,
  generateDeterministicStateHash,
} from "./arch-diff-001-evaluator.js";
export type { GameFrameSnapshot, ArchDiffComparison } from "./arch-diff-001-evaluator.js";
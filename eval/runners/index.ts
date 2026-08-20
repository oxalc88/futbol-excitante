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
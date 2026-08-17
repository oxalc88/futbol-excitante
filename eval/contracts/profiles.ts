/**
 * @module @pes/eval/contracts/profiles
 *
 * Versioned MilestoneProfile registry.
 *
 * These are the normative initial profiles from
 * GAMEPLAY_EVALUATION_SPEC.md §2.3. No additional profiles are
 * materialized here beyond what the spec declares.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { MilestoneProfile } from "./types.js";

/**
 * The FOUNDATION_LAB milestone profile.
 */
export const FOUNDATION_LAB_PROFILE: MilestoneProfile = {
  milestone_id: "FOUNDATION_LAB",
  profile_version: "milestone-foundation-v1",
  required_capabilities: [
    "DETERMINISTIC_CORE",
    "LOCOMOTION",
    "INDEPENDENT_BALL",
    "HEADLESS_SCENARIOS",
    "BROWSER_CORE_SMOKE",
  ],
  optional_diagnostic_capabilities: [
    "FIRST_TOUCH",
    "BASIC_ACTIONS",
    "PRESENTATION_BASELINE",
  ],
  deferred_capabilities: [
    "PLAYER_DUELS",
    "GOALKEEPERS",
    "TEAM_TACTICS",
    "REGULATION_MATCH_RULES",
    "MATCH_ECOLOGY",
    "PERCEPTUAL_GATES",
  ],
  prohibited_capabilities: ["EXTERNAL_RATING_AS_GAMEPLAY_VALUE"],
  required_suite_ids: ["fast", "locomotion", "ball"],
  required_execution_paths: ["HEADLESS", "BROWSER"],
  required_browser_case_ids: [
    "BROWSER-CORE-RESET-001",
    "BROWSER-CORE-STEP-001",
  ],
  required_criterion_classes: ["HARD_INVARIANT"],
  accepted_required_outcomes: ["PASS"] as const,
  entry_prerequisites: ["PINNED_RUNTIME"],
  exit_prerequisites: ["COMMON_DETERMINISTIC_PASS", "MUTANT_CORE_PASS"],
};

/**
 * The PLAYABLE_1V1 milestone profile.
 *
 * ARCH-DIFF-001 is a PERCEPTUAL_TARGET case and therefore keeps the
 * formal milestone unresolved until its blinded comparison gate is satisfied.
 * The touch_and_actions and duels suites are materialized in suites.ts.
 */
export const PLAYABLE_1V1_PROFILE: MilestoneProfile = {
  milestone_id: "PLAYABLE_1V1",
  profile_version: "milestone-1v1-v1",
  required_capabilities: [
    "DETERMINISTIC_CORE",
    "LOCOMOTION",
    "INDEPENDENT_BALL",
    "FIRST_TOUCH",
    "BASIC_ACTIONS",
    "PLAYER_DUELS",
    "LOCAL_CONTROL_SLOTS",
    "PRESENTATION_BASELINE",
    "FICTIONAL_ARCHETYPES",
  ],
  optional_diagnostic_capabilities: [
    "GOALKEEPERS",
    "TEAM_TACTICS",
    "PERCEPTUAL_PES_REFERENCE",
  ],
  deferred_capabilities: [
    "REGULATION_MATCH_RULES",
    "MATCH_ECOLOGY",
  ],
  prohibited_capabilities: ["EXTERNAL_RATING_AS_GAMEPLAY_VALUE"],
  required_suite_ids: [
    "fast",
    "locomotion",
    "ball",
    "touch_and_actions",
    "duels",
  ],
  required_execution_paths: ["HEADLESS", "BROWSER"],
  required_browser_case_ids: [
    "BROWSER-CORE-RESET-001",
    "BROWSER-CORE-STEP-001",
    "BROWSER-1V1-CONTROL-001",
    "ARCH-DIFF-001",
  ],
  required_criterion_classes: ["HARD_INVARIANT", "ENGINE_DESIGN_TARGET"],
  accepted_required_outcomes: ["PASS"] as const,
  entry_prerequisites: ["FOUNDATION_LAB_PASS", "CAPABILITY_DESIGN_PROFILE"],
  exit_prerequisites: ["MUTANT_1V1_PASS", "ARCHETYPE_BLINDED_COMPARISON_PASS"],
};

/**
 * The SMALL_SIDED_SHAPE milestone profile.
 *
 * This is materialized directly from GAMEPLAY_EVALUATION_SPEC.md §2.3.
 * Registering the profile does not claim that current 3v3 gameplay satisfies it.
 * Missing bindings, team-suite criteria, entry/exit prerequisites, or required
 * browser/playtest evidence must remain non-PASS.
 */
export const SMALL_SIDED_SHAPE_PROFILE: MilestoneProfile = {
  milestone_id: "SMALL_SIDED_SHAPE",
  profile_version: "milestone-small-sided-v1",
  required_capabilities: [
    "DETERMINISTIC_CORE",
    "LOCOMOTION",
    "INDEPENDENT_BALL",
    "FIRST_TOUCH",
    "BASIC_ACTIONS",
    "PLAYER_DUELS",
    "TEAM_TACTICS",
    "TRANSITION_PHASES",
    "SMALL_SIDED_CARDINALITY",
    "PRESENTATION_BASELINE",
  ],
  optional_diagnostic_capabilities: [
    "GOALKEEPERS",
    "REGULATION_MATCH_RULES",
    "MATCH_ECOLOGY",
    "PERCEPTUAL_PES_REFERENCE",
  ],
  deferred_capabilities: ["COMPLETE_REGULATION_MATCH"],
  prohibited_capabilities: ["EXTERNAL_RATING_AS_GAMEPLAY_VALUE"],
  required_suite_ids: [
    "fast",
    "locomotion",
    "ball",
    "touch_and_actions",
    "duels",
    "team",
  ],
  required_execution_paths: ["HEADLESS", "BROWSER"],
  required_browser_case_ids: [
    "BROWSER-CORE-RESET-001",
    "BROWSER-CORE-STEP-001",
    "BROWSER-SMALL-SIDED-001",
  ],
  required_criterion_classes: ["HARD_INVARIANT", "ENGINE_DESIGN_TARGET"],
  accepted_required_outcomes: ["PASS"] as const,
  entry_prerequisites: ["PLAYABLE_1V1_PASS", "TEAM_DECISION_PROFILE"],
  exit_prerequisites: ["MUTANT_TEAM_PASS", "TEAM_SHAPE_SUITE_PASS"],
};

/** All registered milestone profiles keyed by milestone_id. */
export const MILESTONE_PROFILES: Record<string, MilestoneProfile> = {
  [FOUNDATION_LAB_PROFILE.milestone_id]: FOUNDATION_LAB_PROFILE,
  [PLAYABLE_1V1_PROFILE.milestone_id]: PLAYABLE_1V1_PROFILE,
  [SMALL_SIDED_SHAPE_PROFILE.milestone_id]: SMALL_SIDED_SHAPE_PROFILE,
};

/**
 * Get a milestone profile by milestone_id.
 * @returns The profile or undefined if not registered.
 */
export function getMilestoneProfile(
  milestoneId: string,
): MilestoneProfile | undefined {
  return MILESTONE_PROFILES[milestoneId];
}

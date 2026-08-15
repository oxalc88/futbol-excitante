/**
 * @module @pes/eval/contracts/profiles
 *
 * Versioned MilestoneProfile registry.
 *
 * These are normative initial profiles from
 * GAMEPLAY_EVALUATION_SPEC.md §2.3.  No additional profiles are
 * materialized here beyond what the spec declares.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { MilestoneProfile } from "./types.js";

/**
 * The FOUNDATION_LAB milestone profile.
 * Required suites: fast, locomotion, ball.
 * Required criterion classes: HARD_INVARIANT.
 * Required execution paths: HEADLESS, BROWSER.
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
 * Required suites: fast, locomotion, ball, touch_and_actions, duels.
 * Required criterion classes: HARD_INVARIANT, ENGINE_DESIGN_TARGET.
 * Required execution paths: HEADLESS, BROWSER.
 * Browser cases include BROWSER-1V1-CONTROL-001 and ARCH-DIFF-001.
 *
 * ARCH-DIFF-001 is a PERCEPTUAL_TARGET case (NEEDS_PERCEPTUAL_REVIEW)
 * and MUST prevent an overall PLAYABLE_1V1_PASS / milestoneVerdict PASS.
 *
 * Required suites touch_and_actions and duels do not yet exist in the
 * registry; they are listed so the profile is spec-complete. The evaluator
 * will report NOT_EVALUATED (or INVALID_RUN for required suites) when
 * they are missing.
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

/** All registered milestone profiles keyed by milestone_id. */
export const MILESTONE_PROFILES: Record<string, MilestoneProfile> = {
  [FOUNDATION_LAB_PROFILE.milestone_id]: FOUNDATION_LAB_PROFILE,
  [PLAYABLE_1V1_PROFILE.milestone_id]: PLAYABLE_1V1_PROFILE,
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
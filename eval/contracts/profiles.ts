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

/** All registered milestone profiles keyed by milestone_id. */
export const MILESTONE_PROFILES: Record<string, MilestoneProfile> = {
  [FOUNDATION_LAB_PROFILE.milestone_id]: FOUNDATION_LAB_PROFILE,
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
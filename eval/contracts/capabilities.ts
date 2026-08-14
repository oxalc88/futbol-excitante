/**
 * @module @pes/eval/contracts/capabilities
 *
 * CapabilityManifest for the FOUNDATION_LAB milestone.
 *
 * Declares which capabilities are REQUIRED for the foundation lab.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { CapabilityManifest } from "./types.js";

/**
 * Foundation-lab capability manifest.
 *
 * Dispositions mirror the FOUNDATION_LAB profile:
 * - DETERMINISTIC_CORE   → REQUIRED
 * - LOCOMOTION           → REQUIRED
 * - INDEPENDENT_BALL     → REQUIRED
 * - HEADLESS_SCENARIOS   → REQUIRED
 * - BROWSER_CORE_SMOKE   → REQUIRED
 * - ALL others → DEFERRED (no separate manifest entries needed)
 */
export const FOUNDATION_LAB_CAPABILITIES: CapabilityManifest = {
  manifest_id: "foundation-lab-capabilities-v1",
  manifest_version: "capability-foundation-v1",
  implementation_versions: {
    DETERMINISTIC_CORE: "sim-core-v1",
    LOCOMOTION: "locomotion-v1",
    INDEPENDENT_BALL: "ball-system-v1",
    HEADLESS_SCENARIOS: "headless-runner-v1",
    BROWSER_CORE_SMOKE: "browser-bridge-v1",
  },
  dispositions: {
    DETERMINISTIC_CORE: "REQUIRED",
    LOCOMOTION: "REQUIRED",
    INDEPENDENT_BALL: "REQUIRED",
    HEADLESS_SCENARIOS: "REQUIRED",
    BROWSER_CORE_SMOKE: "REQUIRED",
    FIRST_TOUCH: "OPTIONAL_DIAGNOSTIC",
    BASIC_ACTIONS: "OPTIONAL_DIAGNOSTIC",
    PRESENTATION_BASELINE: "OPTIONAL_DIAGNOSTIC",
    PLAYER_DUELS: "DEFERRED",
    GOALKEEPERS: "DEFERRED",
    TEAM_TACTICS: "DEFERRED",
    REGULATION_MATCH_RULES: "DEFERRED",
    MATCH_ECOLOGY: "DEFERRED",
    PERCEPTUAL_GATES: "DEFERRED",
    EXTERNAL_RATING_AS_GAMEPLAY_VALUE: "PROHIBITED",
  },
};

/** All registered capability manifests keyed by manifest_id. */
export const CAPABILITY_MANIFESTS: Record<string, CapabilityManifest> = {
  [FOUNDATION_LAB_CAPABILITIES.manifest_id]: FOUNDATION_LAB_CAPABILITIES,
};

/**
 * Get a capability manifest by manifest_id.
 */
export function getCapabilityManifest(
  manifestId: string,
): CapabilityManifest | undefined {
  return CAPABILITY_MANIFESTS[manifestId];
}
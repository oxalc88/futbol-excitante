/**
 * @module @pes/eval/contracts/browser-cases
 *
 * Registry of versioned browser-case definitions.
 *
 * Browser cases are execution-path requirements that must be exercised
 * when a milestone profile's `required_browser_case_ids` list includes
 * their case_id.  They are registered here and validated at evaluation
 * time by the foundation evaluator.
 *
 * Cases from BOOTSTRAP-11 (core-smoke.browser.test.ts):
 *  - BROWSER-CORE-RESET-001: two resets of the same scenario yield
 *    the headless initial hash and identical primitive entity
 *    counts/transforms.
 *  - BROWSER-CORE-STEP-001: exact injected frames and tick count
 *    yield the same per-tick/final hashes as headless.
 *
 * Cases from PLAYABLE-1V1 (1v1-control.browser.test.ts):
 *  - BROWSER-1V1-CONTROL-001: two HUMAN slots with independent inputs.
 *  - ARCH-DIFF-001: human perceptual blinded comparison (NEEDS_PERCEPTUAL_REVIEW).
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

// ---------------------------------------------------------------------------
// Browser case types
// ---------------------------------------------------------------------------

/**
 * A browser case that must be exercised for a milestone profile.
 */
export interface BrowserCaseDefinition {
  /** Stable case identifier (matches the profile's required_browser_case_ids). */
  case_id: string;
  /** Version for this definition. */
  case_version: string;
  /** One-line description of what the case validates. */
  description: string;
  /** Test source module (the Vitest test file). */
  test_source: string;
  /** What must hold for this case to be considered PASS. */
  acceptance_criteria: string;
}

/**
 * Result recorded when a browser case is executed.
 */
export interface BrowserCaseResult {
  case_id: string;
  passed: boolean;
  /** Optional error message if the case failed or could not run. */
  error?: string;
  /** Evidence proving a real browser run occurred. */
  evidence: {
    initialHash: string;
    perTickHashes?: string[];
  };
}

// ---------------------------------------------------------------------------
// Case definitions (BOOTSTRAP-11)
// ---------------------------------------------------------------------------

export const BROWSER_CASE_CORE_RESET_001: BrowserCaseDefinition = {
  case_id: "BROWSER-CORE-RESET-001",
  case_version: "browser-case-core-reset-v1",
  description:
    "Two resets of the same scenario yield the headless initial hash " +
    "and identical primitive entity counts/transforms.",
  test_source: "tests/browser/core-smoke.browser.test.ts",
  acceptance_criteria:
    "Bridge state hash after reset matches headless initial hash; " +
    "two resets produce identical hashes; player and ball transforms match headless; " +
    "renderer primitive entity counts are verified.",
};

export const BROWSER_CASE_CORE_STEP_001: BrowserCaseDefinition = {
  case_id: "BROWSER-CORE-STEP-001",
  case_version: "browser-case-core-step-v1",
  description:
    "Exact injected frames and tick count yield the same per-tick/final " +
    "hashes as headless.",
  test_source: "tests/browser/core-smoke.browser.test.ts",
  acceptance_criteria:
    "Bridge per-tick hashes match headless per-tick hashes; " +
    "bridge final hash matches headless final hash; " +
    "different input frames produce different hashes.",
};

// ---------------------------------------------------------------------------
// Case definitions (PLAYABLE-1V1)
// ---------------------------------------------------------------------------

export const BROWSER_CASE_1V1_CONTROL_001: BrowserCaseDefinition = {
  case_id: "BROWSER-1V1-CONTROL-001",
  case_version: "browser-case-1v1-control-v1",
  description:
    "Two HUMAN slots with independently injected InputFrames yield the same " +
    "per-tick/final hashes as headless for the same two-slot input program; " +
    "slot-1 input moves only slot-1's controlled player; slot-2 input moves only slot-2's controlled player.",
  test_source: "tests/browser/1v1-control.browser.test.ts",
  acceptance_criteria:
    "Bridge per-tick hashes match headless per-tick hashes for the " +
    "two-player scenario with both slots driven; rendering extra frames " +
    "without stepping does not change the hash; slot-1 input only affects " +
    "slot-1's player and slot-2 input only affects slot-2's player.",
};

export const BROWSER_CASE_ARCH_DIFF_001: BrowserCaseDefinition = {
  case_id: "ARCH-DIFF-001",
  case_version: "browser-case-arch-diff-v1",
  description:
    "Human perceptual blinded comparison of burst vs steady archetypes. " +
    "Identical visual models, hidden labels, identical replay/task conditions, " +
    "randomized/counterbalanced order.",
  test_source: "tests/browser/1v1-control.browser.test.ts",
  acceptance_criteria:
    "NEEDS_PERCEPTUAL_REVIEW — objective comparison requires a versioned " +
    "rubric, randomized presentation, and human subject data. Not executable " +
    "without those artifacts.",
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All registered browser-case definitions keyed by case_id. */
export const BROWSER_CASES: Record<string, BrowserCaseDefinition> = {
  [BROWSER_CASE_CORE_RESET_001.case_id]: BROWSER_CASE_CORE_RESET_001,
  [BROWSER_CASE_CORE_STEP_001.case_id]: BROWSER_CASE_CORE_STEP_001,
  [BROWSER_CASE_1V1_CONTROL_001.case_id]: BROWSER_CASE_1V1_CONTROL_001,
  [BROWSER_CASE_ARCH_DIFF_001.case_id]: BROWSER_CASE_ARCH_DIFF_001,
};

/**
 * Get a browser case definition by case_id.
 * @returns The definition or undefined if not registered.
 */
export function getBrowserCase(
  caseId: string,
): BrowserCaseDefinition | undefined {
  return BROWSER_CASES[caseId];
}

/** All registered case IDs (in declaration order). */
export const ALL_BROWSER_CASE_IDS: string[] = [
  BROWSER_CASE_CORE_RESET_001.case_id,
  BROWSER_CASE_CORE_STEP_001.case_id,
  BROWSER_CASE_1V1_CONTROL_001.case_id,
  BROWSER_CASE_ARCH_DIFF_001.case_id,
];

/**
 * Validate a list of browser case results against the known case registry.
 *
 * Returns an array of error messages.  An error is produced when:
 *  - a result references an unknown case_id.
 *
 * @param results - Browser case results to validate.
 * @returns Array of validation error strings (empty if valid).
 */
export function validateBrowserCaseResults(
  results: BrowserCaseResult[],
): string[] {
  const errors: string[] = [];
  for (const r of results) {
    if (!(r.case_id in BROWSER_CASES)) {
      errors.push(
        `Unknown browser case_id in results: "${r.case_id}"`,
      );
    }
  }
  return errors;
}
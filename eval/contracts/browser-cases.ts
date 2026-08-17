/**
 * @module @pes/eval/contracts/browser-cases
 *
 * Registry of versioned browser-case definitions.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

export interface BrowserCaseDefinition {
  case_id: string;
  case_version: string;
  description: string;
  test_source: string;
  acceptance_criteria: string;
}

export interface BrowserCaseResult {
  case_id: string;
  passed: boolean;
  error?: string;
  evidence: {
    initialHash: string;
    perTickHashes?: string[];
  };
}

export const BROWSER_CASE_CORE_RESET_001: BrowserCaseDefinition = {
  case_id: "BROWSER-CORE-RESET-001",
  case_version: "browser-case-core-reset-v1",
  description: "Two resets of the same scenario yield the headless initial hash and identical primitive entity counts/transforms.",
  test_source: "tests/browser/core-smoke.browser.test.ts",
  acceptance_criteria: "Bridge state hash after reset matches headless initial hash; two resets produce identical hashes; player and ball transforms match headless; renderer primitive entity counts are verified.",
};

export const BROWSER_CASE_CORE_STEP_001: BrowserCaseDefinition = {
  case_id: "BROWSER-CORE-STEP-001",
  case_version: "browser-case-core-step-v1",
  description: "Exact injected frames and tick count yield the same per-tick/final hashes as headless.",
  test_source: "tests/browser/core-smoke.browser.test.ts",
  acceptance_criteria: "Bridge per-tick hashes match headless per-tick hashes; bridge final hash matches headless final hash; different input frames produce different hashes.",
};

export const BROWSER_CASE_1V1_CONTROL_001: BrowserCaseDefinition = {
  case_id: "BROWSER-1V1-CONTROL-001",
  case_version: "browser-case-1v1-control-v1",
  description: "Two HUMAN slots with independently injected InputFrames yield the same per-tick/final hashes as headless for the same two-slot input program.",
  test_source: "tests/browser/1v1-control.browser.test.ts",
  acceptance_criteria: "Bridge per-tick hashes match headless per-tick hashes for the two-player scenario; rendering without stepping does not change the hash; each slot only controls its assigned player.",
};

export const BROWSER_CASE_ARCH_DIFF_001: BrowserCaseDefinition = {
  case_id: "ARCH-DIFF-001",
  case_version: "browser-case-arch-diff-v1",
  description: "Human perceptual blinded comparison of burst vs steady archetypes.",
  test_source: "tests/browser/1v1-control.browser.test.ts",
  acceptance_criteria: "NEEDS_PERCEPTUAL_REVIEW — objective comparison requires a versioned rubric, randomized presentation, and human subject data.",
};

/**
 * Browser execution case required by the normative SMALL_SIDED_SHAPE profile.
 * The existing deterministic 3v3 browser match is the first concrete execution
 * source for this case, but its existence alone does not satisfy the milestone's
 * team/transition/playtest criteria.
 */
export const BROWSER_CASE_SMALL_SIDED_001: BrowserCaseDefinition = {
  case_id: "BROWSER-SMALL-SIDED-001",
  case_version: "browser-case-small-sided-v1",
  description: "A deterministic browser small-sided match renders multiple players per team and preserves browser/headless state correspondence while exposing team behavior for milestone playtest review.",
  test_source: "tests/browser/3v3-match.browser.test.ts",
  acceptance_criteria: "A real browser run must exercise the small-sided scenario deterministically. Passing this execution case does not by itself prove TEAM_TACTICS, TRANSITION_PHASES, or qualitative football behavior; those remain milestone-suite/playtest responsibilities.",
};

export const BROWSER_CASES: Record<string, BrowserCaseDefinition> = {
  [BROWSER_CASE_CORE_RESET_001.case_id]: BROWSER_CASE_CORE_RESET_001,
  [BROWSER_CASE_CORE_STEP_001.case_id]: BROWSER_CASE_CORE_STEP_001,
  [BROWSER_CASE_1V1_CONTROL_001.case_id]: BROWSER_CASE_1V1_CONTROL_001,
  [BROWSER_CASE_ARCH_DIFF_001.case_id]: BROWSER_CASE_ARCH_DIFF_001,
  [BROWSER_CASE_SMALL_SIDED_001.case_id]: BROWSER_CASE_SMALL_SIDED_001,
};

export function getBrowserCase(caseId: string): BrowserCaseDefinition | undefined {
  return BROWSER_CASES[caseId];
}

export const ALL_BROWSER_CASE_IDS: string[] = [
  BROWSER_CASE_CORE_RESET_001.case_id,
  BROWSER_CASE_CORE_STEP_001.case_id,
  BROWSER_CASE_1V1_CONTROL_001.case_id,
  BROWSER_CASE_ARCH_DIFF_001.case_id,
  BROWSER_CASE_SMALL_SIDED_001.case_id,
];

export function validateBrowserCaseResults(results: BrowserCaseResult[]): string[] {
  const errors: string[] = [];
  for (const r of results) {
    if (!(r.case_id in BROWSER_CASES)) errors.push(`Unknown browser case_id in results: "${r.case_id}"`);
  }
  return errors;
}

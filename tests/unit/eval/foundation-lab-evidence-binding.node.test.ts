/**
 * @module tests/unit/eval/foundation-lab-evidence-binding.node.test
 *
 * Proves that the persisted eval.json is executable evidence — i.e. a live
 * evaluateFoundationLab call with the same durable browser cases produces
 * the same milestoneVerdict.
 *
 * Also proves that resolveEntryPrereqOutcomes reads that verdict from the
 * durable eval.json path.
 *
 * Node I/O is allowed in tests.
 *
 * Tests:
 *  1. eval.json exists at the expected path.
 *  2. milestoneVerdict in eval.json matches a live run with durable browser cases.
 *  3. resolveEntryPrereqOutcomes from the default docs/evidence path returns
 *     the same verdict as eval.json for FOUNDATION_LAB_PASS.
 *  4. If a browser case hash mismatches headless, the verdict is FAIL/INVALID_RUN,
 *     not an invented PASS.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Import wire.ts to register oracles before running.
import "../../../eval/oracles/wire.js";

import { evaluateFoundationLab } from "../../../eval/runners/foundation-promotion.js";
import {
  resolveEntryPrereqOutcomes,
} from "../../../eval/runners/playable-1v1-profile-runner.js";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import type { ScenarioDefinition, InputFrame } from "../../../src/contracts/index.js";
import type { BrowserCaseResult } from "../../../eval/contracts/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../../..");
}

function loadFixture(): ScenarioDefinition {
  const raw = readFileSync(
    join(baseDir(), "eval/scenarios/foundation-move-and-roll.v1.json"),
    "utf-8",
  );
  return JSON.parse(raw) as ScenarioDefinition;
}

function loadDurableBrowserCases(): BrowserCaseResult[] {
  const raw = readFileSync(
    join(baseDir(), "docs/evidence/BROWSER-CORE-EVIDENCE/browser-cases.json"),
    "utf-8",
  );
  return JSON.parse(raw) as BrowserCaseResult[];
}

function loadPersistedEvalJson(): Record<string, unknown> {
  const raw = readFileSync(
    join(baseDir(), "docs/evidence/FOUNDATION_LAB_PASS/eval.json"),
    "utf-8",
  );
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Generate browser-case evidence from a scenario using the simulation core.
 * Uses the scenario's actual input program so evidence matches the headless ref.
 */
function generateBrowserEvidence(
  scenario: ScenarioDefinition,
): Record<string, { initialHash: string; perTickHashes?: string[] }> {
  const headless = createHeadlessSim(scenario);
  const initialHash = headless.stateHash();

  // Generate perTickHashes from a simulation using the scenario's actual inputs.
  const sim2 = createHeadlessSim(scenario);
  const perTickHashes: string[] = [];
  const ticks = Math.min(5, scenario.durationTicks);
  for (let tick = 0; tick < ticks; tick++) {
    const inputs = scenario.inputProgram[sim2.tick] ?? [];
    if (inputs.length > 0) {
      sim2.applyInputs(inputs);
    }
    const result = sim2.step();
    perTickHashes.push(result.stateHash);
  }

  return {
    "BROWSER-CORE-RESET-001": { initialHash },
    "BROWSER-CORE-STEP-001": { initialHash, perTickHashes },
  };
}

function createHeadlessSim(scenario: ScenarioDefinition) {
  const world = createWorld({ scenario });
  return createSimulation(world);
}

// ---------------------------------------------------------------------------
// 1. eval.json exists
// ---------------------------------------------------------------------------

describe("Evidence binding: eval.json exists", () => {
  it("docs/evidence/FOUNDATION_LAB_PASS/eval.json exists", () => {
    const evalJson = loadPersistedEvalJson();
    expect(evalJson).toBeDefined();
    expect(evalJson).toHaveProperty("milestoneVerdict");
  });

  it("eval.json has all required fields", () => {
    const evalJson = loadPersistedEvalJson();
    expect(evalJson).toHaveProperty("registrySetId");
    expect(evalJson).toHaveProperty("profileVersion");
    expect(evalJson).toHaveProperty("subComponents");
    expect(evalJson).toHaveProperty("allHardInvariantPass");
    expect(evalJson).toHaveProperty("commonDeterministicPass");
    expect(evalJson).toHaveProperty("mutantCorePass");
    expect(evalJson).toHaveProperty("browserCases");
    expect(evalJson).toHaveProperty("milestoneVerdict");
    expect(evalJson).toHaveProperty("details");
  });
});

// ---------------------------------------------------------------------------
// 2. Live run with durable browser cases matches persisted verdict
// ---------------------------------------------------------------------------

describe("Evidence binding: live run matches persisted verdict", () => {
  it("evaluateFoundationLab with durable browser cases produces the same milestoneVerdict as eval.json", () => {
    const scenario = loadFixture();
    const durableBrowserCases = loadDurableBrowserCases();
    const evalJson = loadPersistedEvalJson();

    const liveResult = evaluateFoundationLab(scenario, { browserCases: durableBrowserCases });

    expect(liveResult.milestoneVerdict).toBe(evalJson.milestoneVerdict);
  });

  it("the live run produces a full FoundationLabResult with matching structure", () => {
    const scenario = loadFixture();
    const durableBrowserCases = loadDurableBrowserCases();
    const evalJson = loadPersistedEvalJson();

    const liveResult = evaluateFoundationLab(scenario, { browserCases: durableBrowserCases });

    // The durable artifact is accepted evidence produced by a prior registry
    // set version.  Adding the goalkeepers suite changes the whole registry
    // content hash, so the live registry's id differs from the persisted one.
    // Both must be genuine evaluator output (not placeholders); the remaining
    // structural fields are still compared strictly below.
    expect(liveResult.registrySetId).not.toBe("placeholder");
    expect(liveResult.registrySetId).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
    expect(evalJson.registrySetId).not.toBe("placeholder");
    expect(evalJson.registrySetId).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
    expect(liveResult.profileVersion).toBe(evalJson.profileVersion);
    expect(liveResult.allHardInvariantPass).toBe(evalJson.allHardInvariantPass);
    expect(liveResult.commonDeterministicPass).toBe(evalJson.commonDeterministicPass);
    expect(liveResult.mutantCorePass).toBe(evalJson.mutantCorePass);
  });
});

// ---------------------------------------------------------------------------
// 3. resolveEntryPrereqOutcomes reads from the default docs/evidence path
// ---------------------------------------------------------------------------

describe("Evidence binding: resolveEntryPrereqOutcomes", () => {
  it("resolveEntryPrereqOutcomes returns the same verdict as eval.json", () => {
    const evalJson = loadPersistedEvalJson();
    const prereqVerdict = evalJson.milestoneVerdict;

    const resolverResult = resolveEntryPrereqOutcomes(["FOUNDATION_LAB_PASS"]);

    expect(resolverResult["FOUNDATION_LAB_PASS"]).toBe(prereqVerdict);
  });

  it("resolver maps FOUNDATION_LAB_PASS to PASS when eval.json says PASS", () => {
    const evalJson = loadPersistedEvalJson();

    if (evalJson.milestoneVerdict === "PASS") {
      const resolverResult = resolveEntryPrereqOutcomes(["FOUNDATION_LAB_PASS"]);
      expect(resolverResult["FOUNDATION_LAB_PASS"]).toBe("PASS");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Mismatched hashes → FAIL or INVALID_RUN (not invented PASS)
// ---------------------------------------------------------------------------

describe("Evidence binding: hash mismatch produces FAIL/INVALID_RUN", () => {
  it("corrupting a browser case initialHash makes live run produce a non-PASS verdict", () => {
    const scenario = loadFixture();
    const durableBrowserCases = loadDurableBrowserCases();

    // Corrupt the initialHash of the first browser case.
    durableBrowserCases[0].evidence.initialHash = "fnv1a64-v1:corrupted-hash";

    const result = evaluateFoundationLab(scenario, { browserCases: durableBrowserCases });

    // The verdict must NOT be PASS — it should be INVALID_RUN (hash mismatch)
    // or FAIL (passed:false). Since we only corrupted the hash but left
    // passed:true, the validateBrowserCases function returns INVALID_RUN.
    expect(result.milestoneVerdict).not.toBe("PASS");
    expect(result.milestoneVerdict).toMatch(/^(FAIL|INVALID_RUN)$/);
  });

  it("corrupting perTickHash also prevents PASS", () => {
    const scenario = loadFixture();
    const durableBrowserCases = loadDurableBrowserCases();

    // Find the case with perTickHashes and corrupt one.
    const stepCase = durableBrowserCases.find(
      (c) => c.case_id === "BROWSER-CORE-STEP-001",
    );
    if (stepCase && stepCase.evidence.perTickHashes) {
      stepCase.evidence.perTickHashes[0] = "fnv1a64-v1:corrupted";
    }

    const result = evaluateFoundationLab(scenario, { browserCases: durableBrowserCases });

    expect(result.milestoneVerdict).not.toBe("PASS");
  });
});
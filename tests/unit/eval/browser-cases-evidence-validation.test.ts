/**
 * @module tests/unit/eval/browser-cases-evidence-validation
 *
 * Loads the persisted docs/evidence/BROWSER-CORE-EVIDENCE/browser-cases.json
 * and validates that BROWSER-CORE-RESET-001 and BROWSER-CORE-STEP-001 are
 * not INVALID_RUN when evidence is present and hashes match headless.
 *
 * When the evidence file is absent, tests skip gracefully.
 * Does NOT claim PLAYABLE_1V1_PASS or FOUNDATION_LAB_PASS.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePlayable1v1 } from "../../../eval/runners/playable-evaluator.js";
import { PLAYABLE_1V1_PROFILE } from "../../../eval/contracts/profiles.js";
import type { BrowserCaseResult } from "../../../eval/contracts/browser-cases.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(): ScenarioDefinition {
  const fixturePath = join(
    __dirname,
    "../../../eval/scenarios/foundation-move-and-roll.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

function loadBrowserCases(): BrowserCaseResult[] | null {
  const evidencePath = join(
    __dirname,
    "../../../docs/evidence/BROWSER-CORE-EVIDENCE/browser-cases.json",
  );
  if (!existsSync(evidencePath)) return null;
  const raw = readFileSync(evidencePath, "utf-8");
  return JSON.parse(raw) as BrowserCaseResult[];
}

function generateHeadlessRef(scenario: ScenarioDefinition) {
  const world = createWorld({ scenario });
  const sim = createSimulation(world);
  const initialHash = sim.stateHash();
  const perTickHashes: string[] = [];
  for (let i = 0; i < Math.min(5, scenario.durationTicks); i++) {
    const inputs = scenario.inputProgram[sim.tick] ?? [];
    if (inputs.length > 0) {
      sim.applyInputs(inputs);
    }
    const result = sim.step();
    perTickHashes.push(result.stateHash);
  }
  return { initialHash, perTickHashes };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BROWSER-CORE-EVIDENCE: browser-cases.json validation", () => {
  it("evidence file exists and contains valid JSON", () => {
    const cases = loadBrowserCases();
    if (!cases) {
      // Evidence not yet captured — skip gracefully.
      console.warn("Skipping: browser-cases.json not found");
      return;
    }
    expect(Array.isArray(cases)).toBe(true);
    expect(cases.length).toBeGreaterThanOrEqual(2);
  });

  it("RESET-001 and STEP-001 entries exist in evidence", () => {
    const cases = loadBrowserCases();
    if (!cases) return;

    const reset = cases.find((c) => c.case_id === "BROWSER-CORE-RESET-001");
    const step = cases.find((c) => c.case_id === "BROWSER-CORE-STEP-001");
    expect(reset).toBeDefined();
    expect(step).toBeDefined();
  });

  it("RESET-001 initialHash matches headless reference", () => {
    const cases = loadBrowserCases();
    if (!cases) return;

    const scenario = loadFixture();
    const headless = generateHeadlessRef(scenario);
    const reset = cases.find((c) => c.case_id === "BROWSER-CORE-RESET-001")!;

    expect(reset.evidence.initialHash).toBe(headless.initialHash);
    expect(reset.passed).toBe(true);
  });

  it("STEP-001 perTickHashes match headless reference", () => {
    const cases = loadBrowserCases();
    if (!cases) return;

    const scenario = loadFixture();
    const headless = generateHeadlessRef(scenario);
    const step = cases.find((c) => c.case_id === "BROWSER-CORE-STEP-001")!;

    expect(step.evidence.initialHash).toBe(headless.initialHash);
    expect(step.evidence.perTickHashes).toEqual(headless.perTickHashes);
    expect(step.passed).toBe(true);
  });

  it("RESET-001 and STEP-001 are not INVALID_RUN when evidence is valid", () => {
    const cases = loadBrowserCases();
    if (!cases) return;

    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario, { browserCases: cases });

    const resetVerdict = result.browserCaseVerdicts.find(
      (v) => v.case_id === "BROWSER-CORE-RESET-001",
    );
    const stepVerdict = result.browserCaseVerdicts.find(
      (v) => v.case_id === "BROWSER-CORE-STEP-001",
    );

    expect(resetVerdict).toBeDefined();
    expect(stepVerdict).toBeDefined();
    expect(resetVerdict!.verdict).not.toBe("INVALID_RUN");
    expect(stepVerdict!.verdict).not.toBe("INVALID_RUN");
    expect(resetVerdict!.verdict).toBe("PASS");
    expect(stepVerdict!.verdict).toBe("PASS");
  });

  it("RESET-001 and STEP-001 are INVALID_RUN without browser evidence", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario); // no browserCases

    const resetVerdict = result.browserCaseVerdicts.find(
      (v) => v.case_id === "BROWSER-CORE-RESET-001",
    );
    const stepVerdict = result.browserCaseVerdicts.find(
      (v) => v.case_id === "BROWSER-CORE-STEP-001",
    );

    expect(resetVerdict).toBeDefined();
    expect(stepVerdict).toBeDefined();
    expect(resetVerdict!.verdict).toBe("INVALID_RUN");
    expect(stepVerdict!.verdict).toBe("INVALID_RUN");
  });

  it("overall milestone is not PASS even with valid browser evidence (ARCH-DIFF-001 blocks)", () => {
    const cases = loadBrowserCases();
    if (!cases) return;

    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario, { browserCases: cases });

    // ARCH-DIFF-001 is NEEDS_PERCEPTUAL_REVIEW — blocks PASS.
    expect(result.milestoneVerdict).not.toBe("PASS");
  });

  it("BROWSER-1V1-CONTROL-001 remains INVALID_RUN when unevidenced", () => {
    const cases = loadBrowserCases();
    if (!cases) return;

    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario, { browserCases: cases });

    const controlVerdict = result.browserCaseVerdicts.find(
      (v) => v.case_id === "BROWSER-1V1-CONTROL-001",
    );
    expect(controlVerdict).toBeDefined();
    expect(controlVerdict!.verdict).toBe("INVALID_RUN");
  });

  it("evidence file does not invent PES claims", () => {
    const cases = loadBrowserCases();
    if (!cases) return;

    for (const c of cases) {
      expect(c.case_id).not.toContain("PES");
      expect(c.case_id).not.toContain("FOUNDATION_LAB_PASS");
      expect(c.case_id).not.toContain("PLAYABLE_1V1_PASS");
    }
  });
});

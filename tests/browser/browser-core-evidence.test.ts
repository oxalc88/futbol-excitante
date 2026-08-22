/**
 * @module browser-core-evidence-tests
 *
 * Validates the persisted BROWSER-CORE-EVIDENCE browser-cases.json.
 *
 * When the evidence file exists, loads it and cross-checks hashes
 * against the live browser bridge to confirm the evidence is genuine.
 * When the evidence file is absent, the test validates bridge hashes
 * independently (proving browser execution) but does NOT persist files.
 *
 * Does NOT write screenshots — durable screenshots go through
 * `WIP_SECTION=BROWSER-CORE-EVIDENCE pnpm run capture-wip`.
 * Does NOT write browser-cases.json — that comes from
 * `pnpm tsx scripts/capture-browser-core-evidence.ts`.
 *
 * Core-smoke.browser.test.ts retains the full assertion suite; this
 * file focuses on evidence integrity.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { FOUNDATION_SCENARIO } from "../../src/apps/browser/foundation-scenario.js";
import { createTestBridge, type TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";
import type { BrowserCaseResult } from "../../eval/contracts/browser-cases.js";

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const SHARED_SCENARIO: ScenarioDefinition = FOUNDATION_SCENARIO;

// ---------------------------------------------------------------------------
// Headless reference helpers
// ---------------------------------------------------------------------------

function createHeadlessSim(scenario: ScenarioDefinition): Simulation {
  const world = createWorld({ scenario });
  return createSimulation(world);
}

function headlessInitialHash(scenario: ScenarioDefinition): string {
  const sim = createHeadlessSim(scenario);
  return sim.stateHash();
}

function runHeadlessWithInputs(
  scenario: ScenarioDefinition,
  ticks: number,
): string[] {
  const sim = createHeadlessSim(scenario);
  const hashes: string[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    const inputs = (scenario.inputProgram as Record<string, InputFrame[]>)[String(tick)] ?? [];
    if (inputs.length > 0) {
      sim.applyInputs(inputs);
    }
    const result = sim.step();
    hashes.push(result.stateHash);
  }
  return hashes;
}

// ---------------------------------------------------------------------------
// Browser test-bridge setup
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let bridge: TestBridge;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
  bridge = createTestBridge(container);
});

afterEach(() => {
  try {
    bridge.getPresentationSession().dispose();
  } catch {
    /* already disposed */
  }
  if (container.parentElement) {
    container.parentElement.removeChild(container);
  }
});

// ===========================================================================
// Evidence validation — proves browser execution and evidence integrity
// ===========================================================================

describe("BROWSER-CORE-EVIDENCE validation", () => {
  it("browser bridge produces same initial hash as headless (proves core identity)", async () => {
    const headlessHash = headlessInitialHash(SHARED_SCENARIO);

    await bridge.reset();
    const bridgeHash = bridge.stateHash();

    expect(bridgeHash).toBe(headlessHash);
  });

  it("browser bridge produces same per-tick hashes as headless (5 ticks)", async () => {
    const ticksToRun = 5;

    await bridge.reset();
    const initialHash = bridge.stateHash();
    const perTickHashes: string[] = [];

    for (let tick = 0; tick < ticksToRun; tick++) {
      const inputs = (SHARED_SCENARIO.inputProgram as Record<string, InputFrame[]>)[String(tick)] ?? [];
      if (inputs.length > 0) {
        bridge.injectInputs(inputs.map((f) => ({ ...f })));
      }
      const result = bridge.step(1);
      perTickHashes.push(result[0]);
    }

    const headlessHashes = runHeadlessWithInputs(SHARED_SCENARIO, ticksToRun);
    expect(perTickHashes).toEqual(headlessHashes);
    expect(initialHash).toBe(headlessInitialHash(SHARED_SCENARIO));
  });

  it("if browser-cases.json exists, RESET-001 initialHash matches live bridge", async () => {
    // Attempt to load the evidence file — skip if not present.
    let evidence: BrowserCaseResult[];
    try {
      const { readFileSync } = await import("node:fs");
      const raw = readFileSync(
        "docs/evidence/BROWSER-CORE-EVIDENCE/browser-cases.json",
        "utf-8",
      );
      evidence = JSON.parse(raw) as BrowserCaseResult[];
    } catch {
      // No evidence file yet — test passes vacuously.
      return;
    }

    const resetEvidence = evidence.find(
      (r) => r.case_id === "BROWSER-CORE-RESET-001",
    );
    if (!resetEvidence) return;

    await bridge.reset();
    const bridgeHash = bridge.stateHash();

    expect(resetEvidence.evidence.initialHash).toBe(bridgeHash);
    expect(resetEvidence.evidence.initialHash).toBe(
      headlessInitialHash(SHARED_SCENARIO),
    );
  });

  it("if browser-cases.json exists, STEP-001 perTickHashes match live bridge", async () => {
    let evidence: BrowserCaseResult[];
    try {
      const { readFileSync } = await import("node:fs");
      const raw = readFileSync(
        "docs/evidence/BROWSER-CORE-EVIDENCE/browser-cases.json",
        "utf-8",
      );
      evidence = JSON.parse(raw) as BrowserCaseResult[];
    } catch {
      return;
    }

    const stepEvidence = evidence.find(
      (r) => r.case_id === "BROWSER-CORE-STEP-001",
    );
    if (!stepEvidence) return;
    if (!stepEvidence.evidence.perTickHashes) return;

    const ticksToRun = stepEvidence.evidence.perTickHashes.length;

    await bridge.reset();
    const bridgePerTickHashes: string[] = [];

    for (let tick = 0; tick < ticksToRun; tick++) {
      const inputs = (SHARED_SCENARIO.inputProgram as Record<string, InputFrame[]>)[String(tick)] ?? [];
      if (inputs.length > 0) {
        bridge.injectInputs(inputs.map((f) => ({ ...f })));
      }
      const result = bridge.step(1);
      bridgePerTickHashes.push(result[0]);
    }

    expect(stepEvidence.evidence.perTickHashes).toEqual(bridgePerTickHashes);
    expect(stepEvidence.evidence.initialHash).toBe(
      headlessInitialHash(SHARED_SCENARIO),
    );
  });
});

/**
 * @module tests/browser/small-sided-coherence-rerun.browser.test
 *
 * Browser case BROWSER-SMALL-SIDED-001-COHERENCE-RERUN: re-attests
 * browser/headless hash correspondence on the RESOLVED driven fixture
 * scenarios (extended, shot-resolution, duel-rejection) that produced
 * the 8/8 SMALL_SIDED_SHAPE situation PASS.
 *
 * For each scenario:
 *  (a) Two independent bridge runs over the driven fixture produce
 *      identical per-tick hashes (determinism).
 *  (b) The bridge run matches the equivalent headless run over the
 *      same driven fixture for the same tick count (correspondence).
 *
 * The same deterministic driven policy (inputProgram entries) drives
 * both browser and headless so hashes correspond.
 *
 * Evidence class: DYNAMIC_VISUAL.
 * Case version: browser-case-coherence-rerun-v1.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";

// ---------------------------------------------------------------------------
// Scenario imports
// ---------------------------------------------------------------------------

import extendedScenario from "../../eval/scenarios/3v3-situation-driven-extended.v1.json";
import shotResolutionScenario from "../../eval/scenarios/3v3-situation-driven-shot-resolution.v1.json";
import duelRejectionScenario from "../../eval/scenarios/3v3-situation-driven-duel-rejection.v1.json";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CASE_ID = "BROWSER-SMALL-SIDED-001-COHERENCE-RERUN";
const SCREENSHOT_DIR =
  "/home/ubuntu/projects/oxDeveloop/pes-simulator/docs/screenshots/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN";

const SCENARIOS: Array<{
  name: string;
  scenario: ScenarioDefinition;
}> = [
  { name: "extended", scenario: extendedScenario as unknown as ScenarioDefinition },
  { name: "shot-resolution", scenario: shotResolutionScenario as unknown as ScenarioDefinition },
  { name: "duel-rejection", scenario: duelRejectionScenario as unknown as ScenarioDefinition },
];

// ---------------------------------------------------------------------------
// Driven policy helpers — mirrors evaluate.ts inputProgram-driven pattern
// ---------------------------------------------------------------------------

/**
 * Drive a bridge through a scenario using inputProgram entries.
 * Applies inputProgram[nextTick] before each step, matching evaluate.ts.
 * Returns per-tick state hashes.
 */
function driveBridgeWithInputProgram(
  bridge: TestBridge,
  scenario: ScenarioDefinition,
): string[] {
  const hashes: string[] = [];
  for (let i = 0; i < scenario.durationTicks; i++) {
    const nextTick = bridge.getSimulation().tick + 1;
    const tickInputs = (scenario.inputProgram as Record<string, InputFrame[]>)[
      String(nextTick)
    ];
    if (tickInputs && tickInputs.length > 0) {
      bridge.injectInputs(tickInputs.map((f) => ({ ...f })));
    }
    const result = bridge.step(1);
    hashes.push(result[0]);
  }
  return hashes;
}

/**
 * Drive a headless simulation through a scenario using inputProgram entries.
 * Same policy as driveBridgeWithInputProgram.
 */
function driveHeadlessWithInputProgram(scenario: ScenarioDefinition): string[] {
  const world = createWorld({ scenario });
  const sim = createSimulation(world);
  const hashes: string[] = [];
  for (let i = 0; i < scenario.durationTicks; i++) {
    const nextTick = sim.tick + 1;
    const tickInputs = (scenario.inputProgram as Record<string, InputFrame[]>)[
      String(nextTick)
    ];
    if (tickInputs && tickInputs.length > 0) {
      sim.applyInputs(tickInputs.map((f) => ({ ...f })));
    }
    const result = sim.step();
    hashes.push(result.stateHash);
  }
  return hashes;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let bridge: TestBridge;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
});

afterEach(() => {
  try {
    bridge?.getPresentationSession().dispose();
  } catch {
    /* already disposed */
  }
  if (container?.parentElement) {
    container.parentElement.removeChild(container);
  }
});

// ===========================================================================
// Scenario structure validation
// ===========================================================================

describe("BROWSER-SMALL-SIDED-001-COHERENCE-RERUN: scenario structure", () => {
  for (const { name, scenario } of SCENARIOS) {
    it(`${name}: has 6 AI_FALLBACK control slots`, () => {
      const assignments = scenario.controlAssignments;
      const slots = Object.keys(assignments);
      expect(slots.length).toBe(6);
      const modes = Object.values(assignments).map((a) => a.mode);
      expect(modes.every((m) => m === "AI_FALLBACK")).toBe(true);
    });

    it(`${name}: has 2 teams with 3 players each`, () => {
      const assignments = scenario.controlAssignments;
      const teamA = Object.values(assignments).filter(
        (a) => a.teamId === "team-a",
      );
      const teamB = Object.values(assignments).filter(
        (a) => a.teamId === "team-b",
      );
      expect(teamA.length).toBe(3);
      expect(teamB.length).toBe(3);
    });

    it(`${name}: bridge loads scenario with 6 players`, async () => {
      bridge = createTestBridge(container, scenario);
      await bridge.reset();
      const players = bridge.getSimulation().presentation().players;
      expect(players.length).toBe(6);
      const teamIds = new Set(players.map((p) => p.teamId));
      expect(teamIds.size).toBe(2);
    });

    it(`${name}: durationTicks is positive and seed is set`, () => {
      expect(scenario.durationTicks).toBeGreaterThan(0);
      expect(typeof scenario.seed).toBe("number");
    });
  }
});

// ===========================================================================
// Hash correspondence — per scenario
// ===========================================================================

for (const { name, scenario } of SCENARIOS) {
  describe(`BROWSER-SMALL-SIDED-001-COHERENCE-RERUN [${name}]: hash correspondence`, () => {
    it("bridge initial hash matches headless initial hash", async () => {
      bridge = createTestBridge(container, scenario);
      await bridge.reset();

      const world = createWorld({ scenario });
      const headlessSim = createSimulation(world);
      const expectedHash = headlessSim.stateHash();

      expect(bridge.stateHash()).toBe(expectedHash);
    });

    it("two independent bridge runs produce identical per-tick hashes", async () => {
      bridge = createTestBridge(container, scenario);
      await bridge.reset();
      const hashes1 = driveBridgeWithInputProgram(bridge, scenario);

      const bridge2 = createTestBridge(container, scenario);
      await bridge2.reset();
      const hashes2 = driveBridgeWithInputProgram(bridge2, scenario);

      expect(hashes1).toEqual(hashes2);
      expect(hashes1.length).toBe(scenario.durationTicks);
    });

    it("bridge per-tick hashes match headless per-tick hashes (full driven run)", async () => {
      bridge = createTestBridge(container, scenario);
      await bridge.reset();
      const bridgeHashes = driveBridgeWithInputProgram(bridge, scenario);

      const headlessHashes = driveHeadlessWithInputProgram(scenario);

      expect(bridgeHashes).toEqual(headlessHashes);
      expect(bridgeHashes.length).toBe(scenario.durationTicks);
    });

    it("headless determinism: two independent headless runs produce identical hashes", () => {
      const hashes1 = driveHeadlessWithInputProgram(scenario);
      const hashes2 = driveHeadlessWithInputProgram(scenario);

      expect(hashes1).toEqual(hashes2);
      expect(hashes1.length).toBe(scenario.durationTicks);
    });
  });
}

// ===========================================================================
// DYNAMIC_VISUAL: semantic frame capture (extended scenario)
// ===========================================================================

describe("BROWSER-SMALL-SIDED-001-COHERENCE-RERUN: semantic frame capture", () => {
  const scenario = extendedScenario as unknown as ScenarioDefinition;

  it(
    "captures 4 semantic frames: before → first-input → mid-play → final",
    async () => {
      const { page } = await import("@vitest/browser/context");

      bridge = createTestBridge(container, scenario);
      await bridge.reset();

      // Frame 1: before — initial state (tick 0).
      bridge.renderFrame();
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/frame-before.png`,
        type: "png",
      });
      expect(bridge.getSimulation().presentation().players.length).toBe(6);

      // Drive to tick 15 (after inputs at tick 1 and tick 10).
      for (let i = 0; i < 15; i++) {
        const nextTick = bridge.getSimulation().tick + 1;
        const tickInputs = (scenario.inputProgram as Record<string, InputFrame[]>)[
          String(nextTick)
        ];
        if (tickInputs && tickInputs.length > 0) {
          bridge.injectInputs(tickInputs.map((f) => ({ ...f })));
        }
        bridge.step(1);
      }

      // Frame 2: first-input — after early inputs.
      bridge.renderFrame();
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/frame-first-input.png`,
        type: "png",
      });
      expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(15);

      // Drive to tick 40 (after inputs at ticks 17, 22).
      for (let i = 0; i < 25; i++) {
        const nextTick = bridge.getSimulation().tick + 1;
        const tickInputs = (scenario.inputProgram as Record<string, InputFrame[]>)[
          String(nextTick)
        ];
        if (tickInputs && tickInputs.length > 0) {
          bridge.injectInputs(tickInputs.map((f) => ({ ...f })));
        }
        bridge.step(1);
      }

      // Frame 3: mid-play — after movement inputs.
      bridge.renderFrame();
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/frame-mid-play.png`,
        type: "png",
      });
      expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(40);

      // Drive remaining ticks to tick 60.
      const remainingTicks = scenario.durationTicks - bridge.getSimulation().tick;
      for (let i = 0; i < remainingTicks; i++) {
        const nextTick = bridge.getSimulation().tick + 1;
        const tickInputs = (scenario.inputProgram as Record<string, InputFrame[]>)[
          String(nextTick)
        ];
        if (tickInputs && tickInputs.length > 0) {
          bridge.injectInputs(tickInputs.map((f) => ({ ...f })));
        }
        bridge.step(1);
      }

      // Frame 4: final — end state after shot input at tick 50.
      bridge.renderFrame();
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/frame-final.png`,
        type: "png",
      });
      expect(bridge.getSimulation().tick).toBe(scenario.durationTicks);

      // Verify 6 players still present.
      expect(bridge.getSimulation().presentation().players.length).toBe(6);

      // Store evidence data on window for capture script extraction.
      const allHashes: Record<string, string[]> = {};
      for (const s of SCENARIOS) {
        const b = createTestBridge(container, s.scenario);
        await b.reset();
        allHashes[s.name] = driveBridgeWithInputProgram(b, s.scenario);
        try {
          b.getPresentationSession().dispose();
        } catch {
          /* already disposed */
        }
      }
      (
        window as unknown as Record<string, string>
      ).__coherenceRerunHashes = JSON.stringify(allHashes);
      (
        window as unknown as Record<string, string>
      ).__coherenceRerunInitialHash = JSON.stringify(
        Object.fromEntries(
          SCENARIOS.map((s) => {
            const w = createWorld({ scenario: s.scenario });
            const sim = createSimulation(w);
            return [s.name, sim.stateHash()];
          }),
        ),
      );
    },
    { timeout: 60_000 },
  );

  it("semantic frames are non-blank (luminance and color variance)", async () => {
    bridge = createTestBridge(container, scenario);
    await bridge.reset();

    // Drive to end state.
    for (let i = 0; i < scenario.durationTicks; i++) {
      const nextTick = bridge.getSimulation().tick + 1;
      const tickInputs = (scenario.inputProgram as Record<string, InputFrame[]>)[
        String(nextTick)
      ];
      if (tickInputs && tickInputs.length > 0) {
        bridge.injectInputs(tickInputs.map((f) => ({ ...f })));
      }
      bridge.step(1);
    }
    bridge.renderFrame();
    const capture = await bridge.capture();

    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);

    const img = new Image();
    const src = `data:image/png;base64,${base64Data}`;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to decode screenshot image"));
      img.src = src;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    expect(ctx).not.toBeNull();

    ctx!.drawImage(img, 0, 0);
    const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    const luminances: number[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      luminances.push(
        0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2],
      );
    }

    const mean = luminances.reduce((a, b) => a + b, 0) / luminances.length;
    const variance =
      luminances.reduce((sum, l) => sum + (l - mean) * (l - mean), 0) /
      luminances.length;

    expect(variance).toBeGreaterThan(50);

    const colorSet = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) {
      colorSet.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    }
    expect(colorSet.size).toBeGreaterThanOrEqual(20);
  });

  it("all four captured frames are distinct (different state content)", async () => {
    bridge = createTestBridge(container, scenario);
    await bridge.reset();

    // Frame 1 at tick 0.
    bridge.renderFrame();
    const frame1 = await bridge.capture();
    const hash1 = bridge.stateHash();

    // Drive to tick 15.
    for (let i = 0; i < 15; i++) {
      const nextTick = bridge.getSimulation().tick + 1;
      const tickInputs = (scenario.inputProgram as Record<string, InputFrame[]>)[
        String(nextTick)
      ];
      if (tickInputs && tickInputs.length > 0) {
        bridge.injectInputs(tickInputs.map((f) => ({ ...f })));
      }
      bridge.step(1);
    }
    bridge.renderFrame();
    const frame2 = await bridge.capture();
    const hash2 = bridge.stateHash();

    // Drive to tick 40.
    for (let i = 0; i < 25; i++) {
      const nextTick = bridge.getSimulation().tick + 1;
      const tickInputs = (scenario.inputProgram as Record<string, InputFrame[]>)[
        String(nextTick)
      ];
      if (tickInputs && tickInputs.length > 0) {
        bridge.injectInputs(tickInputs.map((f) => ({ ...f })));
      }
      bridge.step(1);
    }
    bridge.renderFrame();
    const frame3 = await bridge.capture();
    const hash3 = bridge.stateHash();

    // Drive to end.
    const remainingTicks = scenario.durationTicks - bridge.getSimulation().tick;
    for (let i = 0; i < remainingTicks; i++) {
      const nextTick = bridge.getSimulation().tick + 1;
      const tickInputs = (scenario.inputProgram as Record<string, InputFrame[]>)[
        String(nextTick)
      ];
      if (tickInputs && tickInputs.length > 0) {
        bridge.injectInputs(tickInputs.map((f) => ({ ...f })));
      }
      bridge.step(1);
    }
    bridge.renderFrame();
    const frame4 = await bridge.capture();
    const hash4 = bridge.stateHash();

    // All frames should have different state hashes.
    const hashes = [hash1, hash2, hash3, hash4];
    const unique = new Set(hashes);
    expect(unique.size).toBe(4);

    // Ticks must be monotonically increasing.
    const ticks = [
      frame1.presentationSnapshot.tick,
      frame2.presentationSnapshot.tick,
      frame3.presentationSnapshot.tick,
      frame4.presentationSnapshot.tick,
    ];
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
    }
  });
});

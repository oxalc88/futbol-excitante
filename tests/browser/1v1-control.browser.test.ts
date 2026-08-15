/**
 * @module 1v1-control-browser-tests
 *
 * Browser-mode tests for PLAYABLE-1V1 — proves the two-player scenario
 * with independent slot inputs is playable and deterministic through the
 * browser test-bridge.
 *
 * Tests:
 *  - BROWSER-1V1-CONTROL-001: two HUMAN slots with independently injected
 *    InputFrames yield the same per-tick/final hashes as headless for the
 *    same two-slot input program.
 *  - Slot-1 input moves only slot-1's controlled player; slot-2 only
 *    slot-2's controlled player.
 *  - Rendering extra frames without stepping does not change the hash.
 *  - ARCH-DIFF-001: human perceptual comparison — registered as
 *    NEEDS_PERCEPTUAL_REVIEW (not executable without a versioned rubric).
 *
 * These tests run in Vitest Browser Mode (Playwright + Chromium).
 * The simulation core is the same synchronous, DOM-free module used
 * by the headless runner.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { encodeCanonical } from "../../src/simulation/determinism/canonical.js";
import { hashFnv1a64 } from "../../src/simulation/determinism/hash.js";
import { FOUNDATION_SCENARIO_TWO_PLAYER } from "../../src/apps/browser/foundation-scenario.js";
import { createTestBridge, type TestBridge } from "../../src/apps/browser/test-bridge.js";
import { ARCHETYPE_REGISTRY } from "../../src/simulation/config/foundation.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a headless simulation from the two-player scenario.
 */
function createHeadlessTwoPlayerSim(): Simulation {
  const world = createWorld({ scenario: FOUNDATION_SCENARIO_TWO_PLAYER });
  return createSimulation(world);
}

/**
 * Run headless simulation for the given tick count, injecting per-tick
 * inputs from the scenario's inputProgram.
 */
function runHeadlessTwoPlayer(ticks: number): string[] {
  const sim = createHeadlessTwoPlayerSim();
  const hashes: string[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    const inputs = (
      FOUNDATION_SCENARIO_TWO_PLAYER.inputProgram as Record<string, InputFrame[]>
    )[String(tick)] ?? [];
    if (inputs.length > 0) {
      sim.applyInputs(inputs);
    }
    const result = sim.step();
    hashes.push(result.stateHash);
  }
  return hashes;
}

// ---------------------------------------------------------------------------
// Shared fixture — two-player scenario
// ---------------------------------------------------------------------------

const TWO_PLAYER_SCENARIO: ScenarioDefinition = FOUNDATION_SCENARIO_TWO_PLAYER;

// ---------------------------------------------------------------------------
// Browser test-bridge helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let bridge: TestBridge;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
  // Load the two-player scenario into the bridge.
  bridge = createTestBridge(container, TWO_PLAYER_SCENARIO);
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
// BROWSER-1V1-CONTROL-001: two-slot independent control with hash parity
// ===========================================================================

describe("BROWSER-1V1-CONTROL-001", () => {
  it("bridge per-tick hashes match headless per-tick hashes (two-player, 10 ticks)", async () => {
    // Record evidence for evaluation consumers.
    await bridge.reset();
    const initialHash = bridge.stateHash();

    // Collect per-tick hashes from the bridge.
    const perTickHashes: string[] = [];
    const ticksToRun = 10;

    for (let tick = 0; tick < ticksToRun; tick++) {
      const inputs = (
        TWO_PLAYER_SCENARIO.inputProgram as Record<string, InputFrame[]>
      )[String(tick)] ?? [];
      if (inputs.length > 0) {
        bridge.injectInputs(inputs.map((f) => ({ ...f })));
      }
      const result = bridge.step(1);
      perTickHashes.push(result[0]);
    }

    // Compare against headless reference.
    const headlessHashes = runHeadlessTwoPlayer(ticksToRun);

    // Per-tick hashes must match.
    expect(perTickHashes).toEqual(headlessHashes);
    // Initial hash must be valid.
    expect(initialHash).toBeTruthy();
    expect(initialHash.length).toBeGreaterThan(0);
  });

  it("bridge final hash matches headless final hash (two-player, 20 ticks)", async () => {
    const ticksToRun = 20;

    // Headless reference.
    const headlessHashes = runHeadlessTwoPlayer(ticksToRun);
    const headlessFinalHash = headlessHashes[headlessHashes.length - 1];

    // Bridge run.
    await bridge.reset();
    for (let tick = 0; tick < ticksToRun; tick++) {
      const inputs = (
        TWO_PLAYER_SCENARIO.inputProgram as Record<string, InputFrame[]>
      )[String(tick)] ?? [];
      if (inputs.length > 0) {
        bridge.injectInputs(inputs.map((f) => ({ ...f })));
      }
      bridge.step(1);
    }
    const bridgeFinalHash = bridge.stateHash();

    expect(bridgeFinalHash).toBe(headlessFinalHash);
  });

  it("slot-1 input moves only slot-1's controlled player", async () => {
    await bridge.reset();

    // Inject only slot-1 input (move +X).
    bridge.injectInputs([
      {
        tick: 0,
        sourceId: "slot1-test",
        controlSlot: "slot-1",
        moveX: 1,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ]);
    bridge.step(5);

    const snap = bridge.snapshot();
    const playerA = snap.players.find((p) => p.playerId === "player-a")!;
    const playerB = snap.players.find((p) => p.playerId === "player-b")!;

    // Player A (slot-1) moved in +X.
    expect(playerA.groundPosition.x).toBeGreaterThan(0);
    // Player B (slot-2, no input) stayed at initial position.
    expect(playerB.groundPosition.x).toBe(5);
  });

  it("slot-2 input moves only slot-2's controlled player", async () => {
    await bridge.reset();

    // Inject only slot-2 input (move -X).
    bridge.injectInputs([
      {
        tick: 0,
        sourceId: "slot2-test",
        controlSlot: "slot-2",
        moveX: -1,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ]);
    bridge.step(5);

    const snap = bridge.snapshot();
    const playerA = snap.players.find((p) => p.playerId === "player-a")!;
    const playerB = snap.players.find((p) => p.playerId === "player-b")!;

    // Player B (slot-2) moved in -X direction from x=5.
    expect(playerB.groundPosition.x).toBeLessThan(5);
    // Player A (slot-1, no input) stayed at origin.
    expect(playerA.groundPosition.x).toBe(0);
  });

  it("slot-1 and slot-2 inputs simultaneously: both players move independently", async () => {
    await bridge.reset();

    // Inject both slot-1 and slot-2 inputs.
    bridge.injectInputs([
      {
        tick: 0,
        sourceId: "slot1-test",
        controlSlot: "slot-1",
        moveX: 1,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
      {
        tick: 0,
        sourceId: "slot2-test",
        controlSlot: "slot-2",
        moveX: -1,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ]);
    bridge.step(5);

    const snap = bridge.snapshot();
    const playerA = snap.players.find((p) => p.playerId === "player-a")!;
    const playerB = snap.players.find((p) => p.playerId === "player-b")!;

    // Both players moved independently.
    expect(playerA.groundPosition.x).toBeGreaterThan(0);
    expect(playerB.groundPosition.x).toBeLessThan(5);
  });

  it("rendering extra frames without stepping does not change state hash", async () => {
    await bridge.reset();
    const hashBefore = bridge.stateHash();

    // Render multiple frames without stepping.
    for (let i = 0; i < 5; i++) {
      bridge.renderFrame();
    }

    const hashAfter = bridge.stateHash();
    expect(hashAfter).toBe(hashBefore);
  });

  it("two resets of the same two-player scenario yield identical initial hash", async () => {
    await bridge.reset();
    const hash1 = bridge.stateHash();

    await bridge.reset();
    const hash2 = bridge.stateHash();

    expect(hash1).toBe(hash2);
    // Hash must be non-empty and deterministic.
    expect(hash1).toBeTruthy();
    expect(hash1.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// ARCH-DIFF-001: human perceptual comparison — NEEDS_PERCEPTUAL_REVIEW
// ===========================================================================

describe("ARCH-DIFF-001", () => {
  it("registered as NEEDS_PERCEPTUAL_REVIEW — no executable PASS claim", () => {
    // This test documents that ARCH-DIFF-001 is a perceptual criterion
    // that requires a versioned rubric, randomized presentation, and
    // human subject data.  No objective PASS is claimed here.
    //
    // Per the Gameplay Evaluation Spec §5.4:
    //   "PERCEPTUAL_TARGET criteria require deterministic browser replays,
    //    event-centered frame strips, relevant telemetry beside each frame,
    //    randomized/counterbalanced comparisons, a versioned rubric, critic
    //    identity/version, confidence, evidence-frame indices, and human
    //    escalation for unresolved high-severity disagreement."
    //
    // Since no versioned rubric or perceptual evaluation framework exists,
    // this criterion returns NEEDS_PERCEPTUAL_REVIEW.
    //
    // This test verifies that:
    // 1. The archetype definitions exist and are distinct.
    // 2. Burst achieves higher early speed than steady (engine-design-target).
    // 3. No ARCHETYPE_BLINDED_COMPARISON_PASS is claimed.
    //
    // The actual blinded comparison must be conducted by a human subject
    // study with a versioned rubric — not by this automated test.

    // Verify the archetype registry contains both archetypes.
    expect(ARCHETYPE_REGISTRY["archetype-burst-v1"]).toBeDefined();
    expect(ARCHETYPE_REGISTRY["archetype-steady-v1"]).toBeDefined();

    // Burst has higher transient acceleration than steady.
    const burstDef = ARCHETYPE_REGISTRY["archetype-burst-v1"];
    const steadyDef = ARCHETYPE_REGISTRY["archetype-steady-v1"];

    expect(burstDef.transientAcceleration.value).toBeGreaterThan(0);
    expect(steadyDef.transientAcceleration.value).toBe(0);

    // Verify the two-player scenario has archetype assignments.
    const scenario = TWO_PLAYER_SCENARIO as Record<string, unknown>;
    const players = scenario.players as Array<Record<string, unknown>>;
    const playerA = players.find((p) => p.playerId === "player-a");
    const playerB = players.find((p) => p.playerId === "player-b");

    expect(playerA).toBeDefined();
    expect(playerB).toBeDefined();
    expect(playerA!.archetypeId).toBe("archetype-burst-v1");
    expect(playerB!.archetypeId).toBe("archetype-steady-v1");

    // No ARCHETYPE_BLINDED_COMPARISON_PASS is claimed here.
    // This criterion is NEEDS_PERCEPTUAL_REVIEW.
    expect(true).toBe(true);
  });
});
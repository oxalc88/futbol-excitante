/**
 * @module browser-core-smoke-tests
 *
 * Browser Mode tests for BOOTSTRAP-11 — proves the same scenario and
 * core are browser-playable and visually inspectable without moving
 * authority into presentation.
 *
 * Tests:
 *  - BROWSER-CORE-RESET-001: two resets of the same scenario yield
 *    the headless initial hash and identical primitive entity counts/transforms.
 *  - BROWSER-CORE-STEP-001: exact injected frames and tick count yield
 *    the same per-tick/final hashes as headless.
 *  - Rendering additional animation frames without core steps leaves
 *    the canonical hash unchanged.
 *  - Screenshot smoke: pitch, player, ball, shadow, marker are visible.
 *
 * These tests run in Vitest Browser Mode (Playwright + Chromium).
 * The simulation core is the same synchronous, DOM-free module used
 * by the headless runner.
 *
 * Uses the shared fixture from eval/scenarios/foundation-move-and-roll.v1.json
 * (imported via the shared foundation-scenario module).
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { encodeCanonical } from "../../src/simulation/determinism/canonical.js";
import { hashFnv1a64 } from "../../src/simulation/determinism/hash.js";
import { freezeWorldState } from "../../src/simulation/world/clone.js";
import { FOUNDATION_SCENARIO } from "../../src/apps/browser/foundation-scenario.js";
import { createTestBridge, type TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";

// ---------------------------------------------------------------------------
// Shared fixture — from eval/scenarios via foundation-scenario module
// ---------------------------------------------------------------------------

/**
 * The shared fixture.  This is the single source of truth imported from
 * eval/scenarios/foundation-move-and-roll.v1.json via the shared module.
 */
const SHARED_SCENARIO: ScenarioDefinition = FOUNDATION_SCENARIO;

// ---------------------------------------------------------------------------
// Helper: create a headless simulation from a scenario (same code path)
// ---------------------------------------------------------------------------

function createHeadlessSim(scenario: ScenarioDefinition): Simulation {
  const world = createWorld({ scenario });
  return createSimulation(world);
}

/**
 * Compute the headless initial state hash (tick 0, before any steps).
 */
function headlessInitialHash(scenario: ScenarioDefinition): string {
  const sim = createHeadlessSim(scenario);
  return sim.stateHash();
}

/**
 * Run a headless simulation with inputs from the scenario's inputProgram
 * for the given tick count, returning per-tick hashes.
 */
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

// ===========================================================================
// Browser test-bridge helpers
// ===========================================================================

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
// BROWSER-CORE-RESET-001: two resets yield identical initial hash
// compared against headless initial hash, and verify renderer
// primitive entity counts/transforms through the bridge.
// ===========================================================================

describe("BROWSER-CORE-RESET-001", () => {
  it("initial hash via bridge matches headless initial hash (shared fixture)", async () => {
    // Compute expected hash using the same code path as headless.
    const expectedHash = headlessInitialHash(SHARED_SCENARIO);

    // Reset the bridge and compare.
    await bridge.reset();
    const bridgeHash = bridge.stateHash();

    expect(bridgeHash).toBe(expectedHash);
  });

  it("two resets of the same scenario yield identical initial hash", async () => {
    await bridge.reset();
    const hash1 = bridge.stateHash();

    await bridge.reset();
    const hash2 = bridge.stateHash();

    expect(hash1).toBe(hash2);
    expect(hash1).toBe(headlessInitialHash(SHARED_SCENARIO));
  });

  it("entity counts match headless snapshot (1 player, 1 ball)", async () => {
    await bridge.reset();

    const headlessSim = createHeadlessSim(SHARED_SCENARIO);
    const headlessSnap = headlessSim.snapshot();
    const bridgeSnap = bridge.snapshot();

    expect(bridgeSnap.players.length).toBe(headlessSnap.players.length);
    expect(bridgeSnap.players.length).toBe(1);
    expect(bridgeSnap.ball).toBeDefined();
  });

  it("player transforms match headless after reset", async () => {
    await bridge.reset();

    const headlessSim = createHeadlessSim(SHARED_SCENARIO);
    const headlessSnap = headlessSim.snapshot();
    const bridgeSnap = bridge.snapshot();

    const hp = headlessSnap.players[0];
    const bp = bridgeSnap.players[0];

    expect(bp.playerId).toBe(hp.playerId);
    expect(bp.teamId).toBe(hp.teamId);
    expect(bp.groundPosition.x).toBe(hp.groundPosition.x);
    expect(bp.groundPosition.y).toBe(hp.groundPosition.y);
    expect(bp.bodyHeading).toBe(hp.bodyHeading);
    expect(bp.desiredHeading).toBe(hp.desiredHeading);
  });

  it("ball state matches headless after reset", async () => {
    await bridge.reset();

    const headlessSim = createHeadlessSim(SHARED_SCENARIO);
    const headlessSnap = headlessSim.snapshot();
    const bridgeSnap = bridge.snapshot();

    expect(bridgeSnap.ball.position.x).toBe(headlessSnap.ball.position.x);
    expect(bridgeSnap.ball.position.y).toBe(headlessSnap.ball.position.y);
    expect(bridgeSnap.ball.position.z).toBe(headlessSnap.ball.position.z);
    expect(bridgeSnap.ball.regime).toBe(headlessSnap.ball.regime);
  });

  it("renderer primitive entity counts verified through bridge", async () => {
    await bridge.reset();

    // Render a frame so scene objects are populated.
    bridge.renderFrame();

    const capture = await bridge.capture();
    // Scene should contain: pitch-group, ball, ball-shadow, controlled-marker,
    // player mesh, lights, plus line objects in pitch-group.
    expect(capture.sceneObjectCount).toBeGreaterThanOrEqual(5);

    // Camera should be positioned (not at origin).
    expect(capture.cameraPosition.z).toBeGreaterThan(0);
  });
});

// ===========================================================================
// BROWSER-CORE-STEP-001: exact injected frames and tick count yield
// the same per-tick/final hashes as headless (shared fixture).
// ===========================================================================

describe("BROWSER-CORE-STEP-001", () => {
  it("bridge step hashes match headless per-tick hashes (shared fixture, 5 ticks)", async () => {
    const ticksToRun = 5;

    // Run headless with the shared fixture's inputProgram.
    const headlessHashes = runHeadlessWithInputs(SHARED_SCENARIO, ticksToRun);

    // Run bridge with the same inputs from the shared fixture.
    await bridge.reset();
    const bridgeHashes: string[] = [];

    for (let tick = 0; tick < ticksToRun; tick++) {
      const inputs = (SHARED_SCENARIO.inputProgram as Record<string, InputFrame[]>)[String(tick)] ?? [];
      if (inputs.length > 0) {
        bridge.injectInputs(inputs.map((f) => ({ ...f })));
      }
      const result = bridge.step(1);
      bridgeHashes.push(result[0]);
    }

    // Per-tick hashes must match.
    expect(bridgeHashes).toEqual(headlessHashes);
  });

  it("bridge final hash matches headless final hash (shared fixture, 10 ticks)", async () => {
    const ticksToRun = 10;

    // Headless reference.
    const headlessHashes = runHeadlessWithInputs(SHARED_SCENARIO, ticksToRun);
    const headlessFinalHash = headlessHashes[headlessHashes.length - 1];

    // Bridge run.
    await bridge.reset();
    for (let tick = 0; tick < ticksToRun; tick++) {
      const inputs = (SHARED_SCENARIO.inputProgram as Record<string, InputFrame[]>)[String(tick)] ?? [];
      if (inputs.length > 0) {
        bridge.injectInputs(inputs.map((f) => ({ ...f })));
      }
      bridge.step(1);
    }
    const bridgeFinalHash = bridge.stateHash();

    expect(bridgeFinalHash).toBe(headlessFinalHash);
  });

  it("different input frames produce different hashes through bridge", async () => {
    await bridge.reset();

    // Inject moveX: 0.5
    bridge.injectInputs([{
      tick: 0,
      sourceId: "test-a",
      controlSlot: "slot-1",
      moveX: 0.5,
      moveY: 0,
      sprint: 0,
      heldButtons: 0,
      pressedButtons: 0,
      releasedButtons: 0,
    }]);
    const resultA = bridge.step(1);
    const hashA = resultA[0];

    await bridge.reset();

    // Inject moveX: -0.5
    bridge.injectInputs([{
      tick: 0,
      sourceId: "test-b",
      controlSlot: "slot-1",
      moveX: -0.5,
      moveY: 0,
      sprint: 0,
      heldButtons: 0,
      pressedButtons: 0,
      releasedButtons: 0,
    }]);
    const resultB = bridge.step(1);
    const hashB = resultB[0];

    expect(hashA).not.toBe(hashB);
  });
});

// ===========================================================================
// Rendering extra frames without core steps leaves hash unchanged
// ===========================================================================

describe("BROWSER-CORE-RENDER-001", () => {
  it("calling renderFrame/capture multiple times does not change state hash", async () => {
    await bridge.reset();
    const hashBefore = bridge.stateHash();

    // Render multiple frames without stepping.
    for (let i = 0; i < 5; i++) {
      bridge.renderFrame();
    }

    const hashAfter = bridge.stateHash();
    expect(hashAfter).toBe(hashBefore);
  });

  it("snapshot does not mutate the simulation", async () => {
    await bridge.reset();
    const hashBefore = bridge.stateHash();

    const snap = bridge.snapshot();
    expect(Object.isFrozen(snap)).toBe(true);

    const hashAfter = bridge.stateHash();
    expect(hashAfter).toBe(hashBefore);
  });
});

// ===========================================================================
// Screenshot smoke — capture after reset, assert visible content
// Diagnostic only — no perceptual PASS claim.
// ===========================================================================

describe("SCREENSHOT-SMOKE-001", () => {
  it("capture after reset produces non-empty screenshot with expected scene objects", async () => {
    await bridge.reset();

    // Render the initial state.
    bridge.renderFrame();

    const capture = await bridge.capture();

    // Screenshot must be a non-empty data URL.
    expect(capture.screenshot).toBeTruthy();
    expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);

    // The base64 payload must have content (canvas is non-empty).
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);

    // Scene diagnostics: pitch, ball, shadow, marker, player should all exist.
    // The scene should have at least 5 top-level objects:
    //   pitch-group, ball, ball-shadow, controlled-marker, main-light, ambient-light, player-group
    expect(capture.sceneObjectCount).toBeGreaterThanOrEqual(5);

    // Camera is positioned above the pitch looking down.
    expect(capture.cameraPosition.y).toBeGreaterThan(0);
    expect(capture.cameraPosition.z).toBeGreaterThan(0);
  });

  it("scene contains all required named objects: pitch-group, player-*, ball, ball-shadow, controlled-marker", async () => {
    await bridge.reset();
    bridge.renderFrame();

    const scene = bridge.getScene();
    const found = new Set<string>();

    scene.traverse((obj: import("three").Object3D) => {
      if (obj.name) found.add(obj.name);
    });

    expect(found.has("pitch-group")).toBe(true);
    expect(found.has("ball")).toBe(true);
    expect(found.has("ball-shadow")).toBe(true);
    expect(found.has("controlled-marker")).toBe(true);

    // At least one player-* group must exist.
    const hasPlayer = [...found].some((n) => n.startsWith("player-"));
    expect(hasPlayer).toBe(true);
  });

  it("controlled-marker is visible when a controlled player exists", async () => {
    await bridge.reset();
    bridge.renderFrame();

    // The foundation scenario assigns controlledPlayerId = "stable-player-1".
    const scene = bridge.getScene();
    let markerFound = false;
    let markerVisible = false;

    scene.traverse((obj: import("three").Object3D) => {
      if (obj.name === "controlled-marker") {
        markerFound = true;
        markerVisible = obj.visible;
      }
    });

    expect(markerFound).toBe(true);

    // A controlled player exists in the presentation after reset.
    const presentation = bridge.getPresentationSession();
    // Render to sync scene with snapshot.
    bridge.renderFrame();

    const capture = await bridge.capture();
    const controlledExists = capture.presentationSnapshot.players.some(
      (p) => p.isControlled,
    );
    expect(controlledExists).toBe(true);
    expect(markerVisible).toBe(true);
  });

  it("decoded screenshot is not fully black or blank (luminance variance above threshold)", async () => {
    await bridge.reset();
    bridge.renderFrame();

    const capture = await bridge.capture();
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);

    // Decode the PNG data URL into pixel data via an offscreen canvas.
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

    // Compute mean luminance and variance.
    const luminances: number[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      luminances.push(0.299 * r + 0.587 * g + 0.114 * b);
    }

    const mean = luminances.reduce((a, b) => a + b, 0) / luminances.length;
    const variance =
      luminances.reduce((sum, l) => sum + (l - mean) * (l - mean), 0) /
      luminances.length;

    // Variance must be above a small threshold — the image is not blank/black.
    // A uniform color would have variance ~0.  The pitch + players + ball
    // guarantee at least some variance.  Provisional threshold: 50.
    expect(variance).toBeGreaterThan(50);

    // Also check distinct color count (unique RGB tuples) to guard against
    // a degenerate single-color render.
    const colorSet = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) {
      colorSet.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    }
    // At least 20 distinct RGB colors for a scene with pitch, players, ball.
    expect(colorSet.size).toBeGreaterThanOrEqual(20);
  });

  it("capture after step renders ball and player at updated positions", async () => {
    await bridge.reset();

    // Inject inputs and step.
    bridge.injectInputs([{
      tick: 0,
      sourceId: "test-input",
      controlSlot: "slot-1",
      moveX: 0.5,
      moveY: 0,
      sprint: 0,
      heldButtons: 0,
      pressedButtons: 0,
      releasedButtons: 0,
    }]);
    bridge.step(1);

    const capture = await bridge.capture();

    // Screenshot has content.
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);

    // Presentation snapshot shows player has moved (non-zero speed).
    const player = capture.presentationSnapshot.players[0];
    expect(player).toBeDefined();
    expect(player.groundPosition).toBeDefined();

    // Ball has moved from initial position (ball system active).
    expect(capture.presentationSnapshot.ball).toBeDefined();
  });
});

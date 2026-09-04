/**
 * @module tests/browser/small-sided-001.browser.test
 *
 * Browser case BROWSER-SMALL-SIDED-001: deterministic small-sided (3v3) match.
 *
 * Validates:
 *  1. Small-sided scenario structure (6 AI_FALLBACK slots, 2 teams, 3 players).
 *  2. Browser/headless hash correspondence (two bridge runs match; bridge matches headless).
 *  3. Deterministic CPU-driven run (multi-tick hash parity).
 *  4. Semantic frame capture (before → kickoff → play → later) via Playwright.
 *  5. Per-tick hash data stored for trajectory.json generation.
 *  6. Case result recorded for browser-cases.json.
 *
 * Evidence class: DYNAMIC_VISUAL.
 * Case version: browser-case-small-sided-v1.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { commands } from "@vitest/browser/context";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { buildCaptureMeta } from "../../eval/capture-snapshot.js";
import { FOUNDATION_SCENARIO_3V3 } from "../../src/apps/browser/foundation-scenario.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CASE_ID = "BROWSER-SMALL-SIDED-001";
const CASE_VERSION = "browser-case-small-sided-v1";
// Capture-hygiene (0.9.2+): ordinary regression runs must not write
// docs/screenshots/**. Durable evidence is entered only through the explicit
// evidence-mode capture (WIP_SECTION=__EVIDENCE__:BROWSER-SMALL-SIDED-001-CASE).
const OBJECTIVE_ID = "BROWSER-SMALL-SIDED-001-CASE";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const SCREENSHOT_DIR = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;

async function assertEvidenceMutable(): Promise<void> {
  try {
    await commands.readFile(`docs/evidence/${OBJECTIVE_ID}/manifest.json`, "utf-8");
  } catch {
    return; // no manifest yet: durable capture for this candidate is allowed
  }
  throw new Error(
    `Accepted evidence is immutable: docs/evidence/${OBJECTIVE_ID}/manifest.json exists`,
  );
}

// ---------------------------------------------------------------------------
// Headless helper — same code path as the browser test bridge
// ---------------------------------------------------------------------------

function createHeadlessSim(): Simulation {
  const world = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });
  return createSimulation(world);
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
    bridge.getPresentationSession().dispose();
  } catch {
    /* already disposed */
  }
  if (container.parentElement) {
    container.parentElement.removeChild(container);
  }
});

// ===========================================================================
// Small-sided scenario structure
// ===========================================================================

describe("BROWSER-SMALL-SIDED-001: small-sided scenario structure", () => {
  it("FOUNDATION_SCENARIO_3V3 has 6 AI_FALLBACK control slots", () => {
    const assignments = FOUNDATION_SCENARIO_3V3.controlAssignments;
    const slots = Object.keys(assignments);
    expect(slots.length).toBe(6);

    const modes = Object.values(assignments).map((a) => a.mode);
    expect(modes.every((m) => m === "AI_FALLBACK")).toBe(true);
  });

  it("small-sided scenario has 2 teams with 3 players each", () => {
    const assignments = FOUNDATION_SCENARIO_3V3.controlAssignments;
    const teamA = Object.values(assignments).filter((a) => a.teamId === "team-a");
    const teamB = Object.values(assignments).filter((a) => a.teamId === "team-b");
    expect(teamA.length).toBe(3);
    expect(teamB.length).toBe(3);
  });

  it("bridge loads the 3v3 scenario with 6 players", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();

    const players = bridge.getSimulation().presentation().players;
    expect(players.length).toBe(6);

    // Verify two teams present in presentation.
    const teamIds = new Set(players.map((p) => p.teamId));
    expect(teamIds.size).toBe(2);
  });
});

// ===========================================================================
// BROWSER-SMALL-SIDED-001: browser/headless hash correspondence
// ===========================================================================

describe("BROWSER-SMALL-SIDED-001: hash correspondence", () => {
  it("bridge initial hash matches headless initial hash", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();

    const headlessSim = createHeadlessSim();
    const expectedHash = headlessSim.stateHash();

    expect(bridge.stateHash()).toBe(expectedHash);
  });

  it("two independent bridge runs produce identical per-tick hashes", async () => {
    const TICKS = 120;

    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();
    const bridgeHashes1 = bridge.stepWithCpuControllers(TICKS);

    const bridge2 = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge2.reset();
    const bridgeHashes2 = bridge2.stepWithCpuControllers(TICKS);

    expect(bridgeHashes1).toEqual(bridgeHashes2);
    expect(bridgeHashes1.length).toBe(TICKS);
  });

  it("bridge CPU hashes match headless CPU hashes for 60 ticks", async () => {
    const TICKS = 60;

    // Bridge with CPU controllers.
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();
    const bridgeHashes = bridge.stepWithCpuControllers(TICKS);

    // Headless with CPU controllers — same wiring.
    const headlessSim = createHeadlessSim();
    const { buildCpuObservation, createCpuAdapter } = await import(
      "../../src/adapters/input-browser/cpu-adapter.js"
    );
    const { computeTeamDecision } = await import(
      "../../src/adapters/input-browser/team-decision-profile.js"
    );

    const entries = Object.entries(FOUNDATION_SCENARIO_3V3.controlAssignments).map(
      ([controlSlot, assignment]) => ({
        controlSlot,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId,
        adapter: createCpuAdapter(),
      }),
    );

    const headlessHashes: string[] = [];
    for (let i = 0; i < TICKS; i++) {
      const snapshot = headlessSim.snapshot();
      const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
      for (const entry of entries) {
        if (!teamDecisions.has(entry.teamId)) {
          const obs = buildCpuObservation(
            snapshot,
            entry.teamId,
            entry.controlledPlayerId,
          );
          teamDecisions.set(entry.teamId, computeTeamDecision(obs, entry.teamId));
        }
      }
      const frames = entries.map((entry) => {
        const obs = buildCpuObservation(
          snapshot,
          entry.teamId,
          entry.controlledPlayerId,
        );
        obs.teamDecision = teamDecisions.get(entry.teamId);
        const frame = entry.adapter.sample(headlessSim.tick, obs);
        frame.controlSlot = entry.controlSlot;
        return frame;
      });
      headlessSim.applyInputs(frames);
      headlessHashes.push(headlessSim.step().stateHash);
    }

    expect(bridgeHashes).toEqual(headlessHashes);
  });

  it("bridge per-tick hashes match headless per-tick hashes (zero-input, 10 ticks)", async () => {
    const TICKS = 10;

    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();

    // Bridge zero-input (pure step).
    const bridgeHashes = bridge.step(TICKS);

    // Headless zero-input — verify stability.
    const headlessSim = createHeadlessSim();
    const headlessHashes: string[] = [];
    for (let i = 0; i < TICKS; i++) {
      const result = headlessSim.step();
      headlessHashes.push(result.stateHash);
    }

    const headlessSim2 = createHeadlessSim();
    const headlessHashes2: string[] = [];
    for (let i = 0; i < TICKS; i++) {
      const result = headlessSim2.step();
      headlessHashes2.push(result.stateHash);
    }
    expect(headlessHashes).toEqual(headlessHashes2);

    // Bridge (zero-input) should match headless (zero-input).
    expect(bridgeHashes).toEqual(headlessHashes);
  });
});

// ===========================================================================
// DYNAMIC_VISUAL: semantic frame capture via Playwright page.screenshot()
// ===========================================================================

describe("BROWSER-SMALL-SIDED-001: semantic frame capture", () => {
  it(
    "captures 4 semantic frames: before → kickoff → play → later",
    async () => {
      if (DURABLE_EVIDENCE) await assertEvidenceMutable();

      async function captureFrame(name: string): Promise<void> {
        const cap = await bridge.capture();
        const base64 = cap.screenshot.split(",")[1] ?? "";
        if (!base64 || base64.length < 100) {
          throw new Error(`renderer produced no PNG bytes for ${name}`);
        }
        await commands.writeFile(`${SCREENSHOT_DIR}/${name}`, base64, "base64");
      }

      // Frame 1: before — initial state (tick 0).
      bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
      await bridge.reset();
      bridge.renderFrame();
      await captureFrame("frame-before.png");

      // Verify 6 players at start.
      expect(bridge.getSimulation().presentation().players.length).toBe(6);

      // Frame 2: kickoff — early CPU play (tick 60).
      bridge.stepWithCpuControllers(60);
      bridge.renderFrame();
      await captureFrame("frame-kickoff.png");
      expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(60);

      // Frame 3: play — mid-game activity (tick 180).
      bridge.stepWithCpuControllers(120);
      bridge.renderFrame();
      await captureFrame("frame-play.png");
      expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(180);

      // Frame 4: later — extended play (tick 360).
      bridge.stepWithCpuControllers(180);
      bridge.renderFrame();
      await captureFrame("frame-later.png");
      expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(360);

      // Verify 6 players still present.
      expect(bridge.getSimulation().presentation().players.length).toBe(6);

      // Capture data for evidence storage.
      const capture = await bridge.capture();
      expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);
      expect(capture.presentationSnapshot.players.length).toBe(6);

      // Store on window for node-side extraction (for evidence scripts).
      (window as unknown as Record<string, string>).__smallSidedInitialHash = bridge.stateHash();
      (window as unknown as Record<string, string>).__smallSidedFrameMeta = JSON.stringify([
        { label: "before", tick: 0, note: "Initial 3v3 state — 6 players at formation positions" },
        { label: "kickoff", tick: 60, note: "Early play — CPU adapters active, players moving from formation" },
        { label: "play", tick: 180, note: "Active match — ball in play, players chasing/defending" },
        { label: "later", tick: 360, note: "Extended play — match well underway, coordinated team behavior" },
      ]);

      // Store per-tick hashes from a full run.
      const bridge2 = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
      await bridge2.reset();
      const perTickHashes = bridge2.stepWithCpuControllers(360);
      (window as unknown as Record<string, string>).__smallSidedPerTickHashes = JSON.stringify(perTickHashes);
    },
    { timeout: 60_000 },
  );

  it("semantic frames are non-blank (luminance and color variance)", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();

    // Step through to play state.
    bridge.stepWithCpuControllers(360);
    bridge.renderFrame();
    const capture = await bridge.capture();

    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);

    // Decode the PNG and check luminance variance.
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
      luminances.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    }

    const mean = luminances.reduce((a, b) => a + b, 0) / luminances.length;
    const variance =
      luminances.reduce((sum, l) => sum + (l - mean) * (l - mean), 0) / luminances.length;

    // Variance must be above threshold — image is not blank/black.
    expect(variance).toBeGreaterThan(50);

    // At least 20 distinct RGB colors for pitch + players + ball.
    const colorSet = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) {
      colorSet.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    }
    expect(colorSet.size).toBeGreaterThanOrEqual(20);
  });

  it("all four captured frames are distinct (different state content)", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();

    // Capture frame 1.
    bridge.renderFrame();
    const frame1 = await bridge.capture();
    const hash1 = bridge.stateHash();

    // Step to tick 60.
    bridge.stepWithCpuControllers(60);
    bridge.renderFrame();
    const frame2 = await bridge.capture();
    const hash2 = bridge.stateHash();

    // Step to tick 180.
    bridge.stepWithCpuControllers(120);
    bridge.renderFrame();
    const frame3 = await bridge.capture();
    const hash3 = bridge.stateHash();

    // Step to tick 360.
    bridge.stepWithCpuControllers(180);
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
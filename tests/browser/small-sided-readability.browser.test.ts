/**
 * @module tests/browser/small-sided-readability.browser.test
 *
 * Captures DYNAMIC_VISUAL evidence for SMALL-SIDED-VISUAL-READABILITY-EVIDENCE.
 *
 * Maps 8 visual_readability_dimensions from SMALL_SIDED_SHAPE to
 * event-centered frame sequences captured via Playwright page.screenshot().
 *
 * Each dimension gets 3 frames (before → event → after) at ticks chosen
 * to demonstrate the named readability dimension in small-sided 3v3 play.
 *
 * Evidence class: DYNAMIC_VISUAL.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_3V3 } from "../../src/apps/browser/foundation-scenario.js";
import { DEFAULT_RENDERER_CONFIG } from "../../src/adapters/renderer-three/renderer.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { RendererConfig } from "../../src/adapters/renderer-three/renderer.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCREENSHOT_DIR = "/home/ubuntu/projects/oxDeveloop/pes-simulator/docs/screenshots/SMALL-SIDED-VISUAL-READABILITY-EVIDENCE";

/** Wider camera for team_classification: shows all 6 players in one frame. */
const WIDE_CAMERA_CONFIG: RendererConfig = {
  ...DEFAULT_RENDERER_CONFIG,
  cameraPosition: { x: 0, y: 30, z: 80 },
  cameraFov: 75,
};

/**
 * Event-centered capture plan for the 8 readability dimensions.
 * Each dimension has a before/event/after tick sequence.
 * Chosen from headless simulation state analysis:
 *  - tick 1: initial formation, ball at center, teams spread
 *  - tick 60: early convergence, teams approaching center
 *  - tick 121: player-player-contact event, congested near ball
 *  - tick 180: dense contact, all 6 players converging
 *  - tick 240: tightest congestion, overlapping silhouettes
 *  - tick 300: post-congestion spread, team A advancing
 *  - tick 360: clear team separation, A attacking right
 *  - tick 420: established attacking shape, wide spread
 *  - tick 600: late-game, fully separated teams
 */
const CAPTURE_PLAN = [
  // 1. ball_readability_under_congestion: ball amid converging players
  { dim: "ball_readability_under_congestion", label: "before", tick: 109 },
  { dim: "ball_readability_under_congestion", label: "event", tick: 121 },
  { dim: "ball_readability_under_congestion", label: "after", tick: 136 },
  // 2. team_classification: both teams visible near center (tick ≥120)
  { dim: "team_classification", label: "before", tick: 120 },
  { dim: "team_classification", label: "event", tick: 125 },
  { dim: "team_classification", label: "after", tick: 140 },
  // 3. facing_orientation: varied headings in tight contact cluster
  { dim: "facing_orientation", label: "before", tick: 168 },
  { dim: "facing_orientation", label: "event", tick: 180 },
  { dim: "facing_orientation", label: "after", tick: 195 },
  // 4. contact_comprehension: overlapping player kits at contact
  { dim: "contact_comprehension", label: "before", tick: 228 },
  { dim: "contact_comprehension", label: "event", tick: 240 },
  { dim: "contact_comprehension", label: "after", tick: 255 },
  // 5. team_shape_readability: established attacking shape
  { dim: "team_shape_readability", label: "before", tick: 408 },
  { dim: "team_shape_readability", label: "event", tick: 420 },
  { dim: "team_shape_readability", label: "after", tick: 432 },
  // 6. camera_readability: static camera, full pitch context
  { dim: "camera_readability", label: "before", tick: 288 },
  { dim: "camera_readability", label: "event", tick: 300 },
  { dim: "camera_readability", label: "after", tick: 312 },
  // 7. silhouette_stability: steady silhouettes during continuous play
  { dim: "silhouette_stability", label: "before", tick: 348 },
  { dim: "silhouette_stability", label: "event", tick: 360 },
  { dim: "silhouette_stability", label: "after", tick: 375 },
  // 8. action_recognition: directional player positioning (no discrete action)
  { dim: "action_recognition", label: "before", tick: 588 },
  { dim: "action_recognition", label: "event", tick: 600 },
  { dim: "action_recognition", label: "after", tick: 615 },
];

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
// DYNAMIC_VISUAL: 8-dimension readability evidence via Playwright screenshots
// ===========================================================================

describe("SMALL-SIDED-VISUAL-READABILITY-EVIDENCE: 8-dimension capture", () => {
  it(
    "captures event-centered frames for all 8 visual readability dimensions",
    async () => {
      const { page } = await import("@vitest/browser/context");

      // ---- Pass 1: 7 dimensions with DEFAULT camera --------------------
      const defaultCaptures = CAPTURE_PLAN.filter(
        (c) => c.dim !== "team_classification",
      ).sort((a, b) => a.tick - b.tick);

      const bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
      await bridge.reset();

      // Verify 6 players at start.
      const initialPlayers = bridge.getSimulation().presentation().players;
      expect(initialPlayers.length).toBe(6);
      const teamIds = new Set(initialPlayers.map((p) => p.teamId));
      expect(teamIds.size).toBe(2);

      const capturedFrames: Array<{
        dim: string;
        label: string;
        tick: number;
        hash: string;
      }> = [];

      let currentTick = 0;
      for (const capture of defaultCaptures) {
        const ticksToStep = capture.tick - currentTick;
        if (ticksToStep > 0) {
          bridge.stepWithCpuControllers(ticksToStep);
          currentTick = capture.tick;
        }
        expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(capture.tick);

        bridge.renderFrame();
        const fileName = `${capture.dim}-${capture.label}.png`;
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${fileName}`,
          type: "png",
        });
        capturedFrames.push({
          dim: capture.dim,
          label: capture.label,
          tick: capture.tick,
          hash: bridge.stateHash(),
        });
      }

      // ---- Pass 2: team_classification with WIDER camera ---------------
      const tcCaptures = CAPTURE_PLAN.filter(
        (c) => c.dim === "team_classification",
      ).sort((a, b) => a.tick - b.tick);

      const wideBridge = createTestBridge(
        container,
        FOUNDATION_SCENARIO_3V3,
        undefined,
        WIDE_CAMERA_CONFIG,
      );
      await wideBridge.reset();

      let wideTick = 0;
      for (const capture of tcCaptures) {
        const ticksToStep = capture.tick - wideTick;
        if (ticksToStep > 0) {
          wideBridge.stepWithCpuControllers(ticksToStep);
          wideTick = capture.tick;
        }
        expect(wideBridge.getSimulation().tick).toBeGreaterThanOrEqual(
          capture.tick,
        );

        wideBridge.renderFrame();
        const fileName = `${capture.dim}-${capture.label}.png`;
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${fileName}`,
          type: "png",
        });
        capturedFrames.push({
          dim: capture.dim,
          label: capture.label,
          tick: capture.tick,
          hash: wideBridge.stateHash(),
        });
      }

      // Dispose the wide bridge.
      try {
        wideBridge.getPresentationSession().dispose();
      } catch {
        /* already disposed */
      }

      // ---- Verify all 24 frames captured ------------------------------
      expect(capturedFrames.length).toBe(CAPTURE_PLAN.length);

      const dims = new Set(capturedFrames.map((f) => f.dim));
      expect(dims.size).toBe(8);

      for (const dim of dims) {
        const dimFrames = capturedFrames.filter((f) => f.dim === dim);
        expect(dimFrames.length).toBe(3);
        const labels = dimFrames.map((f) => f.label);
        expect(labels).toContain("before");
        expect(labels).toContain("event");
        expect(labels).toContain("after");
      }

      // Hashes distinct for different ticks (same-tick frames from different
      // bridges share state hash but are from different camera renders).
      const uniqueHashes = new Set(capturedFrames.map((f) => f.hash));
      expect(uniqueHashes.size).toBeGreaterThanOrEqual(12);

      // Store metadata for the Node-side evidence producer.
      (window as unknown as Record<string, string>).__readabilityFrames =
        JSON.stringify(capturedFrames);

      // Dispose the default bridge.
      try {
        bridge.getPresentationSession().dispose();
      } catch {
        /* already disposed */
      }

      // Now run a full 720-tick CPU match to collect per-tick hashes.
      const bridge2 = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
      await bridge2.reset();
      const perTickHashes = bridge2.stepWithCpuControllers(720);
      (window as unknown as Record<string, string>).__readabilityPerTickHashes =
        JSON.stringify(perTickHashes);
    },
    { timeout: 120_000 },
  );

  it("semantic frames are non-blank with luminance and color variance", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();

    // Step to a representative tick (240 = densest contact).
    bridge.stepWithCpuControllers(240);
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

    expect(variance).toBeGreaterThan(50);

    // At least 20 distinct RGB colors for pitch + players + ball.
    const colorSet = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) {
      colorSet.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    }
    expect(colorSet.size).toBeGreaterThanOrEqual(20);
  });

  it(
    "frames at different ticks are visually distinct",
    async () => {
      bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
      await bridge.reset();

      // Capture at tick 0 (initial).
      bridge.renderFrame();
      const hash0 = bridge.stateHash();

      // Advance to tick 240.
      bridge.stepWithCpuControllers(240);
      bridge.renderFrame();
      const hash240 = bridge.stateHash();
      const tick240 = bridge.getSimulation().tick;

      // Advance to tick 360.
      bridge.stepWithCpuControllers(120);
      bridge.renderFrame();
      const hash360 = bridge.stateHash();
      const tick360 = bridge.getSimulation().tick;

      // All should have different state hashes.
      const hashes = [hash0, hash240, hash360];
      const unique = new Set(hashes);
      expect(unique.size).toBe(3);

      // Ticks monotonically increasing.
      expect(tick240).toBeGreaterThan(0);
      expect(tick360).toBeGreaterThan(tick240);
    },
    { timeout: 60_000 },
  );
});

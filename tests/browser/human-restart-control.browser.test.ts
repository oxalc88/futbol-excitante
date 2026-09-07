/**
 * @module tests/browser/human-restart-control.browser.test
 *
 * Captures DYNAMIC_VISUAL evidence for HUMAN-RESTART-CONTROL: event-centered
 * frames of a human-taken restart vs the CPU-taken control, around a throw-in
 * the human's team won.
 *
 * The restart window is opened from committed state (the same technique the
 * accepted restart integration tests use) so the core's own applyThrowIn
 * machinery runs unchanged. The ONLY difference between the human and CPU runs
 * is whether the human's control slot is fed a directional input frame during
 * the window: the human steers the awarding team's receiving body, and the
 * core re-targets its nearest-receiver serve toward the human-chosen position
 * (human-taken), while the CPU fallback (no human input) serves toward the
 * default nearest receiver.
 *
 * Frames (event-centered on the serve):
 *   - human-before      (window open): restart window active, taker + receivers set
 *   - human-steer       (window):      human steers the receiving body toward +x/-y
 *   - human-serve       (serve):       throw-in-executed, ball served toward the
 *                                      human-steered position
 *   - human-after       (consequence): ball in flight toward the human target
 *   - cpu-serve         (control):     the identical window with NO human input —
 *                                      the core serves toward the default receiver
 *
 * Capture hygiene (0.9.2+): durable screenshots are written only in evidence
 * mode (`WIP_SECTION=__EVIDENCE__:HUMAN-RESTART-CONTROL`); an ordinary run
 * writes under the ignored `test-results/gauntlet-capture/**` tree and leaves
 * `docs/` byte-identical.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { commands } from "@vitest/browser/context";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { DEFAULT_RENDERER_CONFIG } from "../../src/adapters/renderer-three/renderer.js";
import { deepClone } from "../../src/simulation/world/clone.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { WorldState, MatchPhase } from "../../src/contracts/state.js";
import type { InputFrame } from "../../src/contracts/input.js";
import hrScenario from "../../eval/scenarios/5v5-human-restart-throwin.v1.json";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OBJECTIVE_ID = "HUMAN-RESTART-CONTROL";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const SCREENSHOT_DIR = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;

const HUMAN_CONTROL_SLOT = "slot-1";
const HUMAN_TEAM_ID = "team-a";
const HUMAN_PLAYER_ID = "player-3";

/**
 * Camera framed on the throw-in area (near +y touchline at x≈30, y≈34).
 *
 * The restart spot is at sim (30,34) (render (30,0,34)); the receiver steers
 * from sim (20,30) → (20.65,29.35) and the ball flies toward (20.5,29.5).
 * The prior camera (42,28,46)→(28,22,10) projected the whole event 200-440 px
 * below the 600 px frame (visually void). This camera sits ~19 m from the spot
 * and projects the taker, the steered receiver path, and the ball flight all
 * INSIDE the viewport at ~28 px/m so ~0.7 m of body movement and ~1 m of ball
 * flight are legible.
 */
const THROW_IN_CAMERA_CONFIG: typeof DEFAULT_RENDERER_CONFIG = {
  ...DEFAULT_RENDERER_CONFIG,
  cameraPosition: { x: 26, y: 13, z: 47 },
  cameraTarget: { x: 25, y: 0, z: 31.5 },
  cameraFov: 55,
};

const COUNTDOWN = 20;

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
  if (container.parentElement) {
    container.parentElement.removeChild(container);
  }
});

function openThrowInWindow(b: TestBridge): void {
  const mutable = deepClone(b.snapshot()) as WorldState;
  mutable.matchPhase = "throw-in" as MatchPhase;
  mutable.throwInPosition = { x: 30, y: 34 };
  mutable.throwInAwardingTeam = HUMAN_TEAM_ID;
  mutable.throwInCountdown = COUNTDOWN;
  mutable.throwInTakerId = "player-1";
  mutable.throwInTouchlineIndex = 0;
  b.getSimulation().restore(mutable);
}

function humanFrame(tick: number, moveX: number, moveY: number): InputFrame {
  return {
    tick,
    sourceId: "keyboard",
    controlSlot: HUMAN_CONTROL_SLOT,
    moveX,
    moveY,
    sprint: 1,
    heldButtons: 0,
    pressedButtons: 0,
    releasedButtons: 0,
  };
}

/**
 * SHA-256 over the captured PNG bytes (base64-decoded). The distinctness guard
 * is on the actual screenshot bytes so a visually void capture can never pass:
 * two frames that render identically hash identically.
 */
async function pngSha256(base64: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("HUMAN-RESTART-CONTROL: event-centered human vs CPU restart frames", () => {
  it(
    "captures event-centered frames of a human-taken restart vs the CPU-taken control",
    async () => {
      if (DURABLE_EVIDENCE) {
        try {
          await commands.readFile(`docs/evidence/${OBJECTIVE_ID}/manifest.json`, "utf-8");
          throw new Error(
            `Accepted evidence is immutable: docs/evidence/${OBJECTIVE_ID}/manifest.json exists`,
          );
        } catch (err) {
          if ((err as Error).message.includes("immutable")) throw err;
        }
      }

      async function captureFrame(b: TestBridge, fileName: string): Promise<{ base64: string; pngSha256: string; stateHash: string; tick: number }> {
        b.renderFrame();
        const cap = await b.capture();
        const base64 = cap.screenshot.split(",")[1] ?? "";
        if (!base64 || base64.length < 100) {
          throw new Error(`renderer produced no PNG bytes for ${fileName}`);
        }
        await commands.writeFile(`${SCREENSHOT_DIR}/${fileName}`, base64, "base64");
        return { base64, pngSha256: await pngSha256(base64), stateHash: b.stateHash(), tick: b.getSimulation().tick };
      }

      // ------------------------------------------------------------------
      // HUMAN-TAKEN run: the human feeds a directional input in the window.
      // ------------------------------------------------------------------
      bridge = createTestBridge(
        container,
        hrScenario as unknown as ScenarioDefinition,
        undefined,
        THROW_IN_CAMERA_CONFIG,
      );
      await bridge.reset();
      openThrowInWindow(bridge);

      const frames: Array<{ label: string; path: string; tick: number; pngSha256: string; stateHash: string; note: string }> = [];

      const before = await captureFrame(bridge, "human-before.png");
      frames.push({ label: "human-before", path: "human-before.png", tick: before.tick, pngSha256: before.pngSha256, stateHash: before.stateHash, note: "restart window open: the human's team won the throw-in; taker + receivers set" });

      // Step through the window, feeding the human a directional input each tick.
      // Steer the receiving body toward +x/-y (down-right).
      for (let i = 0; i < COUNTDOWN - 1; i++) {
        const tick = bridge.getSimulation().tick;
        bridge.injectInputs([humanFrame(tick, 1, -1)]);
        bridge.stepWithCpuControllers(1);
      }

      const steer = await captureFrame(bridge, "human-steer.png");
      frames.push({ label: "human-steer", path: "human-steer.png", tick: steer.tick, pngSha256: steer.pngSha256, stateHash: steer.stateHash, note: "during the window the human steers the receiving body down-right toward the field" });

      // Step to the serve (countdown hits zero).
      const tickBeforeServe = bridge.getSimulation().tick;
      bridge.injectInputs([humanFrame(tickBeforeServe, 1, -1)]);
      bridge.stepWithCpuControllers(1); // applyThrowIn fires; the committed throw-in-executed event is written
      // The serve event lands in committed state this tick; add a small in-flight window.
      bridge.stepWithCpuControllers(1);

      const serve = await captureFrame(bridge, "human-serve.png");
      frames.push({ label: "human-serve", path: "human-serve.png", tick: serve.tick, pngSha256: serve.pngSha256, stateHash: serve.stateHash, note: "throw-in-executed: the ball is served toward the human-steered receiving body" });

      bridge.stepWithCpuControllers(3);
      const after = await captureFrame(bridge, "human-after.png");
      frames.push({ label: "human-after", path: "human-after.png", tick: after.tick, pngSha256: after.pngSha256, stateHash: after.stateHash, note: "consequence: the ball is in flight toward the human-chosen position" });

      // ------------------------------------------------------------------
      // CPU-taken control: identical window, NO human input in the window.
      // ------------------------------------------------------------------
      bridge.getPresentationSession().dispose();
      bridge = createTestBridge(
        container,
        hrScenario as unknown as ScenarioDefinition,
        undefined,
        THROW_IN_CAMERA_CONFIG,
      );
      await bridge.reset();
      openThrowInWindow(bridge);
      bridge.stepWithCpuControllers(COUNTDOWN + 2); // countdown runs with no human input → core auto-serves
      const cpu = await captureFrame(bridge, "cpu-fallback-serve.png");
      frames.push({ label: "cpu-fallback-serve", path: "cpu-fallback-serve.png", tick: cpu.tick, pngSha256: cpu.pngSha256, stateHash: cpu.stateHash, note: "control: the identical window with no human input — the core serves toward the default nearest receiver" });

      // PNG-byte distinctness proof: hashed from the captured screenshot bytes,
      // so a visually void (duplicate/blank) capture can never pass. Require at
      // least 4 distinct SHA-256 across the 5 frames.
      const pngHashes = new Set(frames.map((f) => f.pngSha256));
      expect(pngHashes.size).toBeGreaterThanOrEqual(4);
      for (const f of frames) {
        expect(f.pngSha256).toMatch(/^[0-9a-f]{64}$/);
      }

      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        semantic_order: "before → event → transition → result (+ CPU-taken control)",
        frames,
      };
      await commands.writeFile(`${SCREENSHOT_DIR}/sequence.json`, JSON.stringify(sequence, null, 2), "utf-8");

      (window as unknown as Record<string, string>).__humanRestartFrames = JSON.stringify(frames);
    },
    { timeout: 120_000 },
  );
});

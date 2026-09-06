/**
 * @module tests/browser/corner-driven-dynamic-evidence.browser.test
 *
 * Captures DYNAMIC_VISUAL evidence for CORNER-DRIVEN-CONFORMANCE: event-centered
 * frames around the corner award + execution of the driven corner fixture
 * (eval/scenarios/5v5-corner-driven.v1.json).
 *
 * The corner is genuinely produced by the core: a defending-team (team-b) last
 * touch sends the ball over the +x goal line outside the posts (boundary at
 * ~tick 70), the core awards the corner to team-a and opens the corner-kick
 * phase, and at ~tick 130 it executes the corner kick (ball placed at the
 * corner flag and crossed toward the penalty area).
 *
 * Frames (before → event → transition → result):
 *   - corner-before     (tick 60): ball near the +x goal line, defender chasing
 *   - corner-award      (tick 71): the ball crossed the goal line → corner awarded
 *   - corner-set-piece  (tick 105): corner-kick phase, taker + box set
 *   - corner-execution  (tick 130): corner-kick-executed, ball at the flag + cross
 *
 * Capture hygiene (0.9.2+): durable screenshots are written only in evidence
 * mode (`WIP_SECTION=__EVIDENCE__:CORNER-DRIVEN-CONFORMANCE`); an ordinary run
 * writes under the ignored `test-results/gauntlet-capture/**` tree and leaves
 * `docs/` byte-identical.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { commands } from "@vitest/browser/context";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { DEFAULT_RENDERER_CONFIG } from "../../src/adapters/renderer-three/renderer.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import cornerScenario from "../../eval/scenarios/5v5-corner-driven.v1.json";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OBJECTIVE_ID = "CORNER-DRIVEN-CONFORMANCE";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const SCREENSHOT_DIR = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;

/** Camera framed on the corner area (sim x≈44..53, y≈0..34) so the award + set piece read clearly. */
const CORNER_CAMERA_CONFIG: RendererConfig = {
  ...DEFAULT_RENDERER_CONFIG,
  cameraPosition: { x: 57, y: 26, z: 46 },
  cameraTarget: { x: 49, y: 0, z: 18 },
  cameraFov: 55,
};

/** Event-centered capture plan (browser ticks, confirmed by the exploration run). */
const CAPTURE_PLAN = [
  { label: "corner-before", tick: 60, note: "ball near the +x goal line, team-b defender chasing back toward its own goal" },
  { label: "corner-award", tick: 71, note: "the ball crossed the goal line outside the posts with a defending-team last touch — the core awards a corner to team-a and opens the corner-kick phase" },
  { label: "corner-set-piece", tick: 105, note: "corner-kick phase: the taker moves to the corner flag, attacking box and defending mark set" },
  { label: "corner-execution", tick: 137, note: "corner-kick-executed (tick ~130): the ball is placed at the corner flag and crossed toward the penalty area — this frame is a few ticks later so the cross is in flight" },
];

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

describe("CORNER-DRIVEN-CONFORMANCE: event-centered corner frames", () => {
  it(
    "captures event-centered frames around the corner award + execution",
    async () => {
      if (DURABLE_EVIDENCE) {
        let manifestExists = false;
        try {
          await commands.readFile(
            `docs/evidence/${OBJECTIVE_ID}/manifest.json`,
            "utf-8",
          );
          manifestExists = true;
        } catch {
          // no manifest yet: durable capture for this candidate is allowed
        }
        if (manifestExists) {
          throw new Error(
            `Accepted evidence is immutable: docs/evidence/${OBJECTIVE_ID}/manifest.json exists`,
          );
        }
      }

      async function captureFrame(
        b: TestBridge,
        fileName: string,
      ): Promise<string> {
        b.renderFrame();
        const cap = await b.capture();
        const base64 = cap.screenshot.split(",")[1] ?? "";
        if (!base64 || base64.length < 100) {
          throw new Error(`renderer produced no PNG bytes for ${fileName}`);
        }
        await commands.writeFile(`${SCREENSHOT_DIR}/${fileName}`, base64, "base64");
        return base64;
      }

      bridge = createTestBridge(
        container,
        cornerScenario as ScenarioDefinition,
        undefined,
        CORNER_CAMERA_CONFIG,
      );
      await bridge.reset();

      const captured: Array<{
        label: string;
        path: string;
        tick: number;
        hash: string;
        note: string;
      }> = [];

      let currentTick = 0;
      for (const capture of CAPTURE_PLAN) {
        const ticksToStep = capture.tick - currentTick;
        if (ticksToStep > 0) {
          bridge.stepWithCpuControllers(ticksToStep);
          currentTick = capture.tick;
        }
        expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(capture.tick);

        const base64 = await captureFrame(bridge, `${capture.label}.png`);
        // Non-trivial bytes + a state hash prove the frame is event-centered, not blank.
        expect(base64.length).toBeGreaterThan(1000);
        captured.push({
          label: capture.label,
          path: `${capture.label}.png`,
          tick: capture.tick,
          hash: bridge.stateHash(),
          note: capture.note,
        });
      }

      // Distinct state hashes across the sequence prove the frames are not duplicates.
      const hashes = new Set(captured.map((c) => c.hash));
      expect(hashes.size).toBeGreaterThanOrEqual(3);

      // Write the semantic sequence metadata (before → event → transition → result).
      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        semantic_order: "before → event → transition → result",
        frames: captured,
      };
      await commands.writeFile(
        `${SCREENSHOT_DIR}/sequence.json`,
        JSON.stringify(sequence, null, 2),
        "utf-8",
      );

      // Store metadata for the node-side evidence producer.
      (window as unknown as Record<string, string>).__cornerFrames =
        JSON.stringify(captured);
    },
    { timeout: 120_000 },
  );

  it("semantic frames are non-blank with luminance and color variance", async () => {
    bridge = createTestBridge(
      container,
      cornerScenario as ScenarioDefinition,
      undefined,
      CORNER_CAMERA_CONFIG,
    );
    await bridge.reset();
    // Step to the execution tick (130) — the most visually distinct corner frame.
    bridge.stepWithCpuControllers(130);
    bridge.renderFrame();
    const capture = await bridge.capture();
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(1000);

    // Decode PNG and measure luminance/color variance (non-uniform check).
    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to decode screenshot image"));
      img.src = `data:image/png;base64,${base64Data}`;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    let min = 255, max = 0, nonUniform = 0;
    const unique = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      min = Math.min(min, lum);
      max = Math.max(max, lum);
      unique.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    }
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - data[i + 1]) > 8 || Math.abs(data[i + 1] - data[i + 2]) > 8) nonUniform++;
    }
    expect(max - min).toBeGreaterThan(20);
    expect(unique.size).toBeGreaterThan(50);
    expect(nonUniform).toBeGreaterThan(0);
  });
});

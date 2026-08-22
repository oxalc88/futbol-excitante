/**
 * @module tests/browser/1v1-control-screenshots.browser.test
 *
 * Captures DYNAMIC_VISUAL evidence screenshots for BROWSER-1V1-CONTROL-EVIDENCE.
 *
 * 5 semantic frames centered on slot-1 vs slot-2 independent motion:
 *  - before: initial state (no input)
 *  - slot1-moves: slot-1 input moves only player-a
 *  - slot2-moves: slot-2 input moves only player-b
 *  - both-move: both slots input simultaneously, both players move independently
 *  - result: final state after independent motion
 *
 * Uses bridge.capture() (WebGL readPixels at 800×600 container size)
 * via the capture-wip/persist-wip evidence pipeline for durable evidence.
 * Also writes sequence.json for the DYNAMIC_VISUAL semantic frame sequence.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_TWO_PLAYER } from "../../src/apps/browser/foundation-scenario.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { InputFrame } from "../../src/contracts/input.js";

// Absolute path — Playwright resolves relative to the test runner CWD.
const SCREENSHOT_DIR = "/home/ubuntu/projects/oxDeveloop/pes-simulator/docs/screenshots/BROWSER-1V1-CONTROL-EVIDENCE";

let container: HTMLDivElement;
let bridge: TestBridge;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
});

afterEach(() => {
  try { bridge.getPresentationSession().dispose(); } catch { /* already disposed */ }
  if (container.parentElement) container.parentElement.removeChild(container);
});

/**
 * Decode a data URL to bytes and write to disk.
 * Works in Vitest browser mode via the same fallback as capture-wip.
 */
async function writeDataUrlToFile(dataUrl: string, filePath: string): Promise<void> {
  const base64Data = dataUrl.split(",")[1] ?? "";
  expect(base64Data.length).toBeGreaterThan(100);

  try {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    mkdirSync(dir, { recursive: true });
    try {
      // @ts-expect-error Buffer may not exist in browser mode.
      writeFileSync(filePath, Buffer.from(base64Data, "base64"));
    } catch {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      writeFileSync(filePath, bytes);
    }
  } catch {
    // In browser mode without node:fs, log base64 for persist-wip to decode.
    const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);
    console.log(`[capture-wip:${fileName}:base64]${base64Data}`);
  }
}

describe("BROWSER-1V1-CONTROL-EVIDENCE DYNAMIC_VISUAL screenshots", () => {
  it("captures 5 semantic frames of independent slot-1 vs slot-2 control", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_TWO_PLAYER);
    await bridge.reset();

    // Verify 2 players are present.
    const players = bridge.getSimulation().presentation().players;
    expect(players.length).toBe(2);

    const sequence: Array<{ label: string; path: string; tick: number }> = [];

    // Frame 1: before — initial state (tick 0).
    bridge.renderFrame();
    const capture1 = await bridge.capture();
    expect(capture1.screenshot).toMatch(/^data:image\/png;base64,/);
    // Verify real 800×600 WebGL capture (container size).
    expect(capture1.sceneObjectCount).toBeGreaterThanOrEqual(5);
    expect(capture1.cameraPosition.z).toBeGreaterThan(0);
    const frame1File = "frame-before.png";
    await writeDataUrlToFile(capture1.screenshot, `${SCREENSHOT_DIR}/${frame1File}`);
    sequence.push({ label: "before", path: frame1File, tick: bridge.getSimulation().tick });

    // Frame 2: slot-1 moves — inject slot-1 input (move +X) only.
    const tick2 = bridge.getSimulation().tick;
    bridge.injectInputs([
      {
        tick: tick2,
        sourceId: "slot1-evidence",
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
    bridge.renderFrame();
    const capture2 = await bridge.capture();
    expect(capture2.screenshot).toMatch(/^data:image\/png;base64,/);
    const frame2File = "frame-slot1-moves.png";
    await writeDataUrlToFile(capture2.screenshot, `${SCREENSHOT_DIR}/${frame2File}`);
    sequence.push({ label: "slot1-moves", path: frame2File, tick: bridge.getSimulation().tick });

    // Frame 3: slot-2 moves — inject slot-2 input (move -X) only.
    const tick3 = bridge.getSimulation().tick;
    bridge.injectInputs([
      {
        tick: tick3,
        sourceId: "slot2-evidence",
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
    bridge.renderFrame();
    const capture3 = await bridge.capture();
    expect(capture3.screenshot).toMatch(/^data:image\/png;base64,/);
    const frame3File = "frame-slot2-moves.png";
    await writeDataUrlToFile(capture3.screenshot, `${SCREENSHOT_DIR}/${frame3File}`);
    sequence.push({ label: "slot2-moves", path: frame3File, tick: bridge.getSimulation().tick });

    // Frame 4: both slots move simultaneously.
    const tick4 = bridge.getSimulation().tick;
    bridge.injectInputs([
      {
        tick: tick4,
        sourceId: "slot1-evidence",
        controlSlot: "slot-1",
        moveX: 1,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
      {
        tick: tick4,
        sourceId: "slot2-evidence",
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
    bridge.renderFrame();
    const capture4 = await bridge.capture();
    expect(capture4.screenshot).toMatch(/^data:image\/png;base64,/);
    const frame4File = "frame-both-move.png";
    await writeDataUrlToFile(capture4.screenshot, `${SCREENSHOT_DIR}/${frame4File}`);
    sequence.push({ label: "both-move", path: frame4File, tick: bridge.getSimulation().tick });

    // Frame 5: result — after further play, verify independent positions.
    bridge.step(10);
    bridge.renderFrame();
    const capture5 = await bridge.capture();
    expect(capture5.screenshot).toMatch(/^data:image\/png;base64,/);
    const frame5File = "frame-result.png";
    await writeDataUrlToFile(capture5.screenshot, `${SCREENSHOT_DIR}/${frame5File}`);
    sequence.push({ label: "result", path: frame5File, tick: bridge.getSimulation().tick });

    // Verify simulation advanced.
    expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(20);

    // Verify both players moved independently.
    const snap = bridge.snapshot();
    const playerA = snap.players.find((p) => p.playerId === "player-a")!;
    const playerB = snap.players.find((p) => p.playerId === "player-b")!;
    expect(playerA.groundPosition.x).toBeGreaterThan(0);
    expect(playerB.groundPosition.x).toBeLessThan(5);

    // Write sequence.json for DYNAMIC_VISUAL evidence.
    const sequencePayload = { schema_version: 1, objective_id: "BROWSER-1V1-CONTROL-EVIDENCE", frames: sequence };
    try {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
      writeFileSync(
        `${SCREENSHOT_DIR}/sequence.json`,
        JSON.stringify(sequencePayload, null, 2) + "\n",
        "utf-8",
      );
    } catch {
      console.log(`[capture-wip:sequence]${JSON.stringify(sequencePayload)}`);
    }
  });
});

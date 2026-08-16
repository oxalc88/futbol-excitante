/**
 * @module tests/browser/capture-2v2-keyboard.browser.test
 *
 * Captures a screenshot of the 2v2 keyboard match and writes to disk.
 * Run: npx vitest run tests/browser/capture-2v2-keyboard.browser.test.ts --project browser
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_2V2_KEYBOARD } from "../../src/apps/browser/foundation-scenario.js";
import { createCpuAdapter, buildCpuObservation } from "../../src/adapters/input-browser/cpu-adapter.js";
import type { InputFrame } from "../../src/contracts/input.js";

let container: HTMLDivElement;
let bridge: TestBridge;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "1280px";
  container.style.height = "720px";
  document.body.appendChild(container);
  bridge = createTestBridge(container, FOUNDATION_SCENARIO_2V2_KEYBOARD);
});

afterEach(() => {
  try { bridge.getPresentationSession().dispose(); } catch { /* ok */ }
  if (container.parentElement) container.parentElement.removeChild(container);
});

describe("capture 2v2 keyboard match screenshot", () => {
  it("captures render output and writes to disk", async () => {
    await bridge.reset();

    // Set up per-slot CPU adapters for AI_FALLBACK slots (2-4).
    const cpuSlots = Object.entries(FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments)
      .filter(([, a]) => a.mode === "AI_FALLBACK")
      .map(([controlSlot, assignment]) => ({
        controlSlot,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId,
        adapter: createCpuAdapter(),
      }));

    // Advance simulation 120 ticks with CPU controllers for AI slots.
    const sim = bridge.getSimulation();
    for (let tick = 0; tick < 120; tick++) {
      const snapshot = sim.snapshot();
      const frames: InputFrame[] = [];
      for (const { adapter, controlSlot, teamId, controlledPlayerId } of cpuSlots) {
        const obs = buildCpuObservation(snapshot, teamId, controlledPlayerId);
        const frame = adapter.sample(sim.tick, obs);
        frame.controlSlot = controlSlot;
        frames.push(frame);
      }
      bridge.injectInputs(frames);
      sim.step();
    }

    bridge.renderFrame();
    const capture = await bridge.capture();
    expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);

    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);

    // Write to disk
    try {
      const { writeFileSync } = await import("node:fs");
      try {
        writeFileSync(
          `docs/screenshots/BROWSER-2V2-MATCH-KEYBOARD/frame-000.png`,
          Buffer.from(base64Data, "base64"),
        );
      } catch {
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        writeFileSync(`docs/screenshots/BROWSER-2V2-MATCH-KEYBOARD/frame-000.png`, bytes);
      }
    } catch {
      console.log(`[capture-2v2-keyboard:base64]${base64Data}`);
    }
  });
});
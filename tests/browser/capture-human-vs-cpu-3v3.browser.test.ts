/**
 * @module tests/browser/capture-human-vs-cpu-3v3.browser.test
 *
 * Captures a screenshot of the 3v3 human-vs-CPU match and writes to disk.
 * Run: npx vitest run tests/browser/capture-human-vs-cpu-3v3.browser.test.ts --project browser
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3 } from "../../src/apps/browser/foundation-scenario.js";
import { createCpuAdapter, buildCpuObservation } from "../../src/adapters/input-browser/cpu-adapter.js";
import type { InputFrame } from "../../src/contracts/input.js";

let container: HTMLDivElement;
let bridge: TestBridge;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "1280px";
  container.style.height = "720px";
  document.body.appendChild(container);
  bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3);
});

afterEach(() => {
  try { bridge.getPresentationSession().dispose(); } catch { /* ok */ }
  if (container.parentElement) container.parentElement.removeChild(container);
});

describe("capture human-vs-CPU 3v3 match screenshot", () => {
  it("captures render output and writes to disk", async () => {
    await bridge.reset();

    // Set up per-slot CPU adapters for AI_FALLBACK slots (2-6).
    const cpuSlots = Object.entries(FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3.controlAssignments)
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

    // Verify 6 players visible.
    const players = capture.presentationSnapshot.players;
    expect(players.length).toBe(6);

    // Write to disk
    try {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync("docs/screenshots/BROWSER-3V3-HUMAN-VS-CPU", { recursive: true });
      try {
        writeFileSync(
          "docs/screenshots/BROWSER-3V3-HUMAN-VS-CPU/frame-000.png",
          Buffer.from(base64Data, "base64"),
        );
      } catch {
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        writeFileSync("docs/screenshots/BROWSER-3V3-HUMAN-VS-CPU/frame-000.png", bytes);
      }
    } catch {
      console.log(`[capture-human-vs-cpu-3v3:base64]${base64Data}`);
    }
  });
});

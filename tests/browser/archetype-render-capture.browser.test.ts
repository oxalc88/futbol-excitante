/**
 * ARCHETYPE-RENDER-DIFFERENCE capture test
 *
 * Captures screenshots showing the provisional visual difference between
 * archetype-burst-v1 and archetype-steady-v1 under identical camera
 * conditions.  Saves durable evidence to docs/screenshots/ARCHETYPE-RENDER-DIFFERENCE/.
 *
 * Hidden labels: archetype IDs are presentation-only.  No PES fidelity.
 */

import { describe, it, beforeEach, afterEach } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { createTestBridge, type TestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO } from "../../src/apps/browser/foundation-scenario.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";

const EVIDENCE_DIR = "docs/screenshots/ARCHETYPE-RENDER-DIFFERENCE";
const CAPTURE_TICKS = 10;

function scenarioWithArchetype(base: ScenarioDefinition, archetypeId: string): ScenarioDefinition {
  const clone = JSON.parse(JSON.stringify(base)) as ScenarioDefinition;
  for (const p of clone.players) {
    p.archetypeId = archetypeId;
  }
  return clone;
}

// Shared input program for deterministic rendering
const INPUTS: Record<number, InputFrame[]> = {
  0: [{ tick: 0, sourceId: "capture", controlSlot: "slot-1", moveX: 0.5, moveY: 0, sprint: 1, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
  1: [{ tick: 1, sourceId: "capture", controlSlot: "slot-1", moveX: 0.5, moveY: 0.2, sprint: 1, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
  3: [{ tick: 3, sourceId: "capture", controlSlot: "slot-1", moveX: 0.3, moveY: -0.3, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
  5: [{ tick: 5, sourceId: "capture", controlSlot: "slot-1", moveX: -0.2, moveY: 0.5, sprint: 1, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
  7: [{ tick: 7, sourceId: "capture", controlSlot: "slot-1", moveX: 0.7, moveY: 0, sprint: 1, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
};

describe("ARCHETYPE-RENDER-DIFFERENCE capture", () => {
  let container: HTMLDivElement;
  let bridge: TestBridge;

  beforeEach(() => {
    container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "600px";
    document.body.appendChild(container);
  });

  afterEach(() => {
    try { bridge.getPresentationSession().dispose(); } catch { /* ok */ }
    if (container.parentElement) container.parentElement.removeChild(container);
  });

  it("captures burst archetype screenshot", async () => {
    bridge = createTestBridge(container, scenarioWithArchetype(FOUNDATION_SCENARIO, "archetype-burst-v1"));
    await bridge.reset();

    for (let tick = 0; tick < CAPTURE_TICKS; tick++) {
      const frames = INPUTS[tick];
      if (frames) bridge.injectInputs(frames.map((f) => ({ ...f })));
      bridge.step(1);
    }

    bridge.renderFrame();
    const capture = await bridge.capture();
    const base64 = capture.screenshot.split(",")[1] ?? "";

    // Write to durable evidence dir
    try {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(EVIDENCE_DIR, { recursive: true });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      writeFileSync(`${EVIDENCE_DIR}/burst-archetype-tick-${CAPTURE_TICKS}.png`, bytes);
      console.log(`[capture] burst screenshot saved: ${EVIDENCE_DIR}/burst-archetype-tick-${CAPTURE_TICKS}.png (${bytes.length} bytes)`);
    } catch {
      console.log(`[capture-wip:burst-archetype:base64]${base64}`);
    }
  });

  it("captures steady archetype screenshot", async () => {
    bridge = createTestBridge(container, scenarioWithArchetype(FOUNDATION_SCENARIO, "archetype-steady-v1"));
    await bridge.reset();

    for (let tick = 0; tick < CAPTURE_TICKS; tick++) {
      const frames = INPUTS[tick];
      if (frames) bridge.injectInputs(frames.map((f) => ({ ...f })));
      bridge.step(1);
    }

    bridge.renderFrame();
    const capture = await bridge.capture();
    const base64 = capture.screenshot.split(",")[1] ?? "";

    try {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(EVIDENCE_DIR, { recursive: true });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      writeFileSync(`${EVIDENCE_DIR}/steady-archetype-tick-${CAPTURE_TICKS}.png`, bytes);
      console.log(`[capture] steady screenshot saved: ${EVIDENCE_DIR}/steady-archetype-tick-${CAPTURE_TICKS}.png (${bytes.length} bytes)`);
    } catch {
      console.log(`[capture-wip:steady-archetype:base64]${base64}`);
    }
  });
});

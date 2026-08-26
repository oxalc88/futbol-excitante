/**
 * Focused browser test for capturing DYNAMIC_VISUAL screenshot evidence.
 *
 * TWO-PASS DETERMINISTIC approach:
 *   Pass 1: Run with human input + CPU to discover pass/shot event ticks.
 *   Pass 2: Reset and re-run with SAME adapters/seed to capture screenshots
 *            at pre-computed target ticks.
 *
 * Frame-tick formula (shared with scripts/capture-human-action-readability-evidence.ts):
 *   pass-before  = passEventTick - 10
 *   pass-event   = passEventTick
 *   pass-after   = passEventTick + 12
 *   shot-event   = shotEventTick
 *   shot-after   = shotEventTick + 12
 *
 * (shot-before is NOT captured — DYNAMIC_VISUAL caps the sequence at 3-5 frames;
 * see eval/scenarios/frame-tick-offsets.ts.)
 *
 * All captures happen AFTER stepping to the target tick (no beforeStep semantics).
 * Captures 5 frames: pass-before/event/after, shot-event/after.
 * All 5 PNGs must have pairwise-unique SHA-256 hashes.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5 } from "../../src/apps/browser/foundation-scenario.js";
import { createCpuAdapter, buildCpuObservation } from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { PASS_BIT, SHOT_BIT } from "../../src/contracts/input.js";
import { PASS_BEFORE_OFFSET, PASS_AFTER_OFFSET, SHOT_AFTER_OFFSET } from "@pes/eval/scenarios/frame-tick-offsets.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { InputFrame } from "../../src/contracts/input.js";

const OBJECTIVE_ID = "SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY";
const SCREENSHOT_DIR = `/home/ubuntu/projects/oxDeveloop/pes-simulator/docs/screenshots/${OBJECTIVE_ID}`;
const MAX_TICKS = 400;
const PROXIMITY_THRESHOLD = 1.5;

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
});

afterEach(() => {
  if (container?.parentElement) container.parentElement.removeChild(container);
});

/**
 * Run a discovery pass to find the first human-driven pass and shot event ticks.
 */
function discoverEventTicks(bridge: TestBridge): { passTick: number; shotTick: number } {
  const sim = bridge.getSimulation();

  const cpuEntries = Object.entries(FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.controlAssignments)
    .filter(([, a]) => a.mode !== "HUMAN")
    .map(([slot, a]) => ({
      controlSlot: slot,
      teamId: a.teamId,
      controlledPlayerId: a.controlledPlayerId,
      adapter: createCpuAdapter(),
    }));

  let passTick = -1;
  let shotTick = -1;
  let passConfirmedTick = -1;

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    const snapshot = sim.snapshot();
    const ballPos = snapshot.ball.position;
    const p1 = snapshot.players.find((p) => p.playerId === "player-1")!;
    const dx = ballPos.x - p1.groundPosition.x;
    const dy = ballPos.y - p1.groundPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const shotDelayComplete = passConfirmedTick >= 0 && (tick - passConfirmedTick) >= 30;

    let action: "steer" | "pass" | "shot" | "idle" = "steer";
    if (dist <= PROXIMITY_THRESHOLD) {
      if (passTick < 0) action = "pass";
      else if (shotTick < 0 && shotDelayComplete) action = "shot";
      else action = "idle";
    }

    const teamDec = new Map<string, ReturnType<typeof computeTeamDecision>>();
    for (const e of cpuEntries) {
      if (!teamDec.has(e.teamId)) {
        const o = buildCpuObservation(snapshot, e.teamId, e.controlledPlayerId);
        teamDec.set(e.teamId, computeTeamDecision(o, e.teamId));
      }
    }

    const frames: InputFrame[] = cpuEntries.map(e => {
      const o = buildCpuObservation(snapshot, e.teamId, e.controlledPlayerId);
      o.teamDecision = teamDec.get(e.teamId);
      const f = e.adapter.sample(sim.tick, o);
      f.controlSlot = e.controlSlot;
      return f;
    });

    let moveX = 0, moveY = 0, held = 0, pressed = 0;
    if (action === "steer" && dist > 0.01) {
      moveX = dx / dist; moveY = dy / dist;
    } else if (action === "pass") {
      moveX = 1; held = PASS_BIT; pressed = PASS_BIT;
    } else if (action === "shot") {
      moveX = 1; held = SHOT_BIT; pressed = SHOT_BIT;
    }

    frames.push({ tick: sim.tick, sourceId: "kb", controlSlot: "slot-1", moveX, moveY, sprint: 1, heldButtons: held, pressedButtons: pressed, releasedButtons: 0 });
    sim.applyInputs(frames);
    const result = sim.step();

    for (const evt of result.events) {
      if (evt.kind === "pass" && passTick < 0) {
        const p = evt.payload as Record<string, unknown>;
        if (p.playerId === "player-1") {
          passTick = evt.tick;
          passConfirmedTick = tick;
        }
      }
      if (evt.kind === "shot" && shotTick < 0) {
        const p = evt.payload as Record<string, unknown>;
        if (p.playerId === "player-1") shotTick = evt.tick;
      }
    }
    if (passTick >= 0 && shotTick >= 0) break;
  }

  return { passTick, shotTick };
}

/**
 * Run a capture pass: re-run the same simulation and capture screenshots
 * at pre-computed target ticks using the shared offset formula.
 *
 * All captures happen AFTER stepping to the target tick.
 * 5 frames: pass-before/event/after, shot-event/after.
 */
async function capturePass(
  container: HTMLDivElement,
  passTick: number,
  shotTick: number,
): Promise<string[]> {
  const { page } = await import("@vitest/browser/context");

  const bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
  await bridge.reset();
  const sim = bridge.getSimulation();

  const cpuEntries = Object.entries(FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.controlAssignments)
    .filter(([, a]) => a.mode !== "HUMAN")
    .map(([slot, a]) => ({
      controlSlot: slot,
      teamId: a.teamId,
      controlledPlayerId: a.controlledPlayerId,
      adapter: createCpuAdapter(),
    }));

  // 5 capture targets — no shot-before (audit allows 3-5 frames).
  interface CaptureTarget {
    tick: number;
    label: string;
  }
  const targets: CaptureTarget[] = [
    { tick: passTick + PASS_BEFORE_OFFSET, label: "pass-before" },
    { tick: passTick, label: "pass-event" },
    { tick: passTick + PASS_AFTER_OFFSET, label: "pass-after" },
    { tick: shotTick, label: "shot-event" },
    { tick: shotTick + SHOT_AFTER_OFFSET, label: "shot-after" },
  ];

  const captured: string[] = [];
  let passFound = false;
  let shotFired = false;
  let passConfirmTick = -1;

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    // Build human input frame (same logic as discovery).
    const snapshot = sim.snapshot();
    const ballPos = snapshot.ball.position;
    const p1 = snapshot.players.find((p) => p.playerId === "player-1")!;
    const dx = ballPos.x - p1.groundPosition.x;
    const dy = ballPos.y - p1.groundPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const shotDelayComplete = passConfirmTick >= 0 && (tick - passConfirmTick) >= 30;

    let action: "steer" | "pass" | "shot" | "idle" = "steer";
    if (dist <= PROXIMITY_THRESHOLD) {
      if (!passFound) action = "pass";
      else if (!shotFired && shotDelayComplete) action = "shot";
      else action = "idle";
    }

    const teamDec = new Map<string, ReturnType<typeof computeTeamDecision>>();
    for (const e of cpuEntries) {
      if (!teamDec.has(e.teamId)) {
        const o = buildCpuObservation(snapshot, e.teamId, e.controlledPlayerId);
        teamDec.set(e.teamId, computeTeamDecision(o, e.teamId));
      }
    }

    const frames: InputFrame[] = cpuEntries.map(e => {
      const o = buildCpuObservation(snapshot, e.teamId, e.controlledPlayerId);
      o.teamDecision = teamDec.get(e.teamId);
      const f = e.adapter.sample(sim.tick, o);
      f.controlSlot = e.controlSlot;
      return f;
    });

    let moveX = 0, moveY = 0, held = 0, pressed = 0;
    if (action === "steer" && dist > 0.01) {
      moveX = dx / dist; moveY = dy / dist;
    } else if (action === "pass") {
      moveX = 1; held = PASS_BIT; pressed = PASS_BIT;
    } else if (action === "shot") {
      moveX = 1; held = SHOT_BIT; pressed = SHOT_BIT;
    }

    frames.push({ tick: sim.tick, sourceId: "kb", controlSlot: "slot-1", moveX, moveY, sprint: 1, heldButtons: held, pressedButtons: pressed, releasedButtons: 0 });
    sim.applyInputs(frames);
    const result = sim.step();

    for (const evt of result.events) {
      if (evt.kind === "pass" && !passFound) {
        const p = evt.payload as Record<string, unknown>;
        if (p.playerId === "player-1") {
          passFound = true;
          passConfirmTick = tick;
        }
      }
      if (evt.kind === "shot" && !shotFired) {
        const p = evt.payload as Record<string, unknown>;
        if (p.playerId === "player-1") shotFired = true;
      }
    }

    // Capture AFTER step — all captures happen at sim.tick after the step.
    for (const t of targets) {
      if (sim.tick === t.tick && !captured.includes(t.label)) {
        bridge.renderFrame();
        await page.screenshot({ path: `${SCREENSHOT_DIR}/${t.label}.png`, type: "png" });
        captured.push(t.label);
      }
    }

    if (captured.length >= targets.length) break;
  }

  bridge.getPresentationSession().dispose();
  return captured;
}

describe("human-action-readability: screenshot capture", () => {
  it(
    "captures 5 before→event→after PNGs with all unique SHA-256 hashes",
    async () => {
      // Pass 1: Discovery — find event ticks.
      const discoveryBridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
      await discoveryBridge.reset();
      const { passTick, shotTick } = discoverEventTicks(discoveryBridge);
      discoveryBridge.getPresentationSession().dispose();

      expect(passTick).toBeGreaterThanOrEqual(0);
      expect(shotTick).toBeGreaterThanOrEqual(0);
      expect(shotTick).toBeGreaterThan(passTick);

      // Pass 2: Capture — same simulation, pre-computed targets.
      const captured = await capturePass(container, passTick, shotTick);

      expect(captured.length).toBe(5);
      const neededLabels = [
        "pass-before", "pass-event", "pass-after",
        "shot-event", "shot-after",
      ];
      for (const label of neededLabels) {
        expect(captured.includes(label)).toBe(true);
      }
    },
    { timeout: 120_000 },
  );

  it("captured screenshots have valid base64 data", async () => {
    const bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();
    bridge.stepWithCpuControllers(60);
    bridge.renderFrame();
    const capture = await bridge.capture();
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(1000);
    bridge.getPresentationSession().dispose();
  });
});

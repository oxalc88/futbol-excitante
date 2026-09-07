/**
 * @module tests/browser/browser-full-match-flow-evidence.browser.test
 *
 * DYNAMIC_VISUAL evidence capture for BROWSER-FULL-MATCH-FLOW-EVIDENCE:
 * the horizon's observable browser capability — a real-Chromium match flowing
 * through the core-owned full-match lifecycle and rendered with the core-owned
 * match-phase + match-timer HUD label visible.
 *
 * The fixture is the accepted short-duration timing scenario
 * `eval/scenarios/5v5-full-match-timing.v1.json` (240-tick halves).  The core
 * timer/lifecycle machinery drives the whole thing: half 1 decrements the
 * in-play timer during "playing", the core transitions to the "halftime"
 * phase (with the §9.4 60-tick break countdown), the timer-driven reset opens
 * the second half, and half 2's literal 1→0 zero-crossing lands the terminal
 * "fulltime" state.  Restart windows (throw-in here) freeze the in-play timer,
 * so the actual transition ticks are located from the run's own phase stream —
 * never hand-transcribed (the CORNER-DRIVEN lesson).
 *
 * Frames (before → event → transition → result, event-centered on the
 * lifecycle):
 *   - kickoff            (tick 0):   initial "playing" state, timer 240
 *   - first-half-late    (near 0):   last "playing" tick before halftime, timer ~1
 *   - halftime-break     (countdown): "halftime" phase, the break countdown visible
 *   - second-half-kickoff: first "playing" tick after the break, timer reset to 240
 *   - fulltime           (terminal): "fulltime" phase, timer 0
 *
 * The HUD label is the opt-in renderer surface (`showMatchPhaseHud`); it reads
 * `matchPhase` + `matchTimer` from the immutable `PresentationSnapshot`.  It is
 * draw-only and never touches a football outcome.
 *
 * Capture hygiene (0.9.2+): durable screenshots are written only in evidence
 * mode (`WIP_SECTION=__EVIDENCE__:BROWSER-FULL-MATCH-FLOW-EVIDENCE`); an
 * ordinary run writes under the ignored `test-results/gauntlet-capture/**` tree
 * and leaves `docs/` byte-identical.
 *
 * No Math.random, wall clock, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { commands } from "@vitest/browser/context";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { DEFAULT_RENDERER_CONFIG } from "../../src/adapters/renderer-three/renderer.js";
import { runHeadlessMatch } from "../../eval/runners/headless-match.js";
import fullMatchTimingJson from "../../eval/scenarios/5v5-full-match-timing.v1.json";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OBJECTIVE_ID = "BROWSER-FULL-MATCH-FLOW-EVIDENCE";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const OUTPUT_REL = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
const SEQUENCE_REL = `${OUTPUT_REL}/sequence.json`;

/** The accepted short-duration full-match timing fixture (240-tick halves). */
const SCENARIO = fullMatchTimingJson as unknown as ScenarioDefinition;
const SCENARIO_PATH = "eval/scenarios/5v5-full-match-timing.v1.json";
/** Total run window — the fixture's own observation window (800 ticks). */
const PLAY_TICKS = 800;

/**
 * Static presentation-only framing, identical for every frame so the sequence
 * stays comparable.  The HUD label is screen-space (top-left), so the framing
 * only shapes the pitch view; the renderer consumes immutable snapshots, so
 * framing cannot move a football.
 */
const CAMERA = {
  position: { x: 0, y: 55, z: 70 },
  target: { x: 0, y: 0, z: 0 },
};
const CAMERA_FOV = 55;

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

// ---------------------------------------------------------------------------
// Per-tick lifecycle record (the browser run's own committed phase + timer)
// ---------------------------------------------------------------------------

interface LifecycleTick {
  tick: number;
  matchPhase: string;
  matchTimer: number;
}

/** Run the fixture through the bridge and record the per-tick core lifecycle. */
function recordLifecycle(b: TestBridge): LifecycleTick[] {
  const sim = b.getSimulation();
  const records: LifecycleTick[] = [];
  for (let i = 0; i < PLAY_TICKS; i++) {
    b.stepWithCpuControllers(1);
    const p = sim.presentation();
    records.push({ tick: p.tick, matchPhase: p.matchPhase, matchTimer: p.matchTimer });
  }
  return records;
}

/** Ordered distinct phases from a lifecycle stream (excluding the leading seed). */
function phaseSequence(records: LifecycleTick[]): string[] {
  const seq: string[] = [];
  for (const r of records) {
    if (seq[seq.length - 1] !== r.matchPhase) seq.push(r.matchPhase);
  }
  return seq;
}

/**
 * Locate the event-centered lifecycle ticks from the run's own phase stream.
 * Every tick is read from the committed record — nothing is hand-transcribed.
 */
function locateLifecycleTicks(records: LifecycleTick[]): {
  kickoff: number;
  firstHalfLate: number;
  halftimeBreak: number;
  secondHalfKickoff: number;
  fulltime: number;
} {
  // kickoff: the opening tick (the fixture's initial state before any step —
  // the core is in "playing" with the timer at the half duration).
  const kickoff = 0;

  // first-half-late: the last "playing" tick before the first "halftime",
  // chosen as the one with the smallest in-play timer (the timer near zero).
  const firstHalftimeIndex = records.findIndex((r) => r.matchPhase === "halftime");
  expect(firstHalftimeIndex, "the fixture never reached halftime").toBeGreaterThan(-1);
  let firstHalfLate = records[0].tick;
  let minTimer = Number.POSITIVE_INFINITY;
  for (let i = 0; i < firstHalftimeIndex; i++) {
    const r = records[i];
    if (r.matchPhase !== "playing") continue;
    if (r.matchTimer < minTimer) {
      minTimer = r.matchTimer;
      firstHalfLate = r.tick;
    }
  }

  // halftime-break: a tick inside the "halftime" phase with the countdown about
  // half-way through (so the countdown is visibly ticking).
  let halftimeBreak = -1;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.matchPhase !== "halftime") continue;
    // Aim for ~30 ticks left in the 60-tick break countdown.
    const delta = Math.abs(r.matchTimer - 30);
    if (delta < bestDelta) {
      bestDelta = delta;
      halftimeBreak = r.tick;
    }
  }
  expect(halftimeBreak, "the fixture never showed a halftime countdown tick").toBeGreaterThan(-1);

  // second-half-kickoff: the first "playing" tick after the "halftime" block
  // (the timer has been reset to the half duration).
  let secondHalfKickoff = -1;
  let seenHalftime = false;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.matchPhase === "halftime") seenHalftime = true;
    else if (seenHalftime && r.matchPhase === "playing") {
      secondHalfKickoff = r.tick;
      break;
    }
  }
  expect(secondHalfKickoff, "the second half never resumed after the break").toBeGreaterThan(-1);

  // fulltime: the first "fulltime" tick (the terminal state).
  const fulltimeIndex = records.findIndex((r) => r.matchPhase === "fulltime");
  expect(fulltimeIndex, "the fixture never reached fulltime").toBeGreaterThan(-1);
  const fulltime = records[fulltimeIndex].tick;

  return { kickoff, firstHalfLate, halftimeBreak, secondHalfKickoff, fulltime };
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

describe("BROWSER-FULL-MATCH-FLOW-EVIDENCE: full-match lifecycle frames", () => {
  it(
    "drives the full lifecycle and captures 5 event-centered frames with the HUD label",
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

      bridge = createTestBridge(container, SCENARIO, undefined, {
        ...DEFAULT_RENDERER_CONFIG,
        cameraPosition: CAMERA.position,
        cameraTarget: CAMERA.target,
        cameraFov: CAMERA_FOV,
        showMatchPhaseHud: true,
      });
      await bridge.reset();

      // The fixture must be a CPU-vs-CPU 5v5 (no human slot).
      for (const assignment of Object.values(SCENARIO.controlAssignments)) {
        expect((assignment as { mode?: string }).mode).not.toBe("HUMAN");
      }
      expect(SCENARIO.players.length).toBe(10);
      expect(SCENARIO.matchDurationTicks ?? SCENARIO.durationTicks).toBe(240);

      // Pass 1 — locate the lifecycle ticks from the run's own phase stream.
      const records = recordLifecycle(bridge);
      expect(records.length).toBe(PLAY_TICKS);
      const ticks = locateLifecycleTicks(records);
      expect(new Set(Object.values(ticks)).size, "frame ticks must be distinct").toBe(5);
      console.log(
        `[full-match-flow] frames kickoff=${ticks.kickoff} firstHalfLate=${ticks.firstHalfLate}` +
          ` halftimeBreak=${ticks.halftimeBreak} secondHalfKickoff=${ticks.secondHalfKickoff}` +
          ` fulltime=${ticks.fulltime} (durable=${DURABLE_EVIDENCE})`,
      );

      // Pass 2 — replay the same wiring and render the five frames.
      const bridge2 = createTestBridge(container, SCENARIO, undefined, {
        ...DEFAULT_RENDERER_CONFIG,
        cameraPosition: CAMERA.position,
        cameraTarget: CAMERA.target,
        cameraFov: CAMERA_FOV,
        showMatchPhaseHud: true,
      });
      await bridge2.reset();

      // The halftime reset re-places every body at its kickoff home, so the
      // literal resumption tick would render like the opening kickoff.  Offset
      // the second-half frame a few ticks so the resumed half is visibly
      // underway (the in-play timer already decremented, bodies released from
      // their kickoff homes) — event-centered on the resumption, not a
      // duplicate of the opening kickoff.
      const secondHalfPlayTick = Math.min(
        ticks.secondHalfKickoff + 20,
        ticks.fulltime - 1,
      );
      const framePlan = [
        { label: "kickoff", tick: ticks.kickoff, semantic: "before", note: "Opening kickoff: the core is in the 'playing' phase with the in-play timer at the half duration" },
        { label: "first-half-late", tick: ticks.firstHalfLate, semantic: "transition", note: "First half winding down: the in-play timer is near zero (the last playing tick before the core transitions to halftime)" },
        { label: "halftime-break", tick: ticks.halftimeBreak, semantic: "event", note: "Halftime break: the core-owned 'halftime' phase with the §9.4 countdown ticking down in the HUD" },
        { label: "second-half-kickoff", tick: secondHalfPlayTick, semantic: "transition", note: "Second half resumed: the timer-driven reset opened a fresh 'playing' phase and the timer reset to the half duration; the frame is a few ticks in so the resumed half is visibly underway" },
        { label: "fulltime", tick: ticks.fulltime, semantic: "result", note: "Full time: the terminal 'fulltime' phase after the timer's literal 1→0 zero-crossing in half 2" },
      ];

      const captured: Array<{
        label: string;
        path: string;
        tick: number;
        matchPhase: string;
        matchTimer: number;
        hash: string;
        note: string;
      }> = [];

      let currentTick = 0;
      for (const frame of framePlan) {
        if (frame.tick > currentTick) {
          bridge2.stepWithCpuControllers(frame.tick - currentTick);
          currentTick = frame.tick;
        }
        expect(bridge2.getSimulation().tick).toBeGreaterThanOrEqual(frame.tick);

        bridge2.renderFrame();
        const cap = await bridge2.capture();
        const base64 = cap.screenshot.split(",")[1] ?? "";
        expect(base64.length, `renderer produced no PNG bytes for ${frame.label}`).toBeGreaterThan(1000);
        await commands.writeFile(`${OUTPUT_REL}/${frame.label}.png`, base64, "base64");

        const p = bridge2.getSimulation().presentation();
        captured.push({
          label: frame.label,
          path: `${frame.label}.png`,
          tick: frame.tick,
          matchPhase: p.matchPhase,
          matchTimer: p.matchTimer,
          hash: bridge2.stateHash(),
          note: frame.note,
        });
      }

      // Distinct state hashes prove the frames are not duplicates.
      const hashes = new Set(captured.map((c) => c.hash));
      expect(hashes.size).toBeGreaterThanOrEqual(3);

      // The capture must genuinely hit the lifecycle phases.
      const phases = captured.map((c) => c.matchPhase);
      expect(phases[0]).toBe("playing");
      expect(phases[2]).toBe("halftime");
      expect(phases[4]).toBe("fulltime");
      expect(captured[0].matchTimer).toBe(240);
      expect(captured[4].matchTimer).toBe(0);

      // Write the semantic sequence metadata (kickoff → ... → fulltime).
      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        semantic_order: "kickoff → first-half late → halftime break → second-half kickoff → fulltime",
        scenario: SCENARIO.id,
        scenario_path: SCENARIO_PATH,
        frames: captured,
      };
      await commands.writeFile(SEQUENCE_REL, `${JSON.stringify(sequence, null, 2)}\n`, "utf-8");

      // Store the lifecycle record + located ticks for the node-side producer.
      (window as unknown as Record<string, string>).__fullMatchLifecycle =
        JSON.stringify(records);
      (window as unknown as Record<string, string>).__fullMatchTicks =
        JSON.stringify(ticks);
      (window as unknown as Record<string, string>).__fullMatchFrames =
        JSON.stringify(captured);
    },
    { timeout: 120_000 },
  );

  it(
    "the browser lifecycle corresponds to the accepted headless timing stream",
    async () => {
      // Headless, browser-parity CPU wiring, core-owned lifecycle.
      const headless = runHeadlessMatch({
        scenario: SCENARIO,
        maxTicks: PLAY_TICKS,
        cpuAntiHuddle: true,
        lifecyclePhaseSync: "core-owned",
        browserParityObservations: true,
      });

      // Browser run (same fixture + wiring).
      bridge = createTestBridge(container, SCENARIO, undefined, {
        ...DEFAULT_RENDERER_CONFIG,
        showMatchPhaseHud: true,
      });
      await bridge.reset();
      const browserRecords = recordLifecycle(bridge);

      // The headless opens with a seeded "kickoff" tick that does not decrement
      // the timer, so drop that leading seed before comparing the phase order.
      const headlessSeq = headless.coreMatchPhases.slice(1);
      const browserSeq = phaseSequence(browserRecords);

      // Both runs traverse the same lifecycle: playing → … → halftime → … → fulltime.
      expect(headlessSeq).toContain("halftime");
      expect(headlessSeq).toContain("fulltime");
      expect(browserSeq).toContain("halftime");
      expect(browserSeq).toContain("fulltime");

      // The ordered phase sequence matches modulo the headless kickoff seed.
      const distinctPhases = (phases: string[]): string[] => {
        const seq: string[] = [];
        for (const p of phases) if (seq[seq.length - 1] !== p) seq.push(p);
        return seq;
      };
      const browserDistinct = distinctPhases(browserSeq).filter((p) => p !== "kickoff");
      const headlessDistinct = distinctPhases(headlessSeq).filter((p) => p !== "kickoff");
      expect(browserDistinct).toEqual(headlessDistinct);
      expect(headlessDistinct[0]).toBe("playing");
      expect(headlessDistinct).toContain("halftime");
      expect(headlessDistinct).toContain("fulltime");
    },
    { timeout: 120_000 },
  );

  it("semantic frames are non-blank with luminance and color variance", async () => {
    bridge = createTestBridge(container, SCENARIO, undefined, {
      ...DEFAULT_RENDERER_CONFIG,
      cameraPosition: CAMERA.position,
      cameraTarget: CAMERA.target,
      cameraFov: CAMERA_FOV,
      showMatchPhaseHud: true,
    });
    await bridge.reset();
    // Step to the halftime break — the most visually distinct lifecycle frame.
    bridge.stepWithCpuControllers(300);
    bridge.renderFrame();
    const capture = await bridge.capture();
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(1000);

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

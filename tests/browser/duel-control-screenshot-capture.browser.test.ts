/**
 * Browser-mode DYNAMIC_VISUAL evidence capture for HUMAN-DEFENSIVE-DUEL-CONTROL.
 *
 * The committed durable evidence is event-centered on the standing-tackle input
 * tick 43 (`docs/evidence/HUMAN-DEFENSIVE-DUEL-CONTROL/trajectory.json` and
 * `docs/screenshots/HUMAN-DEFENSIVE-DUEL-CONTROL/sequence.json`).  This test
 * reproduces exactly that program instead of inventing its own:
 *
 *   Pass 1 — run the committed defensive-duel driver over the proximate 5v5
 *            scenario (`eval/scenarios/proximate-5v5.ts`) with the durable
 *            attempt program, and read the standing-tackle input tick off its
 *            press log.  The press list must equal
 *            `trajectory.json:tackle_attempts`, so the capture can never drift
 *            away from the trajectory it depicts.
 *   Pass 2 — replay that driver program into the browser composition root
 *            (test bridge + Three renderer) through the tick-indexed
 *            `InputFrame` contract, asserting the browser run emits the same
 *            tackle-phase, lock-out-rejection and standing-tackle contact events
 *            at the same ticks as the committed trajectory, and capture the
 *            five frames at `inputTick + TACK_*_OFFSET`.
 *   Pass 3 — hash the PNGs the browser wrote and regenerate `sequence.json`
 *            from those bytes, so metadata and images always agree.
 *
 * File I/O uses Vitest's browser `commands` API: `node:fs`/`node:crypto` are
 * stubbed out in browser mode, so the earlier silent try/catch fallbacks could
 * leave `sequence.json` stale while the PNGs moved.  There are no fallbacks
 * here — a failed read or write fails the test.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { commands } from "@vitest/browser/context";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5 } from "../../src/apps/browser/foundation-scenario.js";
import {
  createCpuAdapter,
  buildCpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import {
  runDefensiveDuel,
  type DefensiveDuelResult,
  type TackleAttempt,
} from "@pes/eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "@pes/eval/scenarios/proximate-5v5.js";
import {
  TACK_BEFORE_OFFSET,
  TACK_INPUT_OFFSET,
  TACK_ACTIVE_OFFSET,
  TACK_CONTACT_OFFSET,
  TACK_RECOVERY_OFFSET,
} from "@pes/eval/scenarios/frame-tick-offsets.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";

const OBJECTIVE_ID = "HUMAN-DEFENSIVE-DUEL-CONTROL";
// Capture-hygiene (0.9.2+): ordinary regression runs must not write
// docs/screenshots/**. Durable evidence is entered only through the explicit
// evidence-mode capture (WIP_SECTION=__EVIDENCE__:HUMAN-DEFENSIVE-DUEL-CONTROL).
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const OUTPUT_ROOT = DURABLE_EVIDENCE ? "docs/screenshots" : "test-results/gauntlet-capture";
/** Root-relative write path; `commands` resolve against the project root. */
const SCREENSHOT_REL = `${OUTPUT_ROOT}/${OBJECTIVE_ID}`;
const SCREENSHOT_DIR = SCREENSHOT_REL;
const TRAJECTORY_REL = `docs/evidence/${OBJECTIVE_ID}/trajectory.json`;
const SEQUENCE_REL = `${SCREENSHOT_REL}/sequence.json`;

/**
 * The attempt program the committed trajectory was produced from: a standing
 * duel on the CPU carrier with a deliberate lock-out follow-up press, then the
 * slide that wins the ball.  Same values, same tick budget, same order.
 */
const DUEL_ATTEMPTS: TackleAttempt[] = [
  { kind: "standing", commitDistance: 3.0, earliestTick: 30, lockoutFollowUpTicks: 3 },
  { kind: "slide", commitDistance: 4.0, earliestTick: 80 },
];
const DUEL_TICKS = 120;

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

// ---------------------------------------------------------------------------
// Committed trajectory (the durable anchor for the event-centered tick)
// ---------------------------------------------------------------------------

interface DurableTrajectory {
  total_ticks: number;
  tackle_attempts: Array<{ tick: number; bits: number; kind: string; lockout: boolean }>;
  tackle_phase_events: Array<{
    tick: number;
    playerId: string;
    tackleKind: string;
    phase: string;
  }>;
  input_rejections: Array<{ tick: number; playerId: string; policy: string }>;
}

async function readDurableTrajectory(): Promise<DurableTrajectory> {
  return JSON.parse(await commands.readFile(TRAJECTORY_REL, "utf-8")) as DurableTrajectory;
}

function standingAttempt(
  attempts: DurableTrajectory["tackle_attempts"],
): DurableTrajectory["tackle_attempts"][number] {
  const attempt = attempts.find((a) => a.kind === "standing" && !a.lockout);
  if (!attempt) throw new Error("trajectory.json has no committed standing tackle attempt");
  return attempt;
}

// ---------------------------------------------------------------------------
// Shared frame targets — always inputTick + TACK_*_OFFSET
// ---------------------------------------------------------------------------

interface FrameTarget {
  label: string;
  offset: number;
  description: string;
}

const FRAME_TARGETS: FrameTarget[] = [
  {
    label: "tack-before",
    offset: TACK_BEFORE_OFFSET,
    description: "Pre-commitment: human defender steers toward the CPU carrier",
  },
  {
    label: "tack-input",
    offset: TACK_INPUT_OFFSET,
    description: "Tackle input tick: STANDING_TACKLE_BIT pressed, phase machine enters prepare",
  },
  {
    label: "tack-active",
    offset: TACK_ACTIVE_OFFSET,
    description: "Active window opens: finite-reach contact eligible in forward cone",
  },
  {
    label: "tack-contact",
    offset: TACK_CONTACT_OFFSET,
    description:
      "Tackle contact: standing tackle's active-window duel contact on the CPU carrier (player-player contact + velocity-only separation impulse); the follow-up tackle press is rejected by the recovery lock-out and the ball is untouched at this tick",
  },
  {
    label: "tack-recovery",
    offset: TACK_RECOVERY_OFFSET,
    description: "Recovery window: body speed capped, lock-out prevents instant re-tackle",
  },
];

function frameTargets(inputTick: number): Array<{ label: string; tick: number; description: string }> {
  return FRAME_TARGETS.map((target) => ({
    label: target.label,
    tick: inputTick + target.offset,
    description: target.description,
  }));
}

// ---------------------------------------------------------------------------
// Capture pass: proximate 5v5 in the browser composition root
// ---------------------------------------------------------------------------

function cpuEntries(scenario: ScenarioDefinition) {
  return Object.entries(scenario.controlAssignments)
    .filter(([, assignment]) => assignment.mode !== "HUMAN")
    .map(([controlSlot, assignment]) => ({
      controlSlot,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId,
      adapter: createCpuAdapter(),
    }));
}

interface CaptureResult {
  captured: string[];
  events: SimulationEvent[];
}

/**
 * Drive the browser composition root over the driver's own tick-indexed human
 * program, so every captured frame comes from the run the trajectory recorded.
 *
 * The CPU slots run at the historical (pre anti-huddle-v1) configuration — the
 * same switch the program was produced with — so the accepted tick-43 duel
 * reproduces instead of being re-pinned.
 */
async function capturePass(
  scenario: ScenarioDefinition,
  program: DefensiveDuelResult,
  inputTick: number,
  cpuAntiHuddle = false,
): Promise<CaptureResult> {
  const targets = frameTargets(inputTick);
  const lastTargetTick = Math.max(...targets.map((t) => t.tick));
  if (lastTargetTick >= program.humanInputs.length) {
    throw new Error(`frame target tick ${lastTargetTick} exceeds the ${program.humanInputs.length}-tick program`);
  }

  const bridge = createTestBridge(container, scenario);
  await bridge.reset();
  const sim = bridge.getSimulation();
  const cpus = cpuEntries(scenario);

  const captured: string[] = [];
  const events: SimulationEvent[] = [];

  // The whole program runs, not just up to the last frame: the standing duel's
  // release phase lands after the final capture tick and the committed
  // trajectory records it.
  for (let tick = 0; tick < program.humanInputs.length; tick++) {
    const snapshot = sim.snapshot();

    const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
    for (const entry of cpus) {
      if (!teamDecisions.has(entry.teamId)) {
        const teamObs = buildCpuObservation(
          snapshot,
          entry.teamId,
          entry.controlledPlayerId,
        );
        teamObs.cpuAntiHuddle = cpuAntiHuddle;
        teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
      }
    }

    const frames: InputFrame[] = cpus.map((entry) => {
      const observation = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
      observation.teamDecision = teamDecisions.get(entry.teamId);
      observation.cpuAntiHuddle = cpuAntiHuddle;
      const frame = entry.adapter.sample(sim.tick, observation);
      frame.controlSlot = entry.controlSlot;
      return frame;
    });

    // The HUMAN slot replays the driver's tick-indexed defensive program.
    const human = program.humanInputs[tick];
    if (!human || human.tick !== tick) {
      throw new Error(`driver program has no human input frame for tick ${tick}`);
    }
    frames.push({
      tick,
      sourceId: "keyboard",
      controlSlot: human.controlSlot,
      moveX: human.moveX,
      moveY: human.moveY,
      sprint: human.sprint,
      heldButtons: human.heldButtons,
      pressedButtons: human.pressedButtons,
      releasedButtons: human.releasedButtons,
    });

    sim.applyInputs(frames);
    const result = sim.step();
    events.push(...result.events);
    if (result.stateHash !== program.stateHashes[tick]) {
      throw new Error(
        `browser run diverged from the driver program at tick ${tick}: ` +
          `${result.stateHash} != ${program.stateHashes[tick]}`,
      );
    }

    for (const target of targets) {
      if (sim.tick === target.tick && !captured.includes(target.label)) {
        bridge.renderFrame();
        const cap = await bridge.capture();
        const base64 = cap.screenshot.split(",")[1] ?? "";
        if (!base64 || base64.length < 100) {
          throw new Error(`renderer produced no PNG bytes for ${target.label}`);
        }
        await commands.writeFile(`${SCREENSHOT_DIR}/${target.label}.png`, base64, "base64");
        captured.push(target.label);
      }
    }
  }

  for (const entry of cpus) entry.adapter.reset();
  bridge.getPresentationSession().dispose();
  return { captured, events };
}

// ---------------------------------------------------------------------------
// PNG hashing + sequence.json generation
// ---------------------------------------------------------------------------

async function sha256OfFile(rootRelativePath: string): Promise<string> {
  const base64 = await commands.readFile(rootRelativePath, "base64");
  const binary = atob(base64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HUMAN-DEFENSIVE-DUEL-CONTROL: screenshot capture", () => {
  it(
    "reproduces the committed standing-tackle program and captures 5 event-centered PNGs",
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

      const trajectory = await readDurableTrajectory();
      expect(trajectory.total_ticks).toBe(DUEL_TICKS);
      const committedAttempt = standingAttempt(trajectory.tackle_attempts);

      const scenario = withProximateHumanDefence(FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
      const program = runDefensiveDuel({
        scenario,
        maxTicks: DUEL_TICKS,
        attempts: DUEL_ATTEMPTS,
        // Accepted tick-43 program predates anti-huddle-v1 → pinned to the
        // historical CPU configuration byte-for-byte (capturePass mirrors it).
        cpuAntiHuddle: false,
      });

      // The driver program is the committed trajectory's program.
      expect(
        program.humanPresses.map((press) => ({
          tick: press.tick,
          bits: press.bits,
          kind: press.kind,
          lockout: press.lockout,
        })),
      ).toEqual(trajectory.tackle_attempts);

      const discovered = program.humanPresses.find((p) => p.kind === "standing" && !p.lockout);
      expect(discovered, "no standing tackle press in the proximate 5v5 program").toBeDefined();
      expect(discovered!.tick).toBe(committedAttempt.tick);

      const targets = frameTargets(discovered!.tick);
      expect(targets[targets.length - 1].tick).toBeLessThan(DUEL_TICKS);
      console.log(
        `[duel-capture] standing-tackle input tick ${discovered!.tick} ` +
          `-> frames ${targets.map((target) => target.tick).join("/")}`,
      );

      const { captured, events } = await capturePass(scenario, program, discovered!.tick);
      expect(captured).toEqual(targets.map((target) => target.label));

      // The browser run produced the same duel the trajectory recorded.
      const browserStandingPhases = events
        .filter(
          (event) =>
            event.kind === "tackle-phase" &&
            (event.payload as Record<string, unknown>).playerId === program.humanPlayerId &&
            (event.payload as Record<string, unknown>).tackleKind === "standing",
        )
        .map((event) => ({
          tick: event.tick,
          phase: (event.payload as Record<string, unknown>).phase,
        }));
      expect(browserStandingPhases).toEqual(
        trajectory.tackle_phase_events
          .filter((phase) => phase.tackleKind === "standing")
          .map((phase) => ({ tick: phase.tick, phase: phase.phase })),
      );

      expect(
        events
          .filter(
            (event) =>
              event.kind === "input-rejection" &&
              (event.payload as Record<string, unknown>).policy === "tackle-lockout",
          )
          .map((event) => event.tick),
      ).toEqual(trajectory.input_rejections.map((rejection) => rejection.tick));

      expect(
        events.some(
          (event) =>
            event.kind === "player-player-contact" &&
            (event.payload as Record<string, unknown>).contactType === "standing-tackle",
        ),
      ).toBe(true);

      const hashes: string[] = [];
      for (const label of captured) {
        hashes.push(await sha256OfFile(`${SCREENSHOT_REL}/${label}.png`));
      }
      expect(new Set(hashes).size).toBe(hashes.length);

      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        description: "Event-centered semantic sequence for defensive tackle action",
        standing_tackle_input_tick: discovered!.tick,
        reproduction: {
          capture_test: "tests/browser/duel-control-screenshot-capture.browser.test.ts",
          driver: "eval/runners/defensive-duel-driver.ts",
          scenario: "eval/scenarios/proximate-5v5.ts (5v5-human-vs-cpu-v1, human team proximate)",
          trajectory: TRAJECTORY_REL,
        },
        frames: captured.map((label, index) => ({
          index: index + 1,
          label,
          tick: targets[index].tick,
          description: targets[index].description,
          path: `${label}.png`,
          sha256: hashes[index],
        })),
      };
      await commands.writeFile(SEQUENCE_REL, `${JSON.stringify(sequence, null, 2)}\n`);
    },
    180_000,
  );

  it("regenerated sequence.json is byte-coherent with the PNGs on disk", async () => {
    const trajectory = await readDurableTrajectory();
    const inputTick = standingAttempt(trajectory.tackle_attempts).tick;
    const expected = frameTargets(inputTick);

    const sequence = JSON.parse(await commands.readFile(SEQUENCE_REL, "utf-8")) as {
      objective_id: string;
      evidence_class: string;
      standing_tackle_input_tick: number;
      frames: Array<{ index: number; label: string; tick: number; path: string; sha256: string }>;
    };
    expect(sequence.objective_id).toBe(OBJECTIVE_ID);
    expect(sequence.evidence_class).toBe("DYNAMIC_VISUAL");
    expect(sequence.standing_tackle_input_tick).toBe(inputTick);
    expect(sequence.frames.length).toBe(5);

    const hashes = new Set<string>();
    for (const [index, frame] of sequence.frames.entries()) {
      expect(frame.index).toBe(index + 1);
      expect(frame.label).toBe(expected[index].label);
      expect(frame.path).toBe(`${expected[index].label}.png`);
      expect(frame.tick).toBe(expected[index].tick);
      expect(frame.sha256).toBe(await sha256OfFile(`${SCREENSHOT_REL}/${frame.path}`));
      expect(frame.sha256).toMatch(/^[0-9a-f]{64}$/);
      hashes.add(frame.sha256);
    }
    expect(hashes.size).toBe(sequence.frames.length);
  });
});

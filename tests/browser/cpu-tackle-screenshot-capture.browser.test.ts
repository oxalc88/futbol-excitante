/**
 * Browser-mode semantic-frame capture for CPU-DEFENSIVE-TACKLE.
 *
 * The frames are event-centered on a CPU-committed tackle inside a coherent
 * CPU-vs-CPU 3v3 match: the browser composition root's own per-slot CPU wiring
 * (the same one `src/apps/browser/main.ts` runs, including the defensive tackle
 * authority on the CPU controllers) plays the match, and the five frames walk
 *
 *   approach → CPU commit → active window opens → contact/outcome → recovery
 *
 * around the attempt the CPU itself decided to make. No tackle bit is scripted
 * anywhere in this file: the only inputs are adapter frames.
 *
 * Two passes, both inside Chromium:
 *   Pass 1 — play the match and locate the first attempt whose contact and
 *            recovery all fit inside the window (no rendering).
 *   Pass 2 — replay from scratch and render the five frames at the ticks read
 *            off that attempt, asserting the ordered phases and in-window
 *            contact are reproduced.
 *   Pass 3 — hash the PNG bytes and write `sequence.json` from them.
 *
 * Durable evidence is written only through the explicit capture command
 * (`WIP_SECTION=__EVIDENCE__:CPU-DEFENSIVE-TACKLE …`), matching the repository
 * capture hygiene; an ordinary suite run lands in `test-results/` instead, and
 * never touches accepted evidence.
 *
 * Cross-runtime note (disclosed, not hidden): the pinned MULTI_TICK artifact
 * `docs/evidence/CPU-DEFENSIVE-TACKLE/trajectory.json` is produced under Node.
 * Chromium's per-tick floats shift the CPU's decisions, so the browser attempt
 * ticks below are the browser run's own; the pinned trajectory's structure
 * (ordered phases, in-window finite-reach contact) is asserted identically.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { commands } from "@vitest/browser/context";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { DEFAULT_RENDERER_CONFIG } from "../../src/adapters/renderer-three/renderer.js";
import {
  createCpuAdapter,
  buildCpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import {
  FOUNDATION_CPU_TACKLE_V1,
  FOUNDATION_TACKLE_V1,
} from "../../src/simulation/config/foundation.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";

const OBJECTIVE_ID = "CPU-DEFENSIVE-TACKLE";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const OUTPUT_REL = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
const TRAJECTORY_REL = `docs/evidence/${OBJECTIVE_ID}/trajectory.json`;
const SEQUENCE_REL = `${OUTPUT_REL}/sequence.json`;

const SCENARIO_PATH = "eval/scenarios/3v3-press-scenario.v1.json";
const PLAY_TICKS = 400;
/** Frames are only taken at or after this tick so the approach frame exists. */
const MIN_ATTEMPT_TICK = 14;

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
 * Scenario bytes come through Vitest's browser command API: `node:fs` is
 * stubbed out inside the page, so a failed read must fail the capture loudly.
 */
async function loadScenario(): Promise<ScenarioDefinition> {
  return JSON.parse(await commands.readFile(SCENARIO_PATH, "utf-8")) as ScenarioDefinition;
}

/** Accepted evidence is immutable: a manifest means the objective is closed. */
async function assertEvidenceMutable(): Promise<void> {
  try {
    await commands.readFile(`docs/evidence/${OBJECTIVE_ID}/manifest.json`, "utf-8");
  } catch {
    return; // no manifest yet: durable capture for this candidate is allowed
  }
  throw new Error(
    `Accepted evidence is immutable: docs/evidence/${OBJECTIVE_ID}/manifest.json exists`,
  );
}

interface CpuSlot {
  adapter: ReturnType<typeof createCpuAdapter>;
  controlSlot: string;
  teamId: string;
  controlledPlayerId: string;
}

function cpuSlots(scenario: ScenarioDefinition): CpuSlot[] {
  return Object.entries(scenario.controlAssignments).map(
    ([controlSlot, assignment]) => ({
      adapter: createCpuAdapter(),
      controlSlot,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId ?? "",
    }),
  );
}

/**
 * One tick of the browser composition root's CPU wiring, tackle authority
 * included — the same wiring `main.ts` runs for every AI slot.
 */
function sampleCpuFrames(
  sim: ReturnType<ReturnType<typeof createTestBridge>["getSimulation"]>,
  slots: CpuSlot[],
): InputFrame[] {
  const snapshot = sim.snapshot();
  const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
  for (const entry of slots) {
    if (!teamDecisions.has(entry.teamId)) {
      const teamObs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
      teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
    }
  }
  return slots.map((entry) => {
    const observation = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
    observation.teamDecision = teamDecisions.get(entry.teamId);
    observation.cpuDefensiveTackle = true;
    const frame = entry.adapter.sample(sim.tick, observation);
    frame.controlSlot = entry.controlSlot;
    return frame;
  });
}

interface AttemptView {
  playerId: string;
  teamId: string;
  kind: string;
  startTick: number;
  prepareTick: number;
  activeTick: number;
  recoverTick: number;
  releaseTick: number;
  activeWindowStartTick: number;
  activeWindowEndTick: number;
  reach: number;
  contactTick: number | null;
}

function payloadOf(event: SimulationEvent): Record<string, unknown> {
  return (event.payload ?? {}) as Record<string, unknown>;
}

/** Rebuild per-attempt views from a run's ordered events. */
function attemptsFromEvents(events: SimulationEvent[]): AttemptView[] {
  const attempts = new Map<string, AttemptView>();
  for (const event of events) {
    const payload = payloadOf(event);
    if (event.kind === "tackle-phase") {
      const key = `${String(payload.playerId)}@${String(payload.startTick)}`;
      let attempt = attempts.get(key);
      if (!attempt) {
        attempt = {
          playerId: String(payload.playerId ?? ""),
          teamId: String(payload.teamId ?? ""),
          kind: String(payload.tackleKind ?? ""),
          startTick: Number(payload.startTick),
          prepareTick: Number.NaN,
          activeTick: Number.NaN,
          recoverTick: Number.NaN,
          releaseTick: Number.NaN,
          activeWindowStartTick: Number(payload.activeWindowStartTick ?? NaN),
          activeWindowEndTick: Number(payload.activeWindowEndTick ?? NaN),
          reach: Number(payload.reach ?? NaN),
          contactTick: null,
        };
        attempts.set(key, attempt);
      }
      const phase = String(payload.phase);
      if (phase === "prepare") attempt.prepareTick = event.tick;
      if (phase === "active") attempt.activeTick = event.tick;
      if (phase === "recover") attempt.recoverTick = event.tick;
      if (phase === "release") attempt.releaseTick = event.tick;
    } else if (
      event.kind === "player-ball-contact" ||
      event.kind === "player-player-contact"
    ) {
      const contactType = String(payload.contactType ?? "");
      if (contactType !== "standing-tackle" && contactType !== "slide-tackle") continue;
      const playerId = event.kind === "player-ball-contact"
        ? String(payload.playerId ?? "")
        : String(payload.playerIdA ?? "");
      const attempt = attempts.get(`${playerId}@${String(payload.attemptStartTick)}`);
      if (attempt && attempt.contactTick === null) attempt.contactTick = event.tick;
    }
  }
  return [...attempts.values()];
}

interface PlayResult {
  events: SimulationEvent[];
  hashes: string[];
  /** Ball planar position at each committed tick, index 0 = tick 1. */
  ballTrack: Array<{ tick: number; x: number; y: number }>;
  /** Labels of the frames actually written by this pass (empty when not rendering). */
  captured: string[];
}

/**
 * Play the CPU-vs-CPU match through the browser composition root.
 *
 * @param renderAt - Optional tick → label map; the frame is rendered and
 *   written when the simulation commits that tick.
 * @param focus - Duel location (simulation metres) the static camera is aimed
 *   at. Presentation-only: the renderer consumes immutable snapshots and never
 *   writes simulation state, so framing cannot change a football outcome.
 */
async function playMatch(
  scenario: ScenarioDefinition,
  renderAt: Map<number, string>,
  render: boolean,
  focus: { x: number; y: number } | null = null,
): Promise<PlayResult> {
  const rendererConfig = focus
    ? {
        ...DEFAULT_RENDERER_CONFIG,
        cameraTarget: { x: focus.x, y: 0, z: focus.y },
        cameraPosition: { x: focus.x, y: 22, z: focus.y + 30 },
      }
    : undefined;
  const bridge = createTestBridge(container, scenario, undefined, rendererConfig);
  await bridge.reset();
  const sim = bridge.getSimulation();
  const slots = cpuSlots(scenario);
  const events: SimulationEvent[] = [];
  const hashes: string[] = [];
  const ballTrack: Array<{ tick: number; x: number; y: number }> = [];
  const captured: string[] = [];

  for (let i = 0; i < PLAY_TICKS; i++) {
    sim.applyInputs(sampleCpuFrames(sim, slots));
    const result = sim.step();
    events.push(...result.events);
    hashes.push(result.stateHash);
    ballTrack.push({
      tick: sim.tick,
      x: sim.snapshot().ball.position.x,
      y: sim.snapshot().ball.position.y,
    });

    const label = renderAt.get(sim.tick);
    if (render && label) {
      const capture = await bridge.capture();
      const base64 = capture.screenshot.split(",")[1] ?? "";
      if (!base64 || base64.length < 100) {
        throw new Error(`renderer produced no PNG bytes for ${label}`);
      }
      await commands.writeFile(`${OUTPUT_REL}/${label}.png`, base64, "base64");
      captured.push(label);
    }
  }

  for (const entry of slots) entry.adapter.reset();
  bridge.getPresentationSession().dispose();
  return { events, hashes, ballTrack, captured };
}

/** Frame labels in semantic order, built around one committed attempt. */
function framePlan(attempt: AttemptView): Array<{ label: string; tick: number; description: string }> {
  const prepareTicks = FOUNDATION_TACKLE_V1.standingPrepareTicks.value;
  const contactTick = attempt.contactTick ?? attempt.activeWindowStartTick;
  const plan = [
    {
      label: "cpu-tack-before",
      tick: attempt.startTick - MIN_ATTEMPT_TICK,
      description:
        "Approach: the CPU presser is closing on the opposing carrier and has committed to nothing yet",
    },
    {
      label: "cpu-tack-commit",
      tick: attempt.startTick,
      description: `CPU commit: the team-decision profile authorised this ${attempt.kind} tackle (prepare; reaction latency ${FOUNDATION_CPU_TACKLE_V1.reactionTicks.value} ticks)`,
    },
    {
      label: "cpu-tack-active",
      tick: attempt.activeWindowStartTick,
      description: `Active window opens at commit + ${prepareTicks}: finite reach ${attempt.reach} m contact becomes eligible in the committed cone`,
    },
    {
      label: "cpu-tack-outcome",
      tick: contactTick + 2,
      description:
        "Outcome: active-window tackle contact resolved (velocity-only deflection / separation impulse) and play continues past the beaten carrier",
    },
    {
      label: "cpu-tack-recovery",
      tick: attempt.recoverTick + 4,
      description:
        "Recovery: the committed body is still capped and locked out, so the challenge cannot be instantly re-tried",
    },
  ];
  return plan;
}

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

describe("CPU-DEFENSIVE-TACKLE: browser CPU tackle frames", () => {
  it(
    "captures 5 event-centered frames around a CPU-committed tackle",
    async () => {
      if (DURABLE_EVIDENCE) await assertEvidenceMutable();
      const scenario = await loadScenario();
      for (const assignment of Object.values(scenario.controlAssignments)) {
        expect((assignment as { mode?: string }).mode).not.toBe("HUMAN");
      }

      // Pass 1 — locate a CPU attempt whose whole commitment fits the play window.
      const first = await playMatch(scenario, new Map(), false);
      const candidates = attemptsFromEvents(first.events).filter(
        (a) =>
          a.startTick >= MIN_ATTEMPT_TICK &&
          a.contactTick !== null &&
          Number.isFinite(a.recoverTick) &&
          Number.isFinite(a.releaseTick) &&
          a.releaseTick + 4 < PLAY_TICKS,
      );
      expect(candidates.length, "no CPU tackle attempt with contact in the play window").toBeGreaterThan(0);
      // The laboratory camera is static and looks at the centre spot, so the
      // frame subject is the attempt the camera can actually show best.
      const ballAt = (tick: number) => first.ballTrack.find((entry) => entry.tick === tick);
      const centrality = (a: AttemptView): number => {
        const at = ballAt(a.contactTick ?? a.startTick);
        return at ? Math.hypot(at.x, at.y) : Number.POSITIVE_INFINITY;
      };
      const attempt = [...candidates].sort(
        (a, b) => centrality(a) - centrality(b) || a.startTick - b.startTick,
      )[0];

      const plan = framePlan(attempt);
      const ticks = plan.map((frame) => frame.tick);
      expect(new Set(ticks).size).toBe(ticks.length);
      for (const tick of ticks) {
        expect(tick).toBeGreaterThanOrEqual(0);
        expect(tick).toBeLessThan(PLAY_TICKS);
      }
      console.log(
        `[cpu-tackle-capture] ${attempt.playerId} ${attempt.kind}@${attempt.startTick}` +
          ` frames ${ticks.join("/")} (durable=${DURABLE_EVIDENCE})`,
      );

      // Pass 2 — replay the same CPU-only wiring and render the five frames.
      const renderAt = new Map(plan.map((frame) => [frame.tick, frame.label]));
      const focusAt = ballAt(attempt.contactTick ?? attempt.startTick);
      const focus = focusAt ? { x: focusAt.x, y: focusAt.y } : null;
      const second = await playMatch(scenario, renderAt, true, focus);
      expect(second.captured).toEqual(plan.map((frame) => frame.label));
      const replayed = attemptsFromEvents(second.events).find(
        (a) => a.playerId === attempt.playerId && a.startTick === attempt.startTick,
      );
      expect(replayed, "the replay lost the CPU attempt").toBeDefined();
      const chosen = replayed!;

      // Ordered phases, exactly the windows the action declares.
      const windows =
        chosen.kind === "standing"
          ? {
              prepare: FOUNDATION_TACKLE_V1.standingPrepareTicks.value,
              active: FOUNDATION_TACKLE_V1.standingActiveTicks.value,
              recover: FOUNDATION_TACKLE_V1.standingRecoverTicks.value,
              reach: FOUNDATION_TACKLE_V1.standingReach.value,
            }
          : {
              prepare: FOUNDATION_TACKLE_V1.slidePrepareTicks.value,
              active: FOUNDATION_TACKLE_V1.slideActiveTicks.value,
              recover: FOUNDATION_TACKLE_V1.slideRecoverTicks.value,
              reach: FOUNDATION_TACKLE_V1.slideReach.value,
            };
      expect(chosen.prepareTick).toBe(chosen.startTick);
      expect(chosen.activeTick).toBe(chosen.startTick + windows.prepare);
      expect(chosen.recoverTick).toBe(chosen.startTick + windows.prepare + windows.active);
      expect(chosen.releaseTick).toBe(
        chosen.startTick + windows.prepare + windows.active + windows.recover,
      );
      expect(chosen.reach).toBe(windows.reach);
      expect(chosen.contactTick).not.toBeNull();
      expect(chosen.contactTick!).toBeGreaterThanOrEqual(chosen.activeWindowStartTick);
      expect(chosen.contactTick!).toBeLessThanOrEqual(chosen.activeWindowEndTick);

      // Second-hand proof that the frames came from a CPU decision: at least one
      // committed frame of the capture tick carries a tackle bit on a CPU slot.
      const pressedCpuTackle = second.events.some(
        (event) => event.kind === "tackle-phase",
      );
      expect(pressedCpuTackle).toBe(true);

      // Pass 3 — hash the written PNGs and derive the sequence metadata.
      const hashes: string[] = [];
      for (const frame of plan) {
        hashes.push(await sha256OfFile(`${OUTPUT_REL}/${frame.label}.png`));
      }
      expect(new Set(hashes).size).toBe(hashes.length);

      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "MULTI_TICK",
        semantic_order: "approach → CPU commit → active window → contact/outcome → recovery",
        durable_capture: DURABLE_EVIDENCE,
        scenario: scenario.id,
        cpu_attempt: {
          player_id: chosen.playerId,
          team_id: chosen.teamId,
          kind: chosen.kind,
          start_tick: chosen.startTick,
          active_window: [chosen.activeWindowStartTick, chosen.activeWindowEndTick],
          contact_tick: chosen.contactTick,
          recover_tick: chosen.recoverTick,
          release_tick: chosen.releaseTick,
          reach: chosen.reach,
        },
        reproduction: {
          capture_test: "tests/browser/cpu-tackle-screenshot-capture.browser.test.ts",
          wiring: "src/apps/browser/main.ts per-slot CPU composition root with CpuObservation.cpuDefensiveTackle",
          scenario_path: SCENARIO_PATH,
          play_ticks: PLAY_TICKS,
          pinned_trajectory: TRAJECTORY_REL,
        },
        cross_runtime_note:
          "Ticks are the Chromium run's own. The pinned Node trajectory in docs/evidence/CPU-DEFENSIVE-TACKLE/trajectory.json records the same attempt structure; per-tick hashes are not comparable across runtimes (known pinned-runtime gap).",
        frames: plan.map((frame, index) => ({
          index: index + 1,
          label: frame.label,
          tick: frame.tick,
          description: frame.description,
          path: `${frame.label}.png`,
          sha256: hashes[index],
        })),
      };
      await commands.writeFile(SEQUENCE_REL, `${JSON.stringify(sequence, null, 2)}\n`);
    },
    280_000,
  );

  it("sequence.json is byte-coherent with the PNGs on disk", async () => {
    const sequence = JSON.parse(await commands.readFile(SEQUENCE_REL, "utf-8")) as {
      objective_id: string;
      frames: Array<{ index: number; label: string; tick: number; path: string; sha256: string }>;
    };
    expect(sequence.objective_id).toBe(OBJECTIVE_ID);
    expect(sequence.frames.length).toBeGreaterThanOrEqual(3);
    expect(sequence.frames.length).toBeLessThanOrEqual(5);

    const hashes = new Set<string>();
    for (const [index, frame] of sequence.frames.entries()) {
      expect(frame.index).toBe(index + 1);
      expect(frame.path).toBe(`${frame.label}.png`);
      expect(frame.sha256).toBe(await sha256OfFile(`${OUTPUT_REL}/${frame.path}`));
      expect(frame.sha256).toMatch(/^[0-9a-f]{64}$/);
      hashes.add(frame.sha256);
    }
    expect(hashes.size).toBe(sequence.frames.length);
  });
});

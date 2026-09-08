/**
 * @module tests/browser/foul-freekick-browser-evidence.browser.test
 *
 * DYNAMIC_VISUAL evidence capture for FOUL-FREEKICK-BROWSER-EVIDENCE: the
 * horizon's observable browser capability — a real foul → free-kick consequence
 * visible in the real shipped app (real Chromium + real Three renderer through
 * the accepted test bridge).
 *
 * The fixture is the accepted FOUL-CONSEQUENCE-MACHINERY driven-duel shape:
 * `eval/scenarios/5v5-human-vs-cpu.v1.json` with `withProximateHumanDefence`
 * (the HUMAN team parked a fixed distance behind the ball), driven by the same
 * scripted standing-tackle policy the headless defensive-duel driver uses.  The
 * core commits a man-not-ball tackle contact (spec §5.1) and, with the accepted
 * `awardFreeKicks` gate live, awards a free kick to the fouled team at the
 * contact position through the accepted restart machinery.  Both the foul and
 * the free kick are REAL core events (the shared foul predicate), never
 * scripted theater: the scripted policy simply reproduces what the defensive
 * duel driver already does, and the award/placement/serve are the core's own.
 *
 * Frames (before → event → transition → result, event-centered on the
 * foul → free-kick consequence):
 *   - tackle-contact   (postTick ~50): the man-not-ball tackle contact moment —
 *     the defender and carrier are in contact, the ball is in play, "PLAYING".
 *   - freekick-award   (postTick 51):  the free kick awarded — the phase turns
 *     "FREE KICK", the ball is re-placed at the contact position, the set piece
 *     is arranged.
 *   - freekick-placement (mid-countdown): the settled set-piece at the contact
 *     spot — the taker on the ball, the fouled-team receivers spread, the
 *     opposing team marking, the in-play clock frozen.
 *   - freekick-served (a few ticks after countdown zero): the ball served back
 *     into play along a real kick direction, "PLAYING".
 *
 * The renderer HUD label (`showMatchPhaseHud`) is the opt-in surface; the
 * curated "FREE KICK" label is the accepted renderer affordance (draw-only,
 * reads the immutable snapshot's matchPhase).  All four frames are byte-distinct
 * over the captured PNG bytes.
 *
 * Capture hygiene (0.9.2+): durable screenshots are written only in evidence
 * mode (`WIP_SECTION=__EVIDENCE__:FOUL-FREEKICK-BROWSER-EVIDENCE`); an
 * ordinary run writes under the ignored `test-results/gauntlet-capture/**` tree
 * and leaves `docs/` byte-identical.  The record carries NO wall-clock field.
 *
 * No Math.random, wall clock, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { commands } from "@vitest/browser/context";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { DEFAULT_RENDERER_CONFIG } from "../../src/adapters/renderer-three/renderer.js";
import { withProximateHumanDefence } from "../../eval/scenarios/proximate-5v5.js";
import { runDefensiveDuel } from "../../eval/runners/defensive-duel-driver.js";
import { isFoulCandidateEvent } from "../../src/simulation/foul-predicate.js";
import {
  createCpuAdapter,
  buildCpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { STANDING_TACKLE_BIT } from "../../src/contracts/input.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";

const OBJECTIVE_ID = "FOUL-FREEKICK-BROWSER-EVIDENCE";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const OUTPUT_REL = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
const SEQUENCE_REL = `${OUTPUT_REL}/sequence.json`;

const SCENARIO_PATH = "eval/scenarios/5v5-human-vs-cpu.v1.json";
/** The driven-duel observation window (the foul lands early, so this is ample). */
const PLAY_TICKS = 200;
/** The scripted standing-tackle attempt (the accepted driven-duel shape). */
const ATTEMPT = { kind: "standing", commitDistance: 3.0, earliestTick: 48 } as const;
/** The accepted in-core free-kick countdown (free-kick-executed = foul + 60). */
const FREE_KICK_COUNTDOWN = 60;

/**
 * Static presentation-only framing, identical for every frame so the sequence
 * stays comparable.  Aimed at the central contact area (the free-kick spot at
 * x≈-1.8, y≈0) where the foul and the set-piece happen, with enough context that
 * the tackle contact and the ball re-placement are legible.  The renderer
 * consumes immutable snapshots, so framing cannot move a football.
 */
const CAMERA = { position: { x: 0, y: 34, z: 46 }, target: { x: -2, y: 0, z: 0 } };
const CAMERA_FOV = 45;

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

async function loadScenario(): Promise<ScenarioDefinition> {
  return JSON.parse(await commands.readFile(SCENARIO_PATH, "utf-8")) as ScenarioDefinition;
}

async function assertEvidenceMutable(): Promise<void> {
  try {
    await commands.readFile(`docs/evidence/${OBJECTIVE_ID}/manifest.json`, "utf-8");
  } catch {
    return;
  }
  throw new Error(
    `Accepted evidence is immutable: docs/evidence/${OBJECTIVE_ID}/manifest.json exists`,
  );
}

// ---------------------------------------------------------------------------
// CPU + human slot wiring (replicates the defensive-duel driver exactly)
// ---------------------------------------------------------------------------

interface CpuSlot {
  adapter: ReturnType<typeof createCpuAdapter>;
  controlSlot: string;
  teamId: string;
  controlledPlayerId: string;
}

function cpuSlots(scenario: ScenarioDefinition): CpuSlot[] {
  return Object.entries(scenario.controlAssignments)
    .filter(([, a]) => (a as { mode?: string }).mode !== "HUMAN")
    .map(([controlSlot, assignment]) => ({
      adapter: createCpuAdapter(),
      controlSlot,
      teamId: (assignment as { teamId: string }).teamId,
      controlledPlayerId: (assignment as { controlledPlayerId: string }).controlledPlayerId,
    }));
}

function humanSlot(scenario: ScenarioDefinition): { controlSlot: string; playerId: string } {
  for (const [controlSlot, assignment] of Object.entries(scenario.controlAssignments)) {
    if ((assignment as { mode?: string }).mode === "HUMAN") {
      return { controlSlot, playerId: (assignment as { controlledPlayerId: string }).controlledPlayerId };
    }
  }
  throw new Error("the driven-duel fixture requires exactly one HUMAN control slot");
}

function planarDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * One tick of the driven-duel wiring: the CPU slots through the same adapter +
 * team-decision profile the browser composition root uses, and the HUMAN slot
 * through the scripted standing-tackle policy from the defensive-duel driver.
 */
function sampleFrames(
  sim: Simulation,
  slots: CpuSlot[],
  human: { controlSlot: string; playerId: string },
  tick: number,
): InputFrame[] {
  const snapshot = sim.snapshot();
  const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
  for (const entry of slots) {
    if (!teamDecisions.has(entry.teamId)) {
      const obs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
      obs.cpuAntiHuddle = true;
      teamDecisions.set(entry.teamId, computeTeamDecision(obs, entry.teamId));
    }
  }
  const frames: InputFrame[] = slots.map((entry) => {
    const obs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
    obs.teamDecision = teamDecisions.get(entry.teamId);
    obs.cpuAntiHuddle = true;
    const frame = entry.adapter.sample(tick, obs);
    frame.controlSlot = entry.controlSlot;
    return frame;
  });

  // Scripted human defensive policy (the accepted driven-duel shape): steer
  // toward the ball/carrier and commit a standing tackle once inside reach.
  let moveX = 0;
  let moveY = 0;
  let held = 0;
  let pressed = 0;
  const humanPlayer = snapshot.players.find((p) => p.playerId === human.playerId);
  if (humanPlayer) {
    const ball = snapshot.ball;
    let carrier: { groundPosition: { x: number; y: number }; teamId: string } | null = null;
    let carrierDist = Number.POSITIVE_INFINITY;
    for (const p of snapshot.players) {
      if (p.teamId === humanPlayer.teamId) continue;
      const d = planarDistance(p.groundPosition.x, p.groundPosition.y, ball.position.x, ball.position.y);
      if (d < carrierDist) { carrierDist = d; carrier = p; }
    }
    const chaseX = carrier !== null && carrierDist < 3 ? carrier.groundPosition.x : ball.position.x;
    const chaseY = carrier !== null && carrierDist < 3 ? carrier.groundPosition.y : ball.position.y;
    const dx = chaseX - humanPlayer.groundPosition.x;
    const dy = chaseY - humanPlayer.groundPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.01) { moveX = dx / dist; moveY = dy / dist; }

    const distToBall = planarDistance(
      humanPlayer.groundPosition.x, humanPlayer.groundPosition.y,
      ball.position.x, ball.position.y,
    );
    if (carrier !== null) {
      const inRange =
        distToBall <= ATTEMPT.commitDistance &&
        planarDistance(
          humanPlayer.groundPosition.x, humanPlayer.groundPosition.y,
          carrier.groundPosition.x, carrier.groundPosition.y,
        ) <= ATTEMPT.commitDistance;
      const timingOk = tick >= (ATTEMPT.earliestTick ?? 0);
      if (inRange && timingOk) {
        pressed |= STANDING_TACKLE_BIT;
        held |= STANDING_TACKLE_BIT;
      }
    }
  }
  frames.push({
    tick,
    sourceId: "keyboard",
    controlSlot: human.controlSlot,
    moveX, moveY,
    sprint: 1,
    heldButtons: held,
    pressedButtons: pressed,
    releasedButtons: 0,
  });
  return frames;
}

// ---------------------------------------------------------------------------
// Play + record
// ---------------------------------------------------------------------------

interface TickFacts {
  tick: number;
  stateHash: string;
  matchPhase: string;
  matchTimer: number;
  ball: { x: number; y: number; regime: string };
  fouledTeamId: string | null;
}

interface FkFromState {
  tick: number;
  teamId: string;
  freeKickPosition: { x: number; y: number };
  kickTakerId: string;
  kickDirection: { x: number; y: number };
}

async function playMatch(
  scenario: ScenarioDefinition,
  renderAt: Map<number, string>,
  render: boolean,
  awardFreeKicks = true,
): Promise<{ records: TickFacts[]; fkFromState: FkFromState | null; captured: string[] }> {
  const bridge = createTestBridge(container, scenario, undefined, {
    ...DEFAULT_RENDERER_CONFIG,
    cameraPosition: CAMERA.position,
    cameraTarget: CAMERA.target,
    cameraFov: CAMERA_FOV,
    showMatchPhaseHud: true,
  }, { awardFreeKicks });
  await bridge.reset();
  const sim = bridge.getSimulation();
  const slots = cpuSlots(scenario);
  const human = humanSlot(scenario);

  const records: TickFacts[] = [];
  const captured: string[] = [];

  for (let i = 0; i < PLAY_TICKS; i++) {
    const frameTick = sim.tick;
    sim.applyInputs(sampleFrames(sim, slots, human, frameTick));
    const result = sim.step();
    const snapshot = sim.snapshot();

    // The man-not-ball foul is a committed player-player-contact event in the
    // per-step events (the shared predicate); read the fouled team from it.
    let fouledTeamId: string | null = null;
    for (const ev of result.events) {
      if (!isFoulCandidateEvent(ev)) continue;
      fouledTeamId = ((ev.payload ?? {}) as { teamIdB?: string }).teamIdB ?? null;
    }

    records.push({
      tick: sim.tick,
      stateHash: result.stateHash,
      matchPhase: sim.presentation().matchPhase,
      matchTimer: sim.presentation().matchTimer,
      ball: {
        x: Number(snapshot.ball.position.x.toFixed(4)),
        y: Number(snapshot.ball.position.y.toFixed(4)),
        regime: snapshot.ball.regime,
      },
      fouledTeamId,
    });

    const label = renderAt.get(sim.tick);
    if (render && label) {
      const cap = await bridge.capture();
      const base64 = cap.screenshot.split(",")[1] ?? "";
      if (!base64 || base64.length < 100) throw new Error(`renderer produced no PNG bytes for ${label}`);
      await commands.writeFile(`${OUTPUT_REL}/${label}.png`, base64, "base64");
      captured.push(label);
    }
  }

  for (const entry of slots) entry.adapter.reset();

  // The free-kick-executed event is committed to the core's persistent state
  // (the accepted serialization limitation), so read it from the snapshot.
  const finalSnap = sim.snapshot();
  const fkEv = finalSnap.events.find((e) => e.kind === "free-kick-executed");
  let fkFromState: FkFromState | null = null;
  if (fkEv) {
    const p = (fkEv.payload ?? {}) as Record<string, unknown>;
    fkFromState = {
      tick: fkEv.tick,
      teamId: p.teamId as string,
      freeKickPosition: p.freeKickPosition as { x: number; y: number },
      kickTakerId: p.kickTakerId as string,
      kickDirection: p.kickDirection as { x: number; y: number },
    };
  }
  bridge.getPresentationSession().dispose();

  return { records, fkFromState, captured };
}

// ---------------------------------------------------------------------------
// Locate the foul arc from the run's own event log
// ---------------------------------------------------------------------------

interface FoulArc {
  foulTick: number;
  fouledTeamId: string;
  fk: FkFromState;
  awardTick: number;
  placementTick: number;
  servedTick: number;
  matchTimerAtAward: number;
}

function locateFoulArc(records: TickFacts[], fk: FkFromState | null): FoulArc | null {
  const foulRecord = records.find((r) => r.fouledTeamId !== null);
  if (!foulRecord || !fk) return null;
  const awardTick = foulRecord.tick;
  const placementTick = Math.min(awardTick + 40, fk.tick - 5);
  const servedTick = Math.min(fk.tick + 3, PLAY_TICKS - 1);
  return {
    foulTick: awardTick,
    fouledTeamId: foulRecord.fouledTeamId!,
    fk,
    awardTick,
    placementTick,
    servedTick,
    matchTimerAtAward: foulRecord.matchTimer,
  };
}

async function sha256OfFile(rootRelativePath: string): Promise<string> {
  const base64 = await commands.readFile(rootRelativePath, "base64");
  const binary = atob(base64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function framePlan(arc: FoulArc): Array<{ label: string; tick: number; semantic: string; description: string }> {
  return [
    {
      label: "tackle-contact",
      tick: Math.max(1, arc.foulTick - 1),
      semantic: "before",
      description: "Tackle contact (the foul): the defending body commits a man-not-ball standing tackle on the carrier — both in contact, the ball still in play (PLAYING) before the free kick is awarded",
    },
    {
      label: "freekick-award",
      tick: arc.awardTick,
      semantic: "event",
      description: `Free kick awarded: the phase turns FREE KICK after the man-not-ball contact; the ball is re-placed at the contact position and the set piece is arranged (awarded to ${arc.fk.teamId})`,
    },
    {
      label: "freekick-placement",
      tick: arc.placementTick,
      semantic: "transition",
      description: "Set-piece placement: the taker on the re-placed ball at the contact spot, the fouled-team receivers spread, the opposing team marking, the in-play clock frozen (FREE KICK)",
    },
    {
      label: "freekick-served",
      tick: arc.servedTick,
      semantic: "result",
      description: `Served free kick: the ball is back in play off the contact spot along the committed kick direction (${arc.fk.kickTakerId}), the phase is PLAYING again`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

describe("FOUL-FREEKICK-BROWSER-EVIDENCE: foul → free-kick frames", () => {
  it(
    "drives a real foul → free-kick and captures 4 byte-distinct event-centered frames",
    async () => {
      if (DURABLE_EVIDENCE) await assertEvidenceMutable();
      const scenario = withProximateHumanDefence(await loadScenario());
      expect(scenario.players.length).toBe(10);

      // Pass 1 — locate the foul arc from the run's own event log (no rendering).
      const first = await playMatch(scenario, new Map(), false);
      const arc = locateFoulArc(first.records, first.fkFromState);
      expect(arc, "the browser driven-duel never produced a foul → free-kick arc").not.toBeNull();
      // The free kick went to the fouled team (the shared predicate's teamIdB).
      expect(arc!.fk.teamId).toBe(arc!.fouledTeamId);
      // The award/placement is at the contact spot; the serve is 60 ticks later.
      expect(arc!.fk.tick - arc!.foulTick).toBe(FREE_KICK_COUNTDOWN);

      const plan = framePlan(arc!);
      const ticks = plan.map((f) => f.tick);
      expect(new Set(ticks).size, "frame ticks must be distinct").toBe(plan.length);
      for (const [index, tick] of ticks.entries()) {
        expect(tick).toBeGreaterThanOrEqual(1);
        expect(tick).toBeLessThan(PLAY_TICKS);
        if (index > 0) expect(tick).toBeGreaterThan(ticks[index - 1]);
      }
      console.log(
        `[foul-freekick] frames ${ticks.join("/")} foul=${arc!.foulTick} fk=${arc!.fk.tick} (durable=${DURABLE_EVIDENCE})`,
      );

      // Pass 2 — replay the same wiring and render the four frames.
      const renderAt = new Map(plan.map((f) => [f.tick, f.label]));
      const second = await playMatch(scenario, renderAt, true);
      expect(second.captured).toEqual(plan.map((f) => f.label));
      // Deterministic replay: the same committed hash chain.
      expect(second.records.map((r) => r.stateHash)).toEqual(first.records.map((r) => r.stateHash));
      const arc2 = locateFoulArc(second.records, second.fkFromState);
      expect(arc2).toEqual(arc);

      // Semantic invariants at the captured ticks (the browser-visible binding).
      const awardRec = second.records.find((r) => r.tick === arc!.awardTick)!;
      const placementRec = second.records.find((r) => r.tick === arc!.placementTick)!;
      const servedRec = second.records.find((r) => r.tick === arc!.servedTick)!;
      const contactRecord = second.records.find((r) => r.tick === Math.max(1, arc!.foulTick - 1))!;
      // The contact frame: ball still in play, PLAYING.
      expect(contactRecord.matchPhase).toBe("playing");
      expect(contactRecord.ball.regime).toBe("ground-roll");
      // The award frame: FREE KICK, ball re-placed at the contact spot.
      expect(awardRec.matchPhase).toBe("free-kick");
      expect(
        planarDistance(awardRec.ball.x, awardRec.ball.y, arc!.fk.freeKickPosition.x, arc!.fk.freeKickPosition.y),
      ).toBeLessThan(0.01);
      // The placement frame: still FREE KICK, in-play clock frozen at the award value.
      expect(placementRec.matchPhase).toBe("free-kick");
      expect(placementRec.matchTimer).toBe(awardRec.matchTimer);
      // The served frame: back to PLAYING, ball off the spot (in flight).
      expect(servedRec.matchPhase).toBe("playing");
      expect(
        planarDistance(servedRec.ball.x, servedRec.ball.y, arc!.fk.freeKickPosition.x, arc!.fk.freeKickPosition.y),
      ).toBeGreaterThan(0.05);

      // Pass 3 — the same wiring with the awardFreeKicks gate OFF (the accepted
      // default) never produces the free-kick phase or a committed free-kick.
      const stashed = await playMatch(scenario, new Map(), false, false);
      expect(stashed.records.some((r) => r.matchPhase === "free-kick")).toBe(false);
      expect(stashed.fkFromState).toBeNull();

      // Pass 4 — hash the PNGs; the four frames must be distinct images.
      const pngHashes: string[] = [];
      for (const frame of plan) pngHashes.push(await sha256OfFile(`${OUTPUT_REL}/${frame.label}.png`));
      expect(new Set(pngHashes).size, "the four frames must be byte-distinct images").toBe(plan.length);

      // Write the semantic sequence metadata.
      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        semantic_order: "tackle contact (the foul) -> free-kick award -> set-piece placement -> served free kick",
        durable_capture: DURABLE_EVIDENCE,
        scenario: scenario.id,
        scenario_path: SCENARIO_PATH,
        rendering: {
          surface: "src/apps/browser/test-bridge.ts + real Three renderer (Chromium)",
          hud: "showMatchPhaseHud:true (curated FREE KICK label)",
        },
        arc: {
          foul_tick: arc!.foulTick,
          awarding_team: arc!.fk.teamId,
          free_kick_executed_tick: arc!.fk.tick,
          free_kick_position: arc!.fk.freeKickPosition,
          kick_taker: arc!.fk.kickTakerId,
          kick_direction: arc!.fk.kickDirection,
          match_timer_at_award: arc!.matchTimerAtAward,
        },
        frames: plan.map((frame) => ({
          label: frame.label,
          path: `${frame.label}.png`,
          tick: frame.tick,
          semantic: frame.semantic,
          description: frame.description,
          sha256: pngHashes[plan.findIndex((f) => f.label === frame.label)],
        })),
      };
      await commands.writeFile(SEQUENCE_REL, `${JSON.stringify(sequence, null, 2)}\n`, "utf-8");

      (window as unknown as Record<string, string>).__ffbArc = JSON.stringify(arc);
    },
    { timeout: 120_000 },
  );

  it(
    "the browser foul/free-kick ticks correspond to the headless defensive-duel run",
    async () => {
      const scenario = withProximateHumanDefence(await loadScenario());
      const headless = runDefensiveDuel({
        scenario,
        maxTicks: PLAY_TICKS,
        attempts: [{ kind: "standing", commitDistance: ATTEMPT.commitDistance, earliestTick: ATTEMPT.earliestTick }],
        freeKickConfig: { awardFreeKicks: true },
      });
      const headlessFoulTick = headless.events.find((e) => isFoulCandidateEvent(e))?.tick ?? null;
      const headlessFk = headless.freeKickEvents[0];

      const browser = await playMatch(scenario, new Map(), false);
      const arc = locateFoulArc(browser.records, browser.fkFromState);

      // Both runtimes traverse the same driven-duel shape: foul at T, free kick
      // at T+60, same awarding team, same contact spot.
      expect(headlessFoulTick).not.toBeNull();
      expect(arc).not.toBeNull();
      expect(arc!.foulTick).toBe(headlessFoulTick);
      expect(arc!.fk.tick).toBe(headlessFoulTick! + FREE_KICK_COUNTDOWN);
      expect(headlessFk).toBeDefined();
      const hp = headlessFk!.payload as { teamId: string; freeKickPosition: { x: number; y: number } };
      expect(arc!.fk.teamId).toBe(hp.teamId);
      expect(
        planarDistance(arc!.fk.freeKickPosition.x, arc!.fk.freeKickPosition.y, hp.freeKickPosition.x, hp.freeKickPosition.y),
      ).toBeLessThan(0.01);
    },
    { timeout: 120_000 },
  );

  it(
    "semantic frames are non-blank with luminance and color variance",
    async () => {
      const scenario = withProximateHumanDefence(await loadScenario());
      const bridge = createTestBridge(container, scenario, undefined, {
        ...DEFAULT_RENDERER_CONFIG,
        cameraPosition: CAMERA.position,
        cameraTarget: CAMERA.target,
        cameraFov: CAMERA_FOV,
        showMatchPhaseHud: true,
      }, { awardFreeKicks: true });
      await bridge.reset();
      // Step to the free-kick award (postTick 51) with the driven-duel wiring
      // (the human slot must be driven by the scripted tackle policy, so
      // stepWithCpuControllers alone is not sufficient).
      const sim0 = bridge.getSimulation();
      const slots0 = cpuSlots(scenario);
      const human0 = humanSlot(scenario);
      for (let i = 0; i < 51; i++) {
        sim0.applyInputs(sampleFrames(sim0, slots0, human0, sim0.tick));
        sim0.step();
      }
      for (const entry of slots0) entry.adapter.reset();
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
    },
    { timeout: 120_000 },
  );
});
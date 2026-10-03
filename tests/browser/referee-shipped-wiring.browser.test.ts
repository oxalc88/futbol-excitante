/**
 * @module tests/browser/referee-shipped-wiring.browser.test
 *
 * DYNAMIC_VISUAL evidence capture for REFEREE-SHIPPED-WIRING: the referee loop
 * (foul → free kick, and the accumulating booking) visible in the REAL shipped
 * app — real Chromium + real Three renderer through the accepted test bridge.
 *
 * The fixture is the accepted driven-duel shape (`5v5-human-vs-cpu.v1.json` +
 * `withProximateHumanDefence`), driven by the SAME repeated scripted
 * standing-tackle policy the headless defensive-duel driver uses.  With BOTH
 * accepted gates live through the SAME `createSimulation` config surface the
 * shipped composition root now exposes (awardFreeKicks + issueCards), the core:
 *
 *   - commits a man-not-ball tackle contact (spec §5.1) and awards a free kick
 *     to the fouled team at the contact position through the accepted restart
 *     machinery (FOUL-CONSEQUENCE-MACHINERY);
 *   - accumulates the fouls and issues a CAUTION when the offending player's
 *     count reaches the `fouls-v1` threshold (CARD-MACHINERY).
 *
 * Both the foul and the booking are REAL core events (the shared foul predicate
 * → the in-core consequence), never scripted theater.
 *
 * Frames (before → event → transition → result, event-centered on the referee
 * consequence), all from the SAME deterministic single run:
 *   - foul-contact      (foul1 - 1): the man-not-ball tackle contact — the
 *     defender and carrier are in contact, ball in play, "PLAYING".
 *   - freekick-award    (foul1 + 1): the free kick awarded — the phase turns
 *     "FREE KICK", the ball is re-placed at the contact spot.
 *   - freekick-served   (fk1 + 2):    the ball served back into play along the
 *     committed kick direction, "PLAYING".
 *   - foul-2-contact    (foul2 - 1): the 2nd man-not-ball contact, still
 *     "PLAYING" before the booking.
 *   - caution           (foul2):       the book is issued — the card HUD draws
 *     the yellow notice (presentation-only enrichment), and the 2nd free kick
 *     is awarded (phase "FREE KICK").
 *
 * The renderer HUD (`showMatchPhaseHud` + `showCardHud`) is the opt-in surface
 * the shipped composition root enables exactly when the Referee toggle is on.
 * All frames are byte-distinct over the captured PNG bytes.
 *
 * Capture hygiene (0.9.2+): durable screenshots are written only in evidence
 * mode (`WIP_SECTION=__EVIDENCE__:REFEREE-SHIPPED-WIRING`); an ordinary run
 * writes under the ignored `test-results/gauntlet-capture/**` tree and leaves
 * `docs/` byte-identical.  The record carries NO wall-clock field.
 *
 * No Math.random, wall clock, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { commands } from "@vitest/browser/context";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import {
  DEFAULT_RENDERER_CONFIG,
  enrichPresentationWithCards,
} from "../../src/adapters/renderer-three/renderer.js";
import { withProximateHumanDefence } from "../../eval/scenarios/proximate-5v5.js";
import { runDefensiveDuel } from "../../eval/runners/defensive-duel-driver.js";
import { isFoulCandidateEvent } from "../../src/simulation/foul-predicate.js";
import { FOUNDATION_TACKLE_V1 } from "../../src/simulation/config/foundation.js";
import {
  createCpuAdapter,
  buildCpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { STANDING_TACKLE_BIT } from "../../src/contracts/input.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";

const OBJECTIVE_ID = "REFEREE-SHIPPED-WIRING";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const OUTPUT_REL = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
const SEQUENCE_REL = `${OUTPUT_REL}/sequence.json`;

const SCENARIO_PATH = "eval/scenarios/5v5-human-vs-cpu.v1.json";
/**
 * The driven-duel observation window.  With BOTH gates live the free-kick
 * countdown spaces the fouls (~60 ticks each); the 2nd foul (→ caution) lands
 * at ~290, so 320 gives margin.  The test locates the arc from the run's own
 * event log, so a drift is an assertion failure, never a silent re-capture.
 */
const PLAY_TICKS = 320;
/** Repeated scripted standing-tackle attempts (the accepted driven-duel shape). */
const DRIVEN_ATTEMPTS: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
for (let t = 44; t <= 300; t += 16) {
  DRIVEN_ATTEMPTS.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
}
/** One scripted standing-tackle attempt reach (accepted tackle geometry). */
const COMMIT_DISTANCE = 3.0;

/**
 * Static presentation-only framing, identical for every frame so the sequence
 * stays comparable.  Aimed at the central contact area where the fouls, the
 * free kick, and the booking happen.  The renderer consumes immutable
 * snapshots, so framing cannot move a football.
 */
const CAMERA = { position: { x: 0, y: 36, z: 48 }, target: { x: -4, y: 0, z: 0 } };
const CAMERA_FOV = 46;

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
 * Per-tick driven-duel wiring: the CPU slots through the same adapter +
 * team-decision profile the browser composition root uses, and the HUMAN slot
 * through the SAME repeated scripted standing-tackle policy (attempt queue,
 * lock-out, release window) the headless defensive-duel driver uses — so the
 * committed foul/free-kick/card ticks match the accepted reference stream.
 */
function buildDrivenOutcome(
  sim: Simulation,
  slots: CpuSlot[],
  human: { controlSlot: string; playerId: string },
  attempts: Array<{ kind: "standing"; commitDistance: number; earliestTick?: number }>,
  driverState: {
    nextAttempt: number;
    lastAttemptReleaseTick: number;
    lockoutTick: number;
    lockoutBits: number;
  },
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
    const frame = entry.adapter.sample(sim.tick, obs);
    frame.controlSlot = entry.controlSlot;
    return frame;
  });

  // --- HUMAN slot: scripted repeated standing-tackle policy --------------
  let moveX = 0;
  let moveY = 0;
  let held = 0;
  let pressed = 0;
  const tick = sim.tick;
  const humanPlayer = snapshot.players.find((p) => p.playerId === human.playerId);
  if (humanPlayer) {
    const ball = snapshot.ball;
    let carrier: { x: number; y: number } | null = null;
    let carrierDist = Number.POSITIVE_INFINITY;
    for (const p of snapshot.players) {
      if (p.teamId === humanPlayer.teamId) continue;
      const d = planarDistance(p.groundPosition.x, p.groundPosition.y, ball.position.x, ball.position.y);
      if (d < carrierDist) { carrierDist = d; carrier = { x: p.groundPosition.x, y: p.groundPosition.y }; }
    }
    const chaseX = carrier !== null && carrierDist < 3 ? carrier.x : ball.position.x;
    const chaseY = carrier !== null && carrierDist < 3 ? carrier.y : ball.position.y;
    const dx = chaseX - humanPlayer.groundPosition.x;
    const dy = chaseY - humanPlayer.groundPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.01) { moveX = dx / dist; moveY = dy / dist; }

    const distToBall = planarDistance(
      humanPlayer.groundPosition.x, humanPlayer.groundPosition.y,
      ball.position.x, ball.position.y,
    );

    if (driverState.lockoutTick === tick) {
      pressed |= driverState.lockoutBits;
      held |= driverState.lockoutBits;
    } else if (driverState.nextAttempt < attempts.length && carrier !== null) {
      const attempt = attempts[driverState.nextAttempt];
      const bits = STANDING_TACKLE_BIT;
      const commitAt = attempt.commitDistance ?? FOUNDATION_TACKLE_V1.standingReach.value;
      const inRange =
        distToBall <= commitAt &&
        planarDistance(
          humanPlayer.groundPosition.x, humanPlayer.groundPosition.y,
          carrier.x, carrier.y,
        ) <= commitAt;
      const timingOk = attempt.earliestTick === undefined || tick >= attempt.earliestTick;
      const clearOfPrevious =
        driverState.lastAttemptReleaseTick < 0 || tick > driverState.lastAttemptReleaseTick;
      if (inRange && timingOk && clearOfPrevious) {
        pressed |= bits;
        held |= bits;
        const windows =
          FOUNDATION_TACKLE_V1.standingPrepareTicks.value +
          FOUNDATION_TACKLE_V1.standingActiveTicks.value +
          FOUNDATION_TACKLE_V1.standingRecoverTicks.value;
        driverState.lastAttemptReleaseTick = tick + windows;
        driverState.nextAttempt += 1;
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

interface CommittedCard {
  tick: number;
  cardType: string;
  playerId: string;
  accumulatedFouls: number;
}

interface RefereeRun {
  records: TickFacts[];
  captured: string[];
  freeKickEvents: Array<{ tick: number; teamId: string; freeKickPosition: { x: number; y: number }; kickDirection: { x: number; y: number } }>;
  cardEvents: CommittedCard[];
  bookingState: Record<string, { fouls: number; cautions: number; expulsions: number }> | null;
}

function committedCards(snapshot: ReturnType<Simulation["snapshot"]>): CommittedCard[] {
  const out: CommittedCard[] = [];
  for (const ev of snapshot.events) {
    if (ev.kind !== "card-issued") continue;
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    out.push({
      tick: ev.tick,
      cardType: p.cardType as string,
      playerId: p.playerId as string,
      accumulatedFouls: p.accumulatedFouls as number,
    });
  }
  return out;
}

function cardEventsAll(snapshot: ReturnType<Simulation["snapshot"]>) {
  return snapshot.events
    .filter((e) => e.kind === "card-issued")
    .map((e) => ({ id: e.id, tick: e.tick, kind: e.kind, label: e.label }));
}

async function playMatch(
  scenario: ScenarioDefinition,
  renderAt: Map<number, { label: string; enrich: boolean }>,
  render: boolean,
  gatesOn = true,
): Promise<RefereeRun> {
  const bridge = createTestBridge(
    container,
    scenario,
    undefined,
    {
      ...DEFAULT_RENDERER_CONFIG,
      cameraPosition: CAMERA.position,
      cameraTarget: CAMERA.target,
      cameraFov: CAMERA_FOV,
      showMatchPhaseHud: true,
      showCardHud: gatesOn,
    },
    gatesOn ? { awardFreeKicks: true } : undefined,
    gatesOn ? { issueCards: true } : undefined,
  );
  await bridge.reset();
  const sim = bridge.getSimulation();
  const slots = cpuSlots(scenario);
  const human = humanSlot(scenario);
  const driverState = { nextAttempt: 0, lastAttemptReleaseTick: -1, lockoutTick: -1, lockoutBits: 0 };

  const records: TickFacts[] = [];
  const captured: string[] = [];

  for (let i = 0; i < PLAY_TICKS; i++) {
    sim.applyInputs(buildDrivenOutcome(sim, slots, human, DRIVEN_ATTEMPTS, driverState));
    const result = sim.step();
    const snapshot = sim.snapshot();
    const presentation = sim.presentation();

    let fouledTeamId: string | null = null;
    for (const ev of result.events) {
      if (!isFoulCandidateEvent(ev)) continue;
      fouledTeamId = ((ev.payload ?? {}) as { teamIdB?: string }).teamIdB ?? null;
    }

    records.push({
      tick: sim.tick,
      stateHash: result.stateHash,
      matchPhase: presentation.matchPhase,
      matchTimer: presentation.matchTimer,
      ball: {
        x: Number(snapshot.ball.position.x.toFixed(4)),
        y: Number(snapshot.ball.position.y.toFixed(4)),
        regime: snapshot.ball.regime,
      },
      fouledTeamId,
    });

    const plan = renderAt.get(sim.tick);
    if (render && plan) {
      const base = sim.presentation();
      const view = plan.enrich ? enrichPresentationWithCards(base, cardEventsAll(snapshot)) : base;
      const cap = await bridge.capture(view);
      const base64 = cap.screenshot.split(",")[1] ?? "";
      if (!base64 || base64.length < 100) throw new Error(`renderer produced no PNG bytes for ${plan.label}`);
      await commands.writeFile(`${OUTPUT_REL}/${plan.label}.png`, base64, "base64");
      captured.push(plan.label);
    }
  }

  for (const entry of slots) entry.adapter.reset();

  const finalSnap = sim.snapshot();
  const freeKickEvents = finalSnap.events
    .filter((e) => e.kind === "free-kick-executed")
    .map((e) => {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      return {
        tick: e.tick,
        teamId: p.teamId as string,
        freeKickPosition: p.freeKickPosition as { x: number; y: number },
        kickDirection: p.kickDirection as { x: number; y: number },
      };
    });
  const cardEvents = committedCards(finalSnap);
  bridge.getPresentationSession().dispose();

  return {
    records,
    captured,
    freeKickEvents,
    cardEvents,
    bookingState: finalSnap.bookings ?? null,
  };
}

// ---------------------------------------------------------------------------
// Locate the referee arc from the run's own event log
// ---------------------------------------------------------------------------

interface RefereeArc {
  foulTicks: number[];
  firstFreeKick: { tick: number; teamId: string; freeKickPosition: { x: number; y: number }; kickDirection: { x: number; y: number } } | null;
  caution: CommittedCard | null;
  foulCount: number;
  cardCount: number;
}

function locateRefereeArc(run: RefereeRun): RefereeArc {
  const foulTicks = run.records.filter((r) => r.fouledTeamId !== null).map((r) => r.tick);
  const firstFreeKick = run.freeKickEvents[0] ?? null;
  const caution = run.cardEvents.find((c) => c.cardType === "caution") ?? null;
  return {
    foulTicks,
    firstFreeKick,
    caution,
    foulCount: foulTicks.length,
    cardCount: run.cardEvents.length,
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

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

describe("REFEREE-SHIPPED-WIRING: the shipped referee loop (foul → free kick → booking) frames", () => {
  it(
    "drives a real foul → free kick → caution in a single run and captures 5 byte-distinct event-centered frames",
    async () => {
      if (DURABLE_EVIDENCE) await assertEvidenceMutable();
      const scenario = withProximateHumanDefence(await loadScenario());
      expect(scenario.players.length).toBe(10);

      // Pass 1 — locate the referee arc from the run's own event log (no rendering).
      const first = await playMatch(scenario, new Map(), false);
      const arc = locateRefereeArc(first);
      expect(arc.foulCount, "the driven run never committed a man-not-ball foul").toBeGreaterThanOrEqual(2);
      expect(arc.firstFreeKick, "no free kick was awarded for the committed fouls").not.toBeNull();
      expect(arc.caution, "the accumulated fouls never reached the caution threshold").not.toBeNull();
      expect(arc.caution!.cardType).toBe("caution");
      expect(arc.caution!.accumulatedFouls).toBe(2);

      const [foul1, foul2] = arc.foulTicks;
      const fk1 = arc.firstFreeKick!;
      const caution = arc.caution!;
      // The free-kick countdown (60) spaces the award from its execute; the
      // caution is committed on the same tick as its 2nd foul.
      expect(fk1.tick - foul1).toBe(60);
      expect(caution.tick).toBe(foul2);
      expect(foul2).toBeGreaterThan(foul1);

      const plan = [
        {
          label: "foul-contact",
          tick: Math.max(1, foul1 - 1),
          semantic: "before",
          description: "Man-not-ball tackle contact (the first foul): the defending body commits a standing tackle on the carrier — both in contact, the ball still in play (PLAYING) before the free kick is awarded",
        },
        {
          label: "freekick-award",
          tick: foul1 + 1,
          semantic: "event",
          description: `Free kick awarded for the first foul: the phase turns FREE KICK, the ball is re-placed at the contact position (${fk1.teamId} awarded)`,
        },
        {
          label: "freekick-served",
          tick: fk1.tick + 2,
          semantic: "result",
          description: "Served free kick: the ball is back in play off the contact spot along the committed kick direction, the phase is PLAYING again",
        },
        {
          label: "foul-2-contact",
          tick: Math.max(1, foul2 - 1),
          semantic: "transition",
          description: "The 2nd man-not-ball tackle contact (the offending player's 2nd accumulated foul) — still PLAYING before the booking",
        },
        {
          label: "caution",
          tick: foul2,
          semantic: "result",
          description: `Caution (yellow) issued on the 2nd accumulated foul: the card consequence issues a caution to ${caution.playerId} (accumulated ${caution.accumulatedFouls}); the card HUD draws the yellow booking and the 2nd free kick is awarded (phase FREE KICK)`,
        },
      ];
      const ticks = plan.map((f) => f.tick);
      expect(new Set(ticks).size, "frame ticks must be distinct").toBe(plan.length);
      for (const [index, tick] of ticks.entries()) {
        expect(tick).toBeGreaterThanOrEqual(1);
        expect(tick).toBeLessThan(PLAY_TICKS);
        if (index > 0) expect(tick).toBeGreaterThan(ticks[index - 1]);
      }
      console.log(
        `[referee-wiring] frames ${ticks.join("/")} fouls=${arc.foulTicks.join("/")} ` +
          `fk1@${fk1.tick} caution@${caution.tick} (durable=${DURABLE_EVIDENCE})`,
      );

      // Pass 2 — replay the same wiring and render the five frames.
      const renderAt = new Map(plan.map((f) => [f.tick, { label: f.label, enrich: f.label === "caution" }]));
      const second = await playMatch(scenario, renderAt, true);
      expect(second.captured).toEqual(plan.map((f) => f.label));
      // Deterministic replay: the same committed hash chain.
      expect(second.records.map((r) => r.stateHash)).toEqual(first.records.map((r) => r.stateHash));
      const arc2 = locateRefereeArc(second);
      expect(arc2.foulTicks).toEqual(arc.foulTicks);
      expect(arc2.firstFreeKick).toEqual(arc.firstFreeKick);
      expect(arc2.caution).toEqual(arc.caution);

      // Semantic invariants at the captured ticks (the browser-visible binding).
      const contactRec = second.records.find((r) => r.tick === Math.max(1, foul1 - 1))!;
      const awardRec = second.records.find((r) => r.tick === foul1 + 1)!;
      const servedRec = second.records.find((r) => r.tick === fk1.tick + 2)!;
      const foul2Rec = second.records.find((r) => r.tick === Math.max(1, foul2 - 1))!;
      const cautionRec = second.records.find((r) => r.tick === foul2)!;
      expect(contactRec.matchPhase).toBe("playing");
      expect(awardRec.matchPhase).toBe("free-kick");
      expect(
        planarDistance(awardRec.ball.x, awardRec.ball.y, fk1.freeKickPosition.x, fk1.freeKickPosition.y),
      ).toBeLessThan(0.01);
      expect(servedRec.matchPhase).toBe("playing");
      expect(
        planarDistance(servedRec.ball.x, servedRec.ball.y, fk1.freeKickPosition.x, fk1.freeKickPosition.y),
      ).toBeGreaterThan(0.05);
      expect(foul2Rec.matchPhase).toBe("playing");
      // The caution is committed on the 2nd foul tick; the booking facts appear
      // in the committed card events (the same source the card HUD enrichment uses).
      expect(
        second.cardEvents.some((c) => c.cardType === "caution" && c.accumulatedFouls === 2),
      ).toBe(true);

      // Pass 3 — the SAME wiring with both gates OFF (the accepted default) never
      // produces the free-kick phase or a committed card / booking.
      const stashed = await playMatch(scenario, new Map(), false, false);
      expect(stashed.records.some((r) => r.matchPhase === "free-kick")).toBe(false);
      expect(stashed.freeKickEvents.length).toBe(0);
      expect(stashed.cardEvents.length).toBe(0);
      expect(stashed.bookingState).toBeNull();

      // Pass 4 — hash the PNGs; the five frames must be distinct images.
      const pngHashes: string[] = [];
      for (const frame of plan) pngHashes.push(await sha256OfFile(`${OUTPUT_REL}/${frame.label}.png`));
      expect(new Set(pngHashes).size, "the five frames must be byte-distinct images").toBe(plan.length);

      // Write the semantic sequence metadata.
      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        semantic_order:
          "man-not-ball foul contact -> free-kick award -> served free kick -> 2nd foul contact -> caution (yellow) issued",
        durable_capture: DURABLE_EVIDENCE,
        scenario: scenario.id,
        scenario_path: SCENARIO_PATH,
        rendering: {
          surface: "src/apps/browser/test-bridge.ts + real Three renderer (Chromium), same createSimulation config surface the shipped composition root uses",
          hud: "showMatchPhaseHud:true + showCardHud:true (curated FREE KICK label + yellow booking notice, presentation-only enrichment)",
        },
        arc: {
          foul_ticks: arc.foulTicks,
          foul_count: arc.foulCount,
          card_count: arc.cardCount,
          first_free_kick: {
            tick: fk1.tick,
            teamId: fk1.teamId,
            free_kick_position: fk1.freeKickPosition,
            kick_direction: fk1.kickDirection,
          },
          caution: {
            tick: caution.tick,
            cardType: caution.cardType,
            accumulatedFouls: caution.accumulatedFouls,
            playerId: caution.playerId,
          },
          booking_state: first.bookingState,
        },
        frames: plan.map((frame) => {
          const idx = plan.findIndex((f) => f.label === frame.label);
          return {
            label: frame.label,
            path: `${frame.label}.png`,
            tick: frame.tick,
            semantic: frame.semantic,
            description: frame.description,
            sha256: pngHashes[idx],
          };
        }),
      };
      await commands.writeFile(SEQUENCE_REL, `${JSON.stringify(sequence, null, 2)}\n`, "utf-8");

      (window as unknown as Record<string, string>).__refereeArc = JSON.stringify(arc);
    },
    { timeout: 120_000 },
  );

  it(
    "the browser foul/free-kick/caution ticks correspond to the headless defensive-duel run",
    async () => {
      const scenario = withProximateHumanDefence(await loadScenario());
      const headless = runDefensiveDuel({
        scenario,
        maxTicks: PLAY_TICKS,
        attempts: DRIVEN_ATTEMPTS,
        freeKickConfig: { awardFreeKicks: true },
        cardConfig: { issueCards: true },
      });

      const browser = await playMatch(scenario, new Map(), false);
      const arc = locateRefereeArc(browser);

      const headlessFoulTicks = headless.events.filter((e) => isFoulCandidateEvent(e)).map((e) => e.tick);
      const headlessFk = headless.freeKickEvents[0];
      const headlessCaution = headless.cardEvents.find((e) => (e.payload as { cardType?: string }).cardType === "caution");

      // Both runtimes traverse the same driven-duel shape with the SAME gates:
      // foul at T → free kick at T+60, 2nd foul at T' → caution, same offender.
      expect(arc.foulCount).toBe(headlessFoulTicks.length);
      expect(arc.firstFreeKick!.tick).toBe(headlessFk.tick);
      expect(arc.firstFreeKick!.tick).toBe(headlessFoulTicks[0] + 60);
      expect(arc.caution!.tick).toBe(headlessCaution!.tick);
      expect(arc.caution!.accumulatedFouls).toBe((headlessCaution!.payload as { accumulatedFouls: number }).accumulatedFouls);
      expect(arc.caution!.playerId).toBe((headlessCaution!.payload as { playerId: string }).playerId);
    },
    { timeout: 120_000 },
  );

  it(
    "semantic frames are non-blank with luminance and color variance",
    async () => {
      const scenario = withProximateHumanDefence(await loadScenario());
      const locateRun = await playMatch(scenario, new Map(), false);
      const arc = locateRefereeArc(locateRun);
      const foul1 = arc.foulTicks[0];
      const awardTick = foul1 + 1;

      const bridge = createTestBridge(container, scenario, undefined, {
        ...DEFAULT_RENDERER_CONFIG,
        cameraPosition: CAMERA.position,
        cameraTarget: CAMERA.target,
        cameraFov: CAMERA_FOV,
        showMatchPhaseHud: true,
        showCardHud: true,
      }, { awardFreeKicks: true }, { issueCards: true });
      await bridge.reset();
      const sim = bridge.getSimulation();
      const slots = cpuSlots(scenario);
      const human = humanSlot(scenario);
      const driverState = { nextAttempt: 0, lastAttemptReleaseTick: -1, lockoutTick: -1, lockoutBits: 0 };
      for (let i = 0; i < awardTick; i++) {
        sim.applyInputs(buildDrivenOutcome(sim, slots, human, DRIVEN_ATTEMPTS, driverState));
        sim.step();
      }
      for (const entry of slots) entry.adapter.reset();
      bridge.renderFrame();
      const capture = await bridge.capture();
      const base64Data = capture.screenshot.split(",")[1] ?? "";
      expect(base64Data.length).toBeGreaterThan(1000);
      bridge.getPresentationSession().dispose();

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

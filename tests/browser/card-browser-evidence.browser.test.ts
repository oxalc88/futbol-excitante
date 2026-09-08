/**
 * @module tests/browser/card-browser-evidence.browser.test
 *
 * DYNAMIC_VISUAL evidence capture for CARD-BROWSER-EVIDENCE: the horizon's
 * observable browser capability — a real booking (caution → expulsion) in the
 * shipped app (real Chromium + real Three renderer through the accepted test
 * bridge).
 *
 * The fixture is the accepted CARD-MACHINERY driven-duel shape:
 * `eval/scenarios/5v5-human-vs-cpu.v1.json` with `withProximateHumanDefence`
 * (the HUMAN team parked a fixed distance behind the ball), driven by the SAME
 * repeated scripted standing-tackle policy the headless defensive-duel driver
 * uses.  With the accepted `issueCards` gate live, the core commits five
 * man-not-ball tackle contacts (spec §5.1) and, over the `fouls-v1` accumulation
 * thresholds, issues a CAUTION on the 2nd foul and an EXPULSION on the 5th.
 * Both the fouls and the cards are REAL core events (the shared foul predicate →
 * the in-core card consequence), never scripted theater.
 *
 * Frames (before → event → transition → transition → result, event-centered on
 * the qualifying foul → booking consequence):
 *   - foul-1-contact  (postTick 66):  the first man-not-ball tackle contact —
 *     the offending body (player-1) commits a standing tackle on the carrier,
 *     no card yet.
 *   - caution         (postTick 116): the 2nd foul — the CAUTION is issued;
 *     the card HUD draws the yellow booking.
 *   - continued-foul  (postTick 173): a further foul (the 3rd), the player
 *     stays booked while the accumulation continues.
 *   - foul-4-contact  (postTick 276): the 4th foul, accumulation ongoing.
 *   - expulsion       (postTick 371): the 5th foul — the EXPULSION is issued;
 *     the card HUD draws the red booking on top of the yellow.
 *
 * The renderer card HUD (`showCardHud`) is the opt-in presentation affordance.
 * It is draw-only and reads the immutable snapshot's `events` array; because
 * the simulation's derived presentation leaves `events` empty (a card event is
 * commit-only to `state.events`), the capture passes a presentation-only
 * enrichment (`enrichPresentationWithCards`) that copies the committed card
 * events into the snapshot.  When the gate is OFF (the default) there are no
 * card events, the enrichment is a no-op, and the render is byte-neutral; the
 * affordance itself is off by default (`showCardHud: false`).
 *
 * The frame ticks and the card facts are fixed ONLY by the accepted
 * CARD-MACHINERY driven-duel stream (fouls at 66/116/173/276/371, caution at
 * 116, expulsion at 371); the test locates them from the run's own committed
 * event log rather than hard-coding them, so a drift in the driven shape would
 * surface as a hard failure.
 *
 * Capture hygiene (0.9.2+): durable screenshots are written only in evidence
 * mode (`WIP_SECTION=__EVIDENCE__:CARD-BROWSER-EVIDENCE`); an ordinary run
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

const OBJECTIVE_ID = "CARD-BROWSER-EVIDENCE";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const OUTPUT_REL = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
const SEQUENCE_REL = `${OUTPUT_REL}/sequence.json`;
const TRAJECTORY_REL = DURABLE_EVIDENCE
  ? `docs/evidence/${OBJECTIVE_ID}/trajectory.json`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}/trajectory.json`;

const SCENARIO_PATH = "eval/scenarios/5v5-human-vs-cpu.v1.json";
/** The driven-duel observation window (the 5th foul lands at 371; ample). */
const PLAY_TICKS = 420;
/** Repeated scripted standing-tackle attempts (the accepted driven-duel shape). */
const DRIVEN_ATTEMPTS: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
for (let t = 44; t <= 400; t += 16) {
  DRIVEN_ATTEMPTS.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
}
/** One scripted standing-tackle attempt reach (accepted tackle geometry). */
const COMMIT_DISTANCE = 3.0;

/**
 * Static presentation-only framing, identical for every frame so the sequence
 * stays comparable.  Aimed at the central contact area where the fouls and the
 * bookings happen (the proximate 5v5 shape keeps play near x≈-6..0).  The
 * renderer consumes immutable snapshots, so framing cannot move a football.
 */
const CAMERA = { position: { x: 0, y: 38, z: 52 }, target: { x: -4, y: 0, z: 0 } };
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

function tackleBit(kind: "standing" | "slide"): number {
  return kind === "standing" ? STANDING_TACKLE_BIT : 0;
}

/**
 * Per-tick driven-duel wiring: the CPU slots through the same adapter +
 * team-decision profile the browser composition root uses, and the HUMAN slot
 * through the SAME repeated scripted standing-tackle policy (attempt queue,
 * lock-out, release window) the headless defensive-duel driver uses — so the
 * committed foul ticks match the accepted CARD-MACHINERY stream exactly.
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
      const bits = tackleBit(attempt.kind);
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

interface CommittedCard {
  tick: number;
  cardType: string;
  playerId: string;
  fouledPlayerId: string;
  accumulatedFouls: number;
  foulSourceEventId: string;
  foulTick: number;
}

interface TickFacts {
  tick: number;
  stateHash: string;
  matchPhase: string;
  matchTimer: number;
  /** Team of the fouled player when this tick committed a man-not-ball foul. */
  fouledTeamId: string | null;
}

interface CardRun {
  records: TickFacts[];
  captured: string[];
  bookingState: Record<string, { fouls: number; cautions: number; expulsions: number }> | null;
  /** Every committed card-issued event (read from the persistent state). */
  cardEvents: CommittedCard[];
}

/** All committed card-issued events in a snapshot's persistent state. */
function cardEventsAll(
  snapshot: ReturnType<Simulation["snapshot"]>,
): Array<{ id: string; tick: number; kind: string; label: string }> {
  const out: Array<{ id: string; tick: number; kind: string; label: string }> = [];
  for (const ev of snapshot.events) {
    if (ev.kind !== "card-issued") continue;
    out.push({ id: ev.id, tick: ev.tick, kind: ev.kind, label: ev.label });
  }
  return out;
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
      fouledPlayerId: p.fouledPlayerId as string,
      accumulatedFouls: p.accumulatedFouls as number,
      foulSourceEventId: p.foulSourceEventId as string,
      foulTick: p.foulTick as number,
    });
  }
  return out;
}

async function playMatch(
  scenario: ScenarioDefinition,
  renderAt: Map<number, { label: string; enrich: boolean }>,
  render: boolean,
  issueCards = true,
): Promise<CardRun> {
  const bridge = createTestBridge(container, scenario, undefined, {
    ...DEFAULT_RENDERER_CONFIG,
    cameraPosition: CAMERA.position,
    cameraTarget: CAMERA.target,
    cameraFov: CAMERA_FOV,
    showMatchPhaseHud: true,
    showCardHud: true,
  }, undefined, { issueCards });
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
    const presentation = sim.presentation();

    // Foul commitment: a man-not-ball player-player-contact in the per-step
    // events (the shared predicate).
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
      fouledTeamId,
    });

    const plan = renderAt.get(sim.tick);
    if (render && plan) {
      // Card enrichment: read the committed card events from the persistent
      // state as of THIS tick (a card event is commit-only to state.events), so
      // the booking notice reflects the booking committed so far.
      const snapshot = sim.snapshot();
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
  bridge.getPresentationSession().dispose();

  const finalSnap = sim.snapshot();
  return {
    records,
    captured,
    bookingState: finalSnap.bookings ?? null,
    cardEvents: committedCards(finalSnap),
  };
}

// ---------------------------------------------------------------------------
// Locate the card arc from the run's own event log
// ---------------------------------------------------------------------------

interface CardArc {
  foulTicks: number[];
  caution: CommittedCard | null;
  expulsion: CommittedCard | null;
  foulCount: number;
  cardCount: number;
}

function locateCardArc(records: TickFacts[], cardEvents: CommittedCard[]): CardArc {
  const foulTicks = records.filter((r) => r.fouledTeamId !== null).map((r) => r.tick);
  const caution = cardEvents.find((c) => c.cardType === "caution") ?? null;
  const expulsion = cardEvents.find((c) => c.cardType === "expulsion") ?? null;
  return { foulTicks, caution, expulsion, foulCount: foulTicks.length, cardCount: cardEvents.length };
}

interface FramePlan {
  label: string;
  tick: number;
  semantic: string;
  description: string;
}

function framePlan(arc: CardArc): FramePlan[] {
  const [f1, f2, f3, f4, f5] = arc.foulTicks;
  return [
    {
      label: "foul-1-contact",
      tick: f1,
      semantic: "before",
      description:
        "Qualifying foul contact: the offending body (player-1) commits a man-not-ball standing tackle on the carrier — both in contact, the ball still in play (PLAYING), and no card yet (1st accumulated foul)",
    },
    {
      label: "caution",
      tick: f2,
      semantic: "event",
      description:
        `Caution (yellow) issued on the 2nd accumulated foul: the shared predicate recognizes the man-not-ball contact and the card consequence issues a caution to ${arc.caution?.playerId ?? "player-1"} ` +
        `(fouled ${arc.caution?.fouledPlayerId ?? "player-10"}, accumulated ${arc.caution?.accumulatedFouls ?? 2}); the card HUD shows the yellow booking`,
    },
    {
      label: "continued-foul",
      tick: f3,
      semantic: "transition",
      description:
        "Continued fouls: the player commits a further man-not-ball tackle (the 3rd accumulated foul) while still booked — the accumulation continues toward the red threshold",
    },
    {
      label: "foul-4-contact",
      tick: f4,
      semantic: "transition",
      description:
        "The 4th accumulated foul: the recurring man-not-ball tackle contact keeps the booking state live (still one yellow), one foul short of the expulsion",
    },
    {
      label: "expulsion",
      tick: f5,
      semantic: "result",
      description:
        `Expulsion (red) issued on the 5th accumulated foul: the card consequence issues an expulsion to ${arc.expulsion?.playerId ?? "player-1"} ` +
        `(fouled ${arc.expulsion?.fouledPlayerId ?? "player-9"}, accumulated ${arc.expulsion?.accumulatedFouls ?? 5}); the card HUD shows the red booking`,
    },
  ];
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

describe("CARD-BROWSER-EVIDENCE: booking (caution → expulsion) frames", () => {
  it(
    "drives a real 5-foul → caution@2 → expulsion@5 booking and captures 5 byte-distinct event-centered frames",
    async () => {
      if (DURABLE_EVIDENCE) await assertEvidenceMutable();
      const scenario = withProximateHumanDefence(await loadScenario());
      expect(scenario.players.length).toBe(10);

      // Pass 1 — locate the card arc from the run's own event log (no rendering).
      const first = await playMatch(scenario, new Map(), false);
      const arc = locateCardArc(first.records, first.cardEvents);
      expect(arc.foulCount, "the browser driven-duel never produced the 5-foul card arc").toBe(5);
      expect(arc.cardCount, "the 5-foul arc must issue 2 cards").toBe(2);
      expect(arc.caution, "no caution was issued on the 2nd foul").not.toBeNull();
      expect(arc.expulsion, "no expulsion was issued on the 5th foul").not.toBeNull();
      expect(arc.caution!.cardType).toBe("caution");
      expect(arc.expulsion!.cardType).toBe("expulsion");
      // The accepted CARD-MACHINERY thresholds: caution at accumulated 2, expulsion at 5.
      expect(arc.caution!.accumulatedFouls).toBe(2);
      expect(arc.expulsion!.accumulatedFouls).toBe(5);
      // The card is committed on the same tick as its foul.
      expect(arc.caution!.tick).toBe(arc.caution!.foulTick);
      expect(arc.expulsion!.tick).toBe(arc.expulsion!.foulTick);
      // Booking state accumulates for the offending player.
      expect(first.bookingState?.[arc.caution!.playerId]?.fouls).toBe(5);
      expect(first.bookingState?.[arc.caution!.playerId]?.cautions).toBe(1);
      expect(first.bookingState?.[arc.caution!.playerId]?.expulsions).toBe(1);

      const plan = framePlan(arc);
      const ticks = plan.map((f) => f.tick);
      expect(new Set(ticks).size, "frame ticks must be distinct").toBe(plan.length);
      for (const [index, tick] of ticks.entries()) {
        expect(tick).toBeGreaterThanOrEqual(1);
        expect(tick).toBeLessThan(PLAY_TICKS);
        if (index > 0) expect(tick).toBeGreaterThan(ticks[index - 1]);
      }
      console.log(
        `[card-browser-evidence] frames ${ticks.join("/")} fouls=${arc.foulTicks.join("/")} ` +
          `caution@${arc.caution!.tick} expulsion@${arc.expulsion!.tick} (durable=${DURABLE_EVIDENCE})`,
      );

      // Pass 2 — replay the same wiring and render the five frames (enriched).
      const renderAt = new Map(plan.map((f) => [f.tick, { label: f.label, enrich: true }]));
      const second = await playMatch(scenario, renderAt, true);
      expect(second.captured).toEqual(plan.map((f) => f.label));
      // Deterministic replay: the same committed hash chain.
      expect(second.records.map((r) => r.stateHash)).toEqual(first.records.map((r) => r.stateHash));
      expect(locateCardArc(second.records, second.cardEvents)).toEqual(arc);

      // Semantic invariants at the captured ticks (the browser-visible binding).
      const cautionRec = second.records.find((r) => r.tick === arc.caution!.tick)!;
      const expulsionRec = second.records.find((r) => r.tick === arc.expulsion!.tick)!;
      // The caution is committed at the 2nd accumulated foul tick; the expulsion
      // at the 5th.  The card events are read from the persistent committed
      // state (commit-only), i.e. the same enrichment source the card HUD uses.
      expect(
        second.cardEvents.some((c) => c.cardType === "caution" && c.accumulatedFouls === 2),
      ).toBe(true);
      expect(
        second.cardEvents.some((c) => c.cardType === "expulsion" && c.accumulatedFouls === 5),
      ).toBe(true);
      // The booking facts appear exactly on their committed tick.
      expect(arc.caution!.tick).toBe(arc.foulTicks[1]);
      expect(arc.expulsion!.tick).toBe(arc.foulTicks[4]);
      // The card consequence does NOT change the match phase (it stays playing).
      expect(cautionRec.matchPhase).toBe("playing");
      expect(expulsionRec.matchPhase).toBe("playing");

      // Pass 3 — the same wiring with the issueCards gate OFF (the accepted
      // default) never produces a booking: no card event, no bookings field.
      const stashed = await playMatch(scenario, new Map(), false, false);
      const stashedArc = locateCardArc(stashed.records, stashed.cardEvents);
      expect(stashedArc.cardCount, "the gate-off run must not issue cards").toBe(0);
      expect(stashed.bookingState, "the gate-off run must keep bookings absent").toBeNull();

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
          "qualifying foul contact -> caution (yellow) issued -> continued fouls -> 4th foul -> expulsion (red) issued",
        durable_capture: DURABLE_EVIDENCE,
        scenario: scenario.id,
        scenario_path: SCENARIO_PATH,
        rendering: {
          surface: "src/apps/browser/test-bridge.ts + real Three renderer (Chromium)",
          hud: "showMatchPhaseHud:true + showCardHud:true (curated card booking notice, presentation-only enrichment)",
        },
        arc: {
          foul_ticks: arc.foulTicks,
          fouling_player_id: arc.caution!.playerId,
          caution: {
            tick: arc.caution!.tick,
            cardType: arc.caution!.cardType,
            accumulatedFouls: arc.caution!.accumulatedFouls,
            fouledPlayerId: arc.caution!.fouledPlayerId,
          },
          expulsion: {
            tick: arc.expulsion!.tick,
            cardType: arc.expulsion!.cardType,
            accumulatedFouls: arc.expulsion!.accumulatedFouls,
            fouledPlayerId: arc.expulsion!.fouledPlayerId,
          },
          booking_state: first.bookingState,
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

      (window as unknown as Record<string, string>).__cardArc = JSON.stringify(arc);
    },
    { timeout: 120_000 },
  );

  it(
    "the browser card ticks correspond to the headless defensive-duel run",
    async () => {
      const scenario = withProximateHumanDefence(await loadScenario());
      const headless = runDefensiveDuel({
        scenario,
        maxTicks: PLAY_TICKS,
        attempts: DRIVEN_ATTEMPTS,
        cardConfig: { issueCards: true },
      });

      const browser = await playMatch(scenario, new Map(), false);
      const arc = locateCardArc(browser.records, browser.cardEvents);

      expect(headless.cardEvents.length).toBe(2);
      const headlessCaution = headless.cardEvents.find((e) => (e.payload as { cardType?: string }).cardType === "caution")!;
      const headlessExpulsion = headless.cardEvents.find((e) => (e.payload as { cardType?: string }).cardType === "expulsion")!;
      const hp = (e: unknown) => (e as { payload?: Record<string, unknown> }).payload ?? {};

      // Both runtimes traverse the same driven-duel shape: 5 fouls, caution at
      // the 2nd (accumulated 2), expulsion at the 5th (accumulated 5), same tick
      // as their foul, same offender / fouled player.
      expect(arc.foulCount).toBe(5);
      expect(arc.caution!.tick).toBe(headlessCaution.tick);
      expect(arc.expulsion!.tick).toBe(headlessExpulsion.tick);
      expect(arc.caution!.accumulatedFouls).toBe(hp(headlessCaution).accumulatedFouls as number);
      expect(arc.expulsion!.accumulatedFouls).toBe(hp(headlessExpulsion).accumulatedFouls as number);
      expect(arc.caution!.playerId).toBe(hp(headlessCaution).playerId as string);
      expect(arc.expulsion!.playerId).toBe(hp(headlessExpulsion).playerId as string);
      expect(arc.caution!.fouledPlayerId).toBe(hp(headlessCaution).fouledPlayerId as string);
      expect(arc.expulsion!.fouledPlayerId).toBe(hp(headlessExpulsion).fouledPlayerId as string);
    },
    { timeout: 120_000 },
  );

  it(
    "semantic frames are non-blank with luminance and color variance, and the card HUD is off-by-default byte-neutral",
    async () => {
      const scenario = withProximateHumanDefence(await loadScenario());
      // The card HUD is OFF by default (the default renderer config): render the
      // caution tick with showCardHud absent and confirm the HUD stays the
      // baseline 128px-high (the pre-affordance value) and the frame is non-blank.
      const locateRun = await playMatch(scenario, new Map(), false);
      const cautionTick = locateCardArc(locateRun.records, locateRun.cardEvents).caution!.tick;
      const bridge = createTestBridge(container, scenario, undefined, {
        ...DEFAULT_RENDERER_CONFIG,
        cameraPosition: CAMERA.position,
        cameraTarget: CAMERA.target,
        cameraFov: CAMERA_FOV,
        showMatchPhaseHud: true,
      }, undefined, { issueCards: true });
      await bridge.reset();
      const sim = bridge.getSimulation();
      const slots = cpuSlots(scenario);
      const human = humanSlot(scenario);
      const driverState = { nextAttempt: 0, lastAttemptReleaseTick: -1, lockoutTick: -1, lockoutBits: 0 };
      for (let i = 0; i < cautionTick; i++) {
        sim.applyInputs(buildDrivenOutcome(sim, slots, human, DRIVEN_ATTEMPTS, driverState));
        sim.step();
      }
      for (const entry of slots) entry.adapter.reset();
      // No card HUD is drawn (showCardHud off): the HUD height stays 128.
      const hudCam = bridge.getPresentationSession().getHudCamera();
      expect(hudCam).not.toBeNull();
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
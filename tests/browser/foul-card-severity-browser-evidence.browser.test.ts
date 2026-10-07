/**
 * @module tests/browser/foul-card-severity-browser-evidence.browser.test
 *
 * DYNAMIC_VISUAL evidence capture for FOUL-CARD-BROWSER-EVIDENCE: the
 * contact-severity DIRECT red (FOULS_CARDS_SPEC §7 / §9.1 / §10) visible in the
 * shipped app (real Chromium + real Three renderer through the accepted test
 * bridge).
 *
 * The fixture is the accepted CARD-MACHINERY driven-duel shape:
 * `eval/scenarios/5v5-human-vs-cpu.v1.json` with `withProximateHumanDefence`,
 * driven through the SAME per-tick wiring the accepted card browser test uses
 * (CPU slots through the cpu-adapter + team-decision profile, the HUMAN slot
 * through the scripted tackle policy of the headless defensive-duel driver).
 * The scripted shape here is the FOUL-CARD-SEVERITY slide: ONE sliding tackle
 * (commitDistance 4.0 — deep inside the versioned slide reach 2.8 m). With the
 * accepted default-OFF gates live (issueCards + awardFreeKicks), the core
 * commits a man-not-ball slide contact whose COMMITTED severity crosses the
 * exported `fouls-v1` §9.1 threshold
 * (`FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD` 0.85, src/simulation/card-policy.ts)
 * and issues a DIRECT expulsion at the foul tick — independent of the
 * accumulation ladder. The foul, the card, and the free kick are REAL core
 * events (the shared foul predicate → the in-core consequences), never
 * scripted theater.
 *
 * Frames (before → event, event-centered on the foul contact tick and the
 * direct-red card HUD tick — the same committed tick):
 *   - slide-contact   (foul tick − 1): the sliding lunge closing on the
 *     carrier, the ball still in play (PLAYING), no card yet.
 *   - direct-red      (the foul tick): the committed slide man-not-ball
 *     contact crosses the §9.1 severity threshold; the core issues the DIRECT
 *     red to the offender on that same tick and the card HUD draws the RED
 *     CARD notice (presentation-only enrichment, the accepted card-HUD path).
 *
 * In-test controls (the FOUL-CARD-SEVERITY producer's shapes, browser-visible):
 *   - standing-tackle control: repeated standing tackles below the threshold →
 *     the §7 accumulation caution only, NO direct red;
 *   - gate-off shape: the identical slide with the card gate OFF → no card
 *     event, no bookings field.
 *
 * The frame ticks and the card facts are located from the run's own committed
 * event log rather than hard-coded, so a drift in the driven shape surfaces as
 * a hard failure.
 *
 * Capture hygiene (0.9.2+): durable screenshots are written only in evidence
 * mode (`WIP_SECTION=__EVIDENCE__:FOUL-CARD-BROWSER-EVIDENCE`); an ordinary run
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
import type { DefensiveDuelResult } from "../../eval/runners/defensive-duel-driver.js";
import { isFoulCandidateEvent } from "../../src/simulation/foul-predicate.js";
import { FOUNDATION_TACKLE_V1 } from "../../src/simulation/config/foundation.js";
import {
  createCpuAdapter,
  buildCpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { STANDING_TACKLE_BIT, SLIDE_TACKLE_BIT } from "../../src/contracts/input.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";

const OBJECTIVE_ID = "FOUL-CARD-BROWSER-EVIDENCE";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const OUTPUT_REL = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
const SEQUENCE_REL = `${OUTPUT_REL}/sequence.json`;

const SCENARIO_PATH = "eval/scenarios/5v5-human-vs-cpu.v1.json";
/** Observation window: the slide foul lands at tick 52 and the FK serve at 112; ample. */
const PLAY_TICKS = 200;
/** The scripted slide attempt (the FOUL-CARD-SEVERITY SLIDE_ATTEMPTS shape). */
const SLIDE_ATTEMPTS: Array<{ kind: "slide"; commitDistance: number; earliestTick: number }> = [
  { kind: "slide", commitDistance: 4.0, earliestTick: 48 },
];
/** The standing-tackle control attempts (the FOUL-CARD-SEVERITY standing shape). */
const STANDING_ATTEMPTS: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
for (let t = 44; t <= 100; t += 16) {
  STANDING_ATTEMPTS.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
}
/** The standing control's 2nd foul (and the accumulation caution) lands at 290; ample. */
const STANDING_TICKS = 320;
/** The accepted in-core free-kick countdown (free-kick-executed = foul + 60). */
const FREE_KICK_COUNTDOWN = 60;

/**
 * Static presentation-only framing, identical for every frame so the sequence
 * stays comparable.  Aimed at the central contact area where the slide foul
 * and the direct red happen (the proximate 5v5 shape keeps play near x≈-6..0).
 * The renderer consumes immutable snapshots, so framing cannot move a football.
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
 * through the SAME scripted tackle policy (attempt queue, lock-out, release
 * window) the headless defensive-duel driver uses — so the committed foul tick
 * matches the FOUL-CARD-SEVERITY driven stream exactly.  The slide bit is the
 * SLIDE_TACKLE_BIT (1<<7): the standing helper's bit mask covers the standing
 * control, and a slide press sets the slide bit only.
 */
function buildDrivenOutcome(
  sim: Simulation,
  slots: CpuSlot[],
  human: { controlSlot: string; playerId: string },
  attempts: Array<{ kind: "standing" | "slide"; commitDistance: number; earliestTick?: number }>,
  driverState: {
    nextAttempt: number;
    lastAttemptReleaseTick: number;
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

  // --- HUMAN slot: scripted tackle policy (standing or slide) ------------
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

    if (driverState.nextAttempt < attempts.length && carrier !== null) {
      const attempt = attempts[driverState.nextAttempt];
      const bits = attempt.kind === "slide" ? SLIDE_TACKLE_BIT : tackleBit("standing");
      const commitAt = attempt.commitDistance;
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
          attempt.kind === "slide"
            ? FOUNDATION_TACKLE_V1.slidePrepareTicks.value +
              FOUNDATION_TACKLE_V1.slideActiveTicks.value +
              FOUNDATION_TACKLE_V1.slideRecoverTicks.value
            : FOUNDATION_TACKLE_V1.standingPrepareTicks.value +
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
  cardReason: string;
  playerId: string;
  fouledPlayerId: string;
  accumulatedFouls: number;
  directRedSeverity: number | null;
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

function committedCards(snapshot: ReturnType<Simulation["snapshot"]>): CommittedCard[] {
  const out: CommittedCard[] = [];
  for (const ev of snapshot.events) {
    if (ev.kind !== "card-issued") continue;
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    out.push({
      tick: ev.tick,
      cardType: p.cardType as string,
      cardReason: (p.cardReason as string) ?? "",
      playerId: p.playerId as string,
      fouledPlayerId: p.fouledPlayerId as string,
      accumulatedFouls: p.accumulatedFouls as number,
      directRedSeverity: typeof p.directRedSeverity === "number" ? p.directRedSeverity : null,
      foulTick: p.foulTick as number,
    });
  }
  return out;
}

async function playMatch(
  scenario: ScenarioDefinition,
  attempts: Array<{ kind: "standing" | "slide"; commitDistance: number; earliestTick?: number }>,
  renderAt: Map<number, { label: string; enrich: boolean }>,
  render: boolean,
  issueCards = true,
  ticks = PLAY_TICKS,
): Promise<CardRun> {
  const bridge = createTestBridge(container, scenario, undefined, {
    ...DEFAULT_RENDERER_CONFIG,
    cameraPosition: CAMERA.position,
    cameraTarget: CAMERA.target,
    cameraFov: CAMERA_FOV,
    showMatchPhaseHud: true,
    showCardHud: true,
  }, { awardFreeKicks: true }, { issueCards });
  await bridge.reset();
  const sim = bridge.getSimulation();
  const slots = cpuSlots(scenario);
  const human = humanSlot(scenario);
  const driverState = { nextAttempt: 0, lastAttemptReleaseTick: -1 };

  const records: TickFacts[] = [];
  const captured: string[] = [];

  for (let i = 0; i < ticks; i++) {
    sim.applyInputs(buildDrivenOutcome(sim, slots, human, attempts, driverState));
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

// ---------------------------------------------------------------------------
// Locate the card arc from the run's own event log
// ---------------------------------------------------------------------------

interface SeverityArc {
  foulTicks: number[];
  directRed: CommittedCard | null;
  foulCount: number;
  cardCount: number;
}

function locateSeverityArc(records: TickFacts[], cardEvents: CommittedCard[]): SeverityArc {
  const foulTicks = records.filter((r) => r.fouledTeamId !== null).map((r) => r.tick);
  const directRed = cardEvents.find((c) => c.cardReason === "direct-severity") ?? null;
  return { foulTicks, directRed, foulCount: foulTicks.length, cardCount: cardEvents.length };
}

interface FramePlan {
  label: string;
  tick: number;
  semantic: string;
  description: string;
}

function framePlan(arc: SeverityArc): FramePlan[] {
  return [
    {
      label: "slide-contact",
      tick: Math.max(1, arc.foulTicks[0] - 1),
      semantic: "before",
      description:
        "The sliding lunge closing on the carrier: the offending body (player-1) has committed the slide deep inside the versioned slide reach (commitDistance 4.0) — the ball still in play (PLAYING), no card yet",
    },
    {
      label: "direct-red",
      tick: arc.foulTicks[0],
      semantic: "event",
      description:
        `DIRECT red at the foul tick: the committed slide man-not-ball contact (fouled ${arc.directRed?.fouledPlayerId ?? "player-10"}) ` +
        `has a normalized contact severity ${arc.directRed?.directRedSeverity?.toFixed(3) ?? ">= 0.85"} crossing the fouls-v1 §9.1 threshold 0.85, ` +
        `so the core issues a direct expulsion to ${arc.directRed?.playerId ?? "player-1"} independent of the accumulation ladder; ` +
        "the card HUD draws the RED CARD notice",
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

/**
 * Count the RED-CARD notice pixels in a captured frame (the browser-visible
 * card-HUD binding for FOUL-CARD-BROWSER-EVIDENCE).
 *
 * The direct-red label is commit-only to the core's persistent state, so the
 * pixel plane is the honest observable: the renderer's card HUD draws the
 * direct-red notice in `#ff4040` (bold monospace) inside the top-left HUD box
 * (a screen-space sprite; the WebGL capture is flipped, so the notice sits
 * near the TOP of the image).  A pixel counts only when it is DOMINATED by
 * red — the pitch, kit, and white/yellow HUD text cannot produce it.
 */
async function countRedCardHudPixels(rootRelativePath: string): Promise<number> {
  const base64Data = await commands.readFile(rootRelativePath, "base64");
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to decode screenshot image: ${rootRelativePath}`));
    img.src = `data:image/png;base64,${base64Data.trim()}`;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  let red = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // The notice's #ff4040 arrives through the renderer's sRGB output as
    // ≈(255,137,137); nothing else on the pitch/HUD is red-dominated like it.
    if (r >= 230 && g >= 110 && g <= 170 && Math.abs(g - b) <= 15) red++;
  }
  return red;
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

describe("FOUL-CARD-BROWSER-EVIDENCE: contact-severity direct-red frames", () => {
  it(
    "drives a real slide foul → direct red and captures 2 byte-distinct event-centered frames",
    async () => {
      if (DURABLE_EVIDENCE) await assertEvidenceMutable();
      const scenario = withProximateHumanDefence(await loadScenario());
      expect(scenario.players.length).toBe(10);

      // Pass 1 — locate the severity arc from the run's own event log (no rendering).
      const first = await playMatch(scenario, SLIDE_ATTEMPTS, new Map(), false);
      const arc = locateSeverityArc(first.records, first.cardEvents);
      expect(arc.foulCount, "the browser driven-duel never produced the slide foul").toBe(1);
      expect(arc.directRed, "the deep slide contact did not cross the §9.1 threshold — no direct red").not.toBeNull();
      expect(arc.cardCount, "the slide run must issue exactly the direct red").toBe(1);
      expect(arc.directRed!.cardType).toBe("expulsion");
      expect(arc.directRed!.cardReason).toBe("direct-severity");
      expect(arc.directRed!.directRedSeverity).toBeGreaterThanOrEqual(0.85);
      // The direct red is NOT an accumulation card: it is committed on the same
      // tick as its foul, on the first recognized foul of the offender.
      expect(arc.directRed!.tick).toBe(arc.foulTicks[0]);
      expect(arc.directRed!.tick).toBe(arc.directRed!.foulTick);
      expect(arc.directRed!.accumulatedFouls).toBe(1);
      // Booking state records the direct expulsion.
      expect(first.bookingState?.[arc.directRed!.playerId]?.fouls).toBe(1);
      expect(first.bookingState?.[arc.directRed!.playerId]?.cautions).toBe(0);
      expect(first.bookingState?.[arc.directRed!.playerId]?.expulsions).toBe(1);

      const plan = framePlan(arc);
      const ticks = plan.map((f) => f.tick);
      expect(new Set(ticks).size, "frame ticks must be distinct").toBe(plan.length);
      for (const [index, tick] of ticks.entries()) {
        expect(tick).toBeGreaterThanOrEqual(1);
        expect(tick).toBeLessThan(PLAY_TICKS);
        if (index > 0) expect(tick).toBeGreaterThan(ticks[index - 1]);
      }
      console.log(
        `[foul-card-severity-browser-evidence] frames ${ticks.join("/")} foul=${arc.foulTicks.join("/")}` +
          ` directRed@${arc.directRed!.tick} severity=${arc.directRed!.directRedSeverity} (durable=${DURABLE_EVIDENCE})`,
      );

      // Pass 2 — replay the same wiring and render the two frames (enriched).
      const renderAt = new Map(plan.map((f) => [f.tick, { label: f.label, enrich: true }]));
      const second = await playMatch(scenario, SLIDE_ATTEMPTS, renderAt, true);
      expect(second.captured).toEqual(plan.map((f) => f.label));
      // Deterministic replay: the same committed hash chain.
      expect(second.records.map((r) => r.stateHash)).toEqual(first.records.map((r) => r.stateHash));
      expect(locateSeverityArc(second.records, second.cardEvents)).toEqual(arc);

      // Semantic invariants at the captured ticks (the browser-visible binding).
      const contactRec = second.records.find((r) => r.tick === plan[0].tick)!;
      const redRec = second.records.find((r) => r.tick === plan[1].tick)!;
      // The contact frame: the slide is closing, the ball still in play.
      expect(contactRec.matchPhase).toBe("playing");
      expect(contactRec.fouledTeamId).toBeNull();
      // The direct-red frame: the foul is committed and the card consequence
      // issues the direct expulsion on the SAME tick. Within the step the card
      // is evaluated while the phase is still playing (6b-3c before 6b-4), and
      // the free-kick consequence then claims the phase on that same tick — so
      // the committed presentation reads FREE KICK (the window serves at
      // foul + 60 through its own gate).
      expect(redRec.matchPhase).toBe("free-kick");
      expect(redRec.fouledTeamId).not.toBeNull();
      expect(
        second.cardEvents.some(
          (c) => c.cardReason === "direct-severity" && c.tick === redRec.tick && c.tick === c.foulTick,
        ),
      ).toBe(true);

      // Pass 3 — the standing-tackle control (below the threshold): the only
      // card is the §7 accumulation caution; NO direct red is committed.
      const standing = await playMatch(scenario, STANDING_ATTEMPTS, new Map(), false, true, STANDING_TICKS);
      const standingArc = locateSeverityArc(standing.records, standing.cardEvents);
      expect(standingArc.foulCount, "the standing control must commit fouls").toBeGreaterThan(0);
      expect(standingArc.cardCount, "the standing control must issue the accumulation caution only").toBe(1);
      expect(standing.cardEvents[0].cardType).toBe("caution");
      expect(standing.cardEvents[0].cardReason).toBe("");
      expect(standingArc.directRed, "the standing control must NOT cross the severity threshold").toBeNull();
      expect(standing.bookingState?.[standing.cardEvents[0].playerId]?.expulsions).toBe(0);

      // Pass 4 — the gate-off shape (the accepted default): the identical slide
      // with the issueCards gate OFF never produces a booking.
      const stashed = await playMatch(scenario, SLIDE_ATTEMPTS, new Map(), false, false);
      const stashedArc = locateSeverityArc(stashed.records, stashed.cardEvents);
      expect(stashedArc.cardCount, "the gate-off run must not issue cards").toBe(0);
      expect(stashed.bookingState, "the gate-off run must keep bookings absent").toBeNull();

      // Pass 5 — hash the PNGs; the two frames must be distinct images.
      const pngHashes: string[] = [];
      for (const frame of plan) pngHashes.push(await sha256OfFile(`${OUTPUT_REL}/${frame.label}.png`));
      expect(new Set(pngHashes).size, "the two frames must be byte-distinct images").toBe(plan.length);

      // Pass 6 — the direct-red HUD frame must actually carry the RED CARD
      // notice: the HUD sprite draws the #ff4040 red text inside the top-left
      // HUD box (a screen-space ortho sprite; the canvas is flipped, so the
      // HUD text region sits near the TOP of the captured image).  The
      // pre-card frame must NOT carry that red notice.
      const redPixels = await countRedCardHudPixels(`${OUTPUT_REL}/direct-red.png`);
      const prePixels = await countRedCardHudPixels(`${OUTPUT_REL}/slide-contact.png`);
      expect(redPixels, "the direct-red frame must carry the RED CARD notice pixels").toBeGreaterThan(20);
      expect(prePixels, "the pre-card frame must not carry the RED CARD notice").toBe(0);

      // Write the semantic sequence metadata.
      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        semantic_order:
          "slide lunge closing -> direct red (contact severity crosses fouls-v1 §9.1 threshold 0.85) at the foul tick",
        durable_capture: DURABLE_EVIDENCE,
        scenario: scenario.id,
        scenario_path: SCENARIO_PATH,
        rendering: {
          surface: "src/apps/browser/test-bridge.ts + real Three renderer (Chromium)",
          hud: "showMatchPhaseHud:true + showCardHud:true (curated card booking notice, presentation-only enrichment)",
        },
        arc: {
          foul_ticks: arc.foulTicks,
          fouling_player_id: arc.directRed!.playerId,
          direct_red: {
            tick: arc.directRed!.tick,
            cardType: arc.directRed!.cardType,
            cardReason: arc.directRed!.cardReason,
            directRedSeverity: arc.directRed!.directRedSeverity,
            accumulatedFouls: arc.directRed!.accumulatedFouls,
            fouledPlayerId: arc.directRed!.fouledPlayerId,
          },
          booking_state: first.bookingState,
          controls: {
            standing_tackle: {
              foul_ticks: standingArc.foulTicks,
              card_count: standingArc.cardCount,
              card_type: standing.cardEvents[0]?.cardType ?? null,
              direct_red: standingArc.directRed !== null,
            },
            gate_off: {
              card_count: stashedArc.cardCount,
              bookings_present: stashed.bookingState !== null,
            },
          },
        },
        frames: plan.map((frame, index) => ({
          label: frame.label,
          path: `${frame.label}.png`,
          tick: frame.tick,
          semantic: frame.semantic,
          description: frame.description,
          sha256: pngHashes[index],
        })),
      };
      await commands.writeFile(SEQUENCE_REL, `${JSON.stringify(sequence, null, 2)}\n`, "utf-8");

      (window as unknown as Record<string, string>).__severityArc = JSON.stringify(arc);
    },
    { timeout: 120_000 },
  );

  it(
    "the browser direct-red tick corresponds to the headless defensive-duel run",
    async () => {
      const scenario = withProximateHumanDefence(await loadScenario());
      const headless: DefensiveDuelResult = runDefensiveDuel({
        scenario,
        maxTicks: PLAY_TICKS,
        attempts: SLIDE_ATTEMPTS,
        cardConfig: { issueCards: true },
        freeKickConfig: { awardFreeKicks: true },
      });

      const browser = await playMatch(scenario, SLIDE_ATTEMPTS, new Map(), false);
      const arc = locateSeverityArc(browser.records, browser.cardEvents);

      expect(arc.foulCount).toBe(1);
      expect(arc.directRed).not.toBeNull();
      const hp = (e: unknown) => (e as { payload?: Record<string, unknown> }).payload ?? {};
      const headlessCards = headless.cardEvents;
      expect(headlessCards.length, "the headless slide run must issue exactly the direct red").toBe(1);
      const headlessDirect = headlessCards.find(
        (e) => (hp(e).cardReason as string) === "direct-severity",
      )!;
      expect(headlessDirect).toBeDefined();
      const headlessFoulTick = headless.events.find((e) => isFoulCandidateEvent(e))!.tick;

      // Both runtimes traverse the same driven-duel shape: the slide foul at
      // the same tick, the direct red committed at that same foul tick, same
      // offender / fouled player, same committed severity.
      expect(arc.foulTicks[0]).toBe(headlessFoulTick);
      expect(arc.directRed!.tick).toBe(headlessDirect.tick);
      expect(arc.directRed!.tick).toBe(arc.directRed!.foulTick);
      expect(arc.directRed!.playerId).toBe(hp(headlessDirect).playerId as string);
      expect(arc.directRed!.fouledPlayerId).toBe(hp(headlessDirect).fouledPlayerId as string);
      expect(arc.directRed!.accumulatedFouls).toBe(hp(headlessDirect).accumulatedFouls as number);
      expect(arc.directRed!.directRedSeverity).toBe(hp(headlessDirect).directRedSeverity as number);
    },
    { timeout: 120_000 },
  );
});

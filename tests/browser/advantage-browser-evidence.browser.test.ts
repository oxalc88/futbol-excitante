/**
 * @module tests/browser/advantage-browser-evidence.browser.test
 *
 * DYNAMIC_VISUAL evidence capture for ADVANTAGE-BROWSER-EVIDENCE: the
 * accepted §6.2 advantage window visible in the shipped browser app through
 * the existing menu-visible Referee toggle (real Chromium + real Three
 * renderer through the accepted test bridge, driven with the SAME resolved
 * wiring the composition root threads: `resolveRefereeWiring(true)` =
 * awardFreeKicks + issueCards + playAdvantage on one createSimulation call).
 *
 * The fixture is the accepted driven-duel shape (the REFEREE-SHIPPED-WIRING /
 * FOUL-FREEKICK-BROWSER-EVIDENCE precedent):
 * `eval/scenarios/5v5-human-vs-cpu.v1.json` with `withProximateHumanDefence`,
 * the same repeated scripted standing-tackle policy, PLAY_TICKS 380.  With all
 * three shipped gates live the core commits a man-not-ball foul at tick 66 and
 * again at 289; the first window closes at 67 (§6.3 last-touch loss) and the
 * SECOND window (289 → 308) stays open for 19 ticks of live play — the
 * framable window.  It closes by `cancelled-last-touch-loss` (§6.3) and the
 * pending foul is called at the CLOSE tick: the FREE KICK phase and the
 * deferred caution (the offender's 2nd accumulated foul) land at 308, the
 * serve at 368.  Nothing is forced or synthesized: the window decision is the
 * accepted in-core ADVANTAGE-MACHINERY branch reading the accepted committed
 * facts.  The §6.2a judged-retained path is NOT implemented and NOT claimed;
 * the run discloses which close reason occurred (cancellation).
 *
 * Frames (before → event → transition → close → result, event-centered on the
 * window open → play-continues → deferred-call transition):
 *   - foul-contact       (openTick-1): the standing tackle is on the carrier,
 *     the ball live, phase PLAYING — nothing called yet.
 *   - advantage-open     (openTick): the foul-contact tick — the window OPENS
 *     and the foul is NOT called: still PLAYING, ball live (gate-off would
 *     already be in the free-kick phase here).
 *   - advantage-window   (openTick+8): play CONTINUES inside the 24-tick
 *     budget — PLAYING, the ball live and moving, NO FREE KICK HUD.
 *   - advantage-close    (closeTick): the window CLOSES (cancellation) and the
 *     pending foul is called at the close tick: phase FREE KICK + deferred
 *     caution.
 *   - freekick-placement (closeTick+4): the deferred set piece settled at the
 *     contact position with the curated FREE KICK HUD.
 *
 * Capture hygiene (0.9.2+): durable screenshots are written only in evidence
 * mode (`WIP_SECTION=__EVIDENCE__:ADVANTAGE-BROWSER-EVIDENCE`); an ordinary
 * run writes under the ignored `test-results/gauntlet-capture/**` tree and
 * leaves `docs/` byte-identical.  The record carries NO wall-clock field.
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
import { ADVANTAGE_WINDOW_TICKS } from "../../src/simulation/advantage-policy.js";
import { FOUNDATION_TACKLE_V1 } from "../../src/simulation/config/foundation.js";
import {
  createCpuAdapter,
  buildCpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { STANDING_TACKLE_BIT } from "../../src/contracts/input.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";

const OBJECTIVE_ID = "ADVANTAGE-BROWSER-EVIDENCE";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const OUTPUT_REL = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
const SEQUENCE_REL = `${OUTPUT_REL}/sequence.json`;

const SCENARIO_PATH = "eval/scenarios/5v5-human-vs-cpu.v1.json";
/**
 * The driven-duel observation window.  With all three shipped gates live the
 * fouls land at 66 and ~289; the 2nd window (the framable one) closes by §6.3
 * last-touch loss at ~308 and the deferred free kick executes at ~368, so 380
 * gives margin.  The test locates the arc from the run's own committed event
 * log, so a drift is an assertion failure, never a silent re-capture.
 */
const PLAY_TICKS = 380;
/** Repeated scripted standing-tackle attempts (the accepted driven-duel shape). */
const DRIVEN_ATTEMPTS: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
for (let t = 44; t <= 300; t += 16) {
  DRIVEN_ATTEMPTS.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
}
/** The accepted in-core free-kick countdown (free-kick-executed = call + 60). */
const FREE_KICK_COUNTDOWN = 60;

/**
 * Static presentation-only framing, identical for every frame so the sequence
 * stays comparable.  Aimed at the left-channel contact area (x≈-6.7, y≈2.8)
 * where the window opens and the deferred call lands.  The renderer consumes
 * immutable snapshots, so framing cannot move a football.
 */
const CAMERA = { position: { x: -6, y: 32, z: 46 }, target: { x: -7, y: 0, z: 3 } };
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
 * committed foul / window / free-kick ticks match the accepted reference
 * stream (ADVANTAGE-MACHINERY driven shape).
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
  ball: { x: number; y: number; regime: string };
}

interface CommittedCard {
  tick: number;
  cardType: string;
  playerId: string;
  accumulatedFouls: number;
}

interface AdvantageWindowFact {
  openTick: number;
  closeTick: number;
  reason: string;
  windowTicks: number;
  fouledTeam: string;
  offenderId: string | null;
  pendingFoulCount: number;
}

interface RefereeRun {
  records: TickFacts[];
  captured: string[];
  foulTicks: number[];
  freeKickEvents: Array<{ tick: number; teamId: string; freeKickPosition: { x: number; y: number }; kickDirection: { x: number; y: number } }>;
  cardEvents: CommittedCard[];
  advantageWindows: AdvantageWindowFact[];
  advantageEventCount: number;
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

/**
 * Pair each committed `advantage-opened` with the close that reports its open
 * tick (the same pairing the accepted ADVANTAGE-MACHINERY record uses).  The
 * decision events are commit-only to the core's persistent state — read them
 * off the final snapshot, never off the per-step event array.
 */
function advantageWindowsFrom(events: readonly SimulationEvent[]): AdvantageWindowFact[] {
  const opens = events.filter((e) => e.kind === "advantage-opened");
  const closes = events.filter((e) => e.kind === "advantage-cancelled" || e.kind === "advantage-expired");
  const out: AdvantageWindowFact[] = [];
  for (const open of opens) {
    const op = (open.payload ?? {}) as Record<string, unknown>;
    const close = closes.find(
      (c) => ((c.payload ?? {}) as Record<string, unknown>).openTick === op.openTick,
    );
    if (!close) continue;
    const cp = (close.payload ?? {}) as Record<string, unknown>;
    out.push({
      openTick: op.openTick as number,
      closeTick: cp.closeTick as number,
      reason: cp.reason as string,
      windowTicks: cp.windowTicks as number,
      fouledTeam: op.fouledTeam as string,
      offenderId: (op.offenderId as string | null | undefined) ?? null,
      pendingFoulCount: cp.pendingFoulCount as number,
    });
  }
  return out;
}

/**
 * The four wiring shapes the evidence compares:
 *   - `on`          — `resolveRefereeWiring(true)`: all three shipped gates live.
 *   - `no-advantage`— the accepted HEAD referee wiring (free kick + card, the
 *                     advantage gate absent): the control that proves the
 *                     deferral comes from the playAdvantage gate.
 *   - `off`         — `resolveRefereeWiring(false)`: all three gates undefined
 *                     (the shipped default).
 *   - `bare`        — the HEAD pre-wiring createSimulation call shape (9 args,
 *                     no gate parameters at all), so the same browser runtime
 *                     can prove the referee-off path byte-identical to the
 *                     pre-change composition root.
 */
type Wiring = "on" | "no-advantage" | "off" | "bare";

async function playMatch(
  scenario: ScenarioDefinition,
  renderAt: Map<number, { label: string; enrich: boolean }>,
  render: boolean,
  wiring: Wiring = "on",
): Promise<RefereeRun> {
  const cameraConfig = {
    ...DEFAULT_RENDERER_CONFIG,
    cameraPosition: CAMERA.position,
    cameraTarget: CAMERA.target,
    cameraFov: CAMERA_FOV,
    showMatchPhaseHud: true,
  };
  const bridge = wiring === "bare"
    ? createTestBridge(container, scenario, undefined, cameraConfig)
    : createTestBridge(
        container,
        scenario,
        undefined,
        { ...cameraConfig, showCardHud: wiring === "on" || wiring === "no-advantage" },
        wiring === "on" || wiring === "no-advantage" ? { awardFreeKicks: true } : undefined,
        wiring === "on" || wiring === "no-advantage" ? { issueCards: true } : undefined,
        wiring === "on" ? { playAdvantage: true } : undefined,
      );
  await bridge.reset();
  const sim = bridge.getSimulation();
  const slots = cpuSlots(scenario);
  const human = humanSlot(scenario);
  const driverState = { nextAttempt: 0, lastAttemptReleaseTick: -1, lockoutTick: -1, lockoutBits: 0 };

  const records: TickFacts[] = [];
  const captured: string[] = [];
  const foulTicks: number[] = [];

  for (let i = 0; i < PLAY_TICKS; i++) {
    sim.applyInputs(buildDrivenOutcome(sim, slots, human, DRIVEN_ATTEMPTS, driverState));
    const result = sim.step();
    const snapshot = sim.snapshot();
    const presentation = sim.presentation();

    let fouled = false;
    for (const ev of result.events) {
      if (isFoulCandidateEvent(ev)) fouled = true;
    }
    if (fouled) foulTicks.push(sim.tick);

    records.push({
      tick: sim.tick,
      stateHash: result.stateHash,
      matchPhase: presentation.matchPhase,
      ball: {
        x: Number(snapshot.ball.position.x.toFixed(4)),
        y: Number(snapshot.ball.position.y.toFixed(4)),
        regime: snapshot.ball.regime,
      },
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
  const windows = advantageWindowsFrom(finalSnap.events);
  const advantageEventCount = finalSnap.events.filter(
    (e) => e.kind === "advantage-opened" || e.kind === "advantage-cancelled" || e.kind === "advantage-expired",
  ).length;
  bridge.getPresentationSession().dispose();

  return {
    records,
    captured,
    foulTicks,
    freeKickEvents,
    cardEvents,
    advantageWindows: windows,
    advantageEventCount,
    bookingState: finalSnap.bookings ?? null,
  };
}

// ---------------------------------------------------------------------------
// Locate the advantage arc from the run's own committed event log
// ---------------------------------------------------------------------------

interface AdvantageArc {
  foulTicks: number[];
  /** The window the capture frames: the longest-open committed window. */
  window: AdvantageWindowFact;
  /** The deferred free-kick serve whose award came from this window's close. */
  windowFreeKick: { tick: number; teamId: string; freeKickPosition: { x: number; y: number }; kickDirection: { x: number; y: number } };
  /** The deferred card committed at the window's close tick, if any. */
  closeTickCard: CommittedCard | null;
}

function longestWindow(windows: AdvantageWindowFact[]): AdvantageWindowFact {
  let best: AdvantageWindowFact | null = null;
  for (const w of windows) {
    if (best === null || w.closeTick - w.openTick > best.closeTick - best.openTick) best = w;
  }
  if (best === null) throw new Error("no committed advantage window in the run");
  return best;
}

function locateAdvantageArc(run: RefereeRun): AdvantageArc {
  const win = longestWindow(run.advantageWindows);
  const fk = run.freeKickEvents.find((e) => e.tick === win.closeTick + FREE_KICK_COUNTDOWN);
  if (!fk) throw new Error(`no deferred free-kick serve at closeTick+${FREE_KICK_COUNTDOWN}`);
  const closeTickCard = run.cardEvents.find((c) => c.tick === win.closeTick) ?? null;
  return { foulTicks: run.foulTicks, window: win, windowFreeKick: fk, closeTickCard };
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

describe("ADVANTAGE-BROWSER-EVIDENCE: the shipped Referee toggle plays the §6.2 advantage window (foul → window → deferred call) frames", () => {
  it(
    "drives a real foul → advantage window → deferred free kick in a single run and captures 5 byte-distinct event-centered frames",
    async () => {
      if (DURABLE_EVIDENCE) await assertEvidenceMutable();
      const scenario = withProximateHumanDefence(await loadScenario());
      expect(scenario.players.length).toBe(10);

      // Pass 1 — locate the advantage arc from the run's own committed log (no rendering).
      const first = await playMatch(scenario, new Map(), false);
      const arc = locateAdvantageArc(first);
      expect(arc.foulTicks.length, "the driven run never committed a man-not-ball foul").toBeGreaterThanOrEqual(2);
      const win = arc.window;
      // The window opens ON the committed foul-contact tick (§6.2).
      expect(arc.foulTicks, "the window open tick must be a committed foul tick").toContain(win.openTick);
      // It never closes on its own opening tick and never outlives the budget (§6.2/§6.3).
      expect(win.closeTick).toBeGreaterThan(win.openTick);
      expect(win.closeTick - win.openTick).toBeLessThanOrEqual(win.windowTicks);
      expect(win.windowTicks).toBe(ADVANTAGE_WINDOW_TICKS);
      // The close reason is a committed §6.3/§6.2c decision (this run's window
      // closes by cancellation; no judged-retained path exists or is claimed).
      expect(["cancelled-last-touch-loss", "cancelled-stoppage", "expired"]).toContain(win.reason);

      const open = win.openTick;
      const close = win.closeTick;
      const mid = open + 8; // inside the 24-tick window budget, after live play continued
      const placement = close + 4;
      expect(mid).toBeLessThan(close);
      expect(placement).toBeLessThan(PLAY_TICKS);
      // The deferred consequence applies at the close tick, never retroactively (§6.4).
      expect(arc.windowFreeKick.tick - close).toBe(FREE_KICK_COUNTDOWN);
      // The deferred caution lands on the close tick itself (0 of the 12-tick
      // pending budget withheld; here the offender's 2nd accumulated foul).
      expect(arc.closeTickCard, "no deferred card at the close tick").not.toBeNull();
      expect(arc.closeTickCard!.cardType).toBe("caution");

      const plan = [
        {
          label: "foul-contact",
          tick: open - 1,
          semantic: "before",
          description: "The man-not-ball tackle contact commits on the next tick: the standing tackle is on the carrier, the ball is live, phase PLAYING — the referee has not called anything yet",
        },
        {
          label: "advantage-open",
          tick: open,
          semantic: "event",
          description: `The foul-contact tick: the §6.2 advantage window OPENS here — the free kick is NOT awarded, phase stays PLAYING with the ball live (team-b fouled, offender ${String(win.offenderId)}); with the gate off this tick would already show the FREE KICK phase`,
        },
        {
          label: "advantage-window",
          tick: mid,
          semantic: "transition",
          description: `Play continues while the window is open: tick ${mid} sits ${mid - open} ticks inside the ${win.windowTicks}-tick budget, the phase is PLAYING, the ball is live and moving, and there is NO free-kick award or FREE KICK HUD yet`,
        },
        {
          label: "advantage-close",
          tick: close,
          semantic: "transition",
          description: `The window CLOSES by ${win.reason} at tick ${close} and the pending foul is called at the close tick: the phase turns FREE KICK and the deferred caution (${String(arc.closeTickCard?.playerId)}, 2nd accumulated foul) is committed on this tick`,
        },
        {
          label: "freekick-placement",
          tick: placement,
          semantic: "result",
          description: `The deferred consequence in the shipped app: the ball is placed at the contact position (${arc.windowFreeKick.teamId} awarded) and the curated FREE KICK HUD draws — the same restart machinery as the gate-off award, applied ${close - open} ticks late because the window ran`,
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
        `[advantage-browser] frames ${ticks.join("/")} fouls=${arc.foulTicks.join("/")} ` +
          `window ${open}->${close} reason=${win.reason} fkExec@${arc.windowFreeKick.tick} ` +
          `card@${String(arc.closeTickCard?.tick)} (durable=${DURABLE_EVIDENCE})`,
      );

      // Pass 2 — replay the same wiring and render the five frames.
      const renderAt = new Map(plan.map((f) => [f.tick, { label: f.label, enrich: f.tick >= close }]));
      const second = await playMatch(scenario, renderAt, true);
      expect(second.captured).toEqual(plan.map((f) => f.label));
      // Deterministic replay: the same committed hash chain.
      expect(second.records.map((r) => r.stateHash)).toEqual(first.records.map((r) => r.stateHash));
      const arc2 = locateAdvantageArc(second);
      expect(arc2.window).toEqual(arc.window);
      expect(arc2.windowFreeKick).toEqual(arc.windowFreeKick);
      expect(arc2.closeTickCard).toEqual(arc.closeTickCard);

      // Semantic invariants at the captured ticks (the browser-visible binding).
      const byTick = new Map(second.records.map((r) => [r.tick, r]));
      const beforeRec = byTick.get(open - 1)!;
      const openRec = byTick.get(open)!;
      const midRec = byTick.get(mid)!;
      const closeRec = byTick.get(close)!;
      const placeRec = byTick.get(placement)!;
      // Before and during the window: PLAYING, ball live, NO free-kick phase.
      expect(beforeRec.matchPhase).toBe("playing");
      expect(openRec.matchPhase).toBe("playing");
      expect(midRec.matchPhase).toBe("playing");
      // The ball is live (rolling, not replaced/settled) inside the window and
      // moved between the open tick and the mid-window frame.
      expect(midRec.ball.regime).toBe("ground-roll");
      expect(planarDistance(midRec.ball.x, midRec.ball.y, openRec.ball.x, openRec.ball.y)).toBeGreaterThan(0.01);
      // Nothing was awarded inside the window: the first phase flip after the
      // open tick comes exactly on the close tick.
      for (const r of second.records) {
        if (r.tick > open && r.tick < close) expect(r.matchPhase, `phase at ${r.tick}`).toBe("playing");
      }
      // The close tick calls the foul: the phase flips to the deferred free kick.
      expect(closeRec.matchPhase).toBe("free-kick");
      expect(placeRec.matchPhase).toBe("free-kick");
      expect(
        planarDistance(placeRec.ball.x, placeRec.ball.y, arc.windowFreeKick.freeKickPosition.x, arc.windowFreeKick.freeKickPosition.y),
      ).toBeLessThan(0.01);

      // Pass 3 — the HEAD referee wiring (the accepted REFEREE-SHIPPED-WIRING
      // two-gate shape: awardFreeKicks + issueCards, the advantage gate absent)
      // calls each committed foul IMMEDIATELY: no advantage decision is ever
      // committed and the first free-kick phase flip lands on the foul tick
      // itself (66 → 67), exactly the accepted reference behaviour.  This is
      // the control that isolates the playAdvantage gate as the deferral.
      const noAdv = await playMatch(scenario, new Map(), false, "no-advantage");
      expect(noAdv.advantageEventCount, "the HEAD two-gate wiring must commit no advantage decisions").toBe(0);
      expect(noAdv.advantageWindows.length).toBe(0);
      for (const foul of noAdv.foulTicks) {
        const laterFlip = noAdv.records.find((r) => r.tick > foul && r.matchPhase === "free-kick");
        expect(laterFlip?.tick, `first free-kick flip after foul ${foul}`).toBe(foul + 1);
      }

      // Pass 3b — the referee OFF wiring (the shipped default): all three gates
      // undefined commits no advantage decision and never enters the free-kick
      // phase at all.
      const off = await playMatch(scenario, new Map(), false, "off");
      expect(off.advantageEventCount, "the gate-off run must commit no advantage decisions").toBe(0);
      expect(off.advantageWindows.length).toBe(0);
      expect(off.records.some((r) => r.matchPhase === "free-kick")).toBe(false);

      // Pass 4 — referee-off byte-identity to HEAD inside THIS runtime: the
      // 10-argument call with the resolved undefined gates vs. the 9-argument
      // pre-change call (no gate parameters at all).
      const bare = await playMatch(scenario, new Map(), false, "bare");
      const bareHashes = bare.records.map((r) => r.stateHash);
      const offHashes = off.records.map((r) => r.stateHash);
      expect(bareHashes).toEqual(offHashes);
      expect(bare.advantageEventCount).toBe(0);
      const chainOf = (hashes: string[]) => {
        const joined = hashes.join("");
        const buf = new Uint8Array(joined.length);
        for (let i = 0; i < joined.length; i++) buf[i] = joined.charCodeAt(i);
        return globalThis.crypto.subtle.digest("SHA-256", buf).then(
          (d) => [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join(""),
        );
      };
      const offChain = await chainOf(offHashes);
      const bareChain = await chainOf(bareHashes);
      expect(bareChain).toBe(offChain);

      // Pass 5 — hash the PNGs; the five frames must be distinct images.
      const pngHashes: string[] = [];
      for (const frame of plan) pngHashes.push(await sha256OfFile(`${OUTPUT_REL}/${frame.label}.png`));
      expect(new Set(pngHashes).size, "the five frames must be byte-distinct images").toBe(plan.length);

      // Write the semantic sequence metadata.
      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        semantic_order:
          "tackle contact -> foul tick opens the §6.2 advantage window (no immediate call) -> play continues inside the window -> window closes (" +
          win.reason +
          ") and the pending foul is called: FREE KICK + deferred caution at the close tick -> deferred set-piece placement",
        durable_capture: DURABLE_EVIDENCE,
        scenario: scenario.id,
        scenario_path: SCENARIO_PATH,
        rendering: {
          surface: "src/apps/browser/test-bridge.ts + real Three renderer (Chromium), same createSimulation config surface the shipped composition root uses (resolveRefereeWiring: freeKickConfig + cardConfig + advantageConfig on one call)",
          hud: "showMatchPhaseHud:true + showCardHud:true (curated PLAYING/FREE KICK label + yellow booking notice, presentation-only enrichment)",
        },
        wiring: {
          source: "src/apps/browser/referee-config.ts resolveRefereeWiring(true) — the existing single menu-visible Referee toggle, no new toggle",
          gates: { awardFreeKicks: true, issueCards: true, playAdvantage: true },
        },
        arc: {
          foul_ticks: arc.foulTicks,
          foul_count: arc.foulTicks.length,
          window: {
            open_tick: win.openTick,
            close_tick: win.closeTick,
            open_to_close_ticks: win.closeTick - win.openTick,
            window_ticks_budget: win.windowTicks,
            close_reason: win.reason,
            fouled_team: win.fouledTeam,
            offender_id: win.offenderId,
            pending_foul_count: win.pendingFoulCount,
          },
          all_windows: first.advantageWindows,
          window_free_kick: {
            tick: arc.windowFreeKick.tick,
            teamId: arc.windowFreeKick.teamId,
            free_kick_position: arc.windowFreeKick.freeKickPosition,
            kick_direction: arc.windowFreeKick.kickDirection,
            call_tick: close,
            countdown: FREE_KICK_COUNTDOWN,
          },
          close_tick_card: arc.closeTickCard,
          card_count: first.cardEvents.length,
          booking_state: first.bookingState,
        },
        frames: plan.map((frame, idx) => ({
          label: frame.label,
          path: `${frame.label}.png`,
          tick: frame.tick,
          semantic: frame.semantic,
          description: frame.description,
          sha256: pngHashes[idx],
        })),
        control_no_advantage_wiring: {
          wiring: "the accepted HEAD referee wiring: awardFreeKicks:true + issueCards:true, the advantage gate absent",
          advantage_events_committed: noAdv.advantageEventCount,
          foul_ticks: noAdv.foulTicks,
          immediate_call: noAdv.foulTicks.map((f) => ({ foul_tick: f, free_kick_phase_from: f + 1 })),
          note: "with the advantage gate absent the SAME fouls are called immediately (foul tick -> free-kick phase on the next tick) — the control that isolates playAdvantage as the deferral the frames evidence",
        },
        gate_off: {
          wiring: "resolveRefereeWiring(false): freeKickConfig/cardConfig/advantageConfig all undefined (the shipped default)",
          advantage_events_committed: off.advantageEventCount,
          windows_committed: off.advantageWindows.length,
          free_kick_phases_seen: off.records.filter((r) => r.matchPhase === "free-kick").length,
          byte_identity_to_pre_change_call: bareChain === offChain,
          compared_ticks: PLAY_TICKS,
          referee_off_chain_sha256: offChain,
          pre_change_call_chain_sha256: bareChain,
          note: "the 10-argument referee-off createSimulation call (three trailing undefined gates) reproduces the 9-argument HEAD call's hash chain tick-for-tick in the same runtime",
        },
      };
      await commands.writeFile(SEQUENCE_REL, `${JSON.stringify(sequence, null, 2)}\n`, "utf-8");

      (window as unknown as Record<string, string>).__advantageArc = JSON.stringify(arc);
    },
    { timeout: 180_000 },
  );

  it(
    "the browser foul/window/deferred-call ticks correspond to the headless defensive-duel run with the same three-gate wiring",
    async () => {
      const scenario = withProximateHumanDefence(await loadScenario());
      const headless = runDefensiveDuel({
        scenario,
        maxTicks: PLAY_TICKS,
        attempts: DRIVEN_ATTEMPTS,
        freeKickConfig: { awardFreeKicks: true },
        cardConfig: { issueCards: true },
        advantageConfig: { playAdvantage: true },
      });
      const headlessWindows = advantageWindowsFrom(headless.advantageEvents);

      const browser = await playMatch(scenario, new Map(), false);
      const arc = locateAdvantageArc(browser);

      const headlessFoulTicks = headless.events.filter((e) => isFoulCandidateEvent(e)).map((e) => e.tick);
      expect(arc.foulTicks).toEqual(headlessFoulTicks);

      // Every committed window agrees between the runtimes, and the framed
      // window is the same one in the headless reference stream.
      expect(browser.advantageWindows).toEqual(headlessWindows);
      expect(arc.window).toEqual(longestWindow(headlessWindows));

      // The deferred serve lands at the close tick + the countdown in BOTH.
      const headlessFk = headless.freeKickEvents.find((e) => e.tick === arc.window.closeTick + FREE_KICK_COUNTDOWN);
      expect(headlessFk, "no headless deferred free-kick serve at close+60").not.toBeUndefined();
      expect(arc.windowFreeKick.tick).toBe(headlessFk!.tick);

      // The deferred caution at the close tick matches too.
      const headlessCaution = headless.cardEvents.find(
        (e) => (e.payload as { cardType?: string }).cardType === "caution",
      );
      expect(arc.closeTickCard!.tick).toBe(headlessCaution!.tick);
      expect(arc.closeTickCard!.playerId).toBe((headlessCaution!.payload as { playerId: string }).playerId);
      expect(arc.closeTickCard!.accumulatedFouls).toBe((headlessCaution!.payload as { accumulatedFouls: number }).accumulatedFouls);
    },
    { timeout: 180_000 },
  );

  it(
    "semantic frames are non-blank with luminance and color variance",
    async () => {
      const scenario = withProximateHumanDefence(await loadScenario());
      const locateRun = await playMatch(scenario, new Map(), false);
      const arc = locateAdvantageArc(locateRun);
      const midTick = arc.window.openTick + 8;

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
          showCardHud: true,
        },
        { awardFreeKicks: true },
        { issueCards: true },
        { playAdvantage: true },
      );
      await bridge.reset();
      const sim = bridge.getSimulation();
      const slots = cpuSlots(scenario);
      const human = humanSlot(scenario);
      const driverState = { nextAttempt: 0, lastAttemptReleaseTick: -1, lockoutTick: -1, lockoutBits: 0 };
      for (let i = 0; i < midTick; i++) {
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
    { timeout: 180_000 },
  );
});

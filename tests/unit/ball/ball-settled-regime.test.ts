/**
 * @module ball-settled-regime-tests
 *
 * Guards for the settled-ball regime re-entry model (BALL-SETTLED-REGIME-FIX,
 * model id `ball-settled-regime-v2`).
 *
 * Before the fix `stepBall` applied no physics at all once the ball's regime
 * was "settled". Player-ball contact, pass and dribble code write
 * `ball.linearVelocity` without touching the regime, so a settled ball could
 * carry a real touch impulse and never move — the kickoff and ground-pass
 * windows showed touch/pass events with zero ball travel.
 *
 * Pinned here:
 *   1. a settled ball that receives an impulse moves (position delta > 0),
 *   2. it re-enters the accepted regime model through the file's own
 *      thresholds (vertical speed above MIN_LIFT_OFF_VELOCITY → airborne,
 *      otherwise ground-roll until GROUND_SETTLE_SPEED), exactly one regime
 *      transition per impulse,
 *   3. the accepted ground↔airborne pitch-contact flood stays closed while a
 *      ball is repeatedly woken,
 *   4. position moves by velocity × dt only — no teleport, no attachment,
 *   5. same script → byte-identical canonical hash chain across two runs.
 *
 * Guards 1-5 go red when the settled branch is reverted to no-physics; the
 * at-rest control (no impulse → no motion) holds either way and keeps the
 * wake honest rather than automatic.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { stepBall } from "../../../src/simulation/ball/ball-system.js";
import { FOUNDATION_BALL_V1 } from "../../../src/simulation/config/foundation.js";
import { encodeCanonical, hashFnv1a64 } from "../../../src/simulation/determinism/index.js";
import type { BallState } from "../../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DT = 1 / 60; // matches FOUNDATION_FIXED_DT_V1
const CFG = FOUNDATION_BALL_V1;
const RADIUS = CFG.ballRadius.value;

/** Mirrors the accepted module-private thresholds (ball-system.ts). */
const MIN_LIFT_OFF_VELOCITY = 0.5;
const GROUND_SETTLE_SPEED = 0.01;

/** FOUNDATION_PASS_V1 ground-pass impulse: 8 m/s with a 0.05 vertical fraction. */
const PASS_SPEED = 8.0;
const PASS_VERTICAL_COMPONENT = PASS_SPEED * 0.05; // 0.4 — below MIN_LIFT_OFF_VELOCITY

function settledBall(overrides?: Partial<BallState>): BallState {
  return {
    position: { x: 5, y: -3, z: RADIUS },
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    regime: "settled",
    lastTouchRef: null,
    ...overrides,
  } as BallState;
}

function counter(): { value: number } {
  return { value: 0 };
}

function planarDistance(a: BallState, b: { x: number; y: number }): number {
  return Math.hypot(a.position.x - b.x, a.position.y - b.y);
}

/**
 * Apply an impulse the way the contact systems do — velocity only, never
 * position — and step the integrator for `ticks`, recording each committed
 * ball snapshot and the events of that tick.
 */
function stepRun(
  ball: BallState,
  ticks: number,
  startTick = 0,
): { snapshots: BallState[]; eventKinds: string[][] } {
  const c = counter();
  const snapshots: BallState[] = [];
  const eventKinds: string[][] = [];
  for (let i = 0; i < ticks; i++) {
    const events = stepBall(ball, DT, CFG, c, startTick + i);
    snapshots.push(JSON.parse(JSON.stringify(ball)) as BallState);
    eventKinds.push(events.map((event) => event.kind));
  }
  return { snapshots, eventKinds };
}

/** Count regime transitions in a snapshot chain, starting from `from`. */
function transitionsFrom(snapshots: BallState[], from: BallState["regime"]): number {
  let count = 0;
  let previous = from;
  for (const snapshot of snapshots) {
    if (snapshot.regime !== previous) count++;
    previous = snapshot.regime;
  }
  return count;
}

function countEvents(eventKinds: string[][], kind: string): number {
  return eventKinds.reduce((total, kinds) => total + kinds.filter((k) => k === kind).length, 0);
}

// ---------------------------------------------------------------------------
// 1. A settled ball that receives an impulse moves
// ---------------------------------------------------------------------------

describe("BALL-SETTLED-IMPULSE-001: an applied impulse moves a settled ball", () => {
  it("a ground-pass impulse on a settled ball changes its position within three ticks", () => {
    const ball = settledBall();
    const before = { x: ball.position.x, y: ball.position.y };
    ball.linearVelocity.x = PASS_SPEED;
    ball.linearVelocity.z = PASS_VERTICAL_COMPONENT;

    const { snapshots } = stepRun(ball, 3);

    expect(snapshots[0].position.x, "first tick must already integrate").toBeGreaterThan(before.x);
    expect(planarDistance(snapshots[2], before)).toBeGreaterThan(0);
    expect(snapshots[2].regime).not.toBe("settled");
  });

  it("a first-touch impulse on a settled ball moves it along the touch direction", () => {
    const ball = settledBall();
    const before = { x: ball.position.x, y: ball.position.y };
    // First touch on a dead ball: horizontal exit speed, vertical damped to 0.
    ball.linearVelocity.x = 3;
    ball.linearVelocity.y = 0;
    ball.linearVelocity.z = 0;

    const { snapshots } = stepRun(ball, 10);

    const last = snapshots[snapshots.length - 1];
    expect(planarDistance(last, before)).toBeGreaterThan(0.4);
    expect(last.position.x).toBeGreaterThan(before.x);
    expect(last.position.y).toBeCloseTo(before.y, 12);
  });

  it("a dribble push on a settled ball moves it", () => {
    const ball = settledBall();
    const before = { x: ball.position.x, y: ball.position.y };
    ball.linearVelocity.x = 0.7; // close-control push ahead of a slow body
    ball.linearVelocity.y = 0.4;

    const { snapshots } = stepRun(ball, 5);

    expect(planarDistance(snapshots[snapshots.length - 1], before)).toBeGreaterThan(0);
  });

  it("control: a settled ball with no impulse stays exactly where it is", () => {
    const ball = settledBall();
    const before = { ...ball.position };

    const { snapshots, eventKinds } = stepRun(ball, 120);

    for (const snapshot of snapshots) {
      expect(snapshot.position).toEqual(before);
      expect(snapshot.regime).toBe("settled");
      expect(snapshot.linearVelocity).toEqual({ x: 0, y: 0, z: 0 });
    }
    expect(countEvents(eventKinds, "pitch-contact")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Re-entry follows the accepted regime thresholds, exactly once per impulse
// ---------------------------------------------------------------------------

describe("BALL-SETTLED-REGIME-002: regime re-entry per the accepted thresholds", () => {
  it("a sub-lift impulse re-enters ground-roll once and re-settles through GROUND_SETTLE_SPEED", () => {
    const ball = settledBall();
    ball.linearVelocity.x = PASS_SPEED;
    ball.linearVelocity.z = PASS_VERTICAL_COMPONENT; // < MIN_LIFT_OFF_VELOCITY

    const { snapshots, eventKinds } = stepRun(ball, 2000);

    // One entry into ground-roll, one return to settled — no re-wake.
    expect(transitionsFrom(snapshots, "settled")).toBe(2);
    expect(snapshots[0].regime).toBe("ground-roll");
    const final = snapshots[snapshots.length - 1];
    expect(final.regime).toBe("settled");
    expect(final.linearVelocity).toEqual({ x: 0, y: 0, z: 0 });
    // Ground-roll absorbs the sub-lift vertical component instead of hopping.
    expect(countEvents(eventKinds, "pitch-contact")).toBe(0);
  });

  it("a lift impulse above MIN_LIFT_OFF_VELOCITY re-enters airborne and lands back in a regime", () => {
    const ball = settledBall();
    ball.linearVelocity.x = 6;
    ball.linearVelocity.z = 4; // > MIN_LIFT_OFF_VELOCITY

    const { snapshots, eventKinds } = stepRun(ball, 2000);

    expect(snapshots[0].regime).toBe("airborne");
    const regimes = snapshots.map((snapshot) => snapshot.regime);
    expect(regimes[regimes.length - 1]).toBe("settled");
    // airborne → ground-roll → settled: the accepted weak-bounce absorption
    // still ends the hop sequence in ground-roll, so exactly three transitions.
    expect(transitionsFrom(snapshots, "settled")).toBe(3);
    // Each bounce is a real landing, and the accepted thresholds cap the
    // sequence — a flood would contact on nearly every tick.
    const contacts = countEvents(eventKinds, "pitch-contact");
    expect(contacts).toBeGreaterThanOrEqual(1);
    expect(contacts).toBeLessThanOrEqual(4);
  });

  it("waking is symmetric with settling: an impulse below GROUND_SETTLE_SPEED stays settled", () => {
    const ball = settledBall();
    ball.linearVelocity.x = GROUND_SETTLE_SPEED / 2;

    const { snapshots } = stepRun(ball, 60);

    for (const snapshot of snapshots) {
      expect(snapshot.regime).toBe("settled");
      expect(snapshot.position.x).toBe(ball.position.x);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. The accepted pitch-contact flood stays closed
// ---------------------------------------------------------------------------

describe("BALL-SETTLED-FLOOD-003: the pitch-contact flood stays closed", () => {
  /**
   * Regression bound, not a reference envelope: a flood means a pitch-contact
   * on nearly every tick (60 per 100 ticks), the accepted behavior is a
   * contact only on a real landing. 5 per 100 ticks keeps an order of
   * magnitude of headroom above what these scripts actually produce.
   */
  const PITCH_CONTACTS_PER_100_TICKS_LIMIT = 5;

  it("repeated impulses on a settled ball move it and stay inside the contact bound", () => {
    const ball = settledBall({ position: { x: 0, y: 0, z: RADIUS } });
    const c = counter();
    const eventKinds: string[][] = [];
    let travelledMetres = 0;

    // A touch impulse every 30 ticks (half a second) for 3000 ticks.
    for (let tick = 0; tick < 3000; tick++) {
      if (tick % 30 === 0) {
        ball.linearVelocity.x = 5 + (tick % 7) * 0.5;
        ball.linearVelocity.y = -2 + (tick % 5) * 0.4;
        ball.linearVelocity.z = 0.3; // below the lift-off threshold
      }
      const before = { x: ball.position.x, y: ball.position.y };
      const events = stepBall(ball, DT, CFG, c, tick);
      travelledMetres += planarDistance(ball, before);
      eventKinds.push(events.map((event) => event.kind));
    }

    // Discriminating: a settled ball that is repeatedly played really travels
    // (with the settled branch reverted to no-physics this is exactly 0).
    expect(travelledMetres).toBeGreaterThan(50);
    // A ground-level impulse must not create pitch contacts at all.
    expect(countEvents(eventKinds, "pitch-contact")).toBe(0);
    // Structural bound: never more than one contact in any 100-tick window.
    for (let start = 0; start + 100 <= eventKinds.length; start += 100) {
      const windowContacts = countEvents(eventKinds.slice(start, start + 100), "pitch-contact");
      expect(windowContacts).toBeLessThanOrEqual(1);
    }
  });

  it("each strike of a settled ball lands in a bounded number of contacts", () => {
    const ball = settledBall({ position: { x: 0, y: 0, z: RADIUS } });
    const c = counter();
    let contacts = 0;
    let strikes = 0;
    let previousContactTick = -Infinity;
    let minimumGap = Infinity;
    const totalTicks = 6000;

    for (let tick = 0; tick < totalTicks; tick++) {
      if (ball.regime === "settled") {
        // Lofted strike: above MIN_LIFT_OFF_VELOCITY, so the accepted
        // lift-off transition applies.
        ball.linearVelocity.x = 7;
        ball.linearVelocity.z = 5;
        strikes++;
      }
      const events = stepBall(ball, DT, CFG, c, tick);
      if (events.some((event) => event.kind === "pitch-contact")) {
        minimumGap = Math.min(minimumGap, tick - previousContactTick);
        previousContactTick = tick;
        contacts++;
      }
    }

    expect(strikes).toBeGreaterThan(1);
    expect(contacts).toBeGreaterThan(0);
    // Bounces are real, separated landings — never a per-tick re-entry.
    expect(minimumGap).toBeGreaterThan(1);
    expect((contacts / totalTicks) * 100).toBeLessThanOrEqual(PITCH_CONTACTS_PER_100_TICKS_LIMIT);
  });
});


// ---------------------------------------------------------------------------
// 4. Integration only: velocity × dt, never a position assignment
// ---------------------------------------------------------------------------

describe("BALL-SETTLED-INTEGRATION-004: no teleport on wake-up", () => {
  it("every per-tick step of a woken ball stays inside the velocity × dt bound", () => {
    const ball = settledBall();
    ball.linearVelocity.x = PASS_SPEED;
    ball.linearVelocity.z = PASS_VERTICAL_COMPONENT;

    const c = counter();
    let previous = { ...ball.position };
    let previousSpeed = Math.hypot(ball.linearVelocity.x, ball.linearVelocity.y, ball.linearVelocity.z);

    for (let tick = 0; tick < 900; tick++) {
      stepBall(ball, DT, CFG, c, tick);
      const step = Math.hypot(
        ball.position.x - previous.x,
        ball.position.y - previous.y,
        ball.position.z - previous.z,
      );
      // Ground resistance only shrinks the velocity before integration, so a
      // single tick can never cover more than the previous tick's speed × dt.
      expect(step).toBeLessThanOrEqual(previousSpeed * DT + 1e-12);
      previous = { ...ball.position };
      previousSpeed = Math.hypot(
        ball.linearVelocity.x,
        ball.linearVelocity.y,
        ball.linearVelocity.z,
      );
      expect(Number.isFinite(ball.position.x)).toBe(true);
      expect(ball.position.z).toBeGreaterThanOrEqual(RADIUS - 1e-9);
    }
  });

  it("the ball stays an independent entity: waking needs an impulse, not a holder", () => {
    const ball = settledBall();
    const frozen = settledBall();

    ball.linearVelocity.x = 4;
    const withImpulse = stepRun(ball, 30).snapshots[29];
    const withoutImpulse = stepRun(frozen, 30).snapshots[29];

    expect(planarDistance(withImpulse, { x: frozen.position.x, y: frozen.position.y })).toBeGreaterThan(0);
    expect(withoutImpulse.position).toEqual({ x: 5, y: -3, z: RADIUS });
  });
});

// ---------------------------------------------------------------------------
// 5. Determinism
// ---------------------------------------------------------------------------

describe("BALL-SETTLED-DETERMINISM-005: byte-identical impulse scripts", () => {
  /** Canonical per-tick hash chain over the committed ball state. */
  function hashChain(): string[] {
    const ball = settledBall({ position: { x: 0, y: 0, z: RADIUS } });
    const c = counter();
    const hashes: string[] = [];
    for (let tick = 0; tick < 400; tick++) {
      if (ball.regime === "settled" && tick % 40 === 0) {
        ball.linearVelocity.x = 4 + (tick % 13) * 0.25;
        ball.linearVelocity.y = -1.5 + (tick % 7) * 0.25;
        ball.linearVelocity.z = 0.2;
      }
      stepBall(ball, DT, CFG, c, tick);
      // Ball state only — no tick field, so a chain that never changes state
      // cannot look non-vacuous by counting.
      hashes.push(hashFnv1a64(encodeCanonical({ schemaVersion: "state-v1", ball })));
    }
    return hashes;
  }

  it("two identical impulse scripts produce identical canonical hash chains", () => {
    expect(hashChain()).toEqual(hashChain());
  });

  it("the chain is non-vacuous: the woken ball keeps changing state", () => {
    const hashes = hashChain();
    // A settled ball that never integrates repeats one hash for the whole run;
    // a woken ball spends most ticks rolling to a new committed state.
    expect(new Set(hashes).size).toBeGreaterThan(hashes.length / 2);
  });
});

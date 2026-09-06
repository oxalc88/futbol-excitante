/**
 * @module tests/unit/eval/rules-oracle
 *
 * Unit guards for the protected MATCH_RULES_SPEC §15 rules oracles
 * (eval/oracles/rules-restart.ts, eval/oracles/rules-phase.ts), objective
 * RULES-SUITE-REGISTRATION.
 *
 * Each oracle is exercised on (a) a clean observation stream where the adopted
 * restart / out-of-play / scoring / phase semantics hold (PASS), (b) a corrupted
 * stream where the semantics are mutated (FAIL), and (c) a stream that genuinely
 * cannot carry the semantics (NOT_EVALUATED).  A genuinely-invalid observation
 * (contradictory event / malformed payload) must FAIL.
 *
 * Node I/O not used; observations are constructed in-memory.
 */

import { describe, it, expect } from "vitest";

import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

// Import wire.ts to register the built-in oracles (side-effect).
import "../../../eval/oracles/wire.js";
import {
  checkOutOfPlayDetection,
  checkOutOfPlayNoLastTouch,
  checkThrowInAward,
  checkGoalKickAward,
  checkCornerKickAward,
  checkGoalDetection,
  checkThrowInPlacement,
  checkThrowInServe,
  checkGoalKickPlacement,
  checkCornerKickPlacement,
  checkGoalPhase,
  checkKickoffFirstTouch,
} from "../../../eval/oracles/rules-restart.js";
import {
  checkKickoffFreeze,
  checkTimerFreeze,
  checkThrowInTimerFreeze,
  checkGoalKickTimerFreeze,
  checkCornerKickTimerFreeze,
  checkTimerDecrement,
  checkTimerHalftime,
  checkTimerFulltime,
} from "../../../eval/oracles/rules-phase.js";

// ---------------------------------------------------------------------------
// Observation builder
// ---------------------------------------------------------------------------

interface P {
  id: string;
  team: string;
  x: number;
  y: number;
}

const TEAM_A: P[] = [
  { id: "player-1", team: "team-a", x: 20, y: 0 },
  { id: "player-2", team: "team-a", x: -20, y: -5 },
];

const TEAM_B: P[] = [
  { id: "player-3", team: "team-b", x: -20, y: 5 },
  { id: "player-4", team: "team-b", x: 20, y: -5 },
];

const ALL_PLAYERS: P[] = [...TEAM_A, ...TEAM_B];

function playerObs(p: P) {
  return {
    playerId: p.id,
    teamId: p.team,
    groundPosition: { x: p.x, y: p.y },
    linearVelocity: { x: 0, y: 0 },
    desiredVelocity: { x: 0, y: 0 },
    bodyHeading: 0,
    desiredHeading: 0,
  };
}

interface ObsEvent {
  id: string;
  tick: number;
  sequence: number;
  kind: string;
  payload?: Record<string, unknown>;
}

function makeObs(
  tick: number,
  events: ObsEvent[] = [],
  opts?: {
    players?: P[];
    lastTouchRef?: string | null;
  },
): TelemetryObservation {
  const players = (opts?.players ?? ALL_PLAYERS).map(playerObs);
  return {
    tick,
    simulationTime: tick / 60,
    prngAlgorithmId: "mulberry32-v1",
    stateHash: `hash-${tick}`,
    prngStateHash: `prng-${tick}`,
    observationCoreHash: `core-${tick}`,
    committedTick: tick,
    inputs: [],
    players,
    ball: {
      position: { x: 0, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
      lastTouchRef: opts?.lastTouchRef ?? null,
    },
    events: events as TelemetryObservation["events"],
  };
}

/** A contact event resolving to a team; the ball's lastTouchRef points at it. */
function contact(id: string, tick: number, teamId: string): ObsEvent {
  return { id, tick, sequence: 1, kind: "player-ball-contact", payload: { teamId, playerId: "player-x" } };
}

/** A contact event by a specific player (used to attribute the first touch). */
function contactBy(id: string, tick: number, teamId: string, playerId: string): ObsEvent {
  return { id, tick, sequence: 1, kind: "player-ball-contact", payload: { teamId, playerId } };
}

function touchlineOut(tick: number, lastTouchRef: string | null): ObsEvent {
  return {
    id: `touchline-${tick}`, tick, sequence: 2, kind: "ball-touchline-out-of-play",
    payload: { touchlineIndex: 0, ballPosition: { x: 10, y: 34, z: 0.11 }, lastTouchRef },
  };
}

function goalLineOut(tick: number, goalIndex: 0 | 1, lastTouchRef: string | null): ObsEvent {
  return {
    id: `goalline-${tick}`, tick, sequence: 2, kind: "ball-out-of-play",
    payload: { goalIndex, ballPosition: { x: 52.5, y: 10, z: 0.5 }, lastTouchRef },
  };
}

function throwInExec(tick: number, teamId: string): ObsEvent {
  return { id: `throwin-${tick}`, tick, sequence: 3, kind: "throw-in-executed", payload: { teamId } };
}

function goalKickExec(tick: number, teamId: string): ObsEvent {
  return { id: `gk-${tick}`, tick, sequence: 3, kind: "goal-kick-executed", payload: { teamId } };
}

function cornerExec(tick: number, teamId: string): ObsEvent {
  return { id: `corner-${tick}`, tick, sequence: 3, kind: "corner-kick-executed", payload: { teamId } };
}

function goal(tick: number, goalIndex: number): ObsEvent {
  return { id: `goal-${tick}`, tick, sequence: 3, kind: "goal", payload: { goalIndex } };
}

// ---------------------------------------------------------------------------
// MATCH-THROW-IN-AWARD
// ---------------------------------------------------------------------------

describe("MATCH-THROW-IN-AWARD oracle", () => {
  it("PASS when the throw-in goes to the opposite-last-touch team", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-b")], { lastTouchRef: "c-1" }),
      makeObs(2, [touchlineOut(2, "c-1")], { lastTouchRef: "c-1" }),
      makeObs(3, [throwInExec(3, "team-a")]),
    ];
    const res = checkThrowInAward(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when the throw-in goes to the same-last-touch team (award mutant)", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-b")], { lastTouchRef: "c-1" }),
      makeObs(2, [touchlineOut(2, "c-1")], { lastTouchRef: "c-1" }),
      makeObs(3, [throwInExec(3, "team-b")]),
    ];
    const res = checkThrowInAward(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when there is no completed throw-in", () => {
    const obs = [makeObs(1, [contact("c-1", 1, "team-b")], { lastTouchRef: "c-1" })];
    const res = checkThrowInAward(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// MATCH-GOAL-KICK-AWARD
// ---------------------------------------------------------------------------

describe("MATCH-GOAL-KICK-AWARD oracle", () => {
  it("PASS when the goal kick goes to the defending team of the exited goal line", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-a")], { lastTouchRef: "c-1" }),
      // goalIndex 0 defended by team-b; last touch team-a (not defending) -> goal kick to team-b.
      makeObs(2, [goalLineOut(2, 0, "c-1")], { lastTouchRef: "c-1" }),
      makeObs(3, [goalKickExec(3, "team-b")]),
    ];
    const res = checkGoalKickAward(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when the goal kick goes to the wrong (non-defending) team", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-a")], { lastTouchRef: "c-1" }),
      makeObs(2, [goalLineOut(2, 0, "c-1")], { lastTouchRef: "c-1" }),
      makeObs(3, [goalKickExec(3, "team-a")]),
    ];
    const res = checkGoalKickAward(obs);
    expect(res[0].status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// MATCH-CORNER-KICK-AWARD
// ---------------------------------------------------------------------------

describe("MATCH-CORNER-KICK-AWARD oracle", () => {
  it("PASS when the corner goes to the attacking team for a defending-team last touch", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-b")], { lastTouchRef: "c-1" }),
      // goalIndex 0 defended by team-b; last touch team-b (defending) -> corner to team-a.
      makeObs(2, [goalLineOut(2, 0, "c-1")], { lastTouchRef: "c-1" }),
      makeObs(3, [cornerExec(3, "team-a")]),
    ];
    const res = checkCornerKickAward(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when a goal-kick-only situation is treated as a corner", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-a")], { lastTouchRef: "c-1" }),
      makeObs(2, [goalLineOut(2, 0, "c-1")], { lastTouchRef: "c-1" }),
      // last touch team-a is NOT the defending team — a goal kick is required.
      makeObs(3, [cornerExec(3, "team-a")]),
    ];
    const res = checkCornerKickAward(obs);
    expect(res[0].status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// MATCH-SCORING-GOAL-DEVENT
// ---------------------------------------------------------------------------

describe("MATCH-SCORING-GOAL-DEVENT oracle", () => {
  it("PASS on a goal with a valid goalIndex", () => {
    const obs = [makeObs(1, [goal(1, 0)])];
    const res = checkGoalDetection(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL on a goal with an invalid goalIndex", () => {
    const obs = [makeObs(1, [goal(1, 5)])];
    const res = checkGoalDetection(obs);
    expect(res[0].status).toBe("fail");
  });

  it("FAIL when a goal and a goal-line out-of-play share a tick (mutual exclusivity)", () => {
    const obs = [makeObs(1, [goal(1, 0), goalLineOut(1, 0, null)])];
    const res = checkGoalDetection(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when no goal event exists", () => {
    const obs = [makeObs(1, [touchlineOut(1, null)])];
    const res = checkGoalDetection(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// MATCH-OUT-OF-PLAY-DETECT
// ---------------------------------------------------------------------------

describe("MATCH-OUT-OF-PLAY-DETECT oracle", () => {
  it("PASS on a clean boundary event", () => {
    const obs = [makeObs(1, [touchlineOut(1, null)])];
    const res = checkOutOfPlayDetection(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when a goal and a goal-line out-of-play share a tick", () => {
    const obs = [makeObs(1, [goal(1, 0), goalLineOut(1, 0, null)])];
    const res = checkOutOfPlayDetection(obs);
    expect(res[0].status).toBe("fail");
  });

  it("FAIL on a malformed boundary payload", () => {
    const bad = {
      id: "bad-1", tick: 1, sequence: 1, kind: "ball-out-of-play",
      payload: { goalIndex: 99 },
    } as ObsEvent;
    const obs = [makeObs(1, [bad])];
    const res = checkOutOfPlayDetection(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when no boundary event exists", () => {
    const obs = [makeObs(1, [])];
    const res = checkOutOfPlayDetection(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// MATCH-OUT-OF-PLAY-NO-LAST-TOUCH
// ---------------------------------------------------------------------------

describe("MATCH-OUT-OF-PLAY-NO-LAST-TOUCH oracle", () => {
  it("PASS when a no-last-touch boundary opens no restart", () => {
    const obs = [
      makeObs(1, [touchlineOut(1, null)]),
      makeObs(2, []),
    ];
    const res = checkOutOfPlayNoLastTouch(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when a no-last-touch boundary is followed by a restart (mutant)", () => {
    const obs = [
      makeObs(1, [touchlineOut(1, null)]),
      makeObs(2, [throwInExec(2, "team-a")]),
    ];
    const res = checkOutOfPlayNoLastTouch(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when every boundary had a resolvable last touch", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-b")], { lastTouchRef: "c-1" }),
      makeObs(2, [touchlineOut(2, "c-1")], { lastTouchRef: "c-1" }),
    ];
    const res = checkOutOfPlayNoLastTouch(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// MATCH-KICKOFF-FREEZE
// ---------------------------------------------------------------------------

/** Build an opening kickoff stream where `movers` bodies leave home. */
function kickoffStream(movers: number): TelemetryObservation[] {
  const homePlayers = ALL_PLAYERS.map((p) => ({
    ...p,
    x: p.x,
    y: p.y,
  }));
  const movedPlayers = ALL_PLAYERS.map((p, i) => ({
    ...p,
    // Move the first `movers` bodies far from home.
    x: p.x + (i < movers ? 3 : 0),
    y: p.y + (i < movers ? 3 : 0),
  }));
  return [
    makeObs(0, [], { players: homePlayers, lastTouchRef: null }),
    makeObs(1, [], { players: movedPlayers, lastTouchRef: null }),
  ];
}

describe("MATCH-KICKOFF-FREEZE oracle", () => {
  it("PASS when only the taker (+ at-ball body) moves during the untouched window", () => {
    const res = checkKickoffFreeze(kickoffStream(1));
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when many bodies leave home during the untouched window (clump mutant)", () => {
    const res = checkKickoffFreeze(kickoffStream(3));
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when the kickoff ball is touched immediately", () => {
    const obs = [makeObs(0, [], { lastTouchRef: "c-1" }), makeObs(1, [contact("c-1", 1, "team-a")], { lastTouchRef: "c-1" })];
    const res = checkKickoffFreeze(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// MATCH-TIMER-FREEZE (honest NOT_EVALUATED)
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-FREEZE oracle", () => {
  it("honestly returns NOT_EVALUATED (the observation stream has no core phase/timer)", () => {
    const res = checkTimerFreeze([makeObs(1, [goal(1, 0)])]);
    expect(res[0].status).toBe("not_evaluated");
  });

  it("never over-claims a timer-freeze PASS", () => {
    const res = checkTimerFreeze([makeObs(1, [])]);
    expect(res[0].status).not.toBe("pass");
    expect(res[0].status).toBe("not_evaluated");
  });

  it("returns an empty result on an empty observation stream (evaluator NOT_EVALUATED)", () => {
    const res = checkTimerFreeze([]);
    expect(res).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// MATCH-TIMER-FREEZE (RESTART-RULES-CONFORMANCE: serialized phase/timer facts)
// ---------------------------------------------------------------------------

/** A runner-injected `core-match-phase` observation event (postPhase + startPhase + timer). */
function corePhase(tick: number, postPhase: string, startPhase: string, timer: number): ObsEvent {
  return {
    id: `core-match-phase-${tick}`,
    tick,
    sequence: 10,
    kind: "core-match-phase",
    payload: { matchPhase: postPhase, matchTimer: timer, startPhase },
  };
}

describe("MATCH-TIMER-FREEZE oracle with serialized phase/timer facts", () => {
  it("PASS when the ball-in-play clock stays frozen during a set-piece run", () => {
    const obs = [
      makeObs(100, [corePhase(100, "playing", "playing", 100)]),
      makeObs(101, [corePhase(101, "throw-in", "playing", 100)]),
      makeObs(102, [corePhase(102, "throw-in", "throw-in", 100)]),
      makeObs(103, [corePhase(103, "playing", "throw-in", 100)]),
    ];
    const res = checkTimerFreeze(obs);
    expect(res[0].id).toBe("rules-timer-freeze-held");
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when the clock decrements across a frozen phase tick", () => {
    const obs = [
      makeObs(100, [corePhase(100, "playing", "playing", 100)]),
      makeObs(101, [corePhase(101, "throw-in", "playing", 99)]),
    ];
    const res = checkTimerFreeze(obs);
    expect(res[0].id).toBe("rules-timer-freeze-mutated");
    expect(res[0].status).toBe("fail");
  });

  it("does not FAIL the legitimate playing→fulltime zero-crossing entry", () => {
    const obs = [
      makeObs(99, [corePhase(99, "playing", "playing", 1)]),
      makeObs(100, [corePhase(100, "fulltime", "playing", 0)]),
    ];
    const res = checkTimerFreeze(obs);
    expect(res[0].status).toBe("pass");
  });

  it("NOT_EVALUATED when there is no frozen (non-playing, non-halftime) tick", () => {
    const obs = [
      makeObs(1, [corePhase(1, "playing", "playing", 100)]),
      makeObs(2, [corePhase(2, "playing", "playing", 99)]),
    ];
    const res = checkTimerFreeze(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// restart award pairing (RESTART-RULES-CONFORMANCE: phase-aware, startPhase)
// ---------------------------------------------------------------------------

describe("restart award pairing uses the phase-opening boundary (phase-aware)", () => {
  it("pairs an execution with the boundary that opened the window, not an extra boundary fired mid-window", () => {
    const obs = [
      // tick 10: core starts tick 10 in "playing"; a touchline exit (team-a last
      // touch) opens the throw-in window.
      makeObs(10, [corePhase(10, "throw-in", "playing", 100), contact("c-10", 10, "team-a"), touchlineOut(10, "c-10")], { lastTouchRef: "c-10" }),
      // tick 11: the window is already open (startPhase "throw-in"); a late extra
      // touchline exit (team-b last touch) is ignored by the core (no new window).
      makeObs(11, [corePhase(11, "throw-in", "throw-in", 100), contact("c-11", 11, "team-b"), touchlineOut(11, "c-11")], { lastTouchRef: "c-11" }),
      // tick 70: the throw-in executes for team-b (opposite of the opening team-a).
      makeObs(70, [corePhase(70, "playing", "throw-in", 100), throwInExec(70, "team-b")]),
    ];
    const res = checkThrowInAward(obs);
    expect(res[0].id).toBe("rules-throw-in-award-held");
    expect(res[0].status).toBe("pass");
  });

  it("still FAILs a genuine award mutant (execution is the same team as the opening last-touch)", () => {
    const obs = [
      makeObs(10, [corePhase(10, "throw-in", "playing", 100), contact("c-10", 10, "team-a"), touchlineOut(10, "c-10")], { lastTouchRef: "c-10" }),
      makeObs(70, [corePhase(70, "playing", "throw-in", 100), throwInExec(70, "team-a")]),
    ];
    const res = checkThrowInAward(obs);
    expect(res[0].status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// MATCH-THROW-IN-PLACEMENT / MATCH-THROW-IN-SERVE (RULES-FACTS-DEPTH-CONFORMANCE)
// ---------------------------------------------------------------------------

/** A touchline exit with a ballPosition. */
function touchlineExit(tick: number, lastTouchRef: string | null, x: number, y: number): ObsEvent {
  return {
    id: `touchline-${tick}`, tick, sequence: 2, kind: "ball-touchline-out-of-play",
    payload: { touchlineIndex: 0, ballPosition: { x, y, z: 0.11 }, lastTouchRef },
  };
}

/** A throw-in execution with placement + serve payload. */
function throwInExecFull(tick: number, teamId: string, x: number, y: number, tx: number, ty: number): ObsEvent {
  const dx = tx - x, dy = ty - y;
  const d = Math.hypot(dx, dy) || 1;
  return {
    id: `throwin-${tick}`, tick, sequence: 3, kind: "throw-in-executed",
    payload: { teamId, throwTakerId: "player-8", throwPosition: { x, y, z: 0.11 }, targetPosition: { x: tx, y: ty }, throwDirection: { x: dx / d, y: dy / d } },
  };
}

function obsWithBall(tick: number, events: ObsEvent[], ball: { x: number; y: number; z: number }, lastTouchRef: string | null = null): TelemetryObservation {
  const o = makeObs(tick, events, { lastTouchRef });
  o.ball.position = { ...ball };
  return o;
}

describe("MATCH-THROW-IN-PLACEMENT oracle", () => {
  it("PASS when the throw-in is placed at the touchline exit point", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-b")], { lastTouchRef: "c-1" }),
      makeObs(2, [touchlineExit(2, "c-1", 30, 34)], { lastTouchRef: "c-1" }),
      obsWithBall(3, [throwInExecFull(3, "team-a", 30, 34, 22, 30)], { x: 30, y: 34, z: 1.5 }),
    ];
    const res = checkThrowInPlacement(obs);
    expect(res[0].id).toBe("rules-throw-in-placement-held");
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when the throw-in is placed away from the exit point", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-b")], { lastTouchRef: "c-1" }),
      makeObs(2, [touchlineExit(2, "c-1", 30, 34)], { lastTouchRef: "c-1" }),
      obsWithBall(3, [throwInExecFull(3, "team-a", 25, 30, 22, 30)], { x: 25, y: 30, z: 1.5 }),
    ];
    const res = checkThrowInPlacement(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when the executed event has no placement payload", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-b")], { lastTouchRef: "c-1" }),
      makeObs(2, [touchlineExit(2, "c-1", 30, 34)], { lastTouchRef: "c-1" }),
      makeObs(3, [throwInExec(3, "team-a")]),
    ];
    const res = checkThrowInPlacement(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

describe("MATCH-THROW-IN-SERVE oracle", () => {
  it("PASS when the throw-in is served at chest height into play", () => {
    const obs = [obsWithBall(3, [throwInExecFull(3, "team-a", 30, 34, 22, 30)], { x: 30, y: 34, z: 1.5 })];
    obs[0].ball.linearVelocity = { x: -10, y: -5, z: 1.8 };
    const res = checkThrowInServe(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when the serve is not at chest height", () => {
    const obs = [obsWithBall(3, [throwInExecFull(3, "team-a", 30, 34, 22, 30)], { x: 30, y: 34, z: 0.11 })];
    obs[0].ball.linearVelocity = { x: -10, y: -5, z: 0 };
    const res = checkThrowInServe(obs);
    expect(res[0].status).toBe("fail");
  });

  it("FAIL when the serve target is the exit point itself", () => {
    const obs = [obsWithBall(3, [throwInExecFull(3, "team-a", 30, 34, 30, 34)], { x: 30, y: 34, z: 1.5 })];
    obs[0].ball.linearVelocity = { x: 0, y: 0, z: 1.8 };
    const res = checkThrowInServe(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when no throw-in execution is observed", () => {
    const obs = [makeObs(1, [])];
    const res = checkThrowInServe(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// MATCH-GOAL-KICK-PLACEMENT
// ---------------------------------------------------------------------------

function goalLineExit(tick: number, goalIndex: 0 | 1, lastTouchRef: string | null, x: number, y: number): ObsEvent {
  return {
    id: `goalline-${tick}`, tick, sequence: 2, kind: "ball-out-of-play",
    payload: { goalIndex, ballPosition: { x, y, z: 0.11 }, lastTouchRef },
  };
}

function goalKickExecFull(tick: number, teamId: string, x: number, y: number): ObsEvent {
  return {
    id: `gk-${tick}`, tick, sequence: 3, kind: "goal-kick-executed",
    payload: { teamId, kickTakerId: "player-9", kickPosition: { x, y }, targetPosition: { x: -11, y: -5 }, kickDirection: { x: -1, y: 0 } },
  };
}

describe("MATCH-GOAL-KICK-PLACEMENT oracle", () => {
  it("PASS when the goal kick is placed inside the goal area on the exit side", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-a")], { lastTouchRef: "c-1" }),
      makeObs(2, [goalLineExit(2, 0, "c-1", 52.5, -3.9)], { lastTouchRef: "c-1" }),
      makeObs(3, [goalKickExecFull(3, "team-b", 47, -3.9)]),
    ];
    const res = checkGoalKickPlacement(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when the goal kick is placed at the wrong spot", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-a")], { lastTouchRef: "c-1" }),
      makeObs(2, [goalLineExit(2, 0, "c-1", 52.5, -3.9)], { lastTouchRef: "c-1" }),
      makeObs(3, [goalKickExecFull(3, "team-b", 30, 0)]),
    ];
    const res = checkGoalKickPlacement(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when no goal-kick execution with placement is observed", () => {
    const obs = [makeObs(1, [goalKickExec(1, "team-b")])];
    const res = checkGoalKickPlacement(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// MATCH-CORNER-KICK-PLACEMENT (MATCH_RULES_SPEC §8.2)
// ---------------------------------------------------------------------------

function cornerExecFull(tick: number, teamId: string, x: number, y: number): ObsEvent {
  return {
    id: `corner-${tick}`, tick, sequence: 3, kind: "corner-kick-executed",
    payload: { teamId, kickTakerId: "player-1", cornerPosition: { x, y }, targetPosition: { x: 44.5, y: 0 }, crossDirection: { x: -1, y: 0 } },
  };
}

describe("MATCH-CORNER-KICK-PLACEMENT oracle", () => {
  it("PASS when the corner kick is placed at the nearest corner flag on the exit-y sign", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-b")], { lastTouchRef: "c-1" }),
      makeObs(2, [goalLineExit(2, 0, "c-1", 52.5, 12)], { lastTouchRef: "c-1" }),
      makeObs(3, [cornerExecFull(3, "team-a", 52.5, 34)]),
    ];
    const res = checkCornerKickPlacement(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when the corner kick is placed at the wrong flag (opposite y sign)", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-b")], { lastTouchRef: "c-1" }),
      makeObs(2, [goalLineExit(2, 0, "c-1", 52.5, 12)], { lastTouchRef: "c-1" }),
      makeObs(3, [cornerExecFull(3, "team-a", 52.5, -34)]),
    ];
    const res = checkCornerKickPlacement(obs);
    expect(res[0].status).toBe("fail");
  });

  it("FAIL when the corner kick is placed on the wrong goal line", () => {
    const obs = [
      makeObs(1, [contact("c-1", 1, "team-b")], { lastTouchRef: "c-1" }),
      makeObs(2, [goalLineExit(2, 0, "c-1", 52.5, 12)], { lastTouchRef: "c-1" }),
      makeObs(3, [cornerExecFull(3, "team-a", -52.5, 34)]),
    ];
    const res = checkCornerKickPlacement(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when no corner-kick execution with placement is observed", () => {
    const obs = [makeObs(1, [cornerExec(1, "team-a")])];
    const res = checkCornerKickPlacement(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// MATCH-SCORING-GOAL-PHASE
// ---------------------------------------------------------------------------

describe("MATCH-SCORING-GOAL-PHASE oracle", () => {
  it("PASS when a goal opens the goal phase and play returns to playing", () => {
    const obs = [
      makeObs(10, [corePhase(10, "playing", "playing", 100), goal(10, 0)]),
      makeObs(11, [corePhase(11, "goal", "playing", 100)]),
      makeObs(70, [corePhase(70, "playing", "goal", 100)]),
    ];
    const res = checkGoalPhase(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when a goal never opens the goal phase", () => {
    const obs = [
      makeObs(10, [corePhase(10, "playing", "playing", 100), goal(10, 0)]),
      makeObs(11, [corePhase(11, "playing", "playing", 100)]),
    ];
    const res = checkGoalPhase(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when no goal is observed", () => {
    const obs = [makeObs(1, [])];
    const res = checkGoalPhase(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// MATCH-KICKOFF-FIRST-TOUCH
// ---------------------------------------------------------------------------

describe("MATCH-KICKOFF-FIRST-TOUCH oracle", () => {
  it("PASS when the opening window closes on the taker's first touch", () => {
    const home = ALL_PLAYERS.map((p) => ({ ...p, x: p.x, y: p.y }));
    // Ball at center; the nearest body (player-1) is the taker and makes the first touch.
    const obs = [
      makeObs(0, [], { players: home, lastTouchRef: null }),
      makeObs(1, [], { players: home, lastTouchRef: null }),
      makeObs(2, [contactBy("c-1", 2, "team-a", "player-1")], { players: home, lastTouchRef: "c-1" }),
    ];
    const res = checkKickoffFirstTouch(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when a non-taker breaks the freeze first", () => {
    const home = ALL_PLAYERS.map((p) => ({ ...p, x: p.x, y: p.y }));
    const obs = [
      makeObs(0, [], { players: home, lastTouchRef: null }),
      makeObs(1, [], { players: home, lastTouchRef: null }),
      makeObs(2, [contactBy("c-1", 2, "team-a", "player-2")], { players: home, lastTouchRef: "c-1" }),
    ];
    const res = checkKickoffFirstTouch(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when the kickoff ball is touched immediately", () => {
    const obs = [makeObs(0, [], { lastTouchRef: "c-1" }), makeObs(1, [contact("c-1", 1, "team-a")], { lastTouchRef: "c-1" })];
    const res = checkKickoffFirstTouch(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// MATCH-THROW-IN-TIMER-FREEZE / MATCH-GOAL-KICK-TIMER-FREEZE
// ---------------------------------------------------------------------------

describe("MATCH-THROW-IN-TIMER-FREEZE oracle", () => {
  it("PASS when the timer stays frozen during the throw-in phase", () => {
    const obs = [
      makeObs(70, [corePhase(70, "throw-in", "playing", 100)]),
      makeObs(71, [corePhase(71, "throw-in", "throw-in", 100)]),
      makeObs(72, [corePhase(72, "playing", "throw-in", 100)]),
    ];
    const res = checkThrowInTimerFreeze(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when the timer decrements during the throw-in phase", () => {
    const obs = [
      makeObs(70, [corePhase(70, "throw-in", "playing", 100)]),
      makeObs(71, [corePhase(71, "throw-in", "throw-in", 99)]),
    ];
    const res = checkThrowInTimerFreeze(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when there is no throw-in phase tick", () => {
    const obs = [makeObs(1, [corePhase(1, "playing", "playing", 100)])];
    const res = checkThrowInTimerFreeze(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

describe("MATCH-GOAL-KICK-TIMER-FREEZE oracle", () => {
  it("PASS when the timer stays frozen during the goal-kick phase", () => {
    const obs = [
      makeObs(10, [corePhase(10, "goal-kick", "playing", 100)]),
      makeObs(11, [corePhase(11, "goal-kick", "goal-kick", 100)]),
      makeObs(12, [corePhase(12, "playing", "goal-kick", 100)]),
    ];
    const res = checkGoalKickTimerFreeze(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when the timer decrements during the goal-kick phase", () => {
    const obs = [
      makeObs(10, [corePhase(10, "goal-kick", "playing", 100)]),
      makeObs(11, [corePhase(11, "goal-kick", "goal-kick", 99)]),
    ];
    const res = checkGoalKickTimerFreeze(obs);
    expect(res[0].status).toBe("fail");
  });
});

describe("MATCH-CORNER-KICK-TIMER-FREEZE oracle", () => {
  it("PASS when the timer stays frozen during the corner-kick phase", () => {
    const obs = [
      makeObs(10, [corePhase(10, "corner-kick", "playing", 100)]),
      makeObs(11, [corePhase(11, "corner-kick", "corner-kick", 100)]),
      makeObs(12, [corePhase(12, "playing", "corner-kick", 100)]),
    ];
    const res = checkCornerKickTimerFreeze(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when the timer decrements during the corner-kick phase", () => {
    const obs = [
      makeObs(10, [corePhase(10, "corner-kick", "playing", 100)]),
      makeObs(11, [corePhase(11, "corner-kick", "corner-kick", 99)]),
    ];
    const res = checkCornerKickTimerFreeze(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when there is no corner-kick phase tick", () => {
    const obs = [makeObs(1, [corePhase(1, "playing", "playing", 100)])];
    const res = checkCornerKickTimerFreeze(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// MATCH-TIMER-DECREMENT / HALFTIME / FULLTIME
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-DECREMENT oracle", () => {
  it("PASS when the timer decrements only during playing", () => {
    const obs = [
      makeObs(1, [corePhase(1, "playing", "playing", 100)]),
      makeObs(2, [corePhase(2, "playing", "playing", 99)]),
      makeObs(3, [corePhase(3, "throw-in", "playing", 99)]),
      makeObs(4, [corePhase(4, "playing", "throw-in", 98)]),
    ];
    const res = checkTimerDecrement(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when the timer decrements during a frozen phase", () => {
    const obs = [
      makeObs(1, [corePhase(1, "playing", "playing", 100)]),
      makeObs(2, [corePhase(2, "throw-in", "playing", 99)]),
    ];
    const res = checkTimerDecrement(obs);
    expect(res[0].status).toBe("fail");
  });

  it("does not FAIL the legitimate playing→fulltime zero-crossing", () => {
    const obs = [
      makeObs(99, [corePhase(99, "playing", "playing", 1)]),
      makeObs(100, [corePhase(100, "fulltime", "playing", 0)]),
    ];
    const res = checkTimerDecrement(obs);
    expect(res[0].status).toBe("pass");
  });
});

describe("MATCH-TIMER-HALFTIME oracle", () => {
  it("PASS on a playing→halftime→playing sequence", () => {
    const obs = [
      makeObs(1, [corePhase(1, "playing", "playing", 100)]),
      makeObs(2, [corePhase(2, "halftime", "playing", 60)]),
      makeObs(3, [corePhase(3, "playing", "halftime", 100)]),
    ];
    const res = checkTimerHalftime(obs);
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when halftime is not followed by the second half", () => {
    const obs = [
      makeObs(1, [corePhase(1, "playing", "playing", 100)]),
      makeObs(2, [corePhase(2, "halftime", "playing", 60)]),
    ];
    const res = checkTimerHalftime(obs);
    expect(res[0].status).toBe("fail");
  });

  it("NOT_EVALUATED when no halftime is observed", () => {
    const obs = [makeObs(1, [corePhase(1, "playing", "playing", 100)])];
    const res = checkTimerHalftime(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

describe("MATCH-TIMER-FULLTIME oracle", () => {
  it("PASS on a timer-driven playing→fulltime zero crossing", () => {
    const obs = [
      makeObs(1, [corePhase(1, "playing", "playing", 1)]),
      makeObs(2, [corePhase(2, "fulltime", "playing", 0)]),
    ];
    const res = checkTimerFulltime(obs);
    expect(res[0].status).toBe("pass");
  });

  it("NOT_EVALUATED on a runner-stamped fulltime (timer not at zero)", () => {
    const obs = [
      makeObs(1, [corePhase(1, "playing", "playing", 182)]),
      makeObs(2, [corePhase(2, "fulltime", "playing", 182)]),
    ];
    const res = checkTimerFulltime(obs);
    expect(res[0].status).toBe("not_evaluated");
  });
});

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
} from "../../../eval/oracles/rules-restart.js";
import {
  checkKickoffFreeze,
  checkTimerFreeze,
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

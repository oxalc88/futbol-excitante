/**
 * @module tests/unit/cpu-adapter/kickoff-anti-huddle
 *
 * Unit guards for 5V5-KICKOFF-ANTI-HUDDLE (adapter layer only).
 *
 * Covers:
 *  1. Activation: the shape is live on an observation that carries the ball's
 *     authoritative touch reference; the kill switch and legacy fixtures that do
 *     not carry it keep the chase-everything frames.
 *  2. Kickoff freeze: until the ball is first touched only the kick taker moves;
 *     every other body holds its fixed kickoff home.
 *  3. Nearest-only chase: after the first touch the designated presser converges
 *     and a non-presser is steered to its home instead of the ball.
 *  4. Designation: one presser per team per tick, chosen from the roles the
 *     accepted defensive policy allows to press, and the same body the accepted
 *     tackle authorisation names.
 *  5. Reachability: the freeze/hold counters only move when the code path runs.
 *
 * Every tuned value here is provisional; no PES 2017 envelope is claimed.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCpuAdapter,
  assignChaseRoles,
  isAntiHuddleActive,
  designatePresser,
  getKickoffFreezeActivations,
  getNearestOnlyChaseActivations,
  getCoverMechanismActivations,
  resetMechanismCounters,
  computeTeamDecision,
  type CpuObservation,
} from "../../../src/adapters/input-browser/cpu-adapter.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type Rigid = "defender" | "midfielder" | "attacker";

interface BodySpec {
  playerId: string;
  teamId: string;
  x: number;
  y: number;
  role?: Rigid;
}

const TEAM_A = "team-a";
const TEAM_B = "team-b";

/** Five bodies per team at their kickoff homes, ball at the centre spot. */
function kickoffBodies(): BodySpec[] {
  return [
    { playerId: "a-1", teamId: TEAM_A, x: -30, y: 0, role: "defender" },
    { playerId: "a-2", teamId: TEAM_A, x: -20, y: -16, role: "defender" },
    { playerId: "a-3", teamId: TEAM_A, x: -8, y: -8, role: "midfielder" },
    { playerId: "a-4", teamId: TEAM_A, x: -8, y: 8, role: "midfielder" },
    { playerId: "a-5", teamId: TEAM_A, x: -2, y: 0, role: "attacker" },
    { playerId: "b-1", teamId: TEAM_B, x: 30, y: 0, role: "defender" },
    { playerId: "b-2", teamId: TEAM_B, x: 20, y: -16, role: "defender" },
    { playerId: "b-3", teamId: TEAM_B, x: 8, y: -8, role: "midfielder" },
    { playerId: "b-4", teamId: TEAM_B, x: 8, y: 8, role: "midfielder" },
    { playerId: "b-5", teamId: TEAM_B, x: 2, y: 0, role: "attacker" },
  ];
}

function moveBodies(bodies: BodySpec[], id: string, x: number, y: number): BodySpec[] {
  return bodies.map((b) => (b.playerId === id ? { ...b, x, y } : b));
}

/**
 * Runtime-shaped observation: carries the ball's authoritative touch reference,
 * which is what activates the anti-huddle. `touched: false` is the untouched
 * restart ball; `touched: true` is open play.
 */
function runtimeObservation(
  bodies: BodySpec[],
  teamId: string,
  controlledPlayerId: string,
  ball: { x: number; y: number; vx?: number; vy?: number },
  touched: boolean,
  overrides: Partial<CpuObservation> = {},
): CpuObservation {
  const obs: CpuObservation = {
    players: bodies.map((b) => ({
      playerId: b.playerId,
      teamId: b.teamId,
      groundPosition: { x: b.x, y: b.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
      formationRole: b.role,
    })),
    ball: {
      position: { x: ball.x, y: ball.y, z: 0.11 },
      linearVelocity: { x: ball.vx ?? 0, y: ball.vy ?? 0, z: 0 },
      regime: "ground-roll",
      lastTouchRef: touched ? "pass-1-1" : null,
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId: teamId,
    controlledPlayerId,
    ...overrides,
  };
  const teamObs: CpuObservation = { ...obs, controlledPlayerId: undefined };
  obs.teamDecision = computeTeamDecision(teamObs, teamId);
  return obs;
}

/** Legacy fixture shape: no touch reference at all. */
function legacyObservation(
  bodies: BodySpec[],
  teamId: string,
  controlledPlayerId: string,
  ball: { x: number; y: number },
): CpuObservation {
  const obs = runtimeObservation(bodies, teamId, controlledPlayerId, ball, false);
  delete (obs.ball as { lastTouchRef?: string | null }).lastTouchRef;
  return obs;
}

// ---------------------------------------------------------------------------
// 1. Activation and the kill switch
// ---------------------------------------------------------------------------

describe("ANTI-HUDDLE-ACT-001: activation is an observable property", () => {
  it("activates on an observation carrying the ball touch reference", () => {
    const obs = runtimeObservation(kickoffBodies(), TEAM_A, "a-1", { x: 0, y: 0 }, true);
    expect(isAntiHuddleActive(obs)).toBe(true);
  });

  it("stays inactive on a legacy fixture with no touch reference", () => {
    const obs = legacyObservation(kickoffBodies(), TEAM_A, "a-1", { x: 0, y: 0 });
    expect(isAntiHuddleActive(obs)).toBe(false);
  });

  it("is switched off explicitly by cpuAntiHuddle: false", () => {
    const bodies = kickoffBodies();
    const off = runtimeObservation(bodies, TEAM_A, "a-1", { x: 0, y: 0 }, false, {
      cpuAntiHuddle: false,
    });
    const on = runtimeObservation(bodies, TEAM_A, "a-1", { x: 0, y: 0 }, false);
    expect(isAntiHuddleActive(off)).toBe(false);
    expect(isAntiHuddleActive(on)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Kickoff freeze
// ---------------------------------------------------------------------------

describe("ANTI-HUDDLE-KICK-001: bodies hold their kickoff homes until first touch", () => {
  beforeEach(() => {
    resetMechanismCounters();
  });

  it("the kick taker is the single closest body to the untouched ball", () => {
    const bodies = kickoffBodies();
    const obs = runtimeObservation(bodies, TEAM_A, "a-5", { x: 0, y: 0 }, false);
    const roles = assignChaseRoles(obs, TEAM_A);
    // a-5 sits 2 m from the spot, every other body is farther.
    expect(roles.kickoffTakerId).toBe("a-5");
  });

  it("the taker designation is independent of observation array order", () => {
    const bodies = kickoffBodies();
    // b-5 is also 2 m from the ball: the tie resolves by ascending playerId.
    const forward = runtimeObservation(bodies, TEAM_A, "a-5", { x: 0, y: 0 }, false);
    const reversed = runtimeObservation([...bodies].reverse(), TEAM_B, "b-5", { x: 0, y: 0 }, false);
    expect(forward.ball.position.x).toBe(reversed.ball.position.x);
    expect(assignChaseRoles(forward, TEAM_A).kickoffTakerId)
      .toBe(assignChaseRoles(reversed, TEAM_B).kickoffTakerId);
    expect(assignChaseRoles(forward, TEAM_A).kickoffTakerId).toBe("a-5");
  });

  it("a non-taker parked at its home issues no movement while the ball is untouched", () => {
    const bodies = kickoffBodies();
    const adapter = createCpuAdapter();
    const frame = adapter.sample(0, runtimeObservation(bodies, TEAM_A, "a-1", { x: 0, y: 0 }, false));
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
    expect(frame.pressedButtons).toBe(0);
    expect(frame.heldButtons).toBe(0);
    expect(frame.sprint).toBe(1);
  });

  it("a displaced non-taker steers home, not at the ball", () => {
    const bodies = kickoffBodies();
    const adapter = createCpuAdapter();
    // Home is captured on the body's first observed sample of the match.
    adapter.sample(0, runtimeObservation(bodies, TEAM_A, "a-1", { x: 0, y: 0 }, false));
    // a-1 (home -30,0) has drifted to (-18,0), i.e. closer to the ball.
    const displaced = moveBodies(bodies, "a-1", -18, 0);
    const frame = adapter.sample(1, runtimeObservation(displaced, TEAM_A, "a-1", { x: 0, y: 0 }, false));
    // Home is further from the ball, so a ball-chase would be +x.
    expect(frame.moveX).toBeLessThan(0);
  });

  it("the taker closes on the ball while the rest are frozen", () => {
    const bodies = kickoffBodies();
    const takerAdapter = createCpuAdapter();
    const otherAdapter = createCpuAdapter();
    const takerFrame = takerAdapter.sample(0, runtimeObservation(bodies, TEAM_A, "a-5", { x: 0, y: 0 }, false));
    const otherFrame = otherAdapter.sample(0, runtimeObservation(bodies, TEAM_A, "a-3", { x: 0, y: 0 }, false));
    expect(takerFrame.moveX).toBeGreaterThan(0);
    expect(otherFrame.moveX).toBe(0);
    expect(otherFrame.moveY).toBe(0);
  });

  it("the freeze stops counting the tick the ball carries a touch reference", () => {
    const bodies = kickoffBodies();
    // b-4 is neither the kick taker nor team-b's presser (b-3 is nearer).
    const adapter = createCpuAdapter();
    adapter.sample(0, runtimeObservation(bodies, TEAM_B, "b-4", { x: 0, y: 0 }, false));
    expect(getKickoffFreezeActivations()).toBe(1);
    adapter.sample(1, runtimeObservation(bodies, TEAM_B, "b-4", { x: 0, y: 0 }, true));
    // Open play no longer freezes: the hold-home path takes over instead.
    expect(getKickoffFreezeActivations()).toBe(1);
    expect(getNearestOnlyChaseActivations()).toBe(1);
  });

  it("stashed, every non-possessing body chases the ball instead (discriminating)", () => {
    const bodies = kickoffBodies();
    const stashed = runtimeObservation(bodies, TEAM_A, "a-1", { x: 0, y: 0 }, false, {
      cpuAntiHuddle: false,
    });
    const adapter = createCpuAdapter();
    const frame = adapter.sample(0, stashed);
    // The accepted chase-everything shape: a body 30 m from the ball sprints at it.
    expect(frame.moveX).toBeGreaterThan(0.9);
    expect(getKickoffFreezeActivations()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Nearest-only chase after the first touch
// ---------------------------------------------------------------------------

describe("ANTI-HUDDLE-CHASE-001: only the designated chaser converges after first touch", () => {
  beforeEach(() => {
    resetMechanismCounters();
  });

  it("the designated chaser moves toward the ball", () => {
    const bodies = kickoffBodies();
    const ball = { x: 0, y: 0 };
    const teamObs = runtimeObservation(bodies, TEAM_A, "a-3", ball, true);
    const chaserId = assignChaseRoles(teamObs, TEAM_A).chaserPlayerId;
    expect(chaserId).toBe("a-3");
    const obs = runtimeObservation(bodies, TEAM_A, chaserId!, ball, true);
    const adapter = createCpuAdapter();
    const frame = adapter.sample(0, obs);
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("a non-chaser is steered to its home, away from the ball", () => {
    // a-3 (midfielder, 11.3 m out) is team-a's presser; a-1 is not.
    const bodies = kickoffBodies();
    const adapter = createCpuAdapter();
    adapter.sample(0, runtimeObservation(bodies, TEAM_A, "a-1", { x: 0, y: 0 }, true));
    // a-1 (home -30,0) has been caught at (-12,-2), 12.2 m from the ball.
    const displaced = moveBodies(bodies, "a-1", -12, -2);
    const obs = runtimeObservation(displaced, TEAM_A, "a-1", { x: 0, y: 0 }, true);
    expect(assignChaseRoles(obs, TEAM_A).chaserPlayerId).toBe("a-3");
    const frame = adapter.sample(1, obs);
    // Home is away from the ball: the steer must point back, not at the ball.
    expect(frame.moveX).toBeLessThan(0);
    expect(getNearestOnlyChaseActivations()).toBeGreaterThan(0);
  });

  it("a non-chaser already at home holds still", () => {
    const bodies = kickoffBodies();
    const adapter = createCpuAdapter();
    const frame = adapter.sample(0, runtimeObservation(bodies, TEAM_A, "a-1", { x: 0, y: 0 }, true));
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
  });

  it("at most one body per team is designated per tick", () => {
    const bodies = kickoffBodies();
    const ball = { x: -12, y: -3 };
    for (const teamId of [TEAM_A, TEAM_B]) {
      const obs = runtimeObservation(bodies, teamId, "a-1", ball, true);
      const roles = assignChaseRoles(obs, teamId);
      const designated = bodies.filter((b) => b.teamId === teamId && b.playerId === roles.chaserPlayerId);
      expect(designated.length).toBe(1);
      // The cover is a different body from the chaser.
      if (roles.coverPlayerId) expect(roles.coverPlayerId).not.toBe(roles.chaserPlayerId);
    }
  });

  it("stashed, the same non-chaser chases the ball (discriminating)", () => {
    const bodies = moveBodies(kickoffBodies(), "a-1", -12, -2);
    const adapter = createCpuAdapter();
    const frame = adapter.sample(0, runtimeObservation(bodies, TEAM_A, "a-1", { x: 0, y: 0 }, true, {
      cpuAntiHuddle: false,
    }));
    // The accepted shape drives straight at the ball from wherever it is.
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveY).toBeGreaterThan(0);
    expect(getNearestOnlyChaseActivations()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Press designation shared with the accepted defensive policy
// ---------------------------------------------------------------------------

describe("ANTI-HUDDLE-PRESS-001: the chaser is the accepted presser", () => {
  it("prefers the nearest body the defensive policy allows to press", () => {
    const bodies = kickoffBodies();
    const obs = runtimeObservation(bodies, TEAM_A, "a-3", { x: -2, y: 0 }, true);
    // a-5 (attacker) is closest to the ball, but attackers are not pressers.
    expect(designatePresser(obs, TEAM_A).playerId).toBe("a-3");
  });

  it("falls back to the nearest body when nothing is press-eligible", () => {
    const attackersOnly = [
      { playerId: "a-5", teamId: TEAM_A, x: -2, y: 0, role: "attacker" as Rigid },
      { playerId: "b-5", teamId: TEAM_B, x: 2, y: 0, role: "attacker" as Rigid },
    ];
    const obs = runtimeObservation(attackersOnly, TEAM_A, "a-5", { x: 0, y: 0 }, true);
    expect(designatePresser(obs, TEAM_A).playerId).toBe("a-5");
  });

  it("the accepted tackle authorisation names the same body as the chase role", () => {
    // An opposing carrier inside contest distance of the ball, with the ball in
    // team-b's third so team-a is defending.
    const bodies = [
      { playerId: "a-1", teamId: TEAM_A, x: -20, y: 0, role: "defender" as Rigid },
      { playerId: "a-3", teamId: TEAM_A, x: -30, y: -8, role: "midfielder" as Rigid },
      { playerId: "a-5", teamId: TEAM_A, x: -21, y: 0.5, role: "attacker" as Rigid },
      { playerId: "b-1", teamId: TEAM_B, x: -40, y: 0, role: "defender" as Rigid },
    ];
    const ball = { x: -22, y: 0, vx: -3, vy: 0 };
    const obs = runtimeObservation(bodies, TEAM_A, "a-1", ball, true);
    const decision = computeTeamDecision(obs, TEAM_A);
    const roles = assignChaseRoles(obs, TEAM_A);
    expect(decision.nearestToBallPlayerId).toBe(roles.chaserPlayerId);
    if (decision.tackleCommit !== null) {
      expect(decision.tackleCommit.playerId).toBe(roles.chaserPlayerId);
    }
  });

  it("legacy observations keep the accepted nearest-body designation", () => {
    const bodies = kickoffBodies();
    const obs = legacyObservation(bodies, TEAM_A, "a-3", { x: -2, y: 0 });
    expect(designatePresser(obs, TEAM_A).playerId).toBe("a-5");
  });
});

// ---------------------------------------------------------------------------
// 5. Accepted mechanisms still fire under the new shape
// ---------------------------------------------------------------------------

describe("ANTI-HUDDLE-REG-001: accepted mechanisms still activate", () => {
  beforeEach(() => {
    resetMechanismCounters();
  });

  it("the cover mechanism still runs for the designated cover body", () => {
    // Ball in team-a's own third with an opposing carrier: team-a defends.
    const bodies = [
      { playerId: "a-1", teamId: TEAM_A, x: -40, y: 0, role: "defender" as Rigid },
      { playerId: "a-2", teamId: TEAM_A, x: -46, y: -6, role: "defender" as Rigid },
      { playerId: "a-5", teamId: TEAM_A, x: -20, y: 0, role: "attacker" as Rigid },
      { playerId: "b-1", teamId: TEAM_B, x: -38, y: 0.5, role: "midfielder" as Rigid },
    ];
    const ball = { x: -38, y: 0, vx: 0, vy: 0 };
    const coverAdapter = createCpuAdapter();
    coverAdapter.sample(0, runtimeObservation(bodies, TEAM_A, "a-2", ball, true));
    // a-1 is the presser, a-2 the second-closest non-attacker → the cover.
    const roles = assignChaseRoles(runtimeObservation(bodies, TEAM_A, "a-2", ball, true), TEAM_A);
    expect(roles.chaserPlayerId).toBe("a-1");
    expect(roles.coverPlayerId).toBe("a-2");
    expect(getCoverMechanismActivations()).toBeGreaterThan(0);
  });

  it("a body inside touch range of an untouched restart ball still plays it", () => {
    const bodies = moveBodies(kickoffBodies(), "a-3", -0.5, 0.5);
    const adapter = createCpuAdapter();
    const frame = adapter.sample(0, runtimeObservation(bodies, TEAM_A, "a-3", { x: 0, y: 0 }, false));
    expect(frame.pressedButtons).not.toBe(0);
    expect(getKickoffFreezeActivations()).toBe(0);
  });
});

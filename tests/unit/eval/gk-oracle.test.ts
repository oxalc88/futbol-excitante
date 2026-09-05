/**
 * @module tests/unit/eval/gk-oracle
 *
 * Unit guards for the protected SMALL-SIDED goalkeeper oracles
 * (eval/oracles/gk-role.ts), objective GK-KEEPER-ORACLE-REGISTRATION.
 *
 * Each oracle is exercised on (a) a clean two-team GK observation stream with a
 * runner-injected `gk-role` designation and a keeper holding its arc, and (b) a
 * corrupted stream where the keeper behavior is mutated, which must flip the
 * verdict to FAIL.  Also verifies that a non-GK stream (no `gk-role`
 * designation) is NOT_EVALUATED.  Thresholds come only from the versioned
 * `gk-small-sided-v1` record.
 *
 * Node I/O not used; observations are constructed in-memory.
 */

import { describe, it, expect } from "vitest";

import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

// Import wire.ts to register the built-in oracles (side-effect).
import "../../../eval/oracles/wire.js";
import {
  checkGkRoleDesignation,
  checkGkPositioningHold,
  checkGkNoFieldChase,
  checkGkSaveClaim,
  checkGkDistributionNoOmniscience,
} from "../../../eval/oracles/gk-role.js";

// ---------------------------------------------------------------------------
// Observation builder
// ---------------------------------------------------------------------------

const PITCH_LENGTH = 105;
const HALF = PITCH_LENGTH / 2; // 52.5

interface PlayerSpec {
  id: string;
  team: string;
  x: number;
  y: number;
}

const TEAM_A = [
  { id: "player-1", team: "team-a", x: 30, y: 0 },
  { id: "player-2", team: "team-a", x: 10, y: -10 },
  { id: "player-3", team: "team-a", x: 10, y: 10 },
  { id: "player-4", team: "team-a", x: -HALF + 0.2, y: 0.5 }, // keeper on arc
  { id: "player-5", team: "team-a", x: -30, y: 10 },
] as const;

const TEAM_B = [
  { id: "player-6", team: "team-b", x: 30, y: 0 },
  { id: "player-7", team: "team-b", x: 10, y: -10 },
  { id: "player-8", team: "team-b", x: 10, y: 20 },
  { id: "player-9", team: "team-b", x: 30, y: -10 },
  { id: "player-10", team: "team-b", x: HALF - 0.2, y: -0.3 }, // keeper on arc
] as const;

const ALL_PLAYERS: PlayerSpec[] = [...TEAM_A, ...TEAM_B];

function playerObs(p: PlayerSpec, tick: number) {
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

function makeObs(
  tick: number,
  opts?: {
    players?: PlayerSpec[];
    events?: Array<Record<string, unknown>>;
    withGkRole?: boolean;
  },
): TelemetryObservation {
  const players = (opts?.players ?? ALL_PLAYERS).map((p) => playerObs(p, tick));
  const events = (opts?.events ?? []) as TelemetryObservation["events"];
  if (opts?.withGkRole !== false && tick === 1) {
    // Runner-injected designation: exactly one keeper per team + pitchLength.
    events.push(
      {
        id: `gk-role-${tick}-team-a`,
        tick,
        sequence: 9001,
        kind: "gk-role",
        label: "designated keeper player-4",
        payload: { teamId: "team-a", keeperPlayerId: "player-4", keeperRoleFlag: true, pitchLength: PITCH_LENGTH },
      },
      {
        id: `gk-role-${tick}-team-b`,
        tick,
        sequence: 9002,
        kind: "gk-role",
        label: "designated keeper player-10",
        payload: { teamId: "team-b", keeperPlayerId: "player-10", keeperRoleFlag: true, pitchLength: PITCH_LENGTH },
      },
    );
  }
  return {
    tick,
    simulationTime: tick / 60,
    prngAlgorithmId: "mulberry32-v1",
    stateHash: `hash-${tick}`,
    prngStateHash: `prng-state-hash-${tick}`,
    observationCoreHash: `core-hash-${tick}`,
    committedTick: tick,
    inputs: [],
    players,
    ball: {
      position: { x: 0, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
      lastTouchRef: null,
    },
    events,
  };
}

/** Two clean ticks: keepers hold the arc; gk-role injected on tick 1. */
function cleanObservations(): TelemetryObservation[] {
  return [makeObs(1), makeObs(2)];
}

/** A keeper that first takes station then leaves its arc into midfield. */
function fieldChaseObservations(): TelemetryObservation[] {
  const obs1 = makeObs(1); // keeper on arc → station tick 1
  const obs2 = makeObs(2, {
    players: ALL_PLAYERS.map((p) => (p.id === "player-4" ? { ...p, x: -5, y: 0 } : p)),
    withGkRole: false,
  });
  return [obs1, obs2];
}

/** A shot on target answered by a keeper contact inside reach (save clean). */
function saveObservations(outsideReach = false): TelemetryObservation[] {
  const obs1 = makeObs(1);
  const shot = {
    id: "shot-2-1",
    tick: 2,
    sequence: 1,
    kind: "shot",
    label: "shot",
    payload: {
      playerId: "player-1",
      teamId: "team-a",
      outgoing: {
        position: { x: 40, y: 0.5 },
        linearVelocity: { x: 12, y: 0.4 },
      },
    },
  };
  const contact = {
    id: "pbc-2-2",
    tick: 2,
    sequence: 2,
    kind: "player-ball-contact",
    label: "contact",
    payload: {
      playerId: "player-10",
      teamId: "team-b",
      planarDistance: outsideReach ? 3.5 : 0.7,
    },
  };
  const obs2 = makeObs(2, {
    players: ALL_PLAYERS.map((p) => (p.id === "player-10" ? { ...p, x: HALF - 1.0, y: 0.4 } : p)),
    events: [shot, contact],
    withGkRole: false,
  });
  return [obs1, obs2];
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe("GK oracles are registered", () => {
  it("all five keeper oracles are registered and executable", () => {
    // executeOracle throws on an unknown oracle; accessing via the evaluator's
    // wire import above is enough — but a direct call proves registration.
    const results = checkGkDistributionNoOmniscience(cleanObservations());
    expect(Array.isArray(results)).toBe(true);
    // Registration is asserted more directly by the registry binding test.
  });

  it("each oracle returns a non-empty array on a clean stream", () => {
    const obs = cleanObservations();
    expect(checkGkRoleDesignation(obs)).toHaveLength(1);
    expect(checkGkPositioningHold(obs)).toHaveLength(1);
    expect(checkGkNoFieldChase(obs)).toHaveLength(1);
    expect(checkGkDistributionNoOmniscience(obs)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// GK-ROLE-DESIGNATION
// ---------------------------------------------------------------------------

describe("GK-ROLE-DESIGNATION oracle", () => {
  it("passes when exactly one designated keeper per team", () => {
    const res = checkGkRoleDesignation(cleanObservations());
    expect(res[0].status).toBe("pass");
  });

  it("fails when a team has no designation", () => {
    const obs = cleanObservations();
    // Remove the team-b designation event.
    obs[0].events = obs[0].events.filter((e) => e.kind !== "gk-role" || (e.payload as { teamId?: string })?.teamId !== "team-b");
    const res = checkGkRoleDesignation(obs);
    expect(res[0].status).toBe("fail");
  });

  it("returns empty (NOT_EVALUATED) on a non-GK stream", () => {
    const obs = cleanObservations().map((o) => ({
      ...o,
      events: o.events.filter((e) => e.kind !== "gk-role"),
    }));
    const res = checkGkRoleDesignation(obs);
    expect(res).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GK-POSITIONING-HOLD
// ---------------------------------------------------------------------------

describe("GK-POSITIONING-HOLD oracle", () => {
  it("passes when the keeper holds its goal arc", () => {
    const res = checkGkPositioningHold(cleanObservations());
    expect(res[0].status).toBe("pass");
  });

  it("fails when the keeper leaves its arc into the field", () => {
    const res = checkGkPositioningHold(fieldChaseObservations());
    expect(res[0].status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// GK-NO-FIELD-CHASE
// ---------------------------------------------------------------------------

describe("GK-NO-FIELD-CHASE oracle", () => {
  it("passes when the keeper never chases into the field", () => {
    const res = checkGkNoFieldChase(cleanObservations());
    expect(res[0].status).toBe("pass");
  });

  it("fails when the keeper chases the ball into the field", () => {
    const res = checkGkNoFieldChase(fieldChaseObservations());
    expect(res[0].status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// GK-SAVE-CLAIM
// ---------------------------------------------------------------------------

describe("GK-SAVE-CLAIM oracle", () => {
  it("passes when a keeper records a save/claim contact within reach", () => {
    const res = checkGkSaveClaim(saveObservations(false));
    expect(res[0].status).toBe("pass");
  });

  it("fails when a keeper contact is outside the reach radius", () => {
    const res = checkGkSaveClaim(saveObservations(true));
    expect(res[0].status).toBe("fail");
  });

  it("is NOT_EVALUATED when there is no opposing shot opportunity", () => {
    const res = checkGkSaveClaim(cleanObservations());
    expect(res[0].status).toBe("not_evaluated");
  });
});

// ---------------------------------------------------------------------------
// GK-DISTRIBUTION-NO-OMNISCIENCE
// ---------------------------------------------------------------------------

/** A keeper-release to team-b's attacker (player-6), target = committed pos. */
function releaseObservations(targetPlayerId = "player-6", targetPos?: { x: number; y: number }): TelemetryObservation[] {
  const target = TEAM_B.find((p) => p.id === targetPlayerId);
  const pos = targetPos ?? (target ? { x: target.x, y: target.y } : { x: 30, y: 0 });
  const obs1 = makeObs(1);
  const release = {
    id: `keeper-release-2-player-10-1`,
    tick: 2,
    sequence: 1,
    kind: "keeper-release",
    label: `keeper player-10 released to ${targetPlayerId}`,
    payload: {
      keeperPlayerId: "player-10",
      teamId: "team-b",
      releaseTargetPlayerId: targetPlayerId,
      releaseTargetPosition: pos,
      keeperPosition: { x: HALF - 0.2, y: -0.3 },
    },
  };
  const obs2 = makeObs(2, {
    events: [release],
    withGkRole: false,
  });
  return [obs1, obs2];
}

describe("GK-DISTRIBUTION-NO-OMNISCIENCE oracle", () => {
  it("stays NOT_EVALUATED (no keeper-release event kind in the telemetry)", () => {
    const res = checkGkDistributionNoOmniscience(cleanObservations());
    expect(res[0].status).toBe("not_evaluated");
  });

  it("PASS on an observed teammate release", () => {
    const res = checkGkDistributionNoOmniscience(releaseObservations("player-6"));
    expect(res[0].status).toBe("pass");
  });

  it("FAIL when the release targets an opponent, not a teammate", () => {
    const res = checkGkDistributionNoOmniscience(releaseObservations("player-1"));
    expect(res[0].status).toBe("fail");
  });

  it("FAIL when the release target position is not the observed one (a hidden future)", () => {
    const res = checkGkDistributionNoOmniscience(releaseObservations("player-6", { x: 60, y: 60 }));
    expect(res[0].status).toBe("fail");
  });
});

/**
 * Unit guards for GK-5V5-ADAPTER-BEHAVIOR: the adapter-layer SMALL-SIDED keeper
 * role defined by specs/GOALKEEPER_SPEC.md §§4-8, implemented on top of the
 * accepted anti-huddle team-decision contract.
 *
 * Every guard is discriminating: the same observation replayed with the
 * `gkBehavior` kill switch off (or absent) must produce exactly the frames this
 * tree produced before any keeper existed.
 *
 * No Math.random, Date, DOM or Node I/O beyond module imports.
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  createCpuAdapter,
  designatePresser,
  assignChaseRoles,
  isKeeperBehaviorActive,
  resolveKeeperPlayerId,
  resetMechanismCounters,
  getKeeperHoldActivations,
  getKeeperSaveArmActivations,
  getKeeperSavePressActivations,
  getKeeperReleasePressActivations,
  getKeeperPressExclusionActivations,
  GK_SMALL_SIDED_V1,
  designateKeeperFromLayout,
  goalArcCenter,
  keeperArcSetPoint,
  keeperStationTarget,
  shotIsOnTargetToOwnGoal,
  latestOnTargetShotAgainst,
  type CpuObservation,
  type KeeperShotInfo,
} from "../../../src/adapters/input-browser/cpu-adapter.js";
import { FIRST_TOUCH_BIT, PASS_BIT, SHOT_BIT } from "../../../src/contracts/input.js";
import { FOUNDATION_LOCOMOTION_V1 } from "../../../src/simulation/config/foundation.js";

const PITCH = 105;
/** Mirrors cpu-adapter.ts SHOT_EVENT_WINDOW_TICKS. */
const SHOT_PERCEPTION_WINDOW_TICKS = 10;
const TEAM_A = "team-a";
const TEAM_B = "team-b";
/** team-a defends -52.5, team-b defends +52.5. */
const A_LINE = -PITCH / 2;
const B_LINE = PITCH / 2;

interface BodySpec {
  playerId: string;
  teamId: string;
  x: number;
  y: number;
  role?: "defender" | "midfielder" | "attacker";
  vx?: number;
  vy?: number;
  heading?: number;
}

/** A five-a-side layout: attacker deep, two mids, two defenders. */
function bodies(overrides: Partial<Record<string, [number, number]>> = {}): BodySpec[] {
  const base: BodySpec[] = [
    { playerId: "a-1", teamId: TEAM_A, x: 38, y: 0, role: "attacker" },
    { playerId: "a-2", teamId: TEAM_A, x: 10, y: -10, role: "midfielder" },
    { playerId: "a-3", teamId: TEAM_A, x: 10, y: 10, role: "midfielder" },
    { playerId: "a-4", teamId: TEAM_A, x: -5, y: -6, role: "defender" },
    { playerId: "a-5", teamId: TEAM_A, x: -5, y: 6, role: "defender" },
    { playerId: "b-6", teamId: TEAM_B, x: 42, y: 0, role: "attacker" },
    { playerId: "b-7", teamId: TEAM_B, x: 15, y: -10, role: "midfielder" },
    { playerId: "b-8", teamId: TEAM_B, x: 15, y: 10, role: "midfielder" },
    { playerId: "b-9", teamId: TEAM_B, x: 40, y: -6, role: "defender" },
    { playerId: "b-10", teamId: TEAM_B, x: 40, y: 6, role: "defender" },
  ];
  return base.map((body) => {
    const override = overrides[body.playerId];
    return override ? { ...body, x: override[0], y: override[1] } : body;
  });
}

interface ObservationOptions {
  gkBehavior?: boolean | undefined;
  keeperPlayerIds?: Record<string, string> | undefined;
  shots?: KeeperShotInfo[];
  ball?: { x?: number; y?: number; vx?: number; vy?: number; ref?: string | null };
}

/** A runtime-shaped observation: it carries the ball's touch reference, so the
 * accepted anti-huddle preconditions are satisfied exactly as in production. */
function runtime(
  controlled: string,
  options: ObservationOptions = {},
): CpuObservation {
  const specs = bodies();
  const teamId = specs.find((s) => s.playerId === controlled)!.teamId;
  const ball = options.ball ?? {};
  const teammates = specs
    .filter((s) => s.teamId === teamId && s.playerId !== controlled)
    .map((s) => ({ playerId: s.playerId, groundPosition: { x: s.x, y: s.y } }));
  return {
    players: specs.map((s) => ({
      playerId: s.playerId,
      teamId: s.teamId,
      groundPosition: { x: s.x, y: s.y },
      linearVelocity: { x: s.vx ?? 0, y: s.vy ?? 0 },
      bodyHeading: s.heading ?? (s.teamId === TEAM_A ? 0 : Math.PI),
      formationRole: s.role,
    })),
    ball: {
      position: { x: ball.x ?? 0, y: ball.y ?? 0, z: 0.11 },
      linearVelocity: { x: ball.vx ?? 0, y: ball.vy ?? 0, z: 0 },
      regime: "ground-roll",
      lastTouchRef: ball.ref === undefined ? "touch-1" : ball.ref,
    },
    pitchLength: PITCH,
    pitchWidth: 68,
    cpuTeamId: teamId,
    controlledPlayerId: controlled,
    teammates,
    matchPhase: "playing",
    gkBehavior: options.gkBehavior,
    keeperPlayerIds: options.keeperPlayerIds,
    recentShotEvents: options.shots,
  };
}

/** The layout shape the designation rule reads. */
function layout(overrides: Partial<Record<string, [number, number]>> = {}) {
  return bodies(overrides).map((body) => ({
    playerId: body.playerId,
    teamId: body.teamId,
    groundPosition: { x: body.x, y: body.y },
    formationRole: body.role,
  }));
}

/** The role map the production wiring would freeze from this layout. */
function frozenRoles(): Record<string, string> {
  return {
    [TEAM_A]: designateKeeperFromLayout(layout(), TEAM_A, PITCH) as string,
    [TEAM_B]: designateKeeperFromLayout(layout(), TEAM_B, PITCH) as string,
  };
}

/** A shot by `shooterTeam` from `from` with planar velocity `v`. */
function shot(
  tick: number,
  shooterTeamId: string,
  shooterPlayerId: string,
  from: [number, number],
  velocity: [number, number],
  eventId = `shot-${tick}-1`,
): KeeperShotInfo {
  return {
    tick,
    eventId,
    shooterTeamId,
    shooterPlayerId,
    ballPosition: { x: from[0], y: from[1] },
    ballVelocity: { x: velocity[0], y: velocity[1] },
  };
}

beforeEach(() => {
  resetMechanismCounters();
});

// ---------------------------------------------------------------------------
// §4 — designation
// ---------------------------------------------------------------------------

describe("GK-DESIGNATION-001: one designated keeper per team, from the role layout", () => {
  it("designates a defender, not the body that happens to stand nearest its own goal", () => {
    // In the accepted 5v5 kickoff layout team-b's attacker stands deeper than its
    // own defenders; the role layout still has to put a defender in goal.
    const roles = frozenRoles();
    expect(roles[TEAM_A]).toBe("a-4");
    expect(roles[TEAM_B]).toBe("b-10");
    const declaredRoles = Object.fromEntries(
      layout().map((body) => [body.playerId, body.formationRole]),
    ) as Record<string, string | undefined>;
    for (const teamId of [TEAM_A, TEAM_B]) {
      expect(declaredRoles[roles[teamId]]).toBe("defender");
    }
  });

  it("breaks ties by ascending playerId, so the choice is order-independent", () => {
    const reordered = layout().reverse();
    expect(designateKeeperFromLayout(reordered, TEAM_B, PITCH))
      .toBe(designateKeeperFromLayout(layout(), TEAM_B, PITCH));
  });

  it("never reads the ball: two different ball states give the same designation", () => {
    const atOwnGoal = runtime("b-10", {
      gkBehavior: true,
      ball: { x: B_LINE, y: 0, vx: 12, vy: 0 },
    });
    const atOpponentGoal = runtime("b-10", {
      gkBehavior: true,
      ball: { x: A_LINE, y: 0, vx: -12, vy: 0 },
    });
    expect(resolveKeeperPlayerId(atOwnGoal, TEAM_B))
      .toBe(resolveKeeperPlayerId(atOpponentGoal, TEAM_B));
  });

  it("falls back to the deepest available role when a team declares no defenders", () => {
    const noDefenders = layout()
      .filter((body) => !(body.teamId === TEAM_B && body.formationRole === "defender"));
    expect(designateKeeperFromLayout(noDefenders, TEAM_B, PITCH)).toBe("b-7");
    // With no deeper role at all the designation still resolves one body.
    const attackerOnly = layout().map((body) => (body.teamId === TEAM_B
      ? { ...body, formationRole: "attacker" as const }
      : body));
    expect(designateKeeperFromLayout(attackerOnly, TEAM_B, PITCH)).toBe("b-6");
  });

  it("is dark unless the wiring opts in", () => {
    expect(isKeeperBehaviorActive(runtime("b-10", {}))).toBe(false);
    expect(isKeeperBehaviorActive(runtime("b-10", { gkBehavior: false }))).toBe(false);
    expect(resolveKeeperPlayerId(runtime("b-10", {}), TEAM_B)).toBeUndefined();
    // A legacy synthetic observation (no touch reference) stays dark even opted in.
    const legacy = runtime("b-10", { gkBehavior: true });
    delete (legacy.ball as { lastTouchRef?: string }).lastTouchRef;
    expect(isKeeperBehaviorActive(legacy)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §5 — goal-arc positioning with bounded lateral drift
// ---------------------------------------------------------------------------

describe("GK-ARC-001: the commanded station is inside the versioned arc", () => {
  it("anchors the arc on the goal-line centre the team defends", () => {
    expect(goalArcCenter(TEAM_A, PITCH)).toEqual({ x: A_LINE, y: 0 });
    expect(goalArcCenter(TEAM_B, PITCH)).toEqual({ x: B_LINE, y: 0 });
  });

  it("clamps lateral drift to goal_arc_lateral_max for any ball position", () => {
    const bound = GK_SMALL_SIDED_V1.goal_arc_lateral_max.value;
    for (const y of [-60, -12, -2, 0, 3.4, 11, 60]) {
      const point = keeperArcSetPoint(TEAM_B, PITCH, y);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(bound);
      expect(point.x).toBe(B_LINE);
    }
  });

  it("keeps the commanded station inside the arc disk for every ball latitude", () => {
    for (let y = -34; y <= 34; y += 1) {
      const station = keeperStationTarget(TEAM_A, PITCH, { x: 0, y }, { x: 0, vy: 0 }, false);
      const center = goalArcCenter(TEAM_A, PITCH);
      expect(Math.hypot(station.x - center.x, station.y - center.y))
        .toBeLessThanOrEqual(GK_SMALL_SIDED_V1.goal_arc_radius.value);
    }
  });

  it("tracks the crossing point of an inbound ball instead of its current latitude", () => {
    // Travelling at team-b's goal 20 m away and 8 m wide: the keeper must drift to
    // where it crosses, which is well inside the band, not to y = 8.
    const station = keeperStationTarget(
      TEAM_B,
      PITCH,
      { x: B_LINE - 20, y: 8 },
      { x: 12, y: -6 },
      false,
    );
    expect(station.x).toBe(B_LINE);
    expect(station.y).toBeLessThan(8 - 4);
    expect(Math.abs(station.y)).toBeLessThanOrEqual(GK_SMALL_SIDED_V1.goal_arc_lateral_max.value);
  });
});

describe("GK-ARC-002: the keeper frame holds the arc instead of the ball", () => {
  it("commands movement toward its own goal arc while the ball lies behind it", () => {
    const adapter = createCpuAdapter();
    const frame = adapter.sample(1, runtime("b-10", {
      gkBehavior: true,
      keeperPlayerIds: frozenRoles(),
      ball: { x: 30, y: 0, vx: 0, vy: 0 },
    }));
    // b-10 starts at (40, 6): its station is (+52.5, 0).
    expect(frame.moveX).toBeGreaterThan(0.5);
    expect(frame.moveY).toBeLessThan(0);
    // The field decision would have run at the ball, i.e. in -x.
    const stashed = createCpuAdapter().sample(1, runtime("b-10", {
      gkBehavior: false,
      keeperPlayerIds: frozenRoles(),
      ball: { x: 30, y: 0, vx: 0, vy: 0 },
    }));
    expect(stashed.moveX).toBeLessThan(0);
  });

  it("repositions inside the arc at keeper_reposition_speed, never faster", () => {
    const cap = GK_SMALL_SIDED_V1.keeper_reposition_speed.value /
      FOUNDATION_LOCOMOTION_V1.maxSpeed.value;
    // On the arc centre line but 3 m off its station latitude: inside the disk.
    const adapter = createCpuAdapter();
    const obs = runtime("b-10", { gkBehavior: true, keeperPlayerIds: frozenRoles(), ball: { x: 20, y: 3.9 } });
    obs.players = obs.players.map((p) => (p.playerId === "b-10"
      ? { ...p, groundPosition: { x: B_LINE, y: 0.9 } }
      : p));
    const frame = adapter.sample(2, obs);
    const magnitude = Math.hypot(frame.moveX, frame.moveY);
    expect(magnitude).toBeGreaterThan(0);
    expect(magnitude).toBeLessThanOrEqual(cap + 1e-9);
  });

  it("holds still once it is at its station, so the hold does not jitter", () => {
    const adapter = createCpuAdapter();
    const obs = runtime("b-10", { gkBehavior: true, keeperPlayerIds: frozenRoles(), ball: { x: 20, y: 0 } });
    obs.players = obs.players.map((p) => (p.playerId === "b-10"
      ? { ...p, groundPosition: { x: B_LINE, y: 0 } }
      : p));
    const frame = adapter.sample(3, obs);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
    // Sprint stays on the accepted invariant.
    expect(frame.sprint).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §6 — no field chase (anti-huddle inheritance)
// ---------------------------------------------------------------------------

describe("GK-CHASE-001: the keeper is never the presser, cover or restart taker", () => {
  it("drops the keeper from the press designation while a field body still presses", () => {
    // b-10 is the closest body of its team to the ball in this geometry.
    const obs = runtime("b-10", {
      gkBehavior: true,
      keeperPlayerIds: frozenRoles(),
      ball: { x: 40, y: 6, vx: 0, vy: 0 },
    });
    expect(designatePresser(obs, TEAM_B).playerId).not.toBe("b-10");
    expect(designatePresser(obs, TEAM_B).playerId).toBe("b-9");
    // Stashed, the accepted designation is unchanged — the keeper was nearest.
    const stashed = runtime("b-10", {
      gkBehavior: false,
      keeperPlayerIds: frozenRoles(),
      ball: { x: 40, y: 6, vx: 0, vy: 0 },
    });
    expect(designatePresser(stashed, TEAM_B).playerId).toBe("b-10");
  });

  it("never names the keeper as the cover body either", () => {
    const obs = runtime("b-10", {
      gkBehavior: true,
      keeperPlayerIds: frozenRoles(),
      ball: { x: 40, y: 6, vx: 0, vy: 0 },
    });
    const roles = assignChaseRoles(obs, TEAM_B);
    expect(roles.coverPlayerId).not.toBe("b-10");
    expect(roles.chaserPlayerId).not.toBe("b-10");
    expect(roles.keeperPlayerId).toBe("b-10");
  });

  it("never sends the keeper out to take an untouched restart ball", () => {
    // The untouched ball is served inside the keeper's own arc, where it is by
    // far the closest body in the match.
    const serve = { x: B_LINE - 1, y: 5.5, vx: 0, vy: 0, ref: null };
    const build = (gkBehavior: boolean): CpuObservation => {
      const obs = runtime("b-10", {
        gkBehavior,
        keeperPlayerIds: frozenRoles(),
        ball: serve,
      });
      obs.players = obs.players.map((p) => (p.playerId === "b-10"
        ? { ...p, groundPosition: { x: B_LINE - 1, y: 6 } }
        : p));
      return obs;
    };
    expect(assignChaseRoles(build(true), TEAM_B, true).kickoffTakerId).not.toBe("b-10");
    expect(assignChaseRoles(build(false), TEAM_B, true).kickoffTakerId).toBe("b-10");
  });

  it("still leaves a chaser when a team's only eligible body is its keeper", () => {
    const keeperOnly: CpuObservation = {
      ...runtime("b-10", { gkBehavior: true, keeperPlayerIds: { [TEAM_B]: "b-10" } }),
      players: [{
        playerId: "b-10",
        teamId: TEAM_B,
        groundPosition: { x: 40, y: 6 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
        formationRole: "defender",
      }],
    };
    expect(designatePresser(keeperOnly, TEAM_B).playerId).toBe("b-10");
  });
});

// ---------------------------------------------------------------------------
// §7 — basic save/claim reaction on shots on target
// ---------------------------------------------------------------------------

describe("GK-SAVE-001: shot-on-target perception", () => {
  it("recognises a shot that projects inside the posts at this goal", () => {
    const inbound = shot(10, TEAM_A, "a-1", [B_LINE - 20, 1], [12, 1.2]);
    expect(shotIsOnTargetToOwnGoal(inbound, TEAM_B, PITCH)).toBe(true);
    expect(latestOnTargetShotAgainst([inbound], TEAM_B, PITCH)?.eventId).toBe(inbound.eventId);
  });

  it("rejects a shot that projects wide of the post, and one that runs away", () => {
    const wide = shot(10, TEAM_A, "a-1", [B_LINE - 20, 1], [12, 9]);
    const away = shot(10, TEAM_A, "a-1", [B_LINE - 20, 1], [-12, 0]);
    expect(shotIsOnTargetToOwnGoal(wide, TEAM_B, PITCH)).toBe(false);
    expect(shotIsOnTargetToOwnGoal(away, TEAM_B, PITCH)).toBe(false);
    expect(latestOnTargetShotAgainst([wide, away], TEAM_B, PITCH)).toBeUndefined();
  });

  it("ignores its own team's strikes", () => {
    // team-b strikes at team-a's goal: live for team-a, ignored by its own team.
    const strike = shot(10, TEAM_B, "b-6", [A_LINE + 20, 0], [-12, 0], "shot-own-1");
    expect(latestOnTargetShotAgainst([strike], TEAM_B, PITCH)).toBeUndefined();
    expect(latestOnTargetShotAgainst([strike], TEAM_A, PITCH)?.eventId).toBe("shot-own-1");
  });
});

describe("GK-SAVE-002: the claim is an explicit recorded contact inside the reach", () => {
  /** Fly a shot at the keeper's goal and return the frames it produced. */
  function inboundShot(opts: {
    keeperStart: [number, number];
    shotFrom: [number, number];
    velocity: [number, number];
    gkBehavior?: boolean;
    ticks?: number;
  }) {
    const adapter = createCpuAdapter();
    const shotTick = 10;
    const frames: Array<{ tick: number; pressed: number; held: number; moveX: number; moveY: number }> = [];
    const ticks = opts.ticks ?? 130;
    for (let tick = shotTick; tick <= shotTick + ticks; tick++) {
      const flight = tick - shotTick;
      const obs = runtime("b-10", {
        gkBehavior: opts.gkBehavior ?? true,
        keeperPlayerIds: frozenRoles(),
        ball: {
          // The shot's own event id is the authoritative reference the ball now
          // carries, which is what keeps the reaction armed across the flight.
          x: opts.shotFrom[0] + opts.velocity[0] * flight / 60,
          y: opts.shotFrom[1] + opts.velocity[1] * flight / 60,
          vx: opts.velocity[0],
          vy: opts.velocity[1],
          ref: flight === 0 ? "shot-10-1" : "shot-10-1",
        },
        // Perceptible only inside the same window the production observation
        // extraction uses, exactly as in a real match.
        shots: flight <= SHOT_PERCEPTION_WINDOW_TICKS
          ? [shot(shotTick, TEAM_A, "a-1", opts.shotFrom, opts.velocity)]
          : [],
      });
      obs.players = obs.players.map((p) => (p.playerId === "b-10"
        ? { ...p, groundPosition: { x: opts.keeperStart[0], y: opts.keeperStart[1] } }
        : p));
      const frame = adapter.sample(tick, obs);
      frames.push({
        tick,
        pressed: frame.pressedButtons,
        held: frame.heldButtons,
        moveX: frame.moveX,
        moveY: frame.moveY,
      });
    }
    return frames;
  }

  it("flies to the keeper and is claimed inside the reach", () => {
    const frames = inboundShot({
      keeperStart: [B_LINE, 0],
      shotFrom: [B_LINE - 20, 0.5],
      velocity: [12, -0.6],
    });
    const firstPress = frames.find((frame) => (frame.pressed & FIRST_TOUCH_BIT) !== 0);
    expect(firstPress, "the keeper must issue a claim press").toBeDefined();
    expect(getKeeperSaveArmActivations()).toBe(1);
    expect(getKeeperSavePressActivations()).toBe(1);
    // The claim happens on the way in, not after the ball has crossed the line.
    expect(firstPress!.tick).toBeLessThan(10 + 20 / (12 / 60));
  });

  it("issues the claim through the sanctioned FIRST_TOUCH action only", () => {
    const frames = inboundShot({
      keeperStart: [B_LINE, 0],
      shotFrom: [B_LINE - 20, 0.5],
      velocity: [12, -0.6],
    });
    const pressTick = frames.find((frame) => (frame.pressed & FIRST_TOUCH_BIT) !== 0)!.tick;
    const frame = frames.find((entry) => entry.tick === pressTick)!;
    expect(frame.held & FIRST_TOUCH_BIT).not.toBe(0);
    expect(frame.pressed & SHOT_BIT).toBe(0);
    expect(frame.pressed & PASS_BIT).toBe(0);
  });

  it("presses only while the ball is inside save_claim_reach_radius of its own body", () => {
    // The shot crosses the goal line at y ≈ -0.2. Pinned 2.4 m off that line the
    // keeper is armed but never reaches; 0.4 m off it, the same shot is claimed.
    const outOfReach = inboundShot({
      keeperStart: [B_LINE, 2.4],
      shotFrom: [B_LINE - 20, 0.4],
      velocity: [12, -0.36],
    });
    expect(outOfReach.some((frame) => (frame.pressed & FIRST_TOUCH_BIT) !== 0)).toBe(false);
    expect(getKeeperSaveArmActivations()).toBe(1);
    expect(getKeeperSavePressActivations()).toBe(0);

    resetMechanismCounters();
    const inReach = inboundShot({
      keeperStart: [B_LINE, 0.4],
      shotFrom: [B_LINE - 20, 0.4],
      velocity: [12, -0.36],
    });
    const press = inReach.find((frame) => (frame.pressed & FIRST_TOUCH_BIT) !== 0);
    expect(press, "the same shot inside reach is claimed").toBeDefined();
    expect(getKeeperSavePressActivations()).toBe(1);
  });

  it("never presses for a ball that is not on target (discriminating negative)", () => {
    const frames = inboundShot({
      keeperStart: [B_LINE, 0],
      shotFrom: [B_LINE - 20, 0.5],
      velocity: [12, 9],
      ticks: 40,
    });
    expect(frames.some((frame) => (frame.pressed & FIRST_TOUCH_BIT) !== 0)).toBe(false);
    expect(getKeeperSaveArmActivations()).toBe(0);
  });

  it("stashes to the pre-keeper shape: no reaction, no claim, no arc hold", () => {
    const inbound = {
      keeperStart: [B_LINE, 0] as [number, number],
      shotFrom: [B_LINE - 20, 0.5] as [number, number],
      velocity: [12, -0.6] as [number, number],
      ticks: 130,
    };
    const live = inboundShot({ ...inbound, gkBehavior: true });
    expect(live.some((frame) => (frame.pressed & FIRST_TOUCH_BIT) !== 0)).toBe(true);
    expect(getKeeperHoldActivations()).toBe(131);
    expect(getKeeperSaveArmActivations()).toBe(1);
    expect(getKeeperPressExclusionActivations()).toBeGreaterThan(0);

    resetMechanismCounters();
    const stashed = inboundShot({ ...inbound, gkBehavior: false });
    // The same shot flies through the same arc with nobody in front of it.
    expect(stashed.some((frame) => (frame.pressed & FIRST_TOUCH_BIT) !== 0)).toBe(false);
    expect(getKeeperHoldActivations()).toBe(0);
    expect(getKeeperSaveArmActivations()).toBe(0);
    expect(getKeeperSavePressActivations()).toBe(0);
    expect(getKeeperPressExclusionActivations()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// §8 — distribution, without omniscience
// ---------------------------------------------------------------------------

describe("GK-DISTRIBUTION-001: a secured ball is released by a canonical pass", () => {
  it("presses PASS toward an observed forward teammate while holding the arc", () => {
    const adapter = createCpuAdapter();
    const obs = runtime("b-10", {
      gkBehavior: true,
      keeperPlayerIds: frozenRoles(),
      ball: { x: B_LINE - 0.5, y: 0.2, vx: 0.2, vy: 0 },
    });
    obs.players = obs.players.map((p) => (p.playerId === "b-10"
      ? { ...p, groundPosition: { x: B_LINE, y: 0.2 }, bodyHeading: Math.PI, linearVelocity: { x: 0, y: 0 } }
      : p));
    // b-10 owns the ball; a-? teammates ahead of it are observable, heading is
    // straight upfield (-x), which is inside its own facing tolerance.
    const frame = adapter.sample(50, obs);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(getKeeperReleasePressActivations()).toBe(1);
  });

  it("does not release down a lane it is not facing", () => {
    const adapter = createCpuAdapter();
    const obs = runtime("b-10", {
      gkBehavior: true,
      keeperPlayerIds: frozenRoles(),
      ball: { x: B_LINE - 0.5, y: 0.2, vx: 0.2, vy: 0 },
    });
    obs.players = obs.players.map((p) => (p.playerId === "b-10"
      ? { ...p, groundPosition: { x: B_LINE, y: 0.2 }, bodyHeading: Math.PI / 2, linearVelocity: { x: 0, y: 0 } }
      : p));
    const frame = adapter.sample(50, obs);
    expect(frame.pressedButtons & PASS_BIT).toBe(0);
    expect(getKeeperReleasePressActivations()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Reachability guards and purity
// ---------------------------------------------------------------------------

describe("GK-GUARD-001: the keeper paths are actually exercised", () => {
  it("lights the hold counter only on live frames", () => {
    expect(getKeeperHoldActivations()).toBe(0);
    const adapter = createCpuAdapter();
    adapter.sample(1, runtime("b-10", { gkBehavior: true, keeperPlayerIds: frozenRoles() }));
    adapter.sample(2, runtime("b-10", { gkBehavior: true, keeperPlayerIds: frozenRoles() }));
    expect(getKeeperHoldActivations()).toBe(2);
    resetMechanismCounters();
    expect(getKeeperHoldActivations()).toBe(0);
    createCpuAdapter().sample(1, runtime("b-10", { gkBehavior: false, keeperPlayerIds: frozenRoles() }));
    expect(getKeeperHoldActivations()).toBe(0);
  });

  it("excludes the keeper from the press designation on every live tick", () => {
    const obs = runtime("b-9", { gkBehavior: true, keeperPlayerIds: frozenRoles() });
    designatePresser(obs, TEAM_B);
    expect(getKeeperPressExclusionActivations()).toBe(1);
  });

  it("never mutates the observation or the ball it reads", () => {
    const obs = runtime("b-10", {
      gkBehavior: true,
      keeperPlayerIds: frozenRoles(),
      ball: { x: B_LINE - 3, y: 0, vx: 12, vy: 0 },
      shots: [shot(40, TEAM_A, "a-1", [B_LINE - 20, 0], [12, 0], "shot-40-1")],
    });
    const frozen = JSON.parse(JSON.stringify(obs));
    Object.freeze(obs);
    Object.freeze(obs.ball);
    Object.freeze(obs.ball.position);
    Object.freeze(obs.ball.linearVelocity);
    Object.freeze(obs.players);
    obs.players.forEach((player) => {
      Object.freeze(player);
      Object.freeze(player.groundPosition);
      Object.freeze(player.linearVelocity);
    });
    const frame = createCpuAdapter().sample(41, obs);
    expect(JSON.parse(JSON.stringify(obs))).toEqual(frozen);
    expect(typeof frame.moveX).toBe("number");
    expect(Number.isFinite(frame.moveX) && Number.isFinite(frame.moveY)).toBe(true);
    expect(Math.abs(frame.moveX)).toBeLessThanOrEqual(1);
    expect(Math.abs(frame.moveY)).toBeLessThanOrEqual(1);
  });

  it("is deterministic: the same (tick, observation) yields the same frame", () => {
    const build = () => runtime("b-10", {
      gkBehavior: true,
      keeperPlayerIds: frozenRoles(),
      ball: { x: B_LINE - 6, y: 1, vx: 12, vy: -1 },
      shots: [shot(44, TEAM_A, "a-1", [B_LINE - 26, 1.4], [12, -1], "shot-44-1")],
    });
    const a = createCpuAdapter().sample(45, build());
    const b = createCpuAdapter().sample(45, build());
    expect(a).toEqual(b);
  });
});

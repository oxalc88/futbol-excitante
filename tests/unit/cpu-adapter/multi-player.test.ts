/**
 * @module tests/unit/cpu-adapter/multi-player
 *
 * Tests for multi-player CPU support — each adapter controls
 * a distinct player via `controlledPlayerId`.
 *
 * Covers:
 *  1. CPU adapter uses controlledPlayerId to find its player
 *  2. CPU adapter falls back to players[0] when controlledPlayerId is not set
 *  3. Multiple adapters controlling different players produce different movement
 *  4. Determinism preserved across adapters
 *
 * All values are provisional (unmeasured PES 2017).
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCpuAdapter,
  buildCpuObservation,
  type CpuAdapter,
  type CpuObservation,
} from "../../../src/adapters/input-browser/cpu-adapter.js";
import {
  type PlayerState,
  type BallState,
  type WorldState,
} from "../../../src/contracts/state.js";

// ===========================================================================
// 1. controlledPlayerId: CPU adapter uses it to find its player
// ===========================================================================

describe("CPU-MULTIPLAYER-001: CPU adapter uses controlledPlayerId", () => {
  it("when controlledPlayerId is set, finds that player not players[0]", () => {
    // Two players: players[0] is player-a, controlledPlayerId is player-b.
    // player-a at (0, 0), player-b at (20, 10), ball at (10, 5).
    const obs: CpuObservation = {
      players: [
        {
          playerId: "player-a",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
        },
        {
          playerId: "player-b",
          teamId: "team-a",
          groundPosition: { x: 20, y: 10 },
          linearVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
        },
      ],
      ball: {
        position: { x: 10, y: 5, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
      pitchLength: 105,
      pitchWidth: 68,
      cpuTeamId: "team-a",
      controlledPlayerId: "player-b",
    };

    const adapter = createCpuAdapter();
    const frame = adapter.sample(0, obs);

    // player-b is at (20, 10), ball at (10, 5).
    // Direction from player-b to ball: dx=-10, dy=-5.
    // Normalized: moveX < 0, moveY < 0.
    expect(frame.moveX).toBeLessThan(0);
    expect(frame.moveY).toBeLessThan(0);
  });

  it("control of player-a when controlledPlayerId is 'player-a'", () => {
    const obs: CpuObservation = {
      players: [
        {
          playerId: "player-a",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
        },
        {
          playerId: "player-b",
          teamId: "team-a",
          groundPosition: { x: 20, y: 10 },
          linearVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
        },
      ],
      ball: {
        position: { x: 5, y: 3, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
      pitchLength: 105,
      pitchWidth: 68,
      cpuTeamId: "team-a",
      controlledPlayerId: "player-a",
    };

    const adapter = createCpuAdapter();
    const frame = adapter.sample(0, obs);

    // player-a is at (0, 0), ball at (5, 3).
    // Direction: dx=5, dy=3 → moveX > 0, moveY > 0.
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveY).toBeGreaterThan(0);
  });

  it("controlledPlayerId not found in players → neutral frame", () => {
    const obs: CpuObservation = {
      players: [
        {
          playerId: "player-a",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
        },
      ],
      ball: {
        position: { x: 5, y: 3, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
      pitchLength: 105,
      pitchWidth: 68,
      cpuTeamId: "team-a",
      controlledPlayerId: "nonexistent-player",
    };

    const adapter = createCpuAdapter();
    const frame = adapter.sample(0, obs);

    // No matching player → neutral frame.
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
    expect(frame.sprint).toBe(0);
    expect(frame.heldButtons).toBe(0);
    expect(frame.pressedButtons).toBe(0);
  });
});

// ===========================================================================
// 2. Fallback: when controlledPlayerId is not set, uses players[0]
// ===========================================================================

describe("CPU-MULTIPLAYER-002: fallback to players[0] when controlledPlayerId not set", () => {
  it("undefined controlledPlayerId → uses first player", () => {
    const obs: CpuObservation = {
      players: [
        {
          playerId: "player-a",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
        },
      ],
      ball: {
        position: { x: 10, y: 5, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
      pitchLength: 105,
      pitchWidth: 68,
      cpuTeamId: "team-a",
      // No controlledPlayerId — should fall back to players[0].
    };

    const adapter = createCpuAdapter();
    const frame = adapter.sample(0, obs);

    // Should chase ball from (0,0) to (10,5) → moveX > 0, moveY > 0.
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveY).toBeGreaterThan(0);
  });

  it("empty-string controlledPlayerId → uses players[0]", () => {
    const obs: CpuObservation = {
      players: [
        {
          playerId: "player-a",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
        },
      ],
      ball: {
        position: { x: 10, y: 5, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
      pitchLength: 105,
      pitchWidth: 68,
      cpuTeamId: "team-a",
      controlledPlayerId: "",
    };

    const adapter = createCpuAdapter();
    const frame = adapter.sample(0, obs);

    // Empty string doesn't match any player → neutral frame (no match fallback
    // to players[0]). Wait — the logic: controlledPlayerId is "" (truthy check
    // on string emptiness: "". length > 0 is false, so it skips the lookup
    // and falls back to players[0]).

    // Actually in our implementation: if (controlledPlayerId) checks truthiness,
    // "" is falsy, so it skips the lookup and uses players[0].
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveY).toBeGreaterThan(0);
  });

  it("backwards compat: old code without controlledPlayerId still works", () => {
    // This mimics the existing tests that don't set controlledPlayerId.
    const obs: CpuObservation = makeCpuObservation(0, 0, 10, 5, 0, 0, "team-a");
    const adapter = createCpuAdapter();
    const frame = adapter.sample(0, obs);

    // Chases ball → positive movement.
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveY).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 3. Multiple adapters, different players → different movement
// ===========================================================================

describe("CPU-MULTIPLAYER-003: multiple adapters control different players", () => {
  it("two adapters, same world state → different moves for different players", () => {
    // Player-a at (0, 0), player-b at (20, 10).
    // Ball at (10, 5).
    //
    // Adapter for player-a: chases ball from (0,0) to (10,5) → direction ≈ (0.894, 0.447).
    // Adapter for player-b: chases ball from (20,10) to (10,5) → direction ≈ (-0.894, -0.447).
    const adapterA = createCpuAdapter();
    const adapterB = createCpuAdapter();

    const obsA: CpuObservation = {
      players: [
        {
          playerId: "player-a",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
        },
        {
          playerId: "player-b",
          teamId: "team-a",
          groundPosition: { x: 20, y: 10 },
          linearVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
        },
      ],
      ball: {
        position: { x: 10, y: 5, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
      pitchLength: 105,
      pitchWidth: 68,
      cpuTeamId: "team-a",
      controlledPlayerId: "player-a",
    };

    const obsB: CpuObservation = {
      players: obsA.players,
      ball: obsA.ball,
      pitchLength: obsA.pitchLength,
      pitchWidth: obsA.pitchWidth,
      cpuTeamId: obsA.cpuTeamId,
      controlledPlayerId: "player-b",
    };

    const frameA = adapterA.sample(0, obsA);
    const frameB = adapterB.sample(0, obsB);

    // Player-a moves toward ball: both positive.
    expect(frameA.moveX).toBeGreaterThan(0);
    expect(frameA.moveY).toBeGreaterThan(0);

    // Player-b moves toward ball from the opposite side: both negative.
    expect(frameB.moveX).toBeLessThan(0);
    expect(frameB.moveY).toBeLessThan(0);

    // They are clearly different.
    expect(frameA.moveX).not.toBe(frameB.moveX);
    expect(frameA.moveY).not.toBe(frameB.moveY);
  });

  it("three adapters, three positions → three distinct movement vectors", () => {
    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();
    const a3 = createCpuAdapter();

    // Three players at different corners, ball in the center.
    const ballPos = { x: 0, y: 0, z: 0.11 };

    const obs1: CpuObservation = {
      players: [
        {
          playerId: "p1", teamId: "team-a",
          groundPosition: { x: -20, y: -15 },
          linearVelocity: { x: 0, y: 0 }, bodyHeading: 0,
        },
        {
          playerId: "p2", teamId: "team-a",
          groundPosition: { x: 20, y: 15 },
          linearVelocity: { x: 0, y: 0 }, bodyHeading: 0,
        },
        {
          playerId: "p3", teamId: "team-a",
          groundPosition: { x: 0, y: 20 },
          linearVelocity: { x: 0, y: 0 }, bodyHeading: 0,
        },
      ],
      ball: { position: ballPos, linearVelocity: { x: 0, y: 0, z: 0 }, regime: "ground-roll" },
      pitchLength: 105,
      pitchWidth: 68,
      cpuTeamId: "team-a",
      controlledPlayerId: "p1",
    };

    const obs2: CpuObservation = {
      players: obs1.players,
      ball: obs1.ball,
      pitchLength: obs1.pitchLength,
      pitchWidth: obs1.pitchWidth,
      cpuTeamId: obs1.cpuTeamId,
      controlledPlayerId: "p2",
    };

    const obs3: CpuObservation = {
      players: obs1.players,
      ball: obs1.ball,
      pitchLength: obs1.pitchLength,
      pitchWidth: obs1.pitchWidth,
      cpuTeamId: obs1.cpuTeamId,
      controlledPlayerId: "p3",
    };

    const f1 = a1.sample(0, obs1);
    const f2 = a2.sample(0, obs2);
    const f3 = a3.sample(0, obs3);

    // p1 at (-20,-15) → ball at (0,0): moveX > 0, moveY > 0.
    expect(f1.moveX).toBeGreaterThan(0);
    expect(f1.moveY).toBeGreaterThan(0);

    // p2 at (20,15) → ball at (0,0): moveX < 0, moveY < 0.
    expect(f2.moveX).toBeLessThan(0);
    expect(f2.moveY).toBeLessThan(0);

    // p3 at (0,20) → ball at (0,0): moveX ≈ 0, moveY < 0.
    expect(Math.abs(f3.moveX)).toBeLessThan(0.01);
    expect(f3.moveY).toBeLessThan(0);

    // All three vectors are distinct.
    const distinctCount = new Set([
      `${f1.moveX},${f1.moveY}`,
      `${f2.moveX},${f2.moveY}`,
      `${f3.moveX},${f3.moveY}`,
    ]).size;
    expect(distinctCount).toBe(3);
  });

  it("one pursues ball, one goes to goal (possession) → different strategies", () => {
    // Adapter A: controls player at (0, 0), ball far → pursuit.
    // Adapter B: controls player at (45, 0), ball at (46, 0) with possession → offense.
    const aPursuit = createCpuAdapter();
    const aOffense = createCpuAdapter();

    const obsPursuit: CpuObservation = {
      players: [
        {
          playerId: "chaser", teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 }, bodyHeading: 0,
        },
      ],
      ball: {
        position: { x: 30, y: 20, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
      pitchLength: 105,
      pitchWidth: 68,
      cpuTeamId: "team-a",
      controlledPlayerId: "chaser",
    };

    // Pre-gain possession for the offense adapter.
    const obsOffense: CpuObservation = {
      players: [
        {
          playerId: "attacker", teamId: "team-a",
          groundPosition: { x: 45, y: 0 },
          linearVelocity: { x: 0, y: 0 }, bodyHeading: 0,
        },
      ],
      ball: {
        position: { x: 46, y: 0, z: 0.11 },
        linearVelocity: { x: 0.5, y: 0.2, z: 0 },
        regime: "ground-roll",
      },
      pitchLength: 105,
      pitchWidth: 68,
      cpuTeamId: "team-a",
      controlledPlayerId: "attacker",
    };

    // Tick 0: both in pursuit (no possession yet).
    const f0p = aPursuit.sample(0, obsPursuit);
    const f0o = aOffense.sample(0, obsOffense);

    // Tick 1: offense adapter gains possession (ball was in range tick 0).
    aPursuit.sample(1, obsPursuit);
    aOffense.sample(1, obsOffense);

    const f1p = aPursuit.sample(2, obsPursuit);
    const f1o = aOffense.sample(2, obsOffense);

    // Pursuit player still chases ball (far away) → moveX > 0, moveY > 0.
    expect(f1p.moveX).toBeGreaterThan(0);
    expect(f1p.moveY).toBeGreaterThan(0);

    // Possession player moves toward goal at x=52.5 (slight) → moveX > 0.
    // And no FIRST_TOUCH (in offense mode).
    expect(f1o.moveX).toBeGreaterThan(0);
    expect(f1o.heldButtons & 1).toBe(0); // FIRST_TOUCH_BIT = 1
  });
});

// ===========================================================================
// 4. Determinism preserved
// ===========================================================================

describe("CPU-MULTIPLAYER-004: determinism preserved with controlledPlayerId", () => {
  it("same controlledPlayerId, same observation → identical frames across independent adapters", () => {
    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();

    const obs: CpuObservation = {
      players: [
        {
          playerId: "player-a",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
        },
      ],
      ball: {
        position: { x: 12, y: -7, z: 0.11 },
        linearVelocity: { x: 1.5, y: 0.8, z: 0 },
        regime: "ground-roll",
      },
      pitchLength: 105,
      pitchWidth: 68,
      cpuTeamId: "team-a",
      controlledPlayerId: "player-a",
    };

    for (let tick = 0; tick < 20; tick++) {
      const f1 = a1.sample(tick, obs);
      const f2 = a2.sample(tick, obs);

      expect(f1.moveX).toBe(f2.moveX);
      expect(f1.moveY).toBe(f2.moveY);
      expect(f1.heldButtons).toBe(f2.heldButtons);
      expect(f1.pressedButtons).toBe(f2.pressedButtons);
      expect(f1.sprint).toBe(f2.sprint);
    }
  });

  it("controlledPlayerId lookup doesn't break determinism", () => {
    const obs: CpuObservation = {
      players: [
        {
          playerId: "a", teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 }, bodyHeading: 0,
        },
        {
          playerId: "b", teamId: "team-a",
          groundPosition: { x: 30, y: 20 },
          linearVelocity: { x: 0, y: 0 }, bodyHeading: 0,
        },
        {
          playerId: "c", teamId: "team-a",
          groundPosition: { x: -15, y: 25 },
          linearVelocity: { x: 0, y: 0 }, bodyHeading: 0,
        },
      ],
      ball: {
        position: { x: 5, y: 8, z: 0.11 },
        linearVelocity: { x: 1, y: -0.5, z: 0 },
        regime: "ground-roll",
      },
      pitchLength: 105,
      pitchWidth: 68,
      cpuTeamId: "team-a",
      controlledPlayerId: "b",
    };

    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();

    for (let tick = 0; tick < 30; tick++) {
      const f1 = a1.sample(tick, obs);
      const f2 = a2.sample(tick, obs);

      expect(f1.moveX).toBe(f2.moveX);
      expect(f1.moveY).toBe(f2.moveY);
      expect(f1.heldButtons).toBe(f2.heldButtons);
    }
  });

  it("buildCpuObservation with explicit controlledPlayerId produces correct observation", () => {
    // Build a minimal WorldState for testing.
    const world: WorldState = {
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      tick: 0,
      fixedDt: { numerator: 1, denominator: 60 },
      prngState: { algorithmId: "mulberry32-v1", state: 42 },
      inputPolicy: {
        policyId: "REPEAT_HELD_WITH_ZERO_EDGES",
        consecutiveMissing: 0,
      },
      players: [
        {
          playerId: "player-a",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        } as PlayerState,
        {
          playerId: "player-b",
          teamId: "team-a",
          groundPosition: { x: 20, y: 10 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        } as PlayerState,
      ],
      ball: {
        position: { x: 10, y: 5, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      } as BallState,
      events: [],
      scheduler: { scheduled: [] },
    } as WorldState;

    // Build observation for player-b.
    const obs = buildCpuObservation(world, "team-a", "player-b");

    // controlledPlayerId should be "player-b".
    expect(obs.controlledPlayerId).toBe("player-b");

    // Both players should be in the players array.
    expect(obs.players.length).toBe(2);

    // Teammates should exclude player-b.
    expect(obs.teammates).toBeDefined();
    expect(obs.teammates!.length).toBe(1);
    expect(obs.teammates![0].playerId).toBe("player-a");

    // Now build observation for player-a.
    const obsA = buildCpuObservation(world, "team-a", "player-a");
    expect(obsA.controlledPlayerId).toBe("player-a");
    expect(obsA.teammates).toBeDefined();
    expect(obsA.teammates!.length).toBe(1);
    expect(obsA.teammates![0].playerId).toBe("player-b");
  });
});

// ===========================================================================
// Helper: create a CpuObservation with given player/ball positions
// ===========================================================================

function makeCpuObservation(
  playerX: number,
  playerY: number,
  ballX: number,
  ballY: number,
  ballVx: number,
  ballVy: number,
  cpuTeamId?: string,
): CpuObservation {
  return {
    players: [
      {
        playerId: "cpu-player",
        teamId: "team-cpu",
        groundPosition: { x: playerX, y: playerY },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
    ],
    ball: {
      position: { x: ballX, y: ballY, z: 0.11 },
      linearVelocity: { x: ballVx, y: ballVy, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId,
  };
}
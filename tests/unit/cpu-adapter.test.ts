/**
 * @module cpu-adapter-tests
 *
 * Tests for the CPU / AI adapter (CPU-OPPONENT-1V1).
 *
 * Covers:
 *  - Chase-ball steering: ball direction → movement direction
 *  - FIRST_TOUCH pressed when within range of slow ball
 *  - pressedButtons clears on subsequent samples (one-shot)
 *  - reset() clears internal state
 *  - buildCpuObservation extracts correct fields from WorldState
 *
 * No Math.random, Date, DOM, or Node I/O.
 * The CPU adapter is deterministic: same observation → same frame.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCpuAdapter,
  buildCpuObservation,
  type CpuAdapter,
  type CpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { FIRST_TOUCH_BIT, SHOT_BIT } from "../../src/contracts/input.js";
import { makeWorldState } from "./contracts.fixture.js";

// ===========================================================================
// 1. Chase-ball steering: direction → movement
// ===========================================================================

describe("CPU-CHASE-001: ball direction → movement direction", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("ball at (5, 0), CPU at (0, 0) → moveX > 0, moveY ≈ 0", () => {
    const obs: CpuObservation = makeObservation(0, 0, 5, 0, 0, 0);
    const frame = adapter.sample(0, obs);

    expect(frame.moveX).toBeGreaterThan(0);
    expect(Math.abs(frame.moveY)).toBeLessThan(0.01);
    expect(frame.sourceId).toBe("cpu");
    expect(frame.sprint).toBe(1);
  });

  it("ball at (0, 5), CPU at (0, 0) → moveX ≈ 0, moveY > 0", () => {
    const obs: CpuObservation = makeObservation(0, 0, 0, 5, 0, 0);
    const frame = adapter.sample(0, obs);

    expect(Math.abs(frame.moveX)).toBeLessThan(0.01);
    expect(frame.moveY).toBeGreaterThan(0);
    expect(frame.sprint).toBe(1);
  });

  it("ball at (-3, -4), CPU at (0, 0) → moveX < 0, moveY < 0", () => {
    const obs: CpuObservation = makeObservation(0, 0, -3, -4, 0, 0);
    const frame = adapter.sample(0, obs);

    expect(frame.moveX).toBeLessThan(0);
    expect(frame.moveY).toBeLessThan(0);
  });

  it("ball at (0, 0), CPU at (0, 0) → moveX = 0, moveY = 0 (same position)", () => {
    const obs: CpuObservation = makeObservation(0, 0, 0, 0, 0, 0);
    const frame = adapter.sample(0, obs);

    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
  });

  it("deterministic: same observation → same frame", () => {
    const obs: CpuObservation = makeObservation(0, 0, 5, 3, 0, 0);
    const frame1 = adapter.sample(0, obs);
    const frame2 = adapter.sample(0, obs);

    expect(frame1.moveX).toBe(frame2.moveX);
    expect(frame1.moveY).toBe(frame2.moveY);
    expect(frame1.heldButtons).toBe(frame2.heldButtons);
    expect(frame1.pressedButtons).toBe(frame2.pressedButtons);
  });
});

// ===========================================================================
// 2. FIRST_TOUCH: pressed when within range of slow ball
// ===========================================================================

describe("CPU-FIRST-TOUCH-001: FIRST_TOUCH pressed within range", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("ball within 1.5 m and slow → heldButtons includes FIRST_TOUCH_BIT", () => {
    // Ball at (1, 0) — 1 m away, horizontal speed 0.5 m/s.
    const obs: CpuObservation = makeObservation(0, 0, 1, 0, 0.3, 0.2);
    const frame = adapter.sample(0, obs);

    expect(frame.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);
  });

  it("ball within 1.5 m and slow → pressedButtons includes FIRST_TOUCH_BIT on first call", () => {
    const obs: CpuObservation = makeObservation(0, 0, 1, 0, 0.3, 0.2);
    const frame = adapter.sample(0, obs);

    expect(frame.pressedButtons & FIRST_TOUCH_BIT).not.toBe(0);
  });

  it("ball outside 1.5 m → no FIRST_TOUCH", () => {
    const obs: CpuObservation = makeObservation(0, 0, 5, 0, 0, 0);
    const frame = adapter.sample(0, obs);

    expect(frame.heldButtons & FIRST_TOUCH_BIT).toBe(0);
    expect(frame.pressedButtons & FIRST_TOUCH_BIT).toBe(0);
  });

  it("ball within range but fast → no FIRST_TOUCH", () => {
    // Ball at (1, 0) but horizontal speed = 3 m/s (> 2 threshold).
    const obs: CpuObservation = makeObservation(0, 0, 1, 0, 2.5, 1.0);
    const frame = adapter.sample(0, obs);

    expect(frame.heldButtons & FIRST_TOUCH_BIT).toBe(0);
    expect(frame.pressedButtons & FIRST_TOUCH_BIT).toBe(0);
  });

  it("ball within range on first sample, still in range on second → pressedButtons cleared", () => {
    const obs: CpuObservation = makeObservation(0, 0, 1, 0, 0.3, 0.2);

    // First sample — ball just entered range.
    const frame1 = adapter.sample(0, obs);
    expect(frame1.pressedButtons & FIRST_TOUCH_BIT).not.toBe(0);
    expect(frame1.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);

    // Second sample — still in range, no new press.
    const frame2 = adapter.sample(1, obs);
    expect(frame2.pressedButtons & FIRST_TOUCH_BIT).toBe(0);
    expect(frame2.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);
  });
});

// ===========================================================================
// 3. Reset clears internal state
// ===========================================================================

describe("CPU-RESET-001: reset clears internal state", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("after reset, ball in range → pressedButtons set again", () => {
    // First: ball in range, consume the press.
    const obs1: CpuObservation = makeObservation(0, 0, 1, 0, 0.3, 0.2);
    adapter.sample(0, obs1);
    adapter.sample(1, obs1); // pressed cleared, still held.

    // Reset.
    adapter.reset();

    // Ball still in range — should produce a fresh pressed.
    const obs2: CpuObservation = makeObservation(0, 0, 1, 0, 0.3, 0.2);
    const frame = adapter.sample(2, obs2);

    expect(frame.pressedButtons & FIRST_TOUCH_BIT).not.toBe(0);
    expect(frame.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);
  });

  it("after reset, ball out of range → neutral frame", () => {
    adapter.reset();
    const obs: CpuObservation = makeObservation(0, 0, 10, 0, 0, 0);
    const frame = adapter.sample(0, obs);

    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.heldButtons).toBe(0);
    expect(frame.pressedButtons).toBe(0);
  });
});

// ===========================================================================
// 4. buildCpuObservation extracts correct fields from WorldState
// ===========================================================================

describe("CPU-BUILD-OBS-001: buildCpuObservation extracts fields", () => {
  it("extracts player positions from WorldState", () => {
    const ws = makeWorldState({
      player: {
        groundPosition: { x: 3.5, y: -2.0 },
        linearVelocity: { x: 1.2, y: 0.8 },
        bodyHeading: 0.75,
      },
    });
    const obs = buildCpuObservation(ws);

    expect(obs.players.length).toBe(1);
    expect(obs.players[0].playerId).toBe("player-1");
    expect(obs.players[0].groundPosition.x).toBe(3.5);
    expect(obs.players[0].groundPosition.y).toBe(-2.0);
    expect(obs.players[0].linearVelocity.x).toBe(1.2);
    expect(obs.players[0].linearVelocity.y).toBe(0.8);
    expect(obs.players[0].bodyHeading).toBe(0.75);
  });

  it("extracts ball state from WorldState", () => {
    const ws = makeWorldState({
      ball: {
        position: { x: 10.0, y: 5.0, z: 0.11 },
        linearVelocity: { x: 2.0, y: 1.0, z: 0.5 },
        regime: "ground-roll",
      },
    });
    const obs = buildCpuObservation(ws);

    expect(obs.ball.position.x).toBe(10.0);
    expect(obs.ball.position.y).toBe(5.0);
    expect(obs.ball.position.z).toBe(0.11);
    expect(obs.ball.linearVelocity.x).toBe(2.0);
    expect(obs.ball.linearVelocity.y).toBe(1.0);
    expect(obs.ball.linearVelocity.z).toBe(0.5);
    expect(obs.ball.regime).toBe("ground-roll");
  });

  it("extracts pitch dimensions from scenario meta", () => {
    const ws = makeWorldState();
    ws.meta = { pitchLength: 105, pitchWidth: 68 };
    const obs = buildCpuObservation(ws);

    expect(obs.pitchLength).toBe(105);
    expect(obs.pitchWidth).toBe(68);
  });

  it("falls back to default pitch dimensions when meta missing", () => {
    const ws = makeWorldState();
    const obs = buildCpuObservation(ws);

    expect(obs.pitchLength).toBe(105);
    expect(obs.pitchWidth).toBe(68);
  });
});

// ===========================================================================
// 5. Goal awareness: OFFENSE mode steers toward opponent's goal
// ===========================================================================

describe("CPU-GOAL-001: goal awareness", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("CPU team A steers toward +x goal when in possession", () => {
    // CPU player at (30, 0), ball at (31, 0) — CPU has possession.
    // Team A attacks +x, opponent goal at (52.5, 0).
    // First call establishes ballWasInRange; second call enters OFFENSE.
    const obs: CpuObservation = makeObservation(30, 0, 31, 0, 0, 0, "team-a");
    adapter.sample(0, obs); // gain FIRST_TOUCH → ballWasInRange = true
    const frame = adapter.sample(1, obs); // hasPossession = true → OFFENSE

    expect(frame.moveX).toBeGreaterThan(0);
    // moveY may be non-zero due to deterministic lateral shot aim offset.
    expect(Math.abs(frame.moveY)).toBeLessThan(0.2);
  });

  it("CPU team B steers toward -x goal when in possession", () => {
    // CPU player at (-30, 0), ball at (-31, 0).
    // Team B attacks -x, opponent goal at (-52.5, 0).
    const obs: CpuObservation = makeObservation(
      -30, 0, -31, 0, 0, 0, "team-b",
    );
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.moveX).toBeLessThan(0);
    // moveY may be non-zero due to deterministic lateral shot aim offset.
    expect(Math.abs(frame.moveY)).toBeLessThan(0.2);
  });

  it("CPU shoots when within 15m of goal and facing goal", () => {
    // CPU at (40, 0), ball at (40.5, 0) — near opponent goal.
    // Team A attacks +x, goal at (52.5, 0), dist = 12.5 m.
    // bodyHeading = 0 faces +x (toward goal).
    const obs: CpuObservation = makeObservation(40, 0, 40.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0; // facing +x
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
  });

  it("CPU does not shoot when far from goal", () => {
    // CPU at (10, 0), ball at (10.5, 0) — far from goal.
    // Team A attacks +x, goal at (52.5, 0), dist = 42.5 m.
    const obs: CpuObservation = makeObservation(10, 0, 10.5, 0, 0, 0, "team-a");
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).toBe(0);
  });

  it("CPU chases ball when not in possession (ball far away)", () => {
    // CPU at (0, 0), ball at (20, 0) — far from ball.
    // Should chase ball regardless of team.
    const obs: CpuObservation = makeObservation(0, 0, 20, 0, 0, 0, "team-a");
    const frame = adapter.sample(0, obs);

    // Chase-ball: moveX toward ball at x=20.
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.heldButtons & FIRST_TOUCH_BIT).toBe(0);
  });

  it("CPU presses FIRST_TOUCH when near ball in defense mode", () => {
    // CPU at (5, 0), ball at (5.5, 0), close to ball but not yet in possession
    // (first tick — ballWasInRange not yet set from prior tick).
    const obs: CpuObservation = makeObservation(5, 0, 5.5, 0, 0, 0, "team-a");
    const frame = adapter.sample(0, obs);

    expect(frame.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);
    expect(frame.pressedButtons & FIRST_TOUCH_BIT).not.toBe(0);
  });
});

// ===========================================================================
// Helper: create a CpuObservation with given player/ball positions
// ===========================================================================

function makeObservation(
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
/**
 * @module tests/unit/loop/foul-consequence-machinery-sim
 *
 * FOUL-CONSEQUENCE-MACHINERY direct core tests for the in-core free-kick restart
 * (src/simulation/loop/simulation.ts, the countdown-zero free-kick branch +
 * the default-off gate).
 *
 * Verifies the DELIBERATE core change:
 *   - opening a free-kick window runs the accepted restart countdown; a
 *     CPU-controlled taker auto-serves at countdown zero, placing the ball at
 *     the contact position and serving it; the match timer is FROZEN throughout
 *     the free-kick phase (no decrement in a non-playing phase);
 *   - a HUMAN-controlled taker holds the phase open for a PASS_BIT InputFrame
 *     and serves along the human's input direction (the pass-gated window from
 *     HUMAN-BALL-SERVER-LITERAL, applied unchanged);
 *   - with the free-kick gate off (default) the WorldState never carries the
 *     optional free-kick fields and no free-kick event is emitted.
 *
 * Input enters ONLY through sim.applyInputs (tick-indexed InputFrame); no
 * state writes. No Math.random, Date, DOM, or Node I/O in the sim path (Node
 * I/O only for the test's fs read of the fixture).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { deepClone } from "../../../src/simulation/world/clone.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";
import { PASS_BIT } from "../../../src/contracts/input.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { WorldState } from "../../../src/contracts/state.js";

const FIXTURE = resolve("eval/scenarios/5v5-human-serve-throwin.v1.json");

function loadFixture(path: string = FIXTURE): ScenarioDefinition {
  return JSON.parse(readFileSync(path, "utf-8")) as ScenarioDefinition;
}

/** Open a free-kick window directly on a fresh simulation. */
function openFreeKick(
  sim: ReturnType<typeof createSimulation>,
  opts: {
    team: string;
    takerPlayerId: string;
    position: { x: number; y: number };
    countdown: number;
  },
): ReturnType<typeof createSimulation> {
  const mutable = deepClone(sim.snapshot()) as WorldState;
  mutable.matchPhase = "free-kick";
  mutable.freeKickPosition = { ...opts.position };
  mutable.freeKickAwardingTeam = opts.team;
  mutable.freeKickTakerId = opts.takerPlayerId;
  mutable.freeKickCountdown = opts.countdown;
  // Place the taker + untouched ball at the spot.
  const taker = mutable.players.find((p) => p.playerId === opts.takerPlayerId);
  if (taker) {
    taker.groundPosition = { x: opts.position.x, y: opts.position.y };
    taker.linearVelocity = { x: 0, y: 0 };
    taker.desiredVelocity = { x: 0, y: 0 };
  }
  mutable.ball.position = { x: opts.position.x, y: opts.position.y, z: 0.11 };
  mutable.ball.regime = "ground-roll";
  mutable.ball.linearVelocity = { x: 0, y: 0, z: 0 };
  mutable.ball.angularVelocity = { x: 0, y: 0, z: 0 };
  mutable.ball.lastTouchRef = null;
  sim.restore(mutable);
  return sim;
}

function stepNeutral(sim: ReturnType<typeof createSimulation>, tick: number): void {
  sim.applyInputs([{
    tick,
    sourceId: "cpu",
    controlSlot: "slot-1",
    moveX: 0, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0,
  }]);
}

function findEvent(events: readonly { kind: string; payload?: Record<string, unknown> }[], kind: string) {
  return events.find((e) => e.kind === kind);
}

describe("FOUL-CONSEQUENCE-MACHINERY free-kick restart (core)", () => {
  it("a CPU-taker free-kick auto-serves at countdown zero and places the ball at the contact position", () => {
    // Use the receiver-steering fixture so taker player-1 is NOT human-controlled (slot-1 drives player-3).
    const fixture = loadFixture(resolve("eval/scenarios/5v5-human-restart-throwin.v1.json"));
    const sim = openFreeKick(createSimulation(createWorld({ scenario: fixture }), NO_OP_OBSERVER, undefined, undefined, undefined, undefined, undefined, { awardFreeKicks: true }), {
      team: "team-a", takerPlayerId: "player-1", position: { x: 30, y: 10 }, countdown: 3,
    });

    // The free-kick window is open.
    let snapshot = sim.snapshot();
    expect(snapshot.matchPhase).toBe("free-kick");

    // Drive 3 neutral ticks: the countdown runs and the CPU auto-serve fires.
    for (let t = 0; t < 3; t++) {
      stepNeutral(sim, t);
      sim.step();
    }
    snapshot = sim.snapshot();
    expect(snapshot.matchPhase).toBe("playing");
    // Ball was placed at the contact position and served (airborne, moving).
    expect(snapshot.ball.regime).toBe("airborne");
    expect(Math.hypot(snapshot.ball.linearVelocity.x, snapshot.ball.linearVelocity.y)).toBeGreaterThan(0);
    // The serve event is in the core's persistent state.
    const served = findEvent(sim.snapshot().events, "free-kick-executed");
    expect(served).toBeDefined();
    expect((served!.payload as { humanServed?: boolean }).humanServed).not.toBe(true);
    // The ball is served from the contact position.
    const pos = (served!.payload as { freeKickPosition: { x: number; y: number } }).freeKickPosition;
    expect(pos.x).toBeCloseTo(30, 0);
    expect(pos.y).toBeCloseTo(10, 0);
    // The timer is frozen across the free-kick-phase ticks (verified in the
    // dedicated freeze test); on the resume tick play returns to `playing` so
    // the ball-in-play clock decrements legitimately, exactly as the accepted
    // throw-in/goal-kick/corner restarts do.
  });

  it("the match timer is frozen across every free-kick phase tick", () => {
    const fixture = loadFixture(resolve("eval/scenarios/5v5-human-restart-throwin.v1.json"));
    const sim = openFreeKick(createSimulation(createWorld({ scenario: fixture }), NO_OP_OBSERVER, undefined, undefined, undefined, undefined, undefined, { awardFreeKicks: true }), {
      team: "team-a", takerPlayerId: "player-1", position: { x: 30, y: 10 }, countdown: 10,
    });
    const timerAtOpen = sim.snapshot().matchTimer;
    let prev = timerAtOpen;
    let sawFreeKickPhase = false;
    for (let t = 0; t < 5; t++) {
      stepNeutral(sim, t);
      sim.step();
      const s = sim.snapshot();
      if (s.matchPhase === "free-kick") {
        sawFreeKickPhase = true;
        expect(s.matchTimer).toBe(prev); // no decrement while frozen
      }
      prev = s.matchTimer;
    }
    expect(sawFreeKickPhase).toBe(true);
  });

  it("a HUMAN-controlled free-kick taker holds the phase open and serves along the human's input direction", () => {
    // 5v5-human-serve-throwin: slot-1 (HUMAN) drives player-1 (the designated taker).
    const sim = openFreeKick(createSimulation(createWorld({ scenario: loadFixture() }), NO_OP_OBSERVER, undefined, undefined, undefined, undefined, undefined, { awardFreeKicks: true }), {
      team: "team-a", takerPlayerId: "player-1", position: { x: 30, y: 10 }, countdown: 2,
    });

    // countdown 2 -> zero at tick 2 -> enter human-serve wait.
    stepNeutral(sim, 0); sim.step();
    stepNeutral(sim, 1); sim.step();
    expect(sim.snapshot().matchPhase).toBe("free-kick");

    // The human presses PASS toward +x during the wait.
    sim.applyInputs([{
      tick: 2, sourceId: "keyboard", controlSlot: "slot-1",
      moveX: 1, moveY: 0, sprint: 1, heldButtons: 0, pressedButtons: PASS_BIT, releasedButtons: 0,
    }]);
    sim.step();

    const snapshot = sim.snapshot();
    expect(snapshot.matchPhase).toBe("playing");
    expect(snapshot.ball.linearVelocity.x).toBeGreaterThan(0);
    const served = findEvent(sim.snapshot().events, "free-kick-executed");
    expect(served).toBeDefined();
    expect((served!.payload as { humanServed?: boolean }).humanServed).toBe(true);
    const dir = (served!.payload as { kickDirection: { x: number; y: number } }).kickDirection;
    expect(dir.x).toBeCloseTo(1, 1);
    expect(Math.abs(dir.y)).toBeLessThan(0.001);
  });

  it("the free-kick gate off (default) leaves the WorldState free of free-kick fields and emits no event", () => {
    const sim = createSimulation(createWorld({ scenario: loadFixture() }), NO_OP_OBSERVER, undefined, undefined, undefined, undefined, undefined, { awardFreeKicks: false });
    // No free-kick window is opened (gate off); drive a few neutral ticks.
    const initial = sim.snapshot();
    expect("freeKickPosition" in initial).toBe(false);
    expect("freeKickAwardingTeam" in initial).toBe(false);
    expect("freeKickTakerId" in initial).toBe(false);
    expect("freeKickCountdown" in initial).toBe(false);
    for (let t = 0; t < 5; t++) { stepNeutral(sim, t); sim.step(); }
    expect(findEvent(sim.snapshot().events, "free-kick-executed")).toBeUndefined();
    expect(sim.snapshot().matchPhase).toBe("playing");
  });
});

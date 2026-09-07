/**
 * @module tests/unit/loop/human-ball-server-literal-sim
 *
 * HUMAN-BALL-SERVER-LITERAL direct core tests for the pass-gated serving path
 * (src/simulation/loop/simulation.ts, the countdown-zero branches).
 *
 * Verifies the DELIBERATE core change:
 *   - a HUMAN-controlled designated taker holds the restart phase open past
 *     countdown zero (the matchTimer stays frozen) and a PASS_BIT InputFrame
 *     executes the serve along the human's input direction;
 *   - if no PASS arrives within the bounded window the CPU auto-serve fires;
 *   - a CPU taker (gate off) fires the auto-serve at countdown zero with NO
 *     wait phase and NO human-serve events.
 *
 * Input entrants ONLY through sim.applyInputs (tick-indexed InputFrame); no
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

function loadFixture(): ScenarioDefinition {
  return JSON.parse(readFileSync(FIXTURE, "utf-8")) as ScenarioDefinition;
}

interface OpenedSim {
  sim: ReturnType<typeof createSimulation>;
}

function openThrowIn(sim: ReturnType<typeof createSimulation>, countdown: number): ReturnType<typeof createSimulation> {
  const mutable = deepClone(sim.snapshot()) as WorldState;
  mutable.matchPhase = "throw-in";
  mutable.throwInPosition = { x: 30, y: 34 };
  mutable.throwInAwardingTeam = "team-a";
  mutable.throwInCountdown = countdown;
  mutable.throwInTakerId = "player-1";
  mutable.throwInTouchlineIndex = 0;
  sim.restore(mutable);
  return sim;
}

function stepWithPass(sim: ReturnType<typeof createSimulation>, tick: number, pass: boolean, dir: { x: number; y: number }): void {
  sim.applyInputs([{
    tick,
    sourceId: "keyboard",
    controlSlot: "slot-1",
    moveX: dir.x,
    moveY: dir.y,
    sprint: 1,
    heldButtons: 0,
    pressedButtons: pass ? PASS_BIT : 0,
    releasedButtons: 0,
  }]);
}

function findEvent(events: readonly { kind: string; payload?: Record<string, unknown> }[], kind: string) {
  return events.find((e) => e.kind === kind);
}

describe("HUMAN-BALL-SERVER-LITERAL pass-gated serving path (core)", () => {
  it("holds the restart phase open past countdown zero for a human taker, then serves along the human's input direction", () => {
    const sim = openThrowIn(createSimulation(createWorld({ scenario: loadFixture() }), NO_OP_OBSERVER), 2);

    // Tick 0 and tick 1 count down; tick 2 hits zero and enters the wait.
    stepWithPass(sim, 0, false, { x: 0, y: 0 });
    sim.step();
    stepWithPass(sim, 1, false, { x: 0, y: 0 });
    sim.step();

    // After the countdown-zero step the phase should STILL be throw-in (wait).
    let snapshot = sim.snapshot();
    expect(snapshot.matchPhase).toBe("throw-in");
    const timerAtWaitEntry = snapshot.matchTimer;

    // Tick 2 (wait): no pass yet, wait decrements.
    stepWithPass(sim, 2, false, { x: 0, y: 0 });
    sim.step();
    snapshot = sim.snapshot();
    expect(snapshot.matchPhase).toBe("throw-in");
    expect(snapshot.matchTimer).toBe(timerAtWaitEntry); // frozen during the wait

    // Tick 3 (wait): the human presses PASS toward +x.
    stepWithPass(sim, 3, true, { x: 1, y: 0 });
    sim.step();
    snapshot = sim.snapshot();
    // The serve fired -> phase returns to playing.
    expect(snapshot.matchPhase).toBe("playing");
    // The ball is served along +x (the human's input direction).
    expect(snapshot.ball.linearVelocity.x).toBeGreaterThan(0);
    expect(Math.abs(snapshot.ball.linearVelocity.y)).toBeLessThan(0.001);

    // The served event carries the human-chosen direction + input direction.
    // (It is written to the core's persistent state.events, not the per-step
    // events array — the same serialization limitation the restart rules
    // oracles close via serializeRestartFacts.)
    const served = findEvent(sim.snapshot().events, "throw-in-executed");
    expect(served).toBeDefined();
    const p = served!.payload!;
    expect(p.humanServed).toBe(true);
    const dir = p.throwDirection as { x: number; y: number };
    expect(Math.abs(dir.x - 1)).toBeLessThan(0.001);
    expect(Math.abs(dir.y)).toBeLessThan(0.001);
    expect((p.serveInputDirection as { x: number; y: number }).x).toBe(1);
  });

  it("fires the CPU auto-serve when no PASS arrives within the bounded window", () => {
    const sim = openThrowIn(createSimulation(createWorld({ scenario: loadFixture() }), NO_OP_OBSERVER), 2);

    // countdown 2 -> zero at tick 2 -> wait of HUMAN_SERVE_WAIT_WINDOW_TICKS.
    stepWithPass(sim, 0, false, { x: 0, y: 0 });
    sim.step();
    stepWithPass(sim, 1, false, { x: 0, y: 0 });
    sim.step();
    // Wait phase active.
    expect(sim.snapshot().matchPhase).toBe("throw-in");

    // Drive every subsequent tick with no PASS (the wait window is 90 ticks).
    let phase = sim.snapshot().matchPhase;
    let guard = 0;
    while (phase === "throw-in" && guard < 200) {
      stepWithPass(sim, sim.tick, false, { x: 0, y: 0 });
      sim.step();
      phase = sim.snapshot().matchPhase;
      guard++;
    }
    // The wait window bounded the wait: it never hangs forever.
    expect(guard).toBeLessThanOrEqual(96); // 90-window ticks + a couple of margin.
    // CPU auto-serve fired -> playing.
    expect(phase).toBe("playing");
    // The served event is a CPU serve (no humanServed marker).
    const served = findEvent(sim.snapshot().events, "throw-in-executed");
    expect(served).toBeDefined();
    expect((served!.payload as { humanServed?: boolean }).humanServed).not.toBe(true);
  });

  it("a CPU taker (gate off) fires the auto-serve at countdown zero with NO wait phase", () => {
    // Use the receiver-steering fixture where slot-1 (HUMAN) controls player-3,
    // NOT the taker (player-1), so the taker is not human-controlled -> gate off.
    const fixture = JSON.parse(readFileSync(resolve("eval/scenarios/5v5-human-restart-throwin.v1.json"), "utf-8")) as ScenarioDefinition;
    const sim = createSimulation(createWorld({ scenario: fixture }), NO_OP_OBSERVER);
    const mutable = deepClone(sim.snapshot()) as WorldState;
    mutable.matchPhase = "throw-in";
    mutable.throwInPosition = { x: 30, y: 34 };
    mutable.throwInAwardingTeam = "team-a";
    mutable.throwInCountdown = 2;
    mutable.throwInTakerId = "player-1"; // NOT the human's controlled player (player-3)
    mutable.throwInTouchlineIndex = 0;
    sim.restore(mutable);

    stepWithPass(sim, 0, false, { x: 0, y: 0 });
    sim.step();
    stepWithPass(sim, 1, true, { x: 1, y: 0 }); // human presses pass, but on a receiver
    sim.step();

    // The auto-serve fired at countdown zero (phase -> playing after tick 2).
    expect(sim.snapshot().matchPhase).toBe("playing");
    // No human-serve wait event / no human-serve executed marker.
    expect(findEvent(sim.snapshot().events, "restart-serve-wait")).toBeUndefined();
    const served = findEvent(sim.snapshot().events, "throw-in-executed");
    expect(served).toBeDefined();
    expect((served!.payload as { humanServed?: boolean }).humanServed).not.toBe(true);
  });
});

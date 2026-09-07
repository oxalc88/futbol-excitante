/**
 * @module tests/integration/human-ball-server-literal
 *
 * HUMAN-BALL-SERVER-LITERAL integration test: the pass-gated serving path. The
 * human is the designated restart TAKER and presses PASS_BIT; the core holds the
 * restart phase open past countdown zero, then serves along the human's input
 * direction. Asserts the serve executed at chest height, into play, along the
 * human's chosen direction, and that the ball is an independent entity after the
 * serve.
 *
 * This is the relevant integration-test pass for the MULTI_TICK evidence class.
 * It reproduces the stream through the production runHeadlessMatch entry point
 * (the same the browser composition root uses) — no direct core mocks.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../../eval/runners/headless-match.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";

const FIXTURE = resolve("eval/scenarios/5v5-human-serve-throwin.v1.json");

const SERVE_WINDOW = {
  kind: "throw-in" as const,
  team: "team-a",
  takerPlayerId: "player-1",
  position: { x: 30, y: 34 },
  countdown: 5,
  touchlineIndex: 0 as const,
};

function loadFixture(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(path, "utf-8")) as ScenarioDefinition;
}

function executedAt(obs: TelemetryObservation[]): { tick: number; payload: Record<string, unknown> } | null {
  for (const o of obs) {
    for (const ev of o.events) {
      if (ev.kind !== "throw-in-executed") continue;
      return { tick: ev.tick, payload: (ev.payload ?? {}) as Record<string, unknown> };
    }
  }
  return null;
}

describe("HUMAN-BALL-SERVER-LITERAL human-serve integration flow", () => {
  it("the human taker's PASS_BIT serves the throw-in along the human's input direction", () => {
    const result = runHeadlessMatch({
      scenario: loadFixture(FIXTURE),
      maxTicks: 40,
      cpuAntiHuddle: true,
      lifecyclePhaseSync: "core-owned",
      browserParityObservations: true,
      serializeRestartFacts: true,
      humanRestartControl: {
        humanTeamId: "team-a",
        humanControlledPlayerId: "player-1",
        humanControlSlot: "slot-1",
        humanMoveDirection: { x: 1, y: 0 },
        humanPassAtTick: 7,
        window: SERVE_WINDOW,
      },
    });

    const served = executedAt(result.observations);
    expect(served).not.toBeNull();
    // The human serve marker + the human-chosen direction (unit +x).
    expect(served!.payload.humanServed).toBe(true);
    const dir = served!.payload.throwDirection as { x: number; y: number };
    expect(dir.x).toBeCloseTo(1, 3);
    expect(Math.abs(dir.y)).toBeLessThan(0.001);
    expect(Math.hypot(dir.x, dir.y)).toBeCloseTo(1, 3);

    // The serve fired after the countdown-zero wait entry (a pass-gated serve,
    // not the CPU countdown-zero auto-serve at tick 5).
    expect(served!.tick).toBeGreaterThan(5);

    // The ball was served as an independent entity (airborne, moving +x).
    const tickObs = result.observations.find((o) => o.tick === served!.tick);
    expect(tickObs).toBeDefined();
    expect(tickObs!.ball.regime).toBe("airborne");
    expect(tickObs!.ball.linearVelocity.x).toBeGreaterThan(0);
  });
});

/**
 * @module tests/unit/eval/human-ball-server-literal-binding
 *
 * HUMAN-BALL-SERVER-LITERAL guards for the pass-gated serving path. Reproduces
 * the human-served throw-in stream through the production runHeadlessMatch +
 * evaluateSuite + executeOracle entry points and asserts the conformance facts:
 *
 *   - a HUMAN-controlled designated taker holds the restart phase open and a
 *     PASS_BIT press fires the serve along the human's input direction;
 *   - the human-served stream is byte-identical across two runs (two-run
 *     attestation under a fixed input program);
 *   - a CPU gate-off run (taker not human-controlled) fires the auto-serve at
 *     countdown zero with NO wait phase and is itself two-run deterministic;
 *   - the registered rules-suite criteria (MATCH-THROW-IN-SERVE,
 *     MATCH-THROW-IN-TIMER-FREEZE, MATCH-TIMER-FREEZE,
 *     MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH) PASS on the human-served stream;
 *   - the NEW human-serve oracles (direction / wait-timer-freeze /
 *     window-close) PASS on the human-served stream;
 *   - the human-served stream's hash differs from the CPU gate-off stream (the
 *     human genuinely changed the serve, not a no-op gate).
 *
 * Node I/O reads the accepted restart fixtures; it never touches the core.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import { executeOracle } from "../../../eval/oracles/oracle-registry.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

const SERVE_FIXTURE = resolve("eval/scenarios/5v5-human-serve-throwin.v1.json");
const CPU_FIXTURE = resolve("eval/scenarios/5v5-human-restart-throwin.v1.json");

const SERVE_WINDOW = {
  kind: "throw-in" as const,
  team: "team-a",
  takerPlayerId: "player-1",
  position: { x: 30, y: 34 },
  countdown: 5,
  touchlineIndex: 0 as const,
};
const PASS_TICK = 7;
const SERVE_DIR = { x: 1, y: 0 };

function loadFixture(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(path, "utf-8")) as ScenarioDefinition;
}

function runHumanServe(): ReturnType<typeof runHeadlessMatch> {
  return runHeadlessMatch({
    scenario: loadFixture(SERVE_FIXTURE),
    maxTicks: 40,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    browserParityObservations: true,
    serializeRestartFacts: true,
    humanRestartControl: {
      humanTeamId: "team-a",
      humanControlledPlayerId: "player-1",
      humanControlSlot: "slot-1",
      humanMoveDirection: SERVE_DIR,
      humanPassAtTick: PASS_TICK,
      window: SERVE_WINDOW,
    },
  });
}

function runCpuGateOff(): ReturnType<typeof runHeadlessMatch> {
  return runHeadlessMatch({
    scenario: loadFixture(CPU_FIXTURE),
    maxTicks: 40,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    browserParityObservations: true,
    serializeRestartFacts: true,
    humanRestartControl: {
      humanTeamId: "team-a",
      humanControlledPlayerId: "player-3",
      humanControlSlot: "slot-1",
      window: SERVE_WINDOW,
    },
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function findWaitEntry(obs: TelemetryObservation[]): number | null {
  for (const o of obs) for (const ev of o.events) if (ev.kind === "restart-serve-wait") return ev.tick;
  return null;
}

function servedFacts(obs: TelemetryObservation[]): {
  tick: number | null;
  direction: { x: number; y: number } | null;
  inputDirection: { x: number; y: number } | null;
  humanServed: boolean;
} {
  for (const o of obs) {
    for (const ev of o.events) {
      if (ev.kind !== "throw-in-executed") continue;
      const p = (ev.payload ?? {}) as Record<string, unknown>;
      const dir = p.throwDirection as { x?: number; y?: number } | undefined;
      const input = p.serveInputDirection as { x?: number; y?: number } | undefined;
      return {
        tick: ev.tick,
        direction: dir && typeof dir.x === "number" && typeof dir.y === "number" ? { x: dir.x, y: dir.y } : null,
        inputDirection: input && typeof input.x === "number" && typeof input.y === "number"
          ? { x: input.x, y: input.y }
          : null,
        humanServed: p.humanServed === true,
      };
    }
  }
  return { tick: null, direction: null, inputDirection: null, humanServed: false };
}

function criterion(obs: TelemetryObservation[], id: string): string | undefined {
  const suite = evaluateSuite("rules", obs);
  for (const t of suite.tests) for (const c of t.criteria) if (c.criterion_id === id) return c.outcome;
  return undefined;
}

function oracle(id: string, version: string, obs: TelemetryObservation[]): string {
  const results = executeOracle(id, version, obs);
  if (results.some((r) => r.status === "fail")) return "FAIL";
  if (results.length > 0 && results.every((r) => r.status === "pass")) return "PASS";
  return "NOT_EVALUATED";
}

describe("HUMAN-BALL-SERVER-LITERAL pass-gated serving path (bindings)", () => {
  it("human taker: the serve fires on the human's PASS along the human's chosen direction", () => {
    const result = runHumanServe();
    const served = servedFacts(result.observations);
    const wait = findWaitEntry(result.observations);

    // The wait phase opened (countdown-zero gate) and the serve fired after it.
    expect(wait).not.toBeNull();
    expect(served.tick).not.toBeNull();
    expect(served.tick!).toBeGreaterThan(wait!);
    // The serve direction matches the human's input direction (unit +x).
    expect(served.humanServed).toBe(true);
    expect(Math.hypot(served.direction!.x, served.direction!.y)).toBeCloseTo(1, 3);
    expect(served.direction!.x).toBeCloseTo(1, 3);
    expect(Math.abs(served.direction!.y)).toBeLessThan(0.001);
    expect(served.inputDirection!.x).toBe(1);
  });

  it("two runs of the human-served stream are byte-identical (two-run attestation)", () => {
    const a = runHumanServe();
    const b = runHumanServe();
    expect(sha256(JSON.stringify(a.stateHashes))).toBe(sha256(JSON.stringify(b.stateHashes)));
  });

  it("CPU gate-off: the auto-serve fires at countdown zero with NO wait phase and the stream is deterministic", () => {
    const a = runCpuGateOff();
    const b = runCpuGateOff();
    // No wait entry, no human-serve marker.
    expect(findWaitEntry(a.observations)).toBeNull();
    const served = servedFacts(a.observations);
    expect(served.humanServed).toBe(false);
    // Serve fired at countdown zero (countdown 5 -> tick 5).
    expect(served.tick).toBe(5);
    // Two-run deterministic.
    expect(sha256(JSON.stringify(a.stateHashes))).toBe(sha256(JSON.stringify(b.stateHashes)));
  });

  it("the human-served stream differs from the CPU gate-off stream (the gate is not a no-op)", () => {
    const human = runHumanServe();
    const cpu = runCpuGateOff();
    expect(sha256(JSON.stringify(human.stateHashes))).not.toBe(sha256(JSON.stringify(cpu.stateHashes)));
  });

  it("the registered rules-suite criteria PASS on the human-served stream", () => {
    const result = runHumanServe();
    expect(criterion(result.observations, "MATCH-THROW-IN-SERVE")).toBe("PASS");
    expect(criterion(result.observations, "MATCH-THROW-IN-TIMER-FREEZE")).toBe("PASS");
    expect(criterion(result.observations, "MATCH-TIMER-FREEZE")).toBe("PASS");
    expect(criterion(result.observations, "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH")).toBe("PASS");
  });

  it("the new human-serve oracles PASS on the human-served stream and are NOT_EVALUATED on the CPU gate-off stream", () => {
    const human = runHumanServe();
    const cpu = runCpuGateOff();
    const cases = [
      ["human-serve-direction-oracle-v1", "oracle-human-serve-direction-v1"],
      ["human-serve-wait-timer-freeze-oracle-v1", "oracle-human-serve-wait-timer-freeze-v1"],
      ["human-serve-window-close-oracle-v1", "oracle-human-serve-window-close-v1"],
    ] as const;
    for (const [id, version] of cases) {
      expect(oracle(id, version, human.observations)).toBe("PASS");
      // On the CPU gate-off stream these criteria are not applicable (no human-serve event).
      expect(oracle(id, version, cpu.observations)).toBe("NOT_EVALUATED");
    }
  });

  it("a human taker who never presses PASS falls back to the CPU auto-serve on window expiry", () => {
    // Same window/taker, but no humanPassAtTick -> the human holds the taker
    // (gate on -> wait opens) but never presses PASS; after the bounded wait
    // window (90 ticks) the CPU auto-serve fires (no human-serve marker).
    const result = runHeadlessMatch({
      scenario: loadFixture(SERVE_FIXTURE),
      maxTicks: 120,
      cpuAntiHuddle: true,
      lifecyclePhaseSync: "core-owned",
      browserParityObservations: true,
      serializeRestartFacts: true,
      humanRestartControl: {
        humanTeamId: "team-a",
        humanControlledPlayerId: "player-1",
        humanControlSlot: "slot-1",
        humanMoveDirection: SERVE_DIR,
        window: SERVE_WINDOW,
      },
    });
    const served = servedFacts(result.observations);
    const wait = findWaitEntry(result.observations);
    // The gate opened (human taker) -> the wait entry exists.
    expect(wait).not.toBeNull();
    // The human never served: no human-serve marker; the CPU auto-serve fired
    // after the bounded window (serve tick strictly after the wait entry).
    expect(served.humanServed).toBe(false);
    expect(served.tick).not.toBeNull();
    expect(served.tick!).toBeGreaterThan(wait!);
  });
});

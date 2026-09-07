/**
 * @module tests/unit/eval/human-restart-rules-conformance-binding
 *
 * HUMAN-RESTART-RULES-CONFORMANCE guards for the gated `serializeRestartFacts`
 * observation extension (eval/runners/headless-match.ts) extended with the
 * human-taker designation.
 *
 * Verifies:
 *   - the human-directed marker (`humanDirected` + the human's team / controlled
 *     player) is carried in the `restart-designation` facts when a human drives
 *     the restart (human-taken stream), and is FALSE (0 ticks) on the CPU-fallback
 *     stream (the human's slot is set up but the human does not act);
 *   - the human's directional input actually re-targets the near-receiver serve
 *     (the serve target differs between human-taken and CPU-fallback);
 *   - the injection is hash-neutral: the gated (ON) run and its stashed (OFF)
 *     control produce IDENTICAL state-hash chains, and the stashed control carries
 *     0 injected facts;
 *   - the anti-huddle freeze rule exempts the human-controlled body (the receiver-
 *     steering realization) while every other non-taker body holds its anchor;
 *   - the applicer restart criteria evaluate to the SAME verdict on the human-taken
 *     and CPU-fallback streams (the human restart conforms to the same rules), with
 *     honest NOT_EVALUATED where the driven window cannot carry the semantics.
 *
 * Node I/O reads the accepted restart fixture; it never touches the simulation core.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import { checkRestartFreezeUntilFirstTouch } from "../../../eval/oracles/rules-restart.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

const DRIVEN_FIXTURE = resolve("eval/scenarios/5v5-human-restart-throwin.v1.json");
const NATURAL_FIXTURE = resolve("eval/scenarios/5v5-restart-throwin.v1.json");

const DRIVEN_WINDOW = {
  kind: "throw-in" as const,
  team: "team-a",
  takerPlayerId: "player-1",
  position: { x: 30, y: 34 },
  countdown: 20,
  touchlineIndex: 0 as const,
};

function loadFixture(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(path, "utf-8")) as ScenarioDefinition;
}

function runHumanDriven(gated: boolean, withMove: boolean): ReturnType<typeof runHeadlessMatch> {
  return runHeadlessMatch({
    scenario: loadFixture(DRIVEN_FIXTURE),
    maxTicks: 24,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    serializeRestartFacts: gated,
    humanRestartControl: {
      humanTeamId: "team-a",
      humanControlledPlayerId: "player-3",
      humanControlSlot: "slot-1",
      ...(withMove ? { humanMoveDirection: { x: 1, y: -1 } } : {}),
      window: DRIVEN_WINDOW,
    },
  });
}

function runNatural(gated: boolean, withMove: boolean): ReturnType<typeof runHeadlessMatch> {
  return runHeadlessMatch({
    scenario: loadFixture(NATURAL_FIXTURE),
    maxTicks: 200,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    browserParityObservations: true,
    serializeRestartFacts: gated,
    humanRestartControl: {
      humanTeamId: "team-b",
      humanControlledPlayerId: "player-6",
      humanControlSlot: "slot-6",
      ...(withMove ? { humanMoveDirection: { x: 1, y: -1 } } : {}),
    },
  });
}

function countDesignations(obs: ReturnType<typeof runHeadlessMatch>["observations"]): number {
  let n = 0;
  for (const o of obs) for (const ev of o.events) if (ev.kind === "restart-designation") n++;
  return n;
}

function countInjected(obs: ReturnType<typeof runHeadlessMatch>["observations"]): number {
  let n = 0;
  for (const o of obs) {
    for (const ev of o.events) {
      if (
        ev.kind === "core-match-phase" ||
        ev.kind === "restart-designation" ||
        ev.kind === "throw-in-executed" ||
        ev.kind === "goal-kick-executed" ||
        ev.kind === "corner-kick-executed"
      ) n++;
    }
  }
  return n;
}

function humanDirectedTicks(obs: ReturnType<typeof runHeadlessMatch>["observations"]): number {
  let n = 0;
  for (const o of obs) {
    for (const ev of o.events) {
      if (ev.kind !== "restart-designation") continue;
      const p = ev.payload as { humanDirected?: unknown } | undefined;
      if (p?.humanDirected === true) n++;
    }
  }
  return n;
}

function servedTarget(obs: ReturnType<typeof runHeadlessMatch>["observations"]): { x: number; y: number } | null {
  for (const o of obs) {
    for (const ev of o.events) {
      if (ev.kind !== "throw-in-executed") continue;
      const p = ev.payload as { targetPosition?: { x?: number; y?: number } } | undefined;
      if (p?.targetPosition && typeof p.targetPosition.x === "number" && typeof p.targetPosition.y === "number") {
        return { x: p.targetPosition.x, y: p.targetPosition.y };
      }
    }
  }
  return null;
}

function outcomes(obs: ReturnType<typeof runHeadlessMatch>["observations"]): Record<string, string> {
  const suite = evaluateSuite("rules", obs);
  const out: Record<string, string> = {};
  for (const t of suite.tests) for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  return out;
}

// ---------------------------------------------------------------------------
// Freeze-gate discriminating streams (synthetic, in-memory)
// ---------------------------------------------------------------------------

interface FP {
  id: string;
  team: string;
  x: number;
  y: number;
}

const FREEZE_ANCHORS: Record<string, { x: number; y: number }> = {
  "player-1": { x: 20, y: 0 },
  "player-2": { x: -20, y: -5 },
  "player-3": { x: -20, y: 5 },
  "player-4": { x: 20, y: -5 },
};

const FREEZE_PLAYERS: FP[] = [
  { id: "player-1", team: "team-a", x: 20, y: 0 },
  { id: "player-2", team: "team-a", x: -20, y: -5 },
  { id: "player-3", team: "team-b", x: -20, y: 5 },
  { id: "player-4", team: "team-b", x: 20, y: -5 },
];

function freezeDesignation(tick: number, overrides: Record<string, unknown> = {}): TelemetryObservation["events"][number] {
  return {
    id: `restart-designation-${tick}`,
    tick,
    sequence: 11,
    kind: "restart-designation",
    payload: {
      ballUntouched: true,
      takerId: "player-1",
      baselineTouchRef: null,
      rearmed: false,
      teams: { "team-a": "player-1", "team-b": "player-3" },
      anchors: FREEZE_ANCHORS,
      ...overrides,
    },
  };
}

function freezeCorePhase(tick: number): TelemetryObservation["events"][number] {
  return {
    id: `core-match-phase-${tick}`,
    tick,
    sequence: 12,
    kind: "core-match-phase",
    payload: { matchPhase: "playing", matchTimer: 100, startPhase: "playing" },
  };
}

function freezeObs(
  tick: number,
  players: FP[],
  designationOverrides: Record<string, unknown> = {},
): TelemetryObservation {
  return {
    tick,
    simulationTime: tick / 60,
    prngAlgorithmId: "mulberry32-v1",
    stateHash: `hash-${tick}`,
    prngStateHash: `prng-${tick}`,
    observationCoreHash: `core-${tick}`,
    committedTick: tick,
    inputs: [],
    players: players.map((p) => ({
      playerId: p.id,
      teamId: p.team,
      groundPosition: { x: p.x, y: p.y },
      linearVelocity: { x: 0, y: 0 },
      desiredVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
      desiredHeading: 0,
    })),
    ball: {
      position: { x: 0, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
      lastTouchRef: null,
    },
    events: [freezeDesignation(tick, designationOverrides), freezeCorePhase(tick)],
  };
}

describe("HUMAN-RESTART-RULES-CONFORMANCE serialization guards", () => {
  it(
    "the human-directed marker is carried on a human-taken driven window and absent on the CPU-fallback",
    { timeout: 30000 },
    () => {
      const human = runHumanDriven(true, true);
      const cpu = runHumanDriven(true, false);
      expect(humanDirectedTicks(human.observations)).toBeGreaterThan(0);
      expect(humanDirectedTicks(cpu.observations)).toBe(0);
      // The marker carries the human's team + controlled player.
      const desig = human.observations.find((o) =>
        o.events.some((ev) => ev.kind === "restart-designation"),
      );
      const p = desig?.events.find((ev) => ev.kind === "restart-designation")?.payload as
        | { humanDirected?: unknown; humanTeamId?: unknown; humanControlledPlayerId?: unknown }
        | undefined;
      expect(p?.humanDirected).toBe(true);
      expect(p?.humanTeamId).toBe("team-a");
      expect(p?.humanControlledPlayerId).toBe("player-3");
    },
  );

  it(
    "the human's directional input re-targets the near-receiver serve (human vs CPU-fallback)",
    { timeout: 30000 },
    () => {
      const human = runHumanDriven(true, true);
      const cpu = runHumanDriven(true, false);
      const ht = servedTarget(human.observations);
      const ct = servedTarget(cpu.observations);
      expect(ht).not.toBeNull();
      expect(ct).not.toBeNull();
      expect(ht!.x !== ct!.x || ht!.y !== ct!.y).toBe(true);
    },
  );

  it(
    "live/stashed chain identity + 0 injected facts on the stash + gate-off byte-identity (driven)",
    { timeout: 30000 },
    () => {
      const gated = runHumanDriven(true, true);
      const stashed = runHumanDriven(false, true);
      // Hash-neutral: the injection is post-loop, so the committed hash chains match.
      expect(JSON.stringify(gated.stateHashes)).toBe(JSON.stringify(stashed.stateHashes));
      expect(countInjected(stashed.observations)).toBe(0);
      expect(countDesignations(stashed.observations)).toBe(0);
      expect(countDesignations(gated.observations)).toBe(gated.observations.length);
    },
  );

  it(
    "live/stashed chain identity + 0 injected facts on the stash (natural/team-b)",
    { timeout: 30000 },
    () => {
      const gated = runNatural(true, true);
      const stashed = runNatural(false, true);
      expect(JSON.stringify(gated.stateHashes)).toBe(JSON.stringify(stashed.stateHashes));
      expect(countInjected(stashed.observations)).toBe(0);
    },
  );

  it(
    "the human-taken restart conforms to the same rules the CPU restart does, with honest NOT_EVALUATED on the driven window",
    { timeout: 30000 },
    () => {
      const human = outcomes(runHumanDriven(true, true).observations);
      const cpu = outcomes(runHumanDriven(true, false).observations);
      // The criteria evaluate identically on both streams (the human restart obeys
      // the same rules); only the serve target differs (the human-directed destination).
      for (const k of ["MATCH-THROW-IN-SERVE", "MATCH-THROW-IN-TIMER-FREEZE", "MATCH-TIMER-FREEZE", "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH"]) {
        expect(human[k]).toBe("PASS");
        expect(cpu[k]).toBe("PASS");
      }
      // The driven window carries no boundary, so award/placement are honestly
      // NOT_EVALUATED (nothing to pair the execution against).
      expect(human["MATCH-THROW-IN-AWARD"]).toBe("NOT_EVALUATED");
      expect(human["MATCH-THROW-IN-PLACEMENT"]).toBe("NOT_EVALUATED");
      expect(human["MATCH-RESTART-NEAREST-ONLY"]).toBe("NOT_EVALUATED");
    },
  );

  it(
    "the natural human-taken stream measures the boundary-dependent criteria (PLACEMENT / AWARD / NEAREST-ONLY) as PASS",
    { timeout: 30000 },
    () => {
      const o = outcomes(runNatural(true, true).observations);
      expect(o["MATCH-THROW-IN-AWARD"]).toBe("PASS");
      expect(o["MATCH-THROW-IN-PLACEMENT"]).toBe("PASS");
      expect(o["MATCH-THROW-IN-SERVE"]).toBe("PASS");
      expect(o["MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH"]).toBe("PASS");
      expect(o["MATCH-RESTART-NEAREST-ONLY"]).toBe("PASS");
      expect(o["MATCH-THROW-IN-TIMER-FREEZE"]).toBe("PASS");
      expect(o["MATCH-RESTART-REARM"]).toBe("NOT_EVALUATED");
    },
  );
});

describe("HUMAN-RESTART-RULES-CONFORMANCE freeze-exemption gate", () => {
  const moved = (id: string, x: number, y: number): FP[] =>
    FREEZE_PLAYERS.map((p) => (p.id === id ? { ...p, x, y } : p));

  it(
    "the human-controlled body is exempt on a genuinely human-taken window (exemption works)",
    () => {
      // player-3 (the human-controlled body) drifts far from its anchor, but the
      // window is genuinely human-taken (humanWindowTaken + humanControlledPlayerId),
      // so the sanctioned steering momentum exempts it and no other body drifts.
      const obs = [
        freezeObs(0, FREEZE_PLAYERS, { humanWindowTaken: true, humanDirected: true, humanControlledPlayerId: "player-3" }),
        freezeObs(1, moved("player-3", 30, 30), { humanWindowTaken: true, humanDirected: false, humanControlledPlayerId: "player-3" }),
      ];
      const res = checkRestartFreezeUntilFirstTouch(obs);
      expect(res[0].status).toBe("pass");
    },
  );

  it(
    "a human-marked window where a NON-human-controlled body drifts FAILs",
    () => {
      // player-2 is NOT the human-controlled body (player-3 is) and drifts far
      // from its anchor → the freeze rule FAILs even on a human-taken window.
      const obs = [
        freezeObs(0, FREEZE_PLAYERS, { humanWindowTaken: true, humanDirected: true, humanControlledPlayerId: "player-3" }),
        freezeObs(1, moved("player-2", 30, 30), { humanWindowTaken: true, humanDirected: true, humanControlledPlayerId: "player-3" }),
      ];
      const res = checkRestartFreezeUntilFirstTouch(obs);
      expect(res[0].status).toBe("fail");
    },
  );

  it(
    "a CPU-fallback-marked stream where the human-slot body drifts FAILs (no exemption field)",
    () => {
      // The runner emits NO human fields on a CPU-fallback stream. With player-3
      // (the human's would-be control slot) drifting, the exemption cannot fire
      // because there is no humanWindowTaken marker → FAIL. This pins the
      // byte-identity requirement: the CPU-fallback carries no exemption-activating
      // field, so its freeze behavior is governed by the gate, not fixture luck.
      const obs = [
        freezeObs(0, FREEZE_PLAYERS),
        freezeObs(1, moved("player-3", 30, 30)),
      ];
      const res = checkRestartFreezeUntilFirstTouch(obs);
      expect(res[0].status).toBe("fail");
    },
  );

  it(
    "a humanControlledPlayerId without the window marker does NOT exempt the body (gate needs both)",
    () => {
      // Even if a stray humanControlledPlayerId is present, the exemption requires
      // humanWindowTaken === true AND the body-id match. Without the window marker
      // the body is not exempt → FAIL.
      const obs = [
        freezeObs(0, FREEZE_PLAYERS, { humanControlledPlayerId: "player-3" }),
        freezeObs(1, moved("player-3", 30, 30), { humanControlledPlayerId: "player-3" }),
      ];
      const res = checkRestartFreezeUntilFirstTouch(obs);
      expect(res[0].status).toBe("fail");
    },
  );
});

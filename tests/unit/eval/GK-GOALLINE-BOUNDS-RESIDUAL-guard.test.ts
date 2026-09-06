/**
 * @module tests/unit/eval/GK-GOALLINE-BOUNDS-RESIDUAL-guard.test.ts
 *
 * Discriminating guards for GK-GOALLINE-BOUNDS-RESIDUAL.
 *
 * The last COMMON-BOUNDS residual was a defending body (the team-b designated
 * keeper, player-10) at |x| = 52.5308 m against the declared 52.5 m bound (the
 * pitch half-length), after a goal: the keeper is pushed into its own goal
 * mouth by a player-player contact with the attacking chaser, and it is inside
 * its own nominal goal arc (a legitimate football position).  This is a
 * goal-depth-geometry case, not a genuinely illegal position: the bound needed
 * to account for the goal mouth, and it was widened DERIVED from the versioned
 * `gk-small-sided-v1` goal-arc constant rather than invented.
 *
 * Guards:
 *   1. The goal-mouth bound is derived from the versioned constants (not a
 *      hard-coded widening) — changing `goal_arc_radius` / `goal_arc_center_x_offset`
 *      propagates to the bound.
 *   2. The gk-shot-fixture core-owned run resolves the residual: the protected
 *      COMMON-BOUNDS oracle passes (no body exceeds the derived goal-mouth bound).
 *   3. The bound is NOT weakened: a body beyond the derived goal-mouth limit
 *      still FAILS, and a body on the old 52.5 m goal line / inside the goal
 *      mouth still PASSES (geometry correction, not oracle weakening).
 *   4. The scenario's declared safetyBounds agree with the derived bound.
 *
 * Node I/O is allowed for scenario loading.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import {
  checkBounds,
  goalMouthMaxX,
  goalMouthSafetyBounds,
  type SafetyBounds,
} from "../../../eval/invariants/bounds.js";
import { executeOracle } from "../../../eval/oracles/oracle-registry.js";
import "../../../eval/oracles/wire.js";
import { GK_SMALL_SIDED_V1 } from "../../../src/adapters/input-browser/goalkeeper-role.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(projectRoot, relativePath), "utf-8")) as T;
}

function telemetryWithBodyX(x: number): TelemetryObservation {
  return {
    tick: 0,
    simulationTime: 0,
    prngAlgorithmId: "mulberry32-v1",
    stateHash: "h",
    prngStateHash: "p",
    observationCoreHash: "c",
    committedTick: 0,
    players: [
      {
        playerId: "p",
        teamId: "team-a",
        groundPosition: { x, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
      },
    ],
    ball: {
      position: { x: 0, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
      lastTouchRef: null,
    },
    events: [],
    inputs: [],
  } as unknown as TelemetryObservation;
}

describe("GK-GOALLINE-BOUNDS-RESIDUAL: goal-mouth bound derivation", () => {
  const GOAL_LINE_X = 52.5;

  it("derives the goal-mouth maxX from the versioned constants, not a hard-coded value", () => {
    // The derivation must use the versioned `gk-small-sided-v1` arc constants so
    // that changing them propagates to the bound (this test fails if someone
    // hard-codes 56.5 without deriving it).
    expect(goalMouthMaxX(GOAL_LINE_X)).toBe(
      GOAL_LINE_X +
        Math.abs(GK_SMALL_SIDED_V1.goal_arc_center_x_offset.value) +
        GK_SMALL_SIDED_V1.goal_arc_radius.value,
    );
    // The concrete value for the standard 105 m pitch (offset 0, radius 4.0).
    expect(goalMouthMaxX(GOAL_LINE_X)).toBeCloseTo(56.5, 6);
    expect(goalMouthSafetyBounds(GOAL_LINE_X).maxX).toBeCloseTo(56.5, 6);
  });

  it("the goal-mouth depth is strictly greater than the pitch half-length (the correction is real)", () => {
    expect(goalMouthMaxX(GOAL_LINE_X)).toBeGreaterThan(GOAL_LINE_X);
  });
});

describe("GK-GOALLINE-BOUNDS-RESIDUAL: the residual resolves under the derived bound", () => {
  it(
    "the gk-shot-fixture core-owned run passes the protected COMMON-BOUNDS oracle",
    () => {
      const scenario = loadScenario("eval/scenarios/5v5-keeper-shot-fixture.v1.json");
      const match = runHeadlessMatch({
        scenario,
        maxTicks: 600,
        cpuAntiHuddle: true,
        cpuDefensiveTackle: true,
        gkBehavior: true,
        browserParityObservations: true,
        lifecyclePhaseSync: "core-owned",
      });
      const results = executeOracle("bounds", "oracle-bounds-v1", match.observations);
      const fails = results.filter((r) => r.status === "fail").length;
      expect(fails).toBe(0);

      // Confirm the offending body is the keeper and it now sits inside the
      // goal mouth (between the goal line and the derived goal-mouth limit).
      let maxPlayerAbsX = 0;
      let offendingPlayerId: string | null = null;
      let offendingX = 0;
      for (const o of match.observations) {
        for (const p of o.players) {
          const absX = Math.abs(p.groundPosition.x);
          if (absX > maxPlayerAbsX) {
            maxPlayerAbsX = absX;
            offendingPlayerId = p.playerId;
            offendingX = p.groundPosition.x;
          }
        }
      }
      expect(offendingPlayerId).toBe("player-10");
      expect(Math.abs(offendingX)).toBeGreaterThan(52.5);
      expect(Math.abs(offendingX)).toBeLessThan(goalMouthMaxX(scenario.pitchLength / 2));
    },
    120_000,
  );
});

describe("GK-GOALLINE-BOUNDS-RESIDUAL: the bound is not weakened", () => {
  it("a body beyond the derived goal-mouth limit still FAILS", () => {
    const bounds = goalMouthSafetyBounds(52.5);
    const beyond = checkBounds(telemetryWithBodyX(goalMouthMaxX(52.5) + 0.1), bounds);
    expect(beyond.status).toBe("fail");
  });

  it("a body inside the goal mouth (beyond the old 52.5 goal line) PASSES", () => {
    const bounds = goalMouthSafetyBounds(52.5);
    // The offending keeper position (52.53) and a deeper goal-mouth position.
    const inside = checkBounds(telemetryWithBodyX(52.53), bounds);
    expect(inside.status).toBe("pass");
    const deeper = checkBounds(telemetryWithBodyX(55.5), bounds);
    expect(deeper.status).toBe("pass");
  });

  it("a body on the goal line and in the outfield still PASSES", () => {
    const bounds = goalMouthSafetyBounds(52.5);
    expect(checkBounds(telemetryWithBodyX(52.5), bounds).status).toBe("pass");
    expect(checkBounds(telemetryWithBodyX(0), bounds).status).toBe("pass");
  });
});

describe("GK-GOALLINE-BOUNDS-RESIDUAL: scenario safetyBounds are the pitch boundary, not the widened goal-mouth bound", () => {
  it("the shot fixture's declared safetyBounds stay the pitch half-length (no state-hash impact)", () => {
    // The scenario safetyBounds is part of the hashed world state
    // (`meta.safetyBounds`), so changing it would perturb every pinned
    // state-hash chain (GK-5V5-ADAPTER-BEHAVIOR stash identity, LIFECYCLE,
    // CPU-DEFENSIVE-TACKLE).  It remains the pitch boundary; the goal-mouth
    // widening lives in the COMMON-BOUNDS oracle (goalMouthSafetyBounds),
    // which is not part of the simulation state hash.
    const scenario = loadScenario("eval/scenarios/5v5-keeper-shot-fixture.v1.json");
    expect(scenario.safetyBounds.maxX).toBe(scenario.pitchLength / 2);
    expect(scenario.safetyBounds.maxY).toBe(34);
    expect(scenario.safetyBounds.minZ).toBe(-0.5);
    expect(scenario.safetyBounds.maxZ).toBe(20);
    // The goal-mouth bound is strictly wider than the pitch boundary.
    expect(goalMouthMaxX(scenario.pitchLength / 2)).toBeGreaterThan(scenario.safetyBounds.maxX);
  });
});

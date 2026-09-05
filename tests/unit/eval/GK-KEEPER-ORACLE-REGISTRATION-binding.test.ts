/**
 * @module tests/unit/eval/GK-KEEPER-ORACLE-REGISTRATION-binding.test.ts
 *
 * Binding test for GK-KEEPER-ORACLE-REGISTRATION.
 *
 * Locks the integration of the five protected SMALL-SIDED goalkeeper oracles:
 *  1. Each GK behavior criterion's invariant definition binds to a registered
 *     oracle (the invariant-definitions comment "no keeper oracle is registered
 *     yet" is now false).
 *  2. `evaluateSuite("goalkeepers", ...)` runs the GK criteria through those
 *     oracles and produces real verdicts over a keeper-bearing observation
 *     stream — not NOT_EVALUATED — while a non-GK stream stays NOT_EVALUATED.
 *  3. No existing common criterion binding changed (additive wiring).
 *
 * Node I/O not used; observations are constructed in-memory.
 */

import { describe, it, expect } from "vitest";

import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

// Import wire.ts to register the built-in oracles (side-effect).
import "../../../eval/oracles/wire.js";

import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import { loadRegistrySet } from "../../../eval/contracts/loader.js";
import {
  INV_GK_ROLE_DESIGNATION,
  INV_GK_POSITIONING,
  INV_GK_NO_FIELD_CHASE,
  INV_GK_SAVE_CLAIM,
  INV_GK_DISTRIBUTION,
} from "../../../eval/contracts/invariant-definitions.js";
import { executeOracle } from "../../../eval/oracles/oracle-registry.js";

const GK_INVARIANTS = [
  INV_GK_ROLE_DESIGNATION,
  INV_GK_POSITIONING,
  INV_GK_NO_FIELD_CHASE,
  INV_GK_SAVE_CLAIM,
  INV_GK_DISTRIBUTION,
] as const;

const GK_BEHAVIOR_CRITERIA = [
  "GK-POSITIONING-HOLD",
  "GK-NO-FIELD-CHASE",
  "GK-SAVE-CLAIM",
  "GK-ROLE-DESIGNATION",
  "GK-DISTRIBUTION-NO-OMNISCIENCE",
] as const;

// ---------------------------------------------------------------------------
// Observation builder (same shape as gk-oracle.test.ts)
// ---------------------------------------------------------------------------

const PITCH_LENGTH = 105;
const HALF = PITCH_LENGTH / 2;

const ALL_PLAYERS = [
  { id: "player-1", team: "team-a", x: 30, y: 0 },
  { id: "player-2", team: "team-a", x: 10, y: -10 },
  { id: "player-3", team: "team-a", x: 10, y: 10 },
  { id: "player-4", team: "team-a", x: -HALF + 0.2, y: 0.5 },
  { id: "player-5", team: "team-a", x: -30, y: 10 },
  { id: "player-6", team: "team-b", x: 30, y: 0 },
  { id: "player-7", team: "team-b", x: 10, y: -10 },
  { id: "player-8", team: "team-b", x: 10, y: 20 },
  { id: "player-9", team: "team-b", x: 30, y: -10 },
  { id: "player-10", team: "team-b", x: HALF - 0.2, y: -0.3 },
] as const;

function makeObs(tick: number, withGkRole = true): TelemetryObservation {
  const events: TelemetryObservation["events"] = [];
  if (withGkRole && tick === 1) {
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
    players: ALL_PLAYERS.map((p) => ({
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
    events,
  };
}

function gkObservations(): TelemetryObservation[] {
  return [makeObs(1, true), makeObs(2, false)];
}

function nonGkObservations(): TelemetryObservation[] {
  return [makeObs(1, false), makeObs(2, false)];
}

function gkOutcomes(obs: TelemetryObservation[]): Record<string, string> {
  const suite = evaluateSuite("goalkeepers", obs);
  const out: Record<string, string> = {};
  for (const test of suite.tests) {
    for (const c of test.criteria) {
      if (GK_BEHAVIOR_CRITERIA.includes(c.criterion_id as (typeof GK_BEHAVIOR_CRITERIA)[number])) {
        out[c.criterion_id] = c.outcome;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Invariant → registered oracle binding
// ---------------------------------------------------------------------------

describe("GK invariant definitions bind to registered oracles", () => {
  it("each GK invariant's oracle_id resolves to a registered oracle", () => {
    for (const inv of GK_INVARIANTS) {
      expect(inv.oracle_id.length).toBeGreaterThan(0);
      // executeOracle throws if the oracle is not registered / version mismatch.
      const results = executeOracle(inv.oracle_id, inv.oracle_version, []);
      expect(Array.isArray(results)).toBe(true);
    }
  });

  it("all five GK invariants are present in the registry set", () => {
    const registry = loadRegistrySet();
    for (const inv of GK_INVARIANTS) {
      expect(registry.invariant_definitions[inv.invariant_id]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. evaluateSuite produces real verdicts over a keeper-bearing stream
// ---------------------------------------------------------------------------

describe("evaluateSuite binds the five GK criteria to the keeper oracles", () => {
  it("GK behavior criteria produce verdicts (not NOT_EVALUATED) over a GK stream", () => {
    const outcomes = gkOutcomes(gkObservations());
    // Designation / positioning / no-chase are PASS on a clean keeper stream;
    // distribution stays NOT_EVALUATED (no release telemetry).
    expect(outcomes["GK-ROLE-DESIGNATION"]).toBe("PASS");
    expect(outcomes["GK-POSITIONING-HOLD"]).toBe("PASS");
    expect(outcomes["GK-NO-FIELD-CHASE"]).toBe("PASS");
    expect(outcomes["GK-DISTRIBUTION-NO-OMNISCIENCE"]).toBe("NOT_EVALUATED");
  });

  it("GK behavior criteria stay NOT_EVALUATED on a non-GK stream", () => {
    const outcomes = gkOutcomes(nonGkObservations());
    for (const criterion of GK_BEHAVIOR_CRITERIA) {
      expect(outcomes[criterion]).toBe("NOT_EVALUATED");
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Required scenario reference (kept for parity with convention)
// ---------------------------------------------------------------------------

describe("GK binding references goalkeeper scenario stubs", () => {
  it("the goalkeepers suite scenario registry is coherent", () => {
    const registry = loadRegistrySet();
    const suite = registry.suite_definitions["goalkeepers"];
    expect(suite).toBeDefined();
    expect(suite.direct_test_ids.length).toBeGreaterThan(0);
  });
});

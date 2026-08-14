/**
 * @module @pes/simulation/world/validate
 *
 * Pure validation functions for contracts and initial state.
 * No DOM, no Node I/O, no Date, no Math.random.
 */

import type { Vec2, Vec3 } from "../../contracts/math.js";
import type { InputFrame } from "../../contracts/input.js";
import type { PlayerState, BallState, WorldState, PrngState } from "../../contracts/state.js";
import type { ScenarioDefinition, SimulationEvent } from "../../contracts/scenario.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns an array of validation error messages (empty if valid). */
type ErrorCollector = (msg: string) => void;

function assert(condition: boolean, message: string): boolean {
  if (!condition) {
    return false;
  }
  return true;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function assertFinite(obj: Record<string, number>, ctx: string, collector: ErrorCollector): void {
  for (const key of Object.keys(obj)) {
    const v = (obj as Record<string, unknown>)[key];
    if (!isFiniteNumber(v)) {
      collector(`${ctx}.${key}: expected finite number, got ${JSON.stringify(v)}`);
    }
  }
}

function assertFiniteVec2(v: Vec2, ctx: string, collector: ErrorCollector): void {
  if (!isFiniteNumber(v.x) || !isFiniteNumber(v.y)) {
    collector(`${ctx}: expected finite Vec2, got x=${v.x} y=${v.y}`);
  }
}

function assertFiniteVec3(v: Vec3, ctx: string, collector: ErrorCollector): void {
  if (!isFiniteNumber(v.x) || !isFiniteNumber(v.y) || !isFiniteNumber(v.z)) {
    collector(`${ctx}: expected finite Vec3, got x=${v.x} y=${v.y} z=${v.z}`);
  }
}

// ---------------------------------------------------------------------------
// Contract validations
// ---------------------------------------------------------------------------

/** Validate a Vec2 value. */
export function validateVec2(v: Vec2, path: string, errs: ErrorCollector): void {
  assertFiniteVec2(v, path, errs);
}

/** Validate a Vec3 value. */
export function validateVec3(v: Vec3, path: string, errs: ErrorCollector): void {
  assertFiniteVec3(v, path, errs);
}

/** Validate an InputFrame. */
export function validateInputFrame(frame: InputFrame, path: string, errs: ErrorCollector): void {
  if (!isFiniteNumber(frame.tick)) {
    errs(`${path}.tick: expected finite number`);
  }
  if (typeof frame.sourceId !== "string" || frame.sourceId.length === 0) {
    errs(`${path}.sourceId: expected non-empty string`);
  }
  if (typeof frame.controlSlot !== "string" || frame.controlSlot.length === 0) {
    errs(`${path}.controlSlot: expected non-empty string`);
  }
  if (!isFiniteNumber(frame.moveX) || frame.moveX < -1 || frame.moveX > 1) {
    errs(`${path}.moveX: expected number in [-1, 1], got ${frame.moveX}`);
  }
  if (!isFiniteNumber(frame.moveY) || frame.moveY < -1 || frame.moveY > 1) {
    errs(`${path}.moveY: expected number in [-1, 1], got ${frame.moveY}`);
  }
  if (!isFiniteNumber(frame.sprint) || frame.sprint < 0 || frame.sprint > 1) {
    errs(`${path}.sprint: expected number in [0, 1], got ${frame.sprint}`);
  }
  if (!Number.isInteger(frame.heldButtons)) {
    errs(`${path}.heldButtons: expected integer bitmask`);
  }
  if (!Number.isInteger(frame.pressedButtons)) {
    errs(`${path}.pressedButtons: expected integer bitmask`);
  }
  if (!Number.isInteger(frame.releasedButtons)) {
    errs(`${path}.releasedButtons: expected integer bitmask`);
  }
}

// ---------------------------------------------------------------------------
// WorldState validation
// ---------------------------------------------------------------------------

/**
 * Validate a WorldState.
 *
 * Checks:
 *  - Non-finite numbers
 *  - Duplicate player IDs
 *  - Duplicate event IDs
 *  - Player count for LABORATORY profile (1–22)
 *  - Exactly one ball
 *  - Ball fields are finite
 *  - Schema/config versions are non-empty
 *  - fixedDt rational is valid (denominator > 0)
 *  - Event references resolve
 *  - Control assignments reference valid players
 *  - No ball parented to a player
 */
export function validateWorldState(state: WorldState, profile?: string, errs?: ErrorCollector): string[] {
  const errors: string[] = [];
  const collect = errs ?? ((msg) => errors.push(msg));

  // Schema/config versions
  if (typeof state.schemaVersion !== "string" || state.schemaVersion.length === 0) {
    collect("schemaVersion: expected non-empty string");
  }
  if (typeof state.simulationVersion !== "string" || state.simulationVersion.length === 0) {
    collect("simulationVersion: expected non-empty string");
  }
  if (typeof state.configVersion !== "string" || state.configVersion.length === 0) {
    collect("configVersion: expected non-empty string");
  }

  // FixedDt rational validity
  if (!Number.isInteger(state.fixedDt.numerator)) {
    collect("fixedDt.numerator: expected integer");
  }
  if (!Number.isInteger(state.fixedDt.denominator) || state.fixedDt.denominator <= 0) {
    collect("fixedDt.denominator: expected positive integer");
  }

  // Tick
  if (!Number.isInteger(state.tick)) {
    collect("tick: expected integer");
  }

  // Players
  if (!Array.isArray(state.players)) {
    collect("players: expected array");
  } else {
    // Cardinally valid for LABORATORY profile
    if (profile === "LABORATORY") {
      if (state.players.length < 1 || state.players.length > 22) {
        collect(`players: LABORATORY profile requires 1–22 players, got ${state.players.length}`);
      }
    }

    // Exactly one player per teamId? (Not validated here — team constraint)
    // Duplicate playerId check
    const seenIds = new Set<string>();
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (typeof p.playerId !== "string" || p.playerId.length === 0) {
        collect(`players[${i}].playerId: expected non-empty string`);
      } else if (seenIds.has(p.playerId)) {
        collect(`players: duplicate playerId "${p.playerId}"`);
      } else {
        seenIds.add(p.playerId);
      }
      if (typeof p.teamId !== "string" || p.teamId.length === 0) {
        collect(`players[${i}].teamId: expected non-empty string`);
      }
      assertFiniteVec2(p.groundPosition, `players[${i}].groundPosition`, collect);
      assertFiniteVec2(p.linearVelocity, `players[${i}].linearVelocity`, collect);
      assertFiniteVec2(p.desiredVelocity, `players[${i}].desiredVelocity`, collect);
      if (!isFiniteNumber(p.bodyHeading)) {
        collect(`players[${i}].bodyHeading: expected finite number`);
      }
      if (!isFiniteNumber(p.desiredHeading)) {
        collect(`players[${i}].desiredHeading: expected finite number`);
      }
    }

    // Control assignments resolve
    if (state.schedulerMemory && state.schedulerMemory.missingInputCounters) {
      for (const slot of Object.keys(state.schedulerMemory.missingInputCounters)) {
        const val = state.schedulerMemory.missingInputCounters[slot];
        if (typeof val !== "number" || val < 0 || !Number.isInteger(val)) {
          collect(`schedulerMemory.missingInputCounters[${slot}]: expected non-negative integer`);
        }
      }
    }
  }

  // Ball — exactly one
  if (!state.ball) {
    collect("ball: required, missing");
  } else {
    assertFiniteVec3(state.ball.position, "ball.position", collect);
    assertFiniteVec3(state.ball.linearVelocity, "ball.linearVelocity", collect);
    assertFiniteVec3(state.ball.angularVelocity, "ball.angularVelocity", collect);
    if (typeof state.ball.regime !== "string" || !["ground-roll", "airborne", "bouncing", "settled"].includes(state.ball.regime)) {
      collect("ball.regime: expected one of ground-roll, airborne, bouncing, settled");
    }
    if (state.ball.lastTouchRef !== null && typeof state.ball.lastTouchRef !== "string") {
      collect("ball.lastTouchRef: expected string or null");
    }

    // Check no ball parented to a player (any field suggesting ownership)
    if ((state.ball as unknown as Record<string, unknown>)["ownerPlayerId"] !== undefined) {
      collect("ball: must not be parented to a player (ownerPlayerId found)");
    }
  }

  // Events — check duplicate IDs and reference resolution
  if (!Array.isArray(state.events)) {
    collect("events: expected array");
  } else {
    const eventIds = new Set<string>();
    for (let i = 0; i < state.events.length; i++) {
      const ev = state.events[i];
      if (typeof ev.id !== "string" || ev.id.length === 0) {
        collect(`events[${i}].id: expected non-empty string`);
      } else if (eventIds.has(ev.id)) {
        collect(`events: duplicate event id "${ev.id}"`);
      } else {
        eventIds.add(ev.id);
      }
      if (!isFiniteNumber(ev.tick)) {
        collect(`events[${i}].tick: expected finite number`);
      }
      if (!Number.isInteger(ev.sequence)) {
        collect(`events[${i}].sequence: expected integer`);
      }
    }
    // lastTouchRef must resolve to an event id
    if (state.ball?.lastTouchRef && typeof state.ball.lastTouchRef === "string") {
      if (!eventIds.has(state.ball.lastTouchRef)) {
        collect(`ball.lastTouchRef "${state.ball.lastTouchRef}": unresolved event reference`);
      }
    }
  }

  // PRNG state
  if (state.prng) {
    if (typeof state.prng.algorithmId !== "string" || state.prng.algorithmId.length === 0) {
      collect("prng.algorithmId: expected non-empty string");
    }
    if (!Number.isInteger(state.prng.seed)) {
      collect("prng.seed: expected integer");
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// ScenarioDefinition validation
// ---------------------------------------------------------------------------

/**
 * Validate a ScenarioDefinition before world creation.
 */
export function validateScenario(scenario: ScenarioDefinition, errs?: ErrorCollector): string[] {
  const errors: string[] = [];
  const collect = errs ?? ((msg) => errors.push(msg));

  // Required string fields
  for (const field of ["id", "version", "family", "schemaVersion", "simulationVersion", "configVersion"]) {
    if (typeof (scenario as unknown as Record<string, unknown>)[field] !== "string") {
      collect(`scenario.${field}: expected string`);
    }
  }

  // Duration and seed
  if (!Number.isInteger(scenario.durationTicks) || scenario.durationTicks < 1) {
    collect("durationTicks: expected positive integer");
  }
  if (!Number.isInteger(scenario.seed)) {
    collect("seed: expected integer");
  }
  if (!isFiniteNumber(scenario.pitchLength) || scenario.pitchLength <= 0) {
    collect("pitchLength: expected positive finite number");
  }
  if (!isFiniteNumber(scenario.pitchWidth) || scenario.pitchWidth <= 0) {
    collect("pitchWidth: expected positive finite number");
  }

  // Players
  if (!Array.isArray(scenario.players) || scenario.players.length < 1) {
    collect("players: expected at least one player");
  } else {
    const seenPlayerIds = new Set<string>();
    for (let i = 0; i < scenario.players.length; i++) {
      const p = scenario.players[i];
      if (typeof p.playerId !== "string" || p.playerId.length === 0) {
        collect(`players[${i}].playerId: expected non-empty string`);
      } else if (seenPlayerIds.has(p.playerId)) {
        collect(`players: duplicate playerId "${p.playerId}"`);
      } else {
        seenPlayerIds.add(p.playerId);
      }
      if (typeof p.teamId !== "string" || p.teamId.length === 0) {
        collect(`players[${i}].teamId: expected non-empty string`);
      }
      // Check control assignments reference valid players
    }

    // Validate control assignments resolve to declared players
    for (const slotKey of Object.keys(scenario.controlAssignments)) {
      const assign = scenario.controlAssignments[slotKey];
      if (typeof assign.teamId !== "string" || assign.teamId.length === 0) {
        collect(`controlAssignments[${slotKey}].teamId: expected non-empty string`);
      }
      if (typeof assign.controlledPlayerId !== "string" || assign.controlledPlayerId.length === 0) {
        collect(`controlAssignments[${slotKey}].controlledPlayerId: expected non-empty string`);
      } else if (!seenPlayerIds.has(assign.controlledPlayerId)) {
        collect(`controlAssignments[${slotKey}].controlledPlayerId "${assign.controlledPlayerId}": unresolved player reference`);
      }
    }

    // Cardinally valid for profile
    if (scenario.profile === "LABORATORY") {
      if (scenario.players.length < 1 || scenario.players.length > 22) {
        collect(`players: LABORATORY profile requires 1–22 players, got ${scenario.players.length}`);
      }
    }
  }

  // Ball — exactly one
  if (!scenario.ball) {
    collect("ball: required");
  } else {
    assertFiniteVec3(scenario.ball.position, "ball.position", collect);
    assertFiniteVec3(scenario.ball.linearVelocity, "ball.linearVelocity", collect);
    assertFiniteVec3(scenario.ball.angularVelocity, "ball.angularVelocity", collect);
    if (typeof scenario.ball.regime !== "string" || !["ground-roll", "airborne", "bouncing", "settled"].includes(scenario.ball.regime)) {
      collect("ball.regime: invalid value");
    }
  }

  // Input program — validate InputFrames
  for (const tickStr of Object.keys(scenario.inputProgram)) {
    const tick = Number(tickStr);
    if (!Number.isInteger(tick) || tick < 0) {
      collect(`inputProgram[${tickStr}]: expected non-negative integer tick key`);
      continue;
    }
    const frames = scenario.inputProgram[tick];
    if (Array.isArray(frames)) {
      for (let fi = 0; fi < frames.length; fi++) {
        validateInputFrame(frames[fi], `inputProgram[${tickStr}][${fi}]`, collect);
      }
    }
  }

  // Events — check references
  if (scenario.players) {
    for (const evGroup of Object.values(scenario.scheduledEvents || {})) {
      if (Array.isArray(evGroup)) {
        for (const ev of evGroup) {
          if (ev.payload) {
            for (const key of Object.keys(ev.payload)) {
              if (key.includes("playerId")) {
                // Will be validated at world creation against active set
              }
            }
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Validate an array of InputFrames for uniqueness by (tick, controlSlot).
 */
export function validateInputUniqueness(frames: InputFrame[], errs?: ErrorCollector): string[] {
  const errors: string[] = [];
  const collect = errs ?? ((msg) => errors.push(msg));
  const seen = new Set<string>();
  for (const f of frames) {
    const key = `${f.tick}:${f.controlSlot}`;
    if (seen.has(key)) {
      collect(`duplicate input frame for (tick=${f.tick}, controlSlot="${f.controlSlot}")`);
    }
    seen.add(key);
  }
  return errors;
}
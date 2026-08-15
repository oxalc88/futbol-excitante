/**
 * @module @pes/simulation/world/create
 *
 * Deterministic world creation from a ScenarioDefinition, immutable config,
 * and a seed.  Produces a complete initial WorldState ready for simulation.
 *
 * No simulation.step, locomotion, ball integration, or PRNG consumption.
 * Pure, synchronous, DOM-free, no-Node-I/O.
 */

import type { Vec2, Vec3 } from "../../contracts/math.js";
import type { InputFrame } from "../../contracts/input.js";
import type { PlayerState, BallState, WorldState } from "../../contracts/state.js";
import type { ScenarioDefinition, SimulationEvent } from "../../contracts/scenario.js";
import { FOUNDATION_CONFIG } from "../config/foundation.js";
import { ARCHETYPE_REGISTRY } from "../config/foundation.js";
import { createMulberry32 } from "../determinism/rng.js";
import {
  validateScenario,
  validateWorldState,
  validateInputUniqueness,
  validateInputFrame,
} from "./validate.js";
import { freezeWorldState, freezeScenario } from "./clone.js";

// ---------------------------------------------------------------------------
// Helpers — deterministic, no randomness, no I/O
// ---------------------------------------------------------------------------

/** Resolve archetype id → transient acceleration coefficient (default 0). */
function resolveArchetypeTransientAccel(archetypeId: string | undefined): number {
  if (!archetypeId) return 0;
  const def = ARCHETYPE_REGISTRY[archetypeId];
  if (!def) return 0;
  return def.transientAcceleration.value;
}

/** Convert a ScenarioPlayerEntry into a PlayerState at tick 0. */
function scenarioPlayerToState(
  entry: {
    playerId: string;
    teamId: string;
    groundPosition: Vec2;
    linearVelocity: Vec2;
    desiredVelocity: Vec2;
    bodyHeading: number;
    desiredHeading: number;
    archetypeId?: string;
  }
): PlayerState {
  return {
    playerId: entry.playerId,
    teamId: entry.teamId,
    groundPosition: { ...entry.groundPosition },
    linearVelocity: { ...entry.linearVelocity },
    desiredVelocity: { ...entry.desiredVelocity },
    bodyHeading: entry.bodyHeading,
    desiredHeading: entry.desiredHeading,
    archetypeId: entry.archetypeId,
    archetypeTransientAccel: resolveArchetypeTransientAccel(entry.archetypeId),
  };
}

/** Convert a ScenarioBallEntry into a BallState at tick 0. */
function scenarioBallToState(
  entry: {
    position: Vec3;
    linearVelocity: Vec3;
    angularVelocity: Vec3;
    regime: BallState["regime"];
  }
): BallState {
  return {
    position: { ...entry.position },
    linearVelocity: { ...entry.linearVelocity },
    angularVelocity: { ...entry.angularVelocity },
    regime: entry.regime,
    lastTouchRef: null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CreateOptions {
  /** Already-loaded ScenarioDefinition (will be validated and deep-cloned). */
  scenario: ScenarioDefinition;
  /** Immutable foundation config; if omitted, uses FOUNDATION_CONFIG. */
  config?: typeof FOUNDATION_CONFIG;
}

/**
 * Create a deterministic initial WorldState from a scenario + config + seed.
 *
 * Steps:
 *  1. Deep-clone the scenario (source object is not mutated).
 *  2. Validate the scenario (throws on errors).
 *  3. Validate input frame uniqueness.
 *  4. Build initial state objects from scenario data.
 *  5. Sort active players by playerId.
 *  6. Validate the produced WorldState.
 *  7. Freeze and return an immutable WorldState.
 *
 * @throws {Error} on scenario validation failure or world validation failure.
 */
export function createWorld(opts: CreateOptions): WorldState {
  const { scenario: rawScenario, config = FOUNDATION_CONFIG } = opts;

  // 1. Deep-clone scenario so callers cannot mutate via the internal reference
  const scenario = freezeScenario(rawScenario);

  // 2. Validate scenario before world creation
  const scenarioErrors = validateScenario(scenario);
  if (scenarioErrors.length > 0) {
    throw new Error(
      `Scenario validation failed:\n${scenarioErrors.join("\n")}`
    );
  }

  // 3. Validate input frame uniqueness — fail closed
  const allFrames: InputFrame[] = [];
  for (const tickStr of Object.keys(scenario.inputProgram)) {
    const tick = Number(tickStr);
    if (!Number.isInteger(tick) || tick < 0) continue;
    const frames = scenario.inputProgram[tick];
    if (Array.isArray(frames)) {
      for (const frame of frames) {
        validateInputFrame(frame, `inputProgram[${tickStr}]`, () => {});
        allFrames.push(frame);
      }
    }
  }
  const uniqErrors = validateInputUniqueness(allFrames);
  if (uniqErrors.length > 0) {
    throw new Error(
      `Input uniqueness validation failed:\n${uniqErrors.join("\n")}`,
    );
  }

  // 4. Build initial state — deep-cloned from scenario data
  const sortedPlayers = [...scenario.players]
    .map((entry) => scenarioPlayerToState(entry))
    .sort((a, b) => a.playerId.localeCompare(b.playerId));

  const ballState = scenarioBallToState(scenario.ball);

  // 5. Schedule initial scenario-start event
  const startEvent: SimulationEvent = {
    id: `evt-start-${scenario.id}`,
    tick: 0,
    sequence: 0,
    kind: "scenario-start",
    label: `Scenario ${scenario.id} v${scenario.version} started`,
    payload: { scenarioId: scenario.id, version: scenario.version },
  };

  // 6. PRNG state (seeded, no consumption yet)
  const rng = createMulberry32(scenario.seed);

  // 7. Build WorldState
  const worldState: WorldState = {
    schemaVersion: scenario.schemaVersion,
    simulationVersion: scenario.simulationVersion,
    configVersion: config.id,
    tick: 0,
    fixedDt: config.fixedDt,
    prng: rng.snapshot(),
    players: sortedPlayers,
    ball: ballState,
    events: [startEvent],
    schedulerMemory: {
      missingInputPolicyId: scenario.missingInputPolicy,
      maxConsecutiveMissing: scenario.maxConsecutiveMissing,
      missingInputCounters: {},
      lastHeldFrames: {},
    },
    controlAssignments: scenario.controlAssignments,
    meta: {
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      scenarioFamily: scenario.family,
      prngAlgorithmId: scenario.prngAlgorithmId,
      seed: scenario.seed,
      pitchLength: scenario.pitchLength,
      pitchWidth: scenario.pitchWidth,
      safetyBounds: scenario.safetyBounds,
      profile: scenario.profile,
    },
  };

  // 8. Validate the produced WorldState
  const worldErrors = validateWorldState(worldState, scenario.profile);
  if (worldErrors.length > 0) {
    throw new Error(
      `WorldState validation failed:\n${worldErrors.join("\n")}`
    );
  }

  // 9. Freeze and return immutable copy
  return freezeWorldState(worldState);
}
/**
 * @module tests/unit/2v2-scoring-helpers
 *
 * Shared helper for 2v2-scoring tests.
 * Extracted to avoid duplicating the scenario builder across split test files.
 */

import {
  type HeadlessMatchConfig,
} from "../../eval/runners/headless-match.js";

/**
 * Build a 2v2 scenario where a ball is shot toward a goal.
 *
 * @param goalIndex - 0 for +x goal (team-a), 1 for -x goal (team-b).
 * @param durationTicks - optional custom duration (default 200 ticks).
 * @returns a fully-formed 2v2 scenario definition.
 */
export function buildForcedGoal2v2Scenario(
  goalIndex: 0 | 1,
  durationTicks = 200,
): HeadlessMatchConfig["scenario"] {
  const vx = goalIndex === 0 ? 30 : -30;
  const startX = goalIndex === 0 ? 40 : -40;

  return {
    id: `2v2-forced-goal-${goalIndex}-v1`,
    version: "1.0.0",
    family: "2v2-scoring",
    durationTicks,
    seed: 42,
    prngAlgorithmId: "mulberry32-v1",
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    configVersion: "foundation-config-v1",
    profile: "SMALL_SIDED",
    pitchLength: 105,
    pitchWidth: 68,
    safetyBounds: {
      maxX: 52.5,
      maxY: 34,
      minZ: -0.5,
      maxZ: 20,
    },
    players: [
      {
        playerId: "player-1",
        teamId: "team-a",
        groundPosition: { x: -15, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
        archetypeId: "archetype-burst-v1",
      },
      {
        playerId: "player-2",
        teamId: "team-a",
        groundPosition: { x: -10, y: -12 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
        archetypeId: "archetype-steady-v1",
      },
      {
        playerId: "player-3",
        teamId: "team-b",
        groundPosition: { x: 15, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 3.141592653589793,
        desiredHeading: 3.141592653589793,
        archetypeId: "archetype-burst-v1",
      },
      {
        playerId: "player-4",
        teamId: "team-b",
        groundPosition: { x: 10, y: 12 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 3.141592653589793,
        desiredHeading: 3.141592653589793,
        archetypeId: "archetype-steady-v1",
      },
    ],
    ball: {
      position: { x: startX, y: 0, z: 0.11 },
      linearVelocity: { x: vx, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    controlAssignments: {
      "slot-1": {
        controlSlot: "slot-1",
        teamId: "team-a",
        controlledPlayerId: "player-1",
        mode: "AI_FALLBACK",
      },
      "slot-2": {
        controlSlot: "slot-2",
        teamId: "team-b",
        controlledPlayerId: "player-3",
        mode: "AI_FALLBACK",
      },
      "slot-3": {
        controlSlot: "slot-3",
        teamId: "team-a",
        controlledPlayerId: "player-2",
        mode: "AI_FALLBACK",
      },
      "slot-4": {
        controlSlot: "slot-4",
        teamId: "team-b",
        controlledPlayerId: "player-4",
        mode: "AI_FALLBACK",
      },
    },
    missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
    maxConsecutiveMissing: 3,
    inputProgram: {},
    scheduledEvents: {},
    observationWindows: [{ startTick: 0, endTick: durationTicks }],
    requestedMetrics: [],
  };
}

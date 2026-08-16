/**
 * @module @pes/adapters/input-browser/team-decision-profile
 *
 * Pure team-level decision state machine for CPU coordination.
 *
 * Each team gets one TeamDecision per tick, recomputed from the
 * current CpuObservation. All CPU adapters on the same team read
 * the same shared signal.
 *
 * Modes:
 *  - ATTACK: team has ball possession → push forward, nearest
 *    player presses ball, others hold advanced positions.
 *  - DEFEND: opponent has ball in own third → drop back, nearest
 *    player chases, others cover space.
 *  - BALANCED: default — independent per-player behavior.
 *
 * Deterministic: same (observation, teamId) → same TeamDecision.
 * No Math.random, Date, DOM, or Node I/O.
 *
 * Lives in the adapter layer — no simulation core or contract changes.
 */

import type { CpuObservation } from "./cpu-adapter.js";

// ---------------------------------------------------------------------------
// TeamDecision type
// ---------------------------------------------------------------------------

/**
 * Team-level strategy signal emitted once per tick per team.
 */
export type TeamStrategy = "ATTACK" | "DEFEND" | "BALANCED";

export interface TeamDecision {
  /** The active team strategy for this tick. */
  strategy: TeamStrategy;
  /** Index of the teammate closest to the ball (within observation.players). */
  nearestToBallPlayerId: string | undefined;
  /** Distance from the nearest teammate to the ball (metres). */
  nearestToBallDistance: number;
  /** Whether this team currently has ball possession. */
  hasPossession: boolean;
  /** Which third the ball is in, from this team's perspective. */
  ballZone: "own" | "center" | "opponent";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Distance (metres) within which a player is considered to have
 * ball possession for team-level decision making.
 * Matches POSSESSION_RANGE from cpu-adapter.ts.
 */
const TEAM_POSSESSION_RANGE = 2;

/**
 * Speed threshold (m/s) below which a nearby ball counts as possessed.
 * Matches POSSESSION_SPEED_THRESHOLD from cpu-adapter.ts.
 */
const TEAM_POSSESSION_SPEED_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Determine which third of the pitch the ball occupies, from the
 * given team's perspective.
 *
 * Pitch extends from -pitchLength/2 to +pitchLength/2.
 * team-a attacks +x, team-b attacks -x.
 *
 * Own third: closest to own goal.
 * Opponent third: closest to opponent goal.
 */
export function getBallZone(
  ballX: number,
  pitchLength: number,
  teamId: string,
): "own" | "center" | "opponent" {
  const thirdWidth = pitchLength / 6;
  if (teamId === "team-a") {
    // team-a attacks +x, own goal at -pitchLength/2
    if (ballX < -thirdWidth) return "own";
    if (ballX > thirdWidth) return "opponent";
    return "center";
  }
  // team-b attacks -x, own goal at +pitchLength/2
  if (ballX > thirdWidth) return "own";
  if (ballX < -thirdWidth) return "opponent";
  return "center";
}

/**
 * Check whether the given team has ball possession.
 *
 * Possession = any player on the team is within TEAM_POSSESSION_RANGE
 * of the ball and the ball horizontal speed is below threshold.
 */
export function teamHasPossession(
  observation: CpuObservation,
  teamId: string,
): boolean {
  const ballHSpeed = Math.sqrt(
    observation.ball.linearVelocity.x ** 2 +
    observation.ball.linearVelocity.y ** 2,
  );
  if (ballHSpeed > TEAM_POSSESSION_SPEED_THRESHOLD) return false;

  for (const p of observation.players) {
    if (p.teamId !== teamId) continue;
    const dx = observation.ball.position.x - p.groundPosition.x;
    const dy = observation.ball.position.y - p.groundPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < TEAM_POSSESSION_RANGE) return true;
  }
  return false;
}

/**
 * Find the teammate closest to the ball and return their player ID
 * and distance.
 */
function findNearestToBall(
  observation: CpuObservation,
  teamId: string,
): { playerId: string | undefined; distance: number } {
  let bestId: string | undefined;
  let bestDist = Infinity;
  for (const p of observation.players) {
    if (p.teamId !== teamId) continue;
    const dx = observation.ball.position.x - p.groundPosition.x;
    const dy = observation.ball.position.y - p.groundPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = p.playerId;
    }
  }
  return { playerId: bestId, distance: bestDist };
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

/**
 * Compute the team-level decision for one team on one tick.
 *
 * Rules (deterministic, pure):
 *  1. If this team has possession → ATTACK.
 *  2. If opponent has possession AND ball is in own third → DEFEND.
 *  3. Otherwise → BALANCED.
 *
 * Score awareness (provisional):
 *  - When ahead by ≥ 2 goals, DEFEND is preferred: BALANCED in center
 *    third counts as DEFEND.
 *  - When behind by ≥ 2 goals, ATTACK is preferred: BALANCED in center
 *    third counts as ATTACK.
 *
 * @param observation — read-only world observation.
 * @param teamId — the team this decision applies to.
 * @returns a TeamDecision with the computed strategy and metadata.
 */
export function computeTeamDecision(
  observation: CpuObservation,
  teamId: string,
): TeamDecision {
  const nearest = findNearestToBall(observation, teamId);
  const ballZone = getBallZone(
    observation.ball.position.x,
    observation.pitchLength,
    teamId,
  );

  // Determine opponent team ID.
  const opponentTeamId = teamId === "team-a" ? "team-b" : "team-a";

  const hasPossession = teamHasPossession(observation, teamId);
  const opponentHasPossession = teamHasPossession(observation, opponentTeamId);

  let strategy: TeamStrategy;

  if (hasPossession) {
    // Rule 1: we have the ball → ATTACK
    strategy = "ATTACK";
  } else if (opponentHasPossession && ballZone === "own") {
    // Rule 2: opponent has ball in our third → DEFEND
    strategy = "DEFEND";
  } else {
    // Rule 3: default → BALANCED, with score-based adjustment
    const scoreDiff = observation.scoreDifferential;
    const isAhead = typeof scoreDiff === "number" && scoreDiff >= 2;
    const isBehind = typeof scoreDiff === "number" && scoreDiff <= -2;

    if (isBehind && ballZone === "center") {
      // Behind by 2+: push forward even in center third
      strategy = "ATTACK";
    } else if (isAhead && ballZone === "center") {
      // Ahead by 2+: drop back even in center third
      strategy = "DEFEND";
    } else {
      strategy = "BALANCED";
    }
  }

  return {
    strategy,
    nearestToBallPlayerId: nearest.playerId,
    nearestToBallDistance: nearest.distance,
    hasPossession,
    ballZone,
  };
}

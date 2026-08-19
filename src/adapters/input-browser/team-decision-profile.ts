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
 * Tactical awareness (CPU-TACTICAL-AWARENESS):
 *  - Score gradient: continuous bias from scoreDifferential replaces
 *    hard ±2 threshold. Larger deficit → more attacking bias.
 *  - Match phase: non-playing phases → hold; kickoff → calm.
 *  - Fatigue effects (press radius/strength reduction) are applied
 *    per-player inside the CPU adapter, not at the team-decision level.
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

/**
 * Defensive sub-mode coordinating how defenders behave within
 * the DEFEND / BALANCED strategies.
 *
 *  - NONE:     no active defensive coordination (typically attacking).
 *  - PRESSING: opponents have the ball and the nearest defender is
 *              close enough to press the ball carrier directly.
 *  - MARKING:  opponents have the ball but the nearest defender is
 *              too far to press; defenders should mark space / players.
 *  - RECOVERING: ball transitioning from own third to center;
 *              defenders recovering defensive shape.
 *
 * Provisional — not a measured PES 2017 concept.
 */
export type DefensiveSubMode = "NONE" | "PRESSING" | "MARKING" | "RECOVERING";

/**
 * Distance (metres) within which a defender is considered close
 * enough to press the ball carrier rather than marking space.
 * Provisional placeholder.
 */
const PRESS_DISTANCE_THRESHOLD = 12;

export interface TeamDecision {
  /** The active team strategy for this tick. */
  strategy: TeamStrategy;
  /** Defensive sub-mode for coordinated defender behavior. */
  defensiveSubMode: DefensiveSubMode;
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
 *  1. If match phase is non-playing ("goal", "halftime", "fulltime",
 *     "corner-kick", "throw-in", "goal-kick") → BALANCED with HOLD
 *     sub-mode (players hold position, no chasing).
 *  2. If match phase is "kickoff" → BALANCED (structured/calm).
 *  3. If this team has possession → ATTACK.
 *  4. If opponent has possession AND ball is in own third → DEFEND.
 *  5. Otherwise → BALANCED with score-gradient adjustment.
 *
 * Score gradient (provisional):
 *  - Continuous bias from scoreDifferential: the larger the deficit,
 *    the more attacking (and vice versa for leads).
 *  - Mapping: bias = clamp(-scoreDifferential / 3, -1, 1).
 *    Positive bias → toward ATTACK; negative → toward DEFEND.
 *  - In center third (BALANCED default):
 *    - bias > 0.33 → ATTACK
 *    - bias < -0.33 → DEFEND
 *    - Otherwise → BALANCED
 *
 * Fatigue effects (per-player, in the adapter, not here):
 *  - Press radius and press strength shrink with fatigue.
 *  - Sprint is always 1 (accepted invariant).
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

  // --- Phase-aware behavior (provisional) ---
  // Non-playing phases: hold position, no chasing.
  const phase = observation.matchPhase;
  const isNonPlayingPhase = phase === "goal" || phase === "halftime" ||
    phase === "fulltime" || phase === "corner-kick" ||
    phase === "throw-in" || phase === "goal-kick";
  const isKickoff = phase === "kickoff";

  let strategy: TeamStrategy;

  if (isNonPlayingPhase) {
    // During set pieces and stoppages, hold position — no chasing.
    strategy = "BALANCED";
  } else if (isKickoff) {
    // Right after kickoff: structured/calm behavior.
    strategy = "BALANCED";
  } else if (hasPossession) {
    // Rule 3: we have the ball → ATTACK
    strategy = "ATTACK";
  } else if (opponentHasPossession && ballZone === "own") {
    // Rule 4: opponent has ball in our third → DEFEND
    strategy = "DEFEND";
  } else {
    // Rule 5: default → BALANCED, with continuous score-gradient adjustment.
    const scoreDiff = observation.scoreDifferential ?? 0;
    // Provisional continuous bias: positive = more attacking, negative = more defensive.
    // Clamp to [-1, 1]. At scoreDiff = -3 → bias ≈ 1 (very attacking).
    // At scoreDiff = +3 → bias ≈ -1 (very defensive).
    const scoreBias = Math.max(-1, Math.min(1, -scoreDiff / 3));

    if (scoreBias > 0.33 && ballZone === "center") {
      // Behind in score → push forward in center third.
      strategy = "ATTACK";
    } else if (scoreBias < -0.33 && ballZone === "center") {
      // Ahead in score → drop back in center third.
      strategy = "DEFEND";
    } else {
      strategy = "BALANCED";
    }
  }

  // ------------------------------------------------------------------
  // Compute defensive sub-mode from strategy + ball state.
  // ------------------------------------------------------------------
  let defensiveSubMode: DefensiveSubMode = "NONE";

  if (isNonPlayingPhase) {
    // During non-playing phases, all players hold — no pressing or marking.
    defensiveSubMode = "NONE";
  } else if (strategy === "DEFEND") {
    if (nearest.distance <= PRESS_DISTANCE_THRESHOLD) {
      defensiveSubMode = "PRESSING";
    } else {
      defensiveSubMode = "MARKING";
    }
  } else if (strategy === "BALANCED" && opponentHasPossession) {
    // Opponent has possession in center/third — cautious marking.
    // RECOVERING when the ball is in the center zone (transitioning
    // from a previous own-third possession by the opponent).
    defensiveSubMode = ballZone === "own" ? "MARKING" : "RECOVERING";
  }
  // ATTACK → NONE (default).

  return {
    strategy,
    defensiveSubMode,
    nearestToBallPlayerId: nearest.playerId,
    nearestToBallDistance: nearest.distance,
    hasPossession,
    ballZone,
  };
}

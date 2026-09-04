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
 * CPU defensive tackle commitment (CPU-DEFENSIVE-TACKLE) is decided here as a
 * shared per-team signal: one authorisation per tick, evaluated only from
 * fields the observation exposes. The adapter that receives it turns it into a
 * tick-indexed tackle press.
 *
 * Anti-huddle (5V5-KICKOFF-ANTI-HUDDLE): with the shape live, the single
 * designated presser above is also the only body of the team the CPU adapter
 * lets converge on the ball, and it is chosen from the roles the defensive
 * policy allows to press, so "one presser" and "one lawful tackler" stay one
 * and the same body.
 *
 * Lives in the adapter layer — no simulation core or contract changes.
 */

import type { CpuObservation } from "./cpu-adapter.js";
import {
  FOUNDATION_CPU_TACKLE_V1,
  FOUNDATION_FIXED_DT_V1,
  FOUNDATION_LOCOMOTION_V1,
  FOUNDATION_TACKLE_V1,
} from "../../simulation/config/foundation.js";
import type {
  CpuTackleConfig,
  TackleConfig,
} from "../../simulation/config/foundation.js";

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

// ---------------------------------------------------------------------------
// CPU defensive tackle commitment (CPU-DEFENSIVE-TACKLE)
// ---------------------------------------------------------------------------

/** Which defensive action a CPU is authorised to commit. */
export type CpuTackleKind = "standing" | "slide";

/**
 * Why no commit was issued this tick. Exposed so evidence can disclose the
 * withheld reason instead of silently emitting nothing.
 */
export type TackleWithheldReason =
  | "COMMITTED"
  | "NOT_DEFENDING"
  | "NO_TACKLER"
  | "ROLE_EXCLUDED"
  | "NO_CONTEST"
  | "OUT_OF_REACH"
  | "MISALIGNED";

/**
 * A single per-tick, per-team authorisation to commit one defensive tackle.
 *
 * The commit is a pure function of the observation: geometry the tackler can
 * see (its own body state, the ball state, the nearest opposing carrier) plus
 * the action geometry declared by `FOUNDATION_TACKLE_V1` — the same versioned
 * declaration the tackle system executes. Thresholds that are not derived from
 * the action system live in `FOUNDATION_CPU_TACKLE_V1` and are provisional.
 *
 * At most one player per team is authorised on a tick — the designated
 * presser — so a commit can never become a coordinated swarm lunge.
 */
export interface CpuTackleCommit {
  /** Player authorised to commit this tick. */
  playerId: string;
  /** Standing or sliding action the observed geometry justifies. */
  kind: CpuTackleKind;
  /** Current planar distance (metres) from tackler to ball. */
  ballDistance: number;
  /**
   * Conservative planar distance (metres) between the tackler and the ball at
   * the last tick on which this action's contact is still eligible, projecting
   * the ball at its current velocity and the tackler by the speed caps the
   * action itself declares.
   */
  predictedDistance: number;
  /** Reach (metres) declared by the action system for this kind. */
  reach: number;
  /** Ticks from the commit to the last contact-eligible tick of the window. */
  contactHorizonTicks: number;
  /** Planar distance (metres) from the ball to its opposing carrier. */
  carrierDistance: number;
}

/** Evaluation output: the commit plus the reason when there is none. */
export interface CpuTackleEvaluation {
  commit: CpuTackleCommit | null;
  withheld: TackleWithheldReason;
}

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
  /**
   * The team's designated presser: the teammate closest to the ball, or — with
   * the anti-huddle shape live — the closest teammate the defensive policy
   * allows to press (see `designatePresser`). Either way exactly one body per
   * team and tick, and the same body the CPU adapter chases with.
   */
  nearestToBallPlayerId: string | undefined;
  /** Distance from the designated presser to the ball (metres). */
  nearestToBallDistance: number;
  /** Whether this team currently has ball possession. */
  hasPossession: boolean;
  /** Which third the ball is in, from this team's perspective. */
  ballZone: "own" | "center" | "opponent";
  /**
   * Defensive tackle authorisation for this tick, or null when the observed
   * geometry does not justify committing one. At most one player per team is
   * authorised, so the signal also coordinates which defender takes the duel.
   *
   * CPU-DEFENSIVE-TACKLE. Provisional thresholds (FOUNDATION_CPU_TACKLE_V1);
   * the action geometry is read from FOUNDATION_TACKLE_V1.
   */
  tackleCommit: CpuTackleCommit | null;
  /** Why `tackleCommit` is null this tick (provenance for evidence). */
  tackleWithheld: TackleWithheldReason;
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
// Anti-huddle activation and press designation (5V5-KICKOFF-ANTI-HUDDLE)
// ---------------------------------------------------------------------------

/**
 * Whether the anti-huddle team shape is live for this observation.
 *
 * It activates on an observable precondition only: the observation carries the
 * ball's authoritative touch reference, which every real runtime wiring does and
 * no legacy synthetic fixture does. Those fixtures therefore keep the
 * byte-identical behavior they pin. `cpuAntiHuddle: false` is the explicit kill
 * switch the discriminating guards use to restore the chase-everything huddle.
 *
 * Deterministic pure function of the observation; the CPU adapter re-exports it
 * so a single activation rule governs both sides.
 */
export function isAntiHuddleActive(observation: CpuObservation): boolean {
  return observation.cpuAntiHuddle !== false &&
    observation.ball.lastTouchRef !== undefined &&
    observation.cpuTeamId !== undefined;
}

/**
 * Designate the one body of `teamId` that presses and chases the ball this tick.
 *
 * Stashed, this is the accepted nearest-body-to-ball designation, unchanged.
 * Live, it prefers the nearest teammate the accepted defensive policy allows to
 * press — a role inside `FOUNDATION_CPU_TACKLE_V1.committingRoles`, with an
 * unassigned role treated as eligible exactly as the accepted tackle gate does —
 * so the single body that converges is also the single body that can lawfully
 * win the duel, and the press block, the cover pair and the tackle
 * authorisation all name the same player. A team with no eligible body keeps the
 * accepted nearest-body designation, so a chaser always exists.
 *
 * Ties resolve by ascending playerId, so the choice never depends on the order
 * players happen to appear in the observation.
 */
export function designatePresser(
  observation: CpuObservation,
  teamId: string,
): { playerId: string | undefined; distance: number } {
  const nearest = findNearestToBall(observation, teamId);
  if (!isAntiHuddleActive(observation)) return nearest;

  const allowed: ReadonlyArray<string> = FOUNDATION_CPU_TACKLE_V1.committingRoles.value;
  let bestId: string | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of observation.players) {
    if (p.teamId !== teamId) continue;
    if (p.formationRole !== undefined && !allowed.includes(p.formationRole)) continue;
    const dist = planarDistance(
      p.groundPosition.x,
      p.groundPosition.y,
      observation.ball.position.x,
      observation.ball.position.y,
    );
    if (
      dist < bestDist ||
      (dist === bestDist && bestId !== undefined && p.playerId < bestId)
    ) {
      bestDist = dist;
      bestId = p.playerId;
    }
  }
  return bestId === undefined ? nearest : { playerId: bestId, distance: bestDist };
}

// ---------------------------------------------------------------------------
// CPU defensive tackle evaluation
// ---------------------------------------------------------------------------

/** Seconds per fixed simulation tick, from the versioned fixed-step config. */
const FIXED_DT_SECONDS =
  FOUNDATION_FIXED_DT_V1.numerator / FOUNDATION_FIXED_DT_V1.denominator;

/** Planar distance helper. */
function planarDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Planar speed helper. */
function planarSpeed(v: { x: number; y: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/** Unit planar direction, or null when the vector is degenerate. */
function unitPlanar(
  dx: number,
  dy: number,
): { x: number; y: number } | null {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return null;
  return { x: dx / len, y: dy / len };
}

/**
 * Project a planar position `ticks` fixed steps ahead at a constant velocity.
 * Deliberately conservative: no acceleration credit is taken, so a commit is
 * only ever justified against ground the body can already cover.
 */
function projectPlanar(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  ticks: number,
): { x: number; y: number } {
  const dt = ticks * FIXED_DT_SECONDS;
  return { x: position.x + velocity.x * dt, y: position.y + velocity.y * dt };
}

/**
 * Metres a committed body can travel toward its target across the contact
 * window: the phase speed caps the action itself declares (`prepareSpeedFactor`
 * while preparing, then the active-window cap) integrated tick by tick. The
 * sprint the commitment gives up is never counted, so a commit is only ever
 * justified against ground the committed body can actually cover.
 */
function committedCover(
  prepareTicks: number,
  activeWindowTicks: number,
  prepareCap: number,
  activeCap: number,
): number {
  return (
    (prepareTicks * prepareCap + activeWindowTicks * activeCap) *
    FIXED_DT_SECONDS
  );
}

/**
 * Nearest opposing player to the ball — the observable ball carrier whose
 * challenge would be a duel rather than a lunge at loose ball.
 */
function findNearestOpponentToBall(
  observation: CpuObservation,
  teamId: string,
): { playerId: string; distance: number } | null {
  let bestId: string | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of observation.players) {
    if (p.teamId === teamId) continue;
    const dist = planarDistance(
      observation.ball.position.x,
      observation.ball.position.y,
      p.groundPosition.x,
      p.groundPosition.y,
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestId = p.playerId;
    }
  }
  return bestId ? { playerId: bestId, distance: bestDist } : null;
}

/**
 * Evaluate whether this team may commit a defensive tackle on this tick, and
 * which action the observed geometry justifies.
 *
 * Gates (all pure functions of the observation — nothing outside it is read):
 *  1. Defensive posture: this team does not have the ball and is not ATTACK.
 *  2. One authorised tackler: the designated presser (nearest teammate to the
 *     ball), and only when their role is allowed to defend.
 *  3. Real contest: an opposing player is the closest body to the ball and is
 *     within the provisional carrier-contest radius, so the commit challenges a
 *     carrier rather than deflecting the ball away from a teammate.
 *  4. Body orientation: the ball lies inside the action's own forward contact
 *     cone relative to the direction the defender is travelling (or its body
 *     heading when stationary). Committing while running away is never
 *     temporally justifiable.
 *  5. Temporal reach: projected to the last tick on which contact is still
 *     eligible — the ball at its current velocity, the tackler by the speed caps
 *     the action itself declares — the ball is still `commitMargin` inside that
 *     kind's reach. The cheaper standing action is preferred; the slide is
 *     additionally a last resort (own third, and the target actually opening a
 *     gap), because its recovery window is far longer.
 *
 * @param observation - Read-only world observation (no privileged state).
 * @param teamId - Team whose defenders are evaluated.
 * @param basis - The strategy signals already derived for this tick.
 * @param config - Provisional CPU decision thresholds.
 * @param tackleConfig - The action geometry the tackle system itself executes.
 */
export function evaluateCpuTackleCommit(
  observation: CpuObservation,
  teamId: string,
  basis: {
    strategy: TeamStrategy;
    nearestToBallPlayerId: string | undefined;
    nearestToBallDistance: number;
    hasPossession: boolean;
    ballZone: "own" | "center" | "opponent";
  },
  config: CpuTackleConfig = FOUNDATION_CPU_TACKLE_V1,
  tackleConfig: TackleConfig = FOUNDATION_TACKLE_V1,
): CpuTackleEvaluation {
  // 1. Defensive posture: a team that has the ball does not tackle itself.
  if (basis.hasPossession || basis.strategy === "ATTACK") {
    return { commit: null, withheld: "NOT_DEFENDING" };
  }

  // 2. Single authorised tackler: the designated presser.
  const tackler = observation.players.find(
    (p) => p.playerId === basis.nearestToBallPlayerId && p.teamId === teamId,
  );
  if (!tackler) {
    return { commit: null, withheld: "NO_TACKLER" };
  }
  const allowedRoles: ReadonlyArray<string> = config.committingRoles.value;
  if (
    tackler.formationRole !== undefined &&
    !allowedRoles.includes(tackler.formationRole)
  ) {
    return { commit: null, withheld: "ROLE_EXCLUDED" };
  }

  // 3. The challenge must contest an actual carrier, and that opponent — not a
  //    teammate — must be the player closest to the ball. Challenging a ball a
  //    teammate already owns would only deflect it away from the team.
  const carrier = findNearestOpponentToBall(observation, teamId);
  if (!carrier || carrier.distance > config.carrierContestDistance.value) {
    return { commit: null, withheld: "NO_CONTEST" };
  }
  if (basis.nearestToBallDistance <= carrier.distance) {
    return { commit: null, withheld: "NO_CONTEST" };
  }

  const ballX = observation.ball.position.x;
  const ballY = observation.ball.position.y;
  const defenderSpeed = planarSpeed(tackler.linearVelocity);
  const toBall = unitPlanar(
    ballX - tackler.groundPosition.x,
    ballY - tackler.groundPosition.y,
  );
  const ballDistance = planarDistance(
    tackler.groundPosition.x,
    tackler.groundPosition.y,
    ballX,
    ballY,
  );

  // 4. The ball must lie in the direction this body is already travelling.
  const orientation =
    defenderSpeed > config.orientationSpeedEpsilon.value
      ? unitPlanar(tackler.linearVelocity.x, tackler.linearVelocity.y)
      : unitPlanar(
          Math.cos(tackler.bodyHeading),
          Math.sin(tackler.bodyHeading),
        );
  if (orientation && toBall) {
    const coneCos = orientation.x * toBall.x + orientation.y * toBall.y;
    if (coneCos < tackleConfig.contactConeMinCos.value) {
      return { commit: null, withheld: "MISALIGNED" };
    }
  }

  // 5. Temporally justified reach across the action's own contact window.
  const intent = toBall ?? { x: 0, y: 0 };
  const ballVelocity = {
    x: observation.ball.linearVelocity.x,
    y: observation.ball.linearVelocity.y,
  };
  // Rate at which the defender→ball gap is opening along that line. Positive
  // means the target is getting away, which is what makes a long-recovery
  // stretch worth committing to.
  const gapRate = toBall
    ? (ballVelocity.x - tackler.linearVelocity.x) * toBall.x +
      (ballVelocity.y - tackler.linearVelocity.y) * toBall.y
    : 0;
  // The versioned locomotion cap the action's own commitment caps derive from
  // — the same value the tackle system receives as `locoMaxSpeed`. A scenario
  // that swapped in a different locomotion config would have to supply that cap
  // through the observation instead of assuming the foundation value.
  const locoMaxSpeed = FOUNDATION_LOCOMOTION_V1.maxSpeed.value;
  const prepareCap = locoMaxSpeed * tackleConfig.prepareSpeedFactor.value;
  const standingActiveCap = locoMaxSpeed * tackleConfig.activeSpeedFactor.value;
  const candidates: Array<{
    kind: CpuTackleKind;
    /** Last tick on which this action's contact is still eligible. */
    horizonTicks: number;
    reach: number;
    /** Metres the committed body can cover toward the ball by that tick. */
    cover: number;
  }> = [
    {
      kind: "standing",
      horizonTicks:
        tackleConfig.standingPrepareTicks.value +
        tackleConfig.standingActiveTicks.value -
        1,
      reach: tackleConfig.standingReach.value,
      cover: committedCover(
        tackleConfig.standingPrepareTicks.value,
        tackleConfig.standingActiveTicks.value - 1,
        prepareCap,
        standingActiveCap,
      ),
    },
    {
      kind: "slide",
      horizonTicks:
        tackleConfig.slidePrepareTicks.value +
        tackleConfig.slideActiveTicks.value -
        1,
      reach: tackleConfig.slideReach.value,
      // The sliding lunge speed is a declared property of the action itself,
      // capped by the action's own active-window speed factor. No credit is
      // taken for the sprint the commitment removes.
      cover: committedCover(
        tackleConfig.slidePrepareTicks.value,
        tackleConfig.slideActiveTicks.value - 1,
        prepareCap,
        Math.min(tackleConfig.slideLungeSpeed.value, standingActiveCap),
      ),
    },
  ];

  let withheld: TackleWithheldReason = "OUT_OF_REACH";
  for (const candidate of candidates) {
    if (candidate.kind === "slide") {
      // The slide costs far more recovery than the standing challenge, so it
      // stays a last resort: only inside the team's own third, and only when
      // the target is actually escaping a run-on standing challenge.
      if (config.slideOwnThirdOnly.value && basis.ballZone !== "own") {
        continue;
      }
      if (gapRate < config.slideEscapeSpeed.value) {
        continue;
      }
    }
    const projectedBall = projectPlanar(
      { x: ballX, y: ballY },
      ballVelocity,
      candidate.horizonTicks,
    );
    const projectedDefender = {
      x: tackler.groundPosition.x + intent.x * candidate.cover,
      y: tackler.groundPosition.y + intent.y * candidate.cover,
    };
    const predictedDistance = planarDistance(
      projectedDefender.x,
      projectedDefender.y,
      projectedBall.x,
      projectedBall.y,
    );
    if (predictedDistance > candidate.reach - config.commitMargin.value) {
      continue;
    }
    return {
      commit: {
        playerId: tackler.playerId,
        kind: candidate.kind,
        ballDistance,
        predictedDistance,
        reach: candidate.reach,
        contactHorizonTicks: candidate.horizonTicks,
        carrierDistance: carrier.distance,
      },
      withheld: "COMMITTED",
    };
  }

  return { commit: null, withheld };
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
  const nearest = designatePresser(observation, teamId);
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

  // ------------------------------------------------------------------
  // Defensive tackle authorisation (CPU-DEFENSIVE-TACKLE).
  // Evaluated from the same observation only — no privileged world state,
  // no wall clock, no randomness.
  // ------------------------------------------------------------------
  const tackle = evaluateCpuTackleCommit(observation, teamId, {
    strategy,
    nearestToBallPlayerId: nearest.playerId,
    nearestToBallDistance: nearest.distance,
    hasPossession,
    ballZone,
  });

  return {
    strategy,
    defensiveSubMode,
    nearestToBallPlayerId: nearest.playerId,
    nearestToBallDistance: nearest.distance,
    hasPossession,
    ballZone,
    tackleCommit: tackle.commit,
    tackleWithheld: tackle.withheld,
  };
}

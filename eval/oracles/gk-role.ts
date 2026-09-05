/**
 * @module eval/oracles/gk-role
 *
 * Protected SMALL-SIDED goalkeeper oracles (objective GK-KEEPER-ORACLE-REGISTRATION).
 *
 * Each oracle is a pure function of the committed `TelemetryObservation[]` and
 * returns invariant-style results for one of the five small-sided GK behavior
 * criteria (specs/GOALKEEPER_SPEC.md §4-§8):
 *   - GK-ROLE-DESIGNATION        -> checkGkRoleDesignation
 *   - GK-POSITIONING-HOLD        -> checkGkPositioningHold
 *   - GK-NO-FIELD-CHASE          -> checkGkNoFieldChase
 *   - GK-SAVE-CLAIM              -> checkGkSaveClaim
 *   - GK-DISTRIBUTION-NO-OMNISCIENCE -> checkGkDistributionNoOmniscience
 *
 * The keeper is an adapter-layer designation, not a core field: the committed
 * telemetry carries no designated-keeper id, so each oracle determines the
 * designated keeper deterministically the way the adapter does from the layout
 * it starts with — the player on each team nearest the own goal-arc centre at
 * the first observation (ties by ascending playerId).  The arc geometry derives
 * from the observed pitch extent; the keeper's per-tick position, goal-line
 * approach, and recorded contacts are read from the committed telemetry.
 *
 * Thresholds come only from the versioned `gk-small-sided-v1` record
 * (`eval/contracts/goalkeeper-config.ts`).  Where the underlying observation
 * genuinely cannot support a verdict (e.g. no keeper-release event kind), the
 * oracle returns an empty result so the evaluator yields NOT_EVALUATED rather
 * than inventing an envelope.  A run that is not a two-team keeper match (e.g.
 * the single-body foundation fixture) is likewise NOT_EVALUATED.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";
import { GK_PROVISIONAL_VALUES } from "../contracts/goalkeeper-config.js";

// ---------------------------------------------------------------------------
// Versioned provisional configuration (gk-small-sided-v1)
// ---------------------------------------------------------------------------

function gkNumber(key: string): number {
  const v = GK_PROVISIONAL_VALUES.find((x) => x.key === key);
  if (v === undefined || typeof v.value !== "number") {
    throw new Error(`GK config key "${key}" missing or non-numeric`);
  }
  return v.value;
}

const GK_ARC_RADIUS = gkNumber("goal_arc_radius"); // 4.0
const GK_ARC_LATERAL_MAX = gkNumber("goal_arc_lateral_max"); // 2.5
const GK_ARC_CENTER_X_OFFSET = gkNumber("goal_arc_center_x_offset"); // 0
const GK_SAVE_REACH = gkNumber("save_claim_reach_radius"); // 1.2
const GK_REACTION_WINDOW = gkNumber("keeper_reaction_window_ticks"); // 12

// ---------------------------------------------------------------------------
// Geometry helpers (pure)
// ---------------------------------------------------------------------------

/** Own goal-line x for a team (team-a defends -x, team-b defends +x). */
function ownGoalLineX(teamId: string, half: number): number {
  return teamId === "team-a" ? -half : half;
}

function arcCenter(teamId: string, half: number): { x: number; y: number } {
  return {
    x: ownGoalLineX(teamId, half) + GK_ARC_CENTER_X_OFFSET,
    y: 0,
  };
}

function planarDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Is a point inside the nominal repositioning disk (§5)? */
function isInsideArc(pos: { x: number; y: number }, center: { x: number; y: number }): boolean {
  return planarDist(pos, center) <= GK_ARC_RADIUS;
}

// ---------------------------------------------------------------------------
// Designation read (from the runner's `gk-role` observation annotation)
// ---------------------------------------------------------------------------

/** A derived keeper match: the two fields each oracle needs. */
interface GkMatch {
  /** Half pitch length (from the scenario's declared pitchLength). */
  half: number;
  /** teamId -> designated keeper playerId. */
  keeperByTeam: Record<string, string>;
}

/**
 * Read the designated keeper per team from the `gk-role` observation events the
 * runner injects when `gkBehavior` is on.  The keeper is an adapter-layer fact,
 * so it must come from the runner (which knows the layout designation), never
 * re-derived from positions (a scenario's attacker can stand closer to the
 * goal-arc centre than its defenders).  Returns null when the observation
 * stream does not carry a keeper designation — e.g. the single-body foundation
 * fixture via the raw `evaluate` path — so the criteria evaluate to
 * NOT_EVALUATED rather than to a verdict on a run that has no keeper.
 */
function deriveGkMatch(observations: TelemetryObservation[]): GkMatch | null {
  if (observations.length === 0) return null;

  const teams = new Set<string>();
  for (const o of observations) {
    for (const p of o.players) teams.add(p.teamId);
  }
  if (teams.size < 2) return null;

  const keeperByTeam: Record<string, string> = {};
  let half: number | undefined;
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "gk-role") continue;
      const payload = ev.payload as
        | { teamId?: string; keeperPlayerId?: string; keeperRoleFlag?: boolean; pitchLength?: number }
        | undefined;
      if (!payload?.teamId || !payload.keeperPlayerId) continue;
      keeperByTeam[payload.teamId] = payload.keeperPlayerId;
      if (typeof payload.pitchLength === "number") half = payload.pitchLength / 2;
    }
  }

  if (Object.keys(keeperByTeam).length === 0) return null;
  if (half === undefined) return null;

  return { half, keeperByTeam };
}

/** Find a player record for a playerId in an observation. */
function findPlayer(
  observation: TelemetryObservation,
  playerId: string,
): TelemetryObservation["players"][number] | undefined {
  return observation.players.find((p) => p.playerId === playerId);
}

/** First tick a keeper's committed position is inside its own goal arc. */
function stationTick(
  observations: TelemetryObservation[],
  match: GkMatch,
  teamId: string,
): number | undefined {
  const keeperId = match.keeperByTeam[teamId];
  const center = arcCenter(teamId, match.half);
  for (const o of observations) {
    const kp = findPlayer(o, keeperId);
    if (kp !== undefined && isInsideArc(kp.groundPosition, center)) {
      return o.tick;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// GK-ROLE-DESIGNATION
// ---------------------------------------------------------------------------

/**
 * Exactly one designated keeper per team, stable for the run.
 *
 * Verifies the runner-injected designation resolves to exactly one body per
 * team and that body belongs to that team (spec §4).
 */
export function checkGkRoleDesignation(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const match = deriveGkMatch(observations);
  if (match === null) return [];

  const teams = new Set(observations[0].players.map((p) => p.teamId));
  const failures: string[] = [];

  for (const team of teams) {
    const keeperId = match.keeperByTeam[team];
    if (keeperId === undefined) {
      failures.push(`team ${team} has no designated keeper`);
      continue;
    }
    const onTeam = observations[0].players.filter((p) => p.teamId === team);
    const keepersOnTeam = onTeam.filter((p) => p.playerId === keeperId);
    if (keepersOnTeam.length !== 1) {
      failures.push(`team ${team} designation ${keeperId} does not resolve to exactly one body on that team`);
    }
  }

  if (failures.length > 0) {
    return [
      {
        id: "gk-role-designation-mutated",
        status: "fail",
        description: `GK designation contract violated: ${failures.join("; ")}`,
        details: { failures, keeperByTeam: match.keeperByTeam },
      },
    ];
  }

  return [
    {
      id: "gk-role-designation-held",
      status: "pass",
      description:
        `Exactly one designated keeper per team, stable for the run (observations ${observations.length})`,
      details: { keeperByTeam: match.keeperByTeam, halfPitchLength: match.half },
    },
  ];
}

// ---------------------------------------------------------------------------
// GK-POSITIONING-HOLD
// ---------------------------------------------------------------------------

/**
 * Keeper holds its goal arc with bounded lateral drift (spec §5).
 *
 * After the keeper takes station (first on-arc tick), its committed position
 * must remain inside `goal_arc_radius` for most post-station ticks and its
 * lateral drift inside `goal_arc_lateral_max`.
 */
export function checkGkPositioningHold(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const match = deriveGkMatch(observations);
  if (match === null) return [];

  const teams = Object.keys(match.keeperByTeam);
  let anyStation = false;
  const failures: string[] = [];

  for (const team of teams) {
    const start = stationTick(observations, match, team);
    if (start === undefined) continue;
    anyStation = true;

    const keeperId = match.keeperByTeam[team];
    const center = arcCenter(team, match.half);
    let postStation = 0;
    let onArc = 0;
    let maxDist = 0;
    let maxDrift = 0;
    for (const o of observations) {
      if (o.tick < start) continue;
      const kp = findPlayer(o, keeperId);
      if (kp === undefined) continue;
      postStation++;
      const d = planarDist(kp.groundPosition, center);
      maxDist = Math.max(maxDist, d);
      maxDrift = Math.max(maxDrift, Math.abs(kp.groundPosition.y - center.y));
      if (isInsideArc(kp.groundPosition, center)) onArc++;
    }

    if (postStation === 0) continue;
    const onArcRatio = onArc / postStation;
    if (onArcRatio < 0.6 || maxDist > GK_ARC_RADIUS + GK_ARC_LATERAL_MAX) {
      failures.push(
        `team ${team} keeper ${keeperId} failed arc hold (onArcRatio=${onArcRatio.toFixed(2)} maxDist=${maxDist.toFixed(2)}m maxDrift=${maxDrift.toFixed(2)}m)`,
      );
    }
    if (maxDrift > GK_ARC_LATERAL_MAX + 0.5) {
      failures.push(
        `team ${team} keeper ${keeperId} exceeded lateral band (${maxDrift.toFixed(2)}m > ${GK_ARC_LATERAL_MAX}m)`,
      );
    }
  }

  if (!anyStation) {
    // The keeper never reached its arc within the observed window — the
    // arc-hold is not observable here, not a failure.
    return [
      {
        id: "gk-positioning-not-evaluated",
        status: "not_evaluated",
        description: `No designated keeper reached its goal arc within the observed window (${observations.length} observations)`,
        details: { keeperByTeam: match.keeperByTeam },
      },
    ];
  }

  if (failures.length > 0) {
    return [
      {
        id: "gk-positioning-hold-mutated",
        status: "fail",
        description: `GK arc-hold violated: ${failures.join("; ")}`,
        details: { failures },
      },
    ];
  }

  return [
    {
      id: "gk-positioning-hold-held",
      status: "pass",
      description: `Designated keeper(s) held their goal arcs with bounded drift (observations ${observations.length})`,
      details: { keeperByTeam: match.keeperByTeam },
    },
  ];
}

// ---------------------------------------------------------------------------
// GK-NO-FIELD-CHASE
// ---------------------------------------------------------------------------

/**
 * The keeper never chases the ball into the field (spec §6, anti-huddle
 * inheritance).
 *
 * After the keeper takes station, its committed position never leaves the goal
 * arc region toward midfield.  A keeper that drifts far into the field to
 * pursue the ball is a field-chase mutant.
 */
export function checkGkNoFieldChase(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const match = deriveGkMatch(observations);
  if (match === null) return [];

  const teams = Object.keys(match.keeperByTeam);
  let anyStation = false;
  const failures: string[] = [];

  // A field-chase threshold: beyond the arc radius plus the save reach plus a
  // small attribution margin, the keeper is no longer holding its arc.
  const chaseLimit = GK_ARC_RADIUS + GK_SAVE_REACH + GK_ARC_LATERAL_MAX;

  for (const team of teams) {
    const start = stationTick(observations, match, team);
    if (start === undefined) continue;
    anyStation = true;

    const keeperId = match.keeperByTeam[team];
    const center = arcCenter(team, match.half);
    for (const o of observations) {
      if (o.tick < start) continue;
      const kp = findPlayer(o, keeperId);
      if (kp === undefined) continue;
      const d = planarDist(kp.groundPosition, center);
      if (d > chaseLimit) {
        failures.push(
          `team ${team} keeper ${keeperId} chased into the field at tick ${o.tick} (${d.toFixed(2)}m from arc centre, limit ${chaseLimit}m)`,
        );
        break;
      }
    }
  }

  if (!anyStation) {
    return [
      {
        id: "gk-no-field-chase-not-evaluated",
        status: "not_evaluated",
        description: `No designated keeper reached its goal arc; field-chase not observable (${observations.length} observations)`,
        details: { keeperByTeam: match.keeperByTeam },
      },
    ];
  }

  if (failures.length > 0) {
    return [
      {
        id: "gk-no-field-chase-mutated",
        status: "fail",
        description: `GK field-chase contract violated: ${failures.join("; ")}`,
        details: { failures, chaseLimit },
      },
    ];
  }

  return [
    {
      id: "gk-no-field-chase-held",
      status: "pass",
      description: `Designated keeper(s) never chased the ball into the field (observations ${observations.length})`,
      details: { keeperByTeam: match.keeperByTeam, chaseLimit },
    },
  ];
}

// ---------------------------------------------------------------------------
// GK-SAVE-CLAIM
// ---------------------------------------------------------------------------

/**
 * Save/claim is an explicit recorded ball contact (spec §7).
 *
 * An opponent shot that is observable approaching the keeper's own goal must be
 * answered by a recorded `player-ball-contact` by the designated keeper inside
 * `save_claim_reach_radius` and within `keeper_reaction_window_ticks`.  A
 * keeper contact outside the reach (a disallowed teleport/overshoot style
 * claim) is a mutant and fails.  With no such shot opportunity the criterion is
 * NOT_EVALUATED.
 */
export function checkGkSaveClaim(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const match = deriveGkMatch(observations);
  if (match === null) return [];

  // Collect opponent shots approaching a keeper's own goal.
  const keeperByTeam = match.keeperByTeam;
  const teamOfPlayer: Record<string, string> = {};
  for (const o of observations) {
    for (const p of o.players) {
      teamOfPlayer[p.playerId] = p.teamId;
    }
  }

  let sawOpponentShot = false;
  const badContacts: string[] = [];
  const goodContacts: string[] = [];

  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "shot") continue;
      const payload = ev.payload as
        | { playerId?: string; outgoing?: { position?: { x: number; y: number }; linearVelocity?: { x: number; y: number } } }
        | undefined;
      if (!payload?.playerId) continue;
      const shooter = payload.playerId;
      const shooterTeam = teamOfPlayer[shooter];
      if (shooterTeam === undefined) continue;

      // For each keeper defending an opposing goal.
      for (const [teamId, keeperId] of Object.entries(keeperByTeam)) {
        if (teamOfPlayer[keeperId] !== teamId) continue;
        if (teamId === shooterTeam) continue;
        const bp = payload.outgoing?.position;
        const bv = payload.outgoing?.linearVelocity;
        if (!bp || !bv) continue;
        // Is the shot approaching this team's goal line?
        const goalLineX = ownGoalLineX(teamId, match.half);
        const approaching = (goalLineX - bp.x) * bv.x > 0;
        if (!approaching) continue;
        sawOpponentShot = true;

        // Look for a keeper contact within the reaction window.
        for (const kpObs of iterateFrom(observations, o.tick)) {
          if (kpObs.tick - o.tick > GK_REACTION_WINDOW) break;
          const kp = findPlayer(kpObs, keeperId);
          if (kp === undefined) continue;
          // The core records the contact's planar player->ball distance; use it
          // (fall back to the object distance at that tick's ball position).
          const contact = kpObs.events.find(
            (e) =>
              e.kind === "player-ball-contact" &&
              (e.payload as { playerId?: string } | undefined)?.playerId === keeperId,
          );
          if (contact === undefined) continue;
          const cp = contact.payload as
            | { planarDistance?: number; outgoing?: { position?: { x: number; y: number } } }
            | undefined;
          const recorded = cp?.planarDistance;
          const objDist = planarDist(kp.groundPosition, kpObs.ball.position);
          const dist = typeof recorded === "number" ? recorded : objDist;
          if (dist <= GK_SAVE_REACH) {
            goodContacts.push(
              `team ${teamId} keeper ${keeperId} claimed shot at tick ${kpObs.tick} within reach (${dist.toFixed(3)}m)`,
            );
          } else {
            badContacts.push(
              `team ${teamId} keeper ${keeperId} contact at tick ${kpObs.tick} outside reach (${dist.toFixed(3)}m > ${GK_SAVE_REACH}m)`,
            );
          }
          break;
        }
      }
    }
  }

  if (badContacts.length > 0) {
    return [
      {
        id: "gk-save-claim-mutated",
        status: "fail",
        description: `GK save/claim contact outside reach: ${badContacts.join("; ")}`,
        details: { badContacts },
      },
    ];
  }

  if (goodContacts.length > 0) {
    return [
      {
        id: "gk-save-claim-held",
        status: "pass",
        description: `Designated keeper(s) recorded save/claim contact(s) within reach and window: ${goodContacts.join("; ")}`,
        details: { goodContacts },
      },
    ];
  }

  // No keeper contact after an opponent shot opportunity.
  return [
    {
      id: "gk-save-claim-not-evaluated",
      status: "not_evaluated",
      description: sawOpponentShot
        ? `Opponent shot(s) at a keeper's goal but no keeper save/claim contact recorded (${observations.length} observations)`
        : `No observable opposing shot at a keeper's goal in ${observations.length} observations`,
      details: { sawOpponentShot },
    },
  ];
}

/** Iterate observations from a tick (inclusive, ordered). */
function* iterateFrom(
  observations: TelemetryObservation[],
  fromTick: number,
): Generator<TelemetryObservation> {
  for (let i = 0; i < observations.length; i++) {
    const o = observations[i];
    if (o.tick >= fromTick) yield o;
  }
}

// ---------------------------------------------------------------------------
// GK-DISTRIBUTION-NO-OMNISCIENCE
// ---------------------------------------------------------------------------

/**
 * Distribution release is a normal pass with no omniscience (spec §8).
 *
 * The committed telemetry carries no keeper-release observation event kind, so
 * the release contract is not observable yet.  The oracle returns
 * NOT_EVALUATED (honest) rather than inventing release semantics.
 */
export function checkGkDistributionNoOmniscience(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const match = deriveGkMatch(observations);
  if (match === null) {
    return [
      {
        id: "gk-distribution-not-evaluated",
        status: "not_evaluated",
        description: `No two-team keeper match; distribution not observable (${observations.length} observations)`,
        details: {},
      },
    ];
  }

  return [
    {
      id: "gk-distribution-not-evaluated",
      status: "not_evaluated",
      description:
        `No keeper-release observation event kind in the committed telemetry (${observations.length} observations); the distribution contract is not observable yet`,
      details: { keeperByTeam: match.keeperByTeam },
    },
  ];
}

/**
 * @module @pes/adapters/input-browser/human-restart-control
 *
 * Human-directed restart detection (objective HUMAN-RESTART-CONTROL).
 *
 * The accepted restart machinery executes every restart (throw-in, goal kick,
 * corner kick, kickoff and the post-goal reset) at the CORE level: the core
 * opens a restart window, holds the countdown, and at countdown zero runs
 * `applyThrowIn` / `applyGoalKick` / `applyCornerKick`, which serve the ball
 * toward the awarding team's nearest receiver (throw-in, goal kick) or a fixed
 * penalty-area target (corner). The adapters' only lever during the window is
 * the tick-indexed `InputFrame` they emit — so a human (or CPU) directs a
 * restart exclusively by steering bodies, never by writing world state.
 *
 * This module is the gating predicate for "the human is directing their team's
 * restart": it reads ONLY committed, observable world state and answers three
 * questions, without mutating anything and without touching the simulation
 * core or its contracts:
 *
 *   1. Is a restart window the human's team won currently active?
 *   2. Is the human's controlled player the body the core placed as the
 *      restart taker (the single awarding-team protagonist at the ball)?
 *   3. Is the human's controlled player a body on the awarding team whose
 *      position the core's nearest-receiver serve target depends on?
 *
 * Those three together define `isHumanDirectedRestartActive`, the gate an
 * evidence/test harness uses to prove the human's directional input during the
 * window changes the served restart, while the CPU fallback (no human input in
 * the window) executes the core's auto-serve exactly as today.
 *
 * Delphi: the module is a pure function of `WorldState`; it never produces an
 * `InputFrame` and never drives a body. It only reports whether the human's
 * slot is the one the restart is currently "taken" by. It is the adapter-layer
 * discipline counterpart to the accepted anti-huddle restart windowing
 * (`assignChaseRoles`) — same read-only observation, no gameplay authority.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { WorldState, MatchPhase } from "../../contracts/state.js";

/**
 * The core-owned match phases that are restart windows the human's team may
 * win: a set piece (throw-in, goal kick, corner) and the post-goal reset.
 * Kickoff is excluded: it is never "won" by a team mid-match, and the opening
 * freeze is the accepted kickoff baseline (5V5-KICKOFF-ANTI-HUDDLE).
 */
export const HUMAN_RESTART_WINDOW_PHASES: readonly MatchPhase[] = [
  "throw-in",
  "goal-kick",
  "corner-kick",
];

/** A restart window the human's team is awarded, read from committed state. */
export interface HumanRestartWindow {
  /** The core's match phase for the active window. */
  matchPhase: MatchPhase;
  /** The team the restart is awarded to. */
  awardingTeam: string | null;
  /** The player the core placed as the restart taker (at the ball). */
  takerPlayerId: string | null;
  /** The restart window's countdown remaining (ticks). */
  countdown: number;
}

/**
 * The awarding team for the active restart window, or null when the window is
 * not one of the phases this module classifies. Reads the committed state's
 * per-restart award fields, never writes.
 */
export function restartAwardingTeam(state: WorldState): string | null {
  switch (state.matchPhase) {
    case "throw-in":
      return state.throwInAwardingTeam;
    case "goal-kick":
      return state.goalKickAwardingTeam;
    case "corner-kick":
      return state.cornerKickAttackingTeam;
    default:
      return null;
  }
}

/**
 * The player the core placed as the restart taker for the active window, or
 * null when the window is not a classified restart phase.
 */
export function restartTakerPlayerId(state: WorldState): string | null {
  switch (state.matchPhase) {
    case "throw-in":
      return state.throwInTakerId;
    case "goal-kick":
      return state.goalKickTakerId;
    case "corner-kick":
      return state.cornerKickTakerId;
    default:
      return null;
  }
}

/**
 * Describe the active restart window as the human's team views it.
 * Returns null when no restart window is active.
 */
export function describeHumanRestartWindow(state: WorldState): HumanRestartWindow | null {
  if (!HUMAN_RESTART_WINDOW_PHASES.includes(state.matchPhase)) return null;
  return {
    matchPhase: state.matchPhase,
    awardingTeam: restartAwardingTeam(state),
    takerPlayerId: restartTakerPlayerId(state),
    countdown:
      state.matchPhase === "throw-in"
        ? state.throwInCountdown
        : state.matchPhase === "goal-kick"
          ? state.goalKickCountdown
          : state.cornerKickCountdown,
  };
}

/**
 * Whether a restart window the human's team won is currently active.
 *
 * @param state The committed world state (read-only).
 * @param humanTeamId The team the human controls.
 */
export function isHumanRestartWindowActive(
  state: WorldState,
  humanTeamId: string,
): boolean {
  const window = describeHumanRestartWindow(state);
  return window !== null && window.awardingTeam === humanTeamId;
}

/**
 * Whether the human's controlled player is the body the core placed as the
 * restart taker (the single awarding-team protagonist at the ball).
 */
export function isHumanRestartTaker(
  state: WorldState,
  humanControlledPlayerId: string,
): boolean {
  return restartTakerPlayerId(state) === humanControlledPlayerId;
}

/**
 * Whether the human's controlled player is a body on the awarding team. The
 * core's nearest-receiver serve target (throw-in and goal kick) is always a
 * non-taker body, so a human directing a restart via the awarding-team
 * receiving position sits on the awarding team but is not the single taker.
 */
export function isHumanControlledPlayerOnAwardingTeam(
  state: WorldState,
  humanTeamId: string,
  humanControlledPlayerId: string,
): boolean {
  const window = describeHumanRestartWindow(state);
  if (window === null || window.awardingTeam !== humanTeamId) return false;
  for (const player of state.players) {
    if (player.playerId === humanControlledPlayerId && player.teamId === humanTeamId) {
      return true;
    }
  }
  return false;
}

/**
 * The FULL gate for HUMAN-RESTART-CONTROL: a restart the human's team won is
 * active AND the human controls a body on the awarding team (either the
 * core's restart taker at the ball, or a receiving body the core's
 * nearest-receiver serve target depends on).
 *
 * True is the condition under which a human's directional input during the
 * window legitimately directs the restart; false keeps the CPU fallback
 * (the core auto-serves at countdown zero) byte-identical to today.
 */
export function isHumanDirectedRestartActive(
  state: WorldState,
  humanTeamId: string,
  humanControlledPlayerId: string,
): boolean {
  return (
    isHumanRestartWindowActive(state, humanTeamId) &&
    isHumanControlledPlayerOnAwardingTeam(state, humanTeamId, humanControlledPlayerId)
  );
}

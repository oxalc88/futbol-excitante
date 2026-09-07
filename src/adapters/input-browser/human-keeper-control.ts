/**
 * @module @pes/adapters/input-browser/human-keeper-control
 *
 * HUMAN-KEEPER-CONTROL gate + directed-keeper helpers (adapter layer).
 *
 * Objective HUMAN-KEEPER-CONTROL: in a human-vs-CPU small-sided match the human
 * can take control of the team's designated keeper. The keeper designation is
 * an adapter-layer role assignment (spec §4, `designateKeeperFromLayout`) and
 * stays the source of truth — the human never becomes "the designation": they
 * direct the already-designated body through the same tick-indexed movement
 * controls they use for an outfield body.
 *
 * The core switch contract already cycles every teammate (it never excluded the
 * keeper), so "the human can switch to the keeper" is a control-assignment fact;
 * what this module adds is the read-only predicate that tells a wiring, a test
 * or an evidence driver when the keeper is the human's controlled body, and the
 * pure helper that expresses the human's directional input as the keeper's
 * commanded movement. It never mutates state and never produces a frame.
 *
 * Delphi: like `human-restart-control.ts`, this module is a discipline
 * counterpart — it reports whether the keeper slot is human-owned and how the
 * human's input maps to it; the actual frame the keeper consumes is the CPU
 * adapter's, which yields its arc-hold positioning to `humanDirectedKeeperMove`
 * while the save/claim reaction stays on the shared production rule. No
 * Math.random, Date, performance, DOM, or Node I/O.
 */

import {
  designateKeeperFromLayout,
  type KeeperLayoutBody,
} from "./goalkeeper-role.js";

/** Whether the body the human's control slot drives is the designated keeper. */
export function isHumanControlledKeeper(
  humanControlledPlayerId: string | null | undefined,
  keeperPlayerId: string | null | undefined,
): boolean {
  if (humanControlledPlayerId == null || keeperPlayerId == null) return false;
  return humanControlledPlayerId === keeperPlayerId;
}

/**
 * The designated keeper of `teamId`, resolved by the same layout rule the
 * adapters act on (spec §4). Returns `undefined` when no body qualifies, so the
 * caller can distinguish "no keeper" from "a keeper that is not the human's
 * body". The designation is a layout fact, never derived from a ball fact.
 */
export function keeperOfTeamFromLayout(
  players: readonly KeeperLayoutBody[],
  teamId: string,
  pitchLength: number,
): string | undefined {
  return designateKeeperFromLayout(players, teamId, pitchLength);
}

/**
 * The keeper's commanded movement when the human directs it: the human's raw
 * axis input (moveX/moveY in [-1, 1]) preserved verbatim. The arc bound is
 * enforced where the speed cap is applied, in the CPU adapter's
 * `computeKeeperFrame`, so this helper is a pure read of the human intent the
 * wiring already captured. It exists so a test or an evidence driver can assert
 * the intended mapping without re-deriving the adapter's speed scaling.
 */
export function humanDirectedKeeperMove(
  humanMoveX: number,
  humanMoveY: number,
): { x: number; y: number } {
  return { x: humanMoveX, y: humanMoveY };
}

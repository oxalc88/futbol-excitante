/**
 * @module @pes/eval/scenarios/proximate-5v5
 *
 * Proximate 5v5 human-vs-CPU configuration for the HUMAN-DEFENSIVE-DUEL-CONTROL
 * evidence program.
 *
 * The stock `5v5-human-vs-cpu.v1` fixture starts team-a on its own goal line, so
 * the scripted defender never reaches the CPU carrier inside the 120-tick
 * evidence budget. This transform parks the HUMAN slot's team a fixed distance
 * behind the ball, velocity-zeroed, which is the configuration every
 * durable artifact for this objective was produced from (standing-tackle input
 * tick 43, phases 44/46/50/62, lock-out rejection at 47).
 *
 * Both the headless defensive-duel driver tests and the browser capture test go
 * through this one function so the capture configuration cannot drift from the
 * trajectory it is supposed to depict.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

/** Metres the HUMAN team starts behind the ball. */
export const PROXIMATE_HUMAN_BACK_DISTANCE_M = 6;

/**
 * Return a copy of `scenario` with the HUMAN slot's team placed behind the
 * ball. The input scenario is never mutated.
 */
export function withProximateHumanDefence(
  scenario: ScenarioDefinition,
): ScenarioDefinition {
  const proximate = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;

  let humanTeamId = "";
  for (const assignment of Object.values(proximate.controlAssignments)) {
    if (assignment.mode === "HUMAN") {
      humanTeamId = assignment.teamId;
      break;
    }
  }
  if (humanTeamId === "") {
    throw new Error("proximate 5v5 requires exactly one HUMAN control slot");
  }

  const ballX = proximate.ball.position.x;
  for (const player of proximate.players) {
    if (player.teamId !== humanTeamId) continue;
    player.groundPosition = { x: ballX - PROXIMATE_HUMAN_BACK_DISTANCE_M, y: 0 };
    player.linearVelocity = { x: 0, y: 0 };
    player.desiredVelocity = { x: 0, y: 0 };
  }

  return proximate;
}

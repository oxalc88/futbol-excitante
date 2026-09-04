/**
 * @module @pes/eval/runners/no-tackle-additivity
 *
 * Strictly-additive behaviour baseline for HUMAN-DEFENSIVE-DUEL-CONTROL.
 *
 * The tackle action system is only reachable through input bits 6 and 7, so
 * these runs — which press neither bit — must keep byte-identical per-tick
 * world hashes against the baseline recorded at
 * `eval/scenarios/no-tackle-additivity-baseline.v1.json`. The module is
 * deliberately self-contained (no tackle imports) so the same file also runs
 * unchanged against a tree without the tackle system, which is how the
 * baseline was recorded.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import {
  createCpuAdapter,
  buildCpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

/** One recorded run: its identity plus the per-tick committed hashes. */
export interface NoTackleRun {
  id: string;
  scenarioPath: string;
  ticks: number;
  /** Initial committed hash followed by one hash per stepped tick. */
  hashes: string[];
}

/** Scenario + tick budget for one recorded run. */
export interface NoTackleRunSpec {
  id: string;
  scenarioPath: string;
  scenario: ScenarioDefinition;
  ticks: number;
  /**
   * `scenario-program` feeds the scenario's own input program.
   * `cpu-adapters` wires CPU adapters on every AI slot plus a keyboard-shaped
   * human slot that presses no action bits at all.
   */
  drive: "scenario-program" | "cpu-adapters";
  /**
   * Anti-huddle switch for `cpu-adapters` drives (5V5-KICKOFF-ANTI-HUDDLE).
   * Left undefined the slots run with the current shape; pinned baselines
   * recorded before `anti-huddle-v1` pass `false` so the historical CPU shape is
   * reproduced byte-for-byte instead of being re-pinned.
   */
  cpuAntiHuddle?: boolean;
}

/**
 * Drive a scenario straight from its own tick-indexed input program.
 */
function runScenarioProgram(
  scenario: ScenarioDefinition,
  ticks: number,
): string[] {
  const world = createWorld({ scenario });
  const sim = createSimulation(world);
  const hashes: string[] = [sim.stateHash()];
  for (let i = 0; i < ticks; i++) {
    const frames = scenario.inputProgram[sim.tick] ?? [];
    if (frames.length > 0) {
      sim.applyInputs(frames);
    }
    const result = sim.step();
    hashes.push(result.stateHash);
  }
  return hashes;
}

/**
 * Drive a match with CPU adapters on every AI slot and, when the scenario
 * declares one, a keyboard-shaped human slot that steers toward the ball with
 * zero action bits.
 *
 * This is the tackle-free control shape of the 5v5 human-vs-CPU evidence run:
 * identical wiring, identical steering policy, no defensive press.
 */
function runHumanVsCpuNoDefensive(
  scenario: ScenarioDefinition,
  ticks: number,
  cpuAntiHuddle = true,
): string[] {
  const world = createWorld({ scenario });
  const sim = createSimulation(world);
  const hashes: string[] = [sim.stateHash()];

  let humanControlSlot = "";
  let humanPlayerId = "";
  for (const [slotId, assignment] of Object.entries(scenario.controlAssignments)) {
    const mode = (assignment as { mode?: string }).mode;
    if (mode === "HUMAN") {
      humanControlSlot = slotId;
      humanPlayerId = assignment.controlledPlayerId ?? "";
      break;
    }
  }

  type CpuSlot = {
    adapter: ReturnType<typeof createCpuAdapter>;
    controlSlot: string;
    teamId: string;
    controlledPlayerId: string;
  };
  const cpuSlots: CpuSlot[] = [];
  for (const [slotId, assignment] of Object.entries(scenario.controlAssignments)) {
    const mode = (assignment as { mode?: string }).mode;
    if (mode === "HUMAN") continue;
    cpuSlots.push({
      adapter: createCpuAdapter(),
      controlSlot: slotId,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId ?? "",
    });
  }

  for (let i = 0; i < ticks; i++) {
    const snapshot = sim.snapshot();
    const tick = sim.tick;

    const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
    for (const entry of cpuSlots) {
      if (!teamDecisions.has(entry.teamId)) {
        const teamObs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
        teamObs.cpuAntiHuddle = cpuAntiHuddle;
        teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
      }
    }

    const frames: InputFrame[] = [];
    for (const entry of cpuSlots) {
      const obs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
      obs.teamDecision = teamDecisions.get(entry.teamId);
      obs.cpuAntiHuddle = cpuAntiHuddle;
      const frame = entry.adapter.sample(tick, obs);
      frame.controlSlot = entry.controlSlot;
      frames.push(frame);
    }

    let moveX = 0;
    let moveY = 0;
    const human = snapshot.players.find((p) => p.playerId === humanPlayerId);
    if (human) {
      const ball = snapshot.ball;
      const dx = ball.position.x - human.groundPosition.x;
      const dy = ball.position.y - human.groundPosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.01) {
        moveX = dx / dist;
        moveY = dy / dist;
      }
    }
    if (humanControlSlot !== "") {
      frames.push({
        tick,
        sourceId: "keyboard",
        controlSlot: humanControlSlot,
        moveX,
        moveY,
        sprint: 1,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      });
    }

    sim.applyInputs(frames);
    const result = sim.step();
    hashes.push(result.stateHash);
  }

  for (const entry of cpuSlots) entry.adapter.reset();
  return hashes;
}

/**
 * Execute every tackle-free control run.
 */
export function runNoTackleAdditivityRuns(specs: NoTackleRunSpec[]): NoTackleRun[] {
  const runs: NoTackleRun[] = [];
  for (const spec of specs) {
    const hashes =
      spec.drive === "cpu-adapters"
        ? runHumanVsCpuNoDefensive(spec.scenario, spec.ticks, spec.cpuAntiHuddle ?? true)
        : runScenarioProgram(spec.scenario, spec.ticks);
    runs.push({
      id: spec.id,
      scenarioPath: spec.scenarioPath,
      ticks: spec.ticks,
      hashes,
    });
  }
  return runs;
}

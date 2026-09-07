/**
 * @module @pes/eval/runners/human-restart-control
 *
 * HUMAN-RESTART-CONTROL evidence driver.
 *
 * Runs ONE restart window through the accepted core restart machinery and
 * records the committed serve. The only variable between runs is whether a
 * human directional input frame is fed to the human's control slot during the
 * window, which is what isolates the "human-directed restart" effect:
 *
 *   - CPU fallback (no human input during the window): the core serves the
 *     restart at countdown zero toward the awarding team's nearest receiver,
 *     byte-identical to the accepted restart flow.
 *   - Human-taken (a directional input frame is fed during the window): the
 *     human's controlled body is steered and the core's nearest-receiver serve
 *     re-targets toward the human-chosen position, so the served direction
 *     changes while the SAME core machinery executes the same restart.
 *
 * The window is opened by restoring the committed world state into the restart
 * phase (the same technique the accepted throw-in / goal-kick / corner
 * integration tests use), so the core's own `applyTrowIn` / `applyGoalKick` /
 * `applyCornerKick` machinery runs unchanged. Nothing here writes world state
 * during a step: the human's input enters ONLY through the tick-indexed
 * `InputFrame` (via `sim.applyInputs`), and EVERY recorded value is read from
 * the committed state returned by the simulation.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { deepClone } from "../../src/simulation/world/clone.js";
import { NO_OP_OBSERVER } from "../../src/simulation/telemetry/observer.js";
import type { WorldState, MatchPhase } from "../../src/contracts/state.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { SimulationEvent } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import {
  describeHumanRestartWindow,
  isHumanDirectedRestartActive,
} from "../../src/adapters/input-browser/human-restart-control.js";

/** One restart window kind supported by this driver. */
export type RestartWindowKind = "throw-in" | "goal-kick" | "corner-kick";

/** The committed serve event emitted by the core's restart execution. */
export type RestartServeEventKind =
  | "throw-in-executed"
  | "goal-kick-executed"
  | "corner-kick-executed";

/** Configuration for a single driven restart-window run. */
export interface HumanRestartRunConfig {
  /** World scenario whose players/teams the window belongs to. */
  scenario: ScenarioDefinition;
  /** Total ticks to simulate (must cover the countdown + serve). */
  maxTicks: number;
  /** The team the human controls. */
  humanTeamId: string;
  /** The player the human's control slot drives. */
  humanControlledPlayerId: string;
  /** The control slot that carries the human's input frames. */
  humanControlSlot: string;
  /**
   * The human's directional input during the window (moveX, moveY in [-1, 1]).
   * When present, the runner feeds that frame EVERY tick the restart window is
   * active; when absent (undefined), no human input is applied and the core's
   * countdown-zero auto-serve is the CPU fallback.
   */
  humanMoveDirection?: { x: number; y: number };
  /**
   * Open the given restart window from the committed state. The fields mirror
   * the core's per-restart state (`throwIn*` / `goalKick*` / `cornerKick*`).
   */
  window: {
    kind: RestartWindowKind;
    /** Awarding / attacking team for the restart. */
    team: string;
    /** The taker the core placed at the ball. */
    takerPlayerId: string;
    /** Core restart placement (varies by kind). */
    position: { x: number; y: number };
    /** Countdown ticks to run before the auto-serve. */
    countdown: number;
    /** Touchline index for a throw-in (0 = +y, 1 = -y). */
    touchlineIndex?: 0 | 1;
    /** Goal index for a goal kick / corner kick (0 = +x, 1 = -x). */
    goalIndex?: 0 | 1;
  };
}

/** One tick of the driven run, as recorded from committed state. */
export interface HumanRestartTickRecord {
  tick: number;
  stateHash: string;
  /** Core match phase after the tick. */
  matchPhase: MatchPhase;
  /** True when the human-directed-restart gate is live this tick. */
  humanGate: boolean;
  /** The human directional frame fed this tick (or null). */
  humanMove: { x: number; y: number } | null;
  /** Human-controlled body's committed position this tick. */
  humanPlayer: { x: number; y: number };
  /** Commit serve event captured this tick, if the restart executed. */
  serveEvent: SimulationEvent | null;
}

/** Result of a driven restart-window run. */
export interface HumanRestartRunResult {
  scenarioId: string;
  kind: RestartWindowKind;
  humanControlSlot: string;
  humanTeamId: string;
  humanControlledPlayerId: string;
  totalTicks: number;
  /** Human directional input configured for the window, or null. */
  humanMoveDirection: { x: number; y: number } | null;
  /** The committed restart-executed serve event (null when never executed). */
  serveEvent: SimulationEvent | null;
  /** The serve direction as recorded by the core event, or null. */
  serveDirection: { x: number; y: number } | null;
  /** The serve target as recorded by the core event, or null. */
  serveTarget: { x: number; y: number } | null;
  /** Count of ticks the human-directed-restart gate was live. */
  humanGateTicks: number;
  /** Per-tick records (state hashes + gate + human frame). */
  ticks: HumanRestartTickRecord[];
}

function openWindow(state: WorldState, window: HumanRestartRunConfig["window"]): void {
  switch (window.kind) {
    case "throw-in":
      state.matchPhase = "throw-in";
      state.throwInPosition = { ...window.position };
      state.throwInAwardingTeam = window.team;
      state.throwInCountdown = window.countdown;
      state.throwInTakerId = window.takerPlayerId;
      state.throwInTouchlineIndex = window.touchlineIndex ?? 0;
      break;
    case "goal-kick":
      state.matchPhase = "goal-kick";
      state.goalKickPosition = { ...window.position };
      state.goalKickAwardingTeam = window.team;
      state.goalKickCountdown = window.countdown;
      state.goalKickTakerId = window.takerPlayerId;
      state.goalKickGoalIndex = window.goalIndex ?? 0;
      break;
    case "corner-kick":
      state.matchPhase = "corner-kick";
      state.cornerKickPosition = { ...window.position };
      state.cornerKickAttackingTeam = window.team;
      state.cornerKickCountdown = window.countdown;
      state.cornerKickTakerId = window.takerPlayerId;
      state.cornerKickGoalIndex = window.goalIndex ?? 0;
      break;
  }
}

/** The serve event kind the core emits for the given restart kind. */
function serveEventKindFor(kind: RestartWindowKind): RestartServeEventKind {
  switch (kind) {
    case "throw-in":
      return "throw-in-executed";
    case "goal-kick":
      return "goal-kick-executed";
    case "corner-kick":
      return "corner-kick-executed";
  }
}

/**
 * Run one restart-window simulation: open the window from committed state,
 * optionally feed a human directional frame while the window is active, and
 * record every committed tick plus the core's restart-executed serve.
 */
export function runHumanRestartWindow(
  config: HumanRestartRunConfig,
): HumanRestartRunResult {
  const world = createWorld({ scenario: config.scenario });
  const sim = createSimulation(world, NO_OP_OBSERVER);

  // Open the restart window from the committed state (the same technique the
  // accepted restart integration tests use); the core's own machinery runs.
  const mutable = deepClone(sim.snapshot()) as WorldState;
  openWindow(mutable, config.window);
  // Keep the ball at its start position (the scenario's ball) and untouched so
  // the restart serve rewrites it at countdown zero; the ball state is not
  // mutated here beyond placing it at the restart spot for the window.
  sim.restore(mutable);

  const serveEventKind = serveEventKindFor(config.window.kind);
  const windowPhase: MatchPhase = config.window.kind;

  const ticks: HumanRestartTickRecord[] = [];
  let serveEvent: SimulationEvent | null = null;
  let humanGateTicks = 0;
  const { humanMoveDirection, humanTeamId, humanControlledPlayerId, humanControlSlot } = config;

  for (let i = 0; i < config.maxTicks; i++) {
    const currentTick = sim.tick;
    const snapshot = sim.snapshot();

    const windowNow = describeHumanRestartWindow(snapshot);
    const windowActive = windowNow !== null && windowNow.matchPhase === windowPhase;
    const humanMove = humanMoveDirection !== undefined && windowActive
      ? { x: humanMoveDirection.x, y: humanMoveDirection.y }
      : null;

    // The human's input enters ONLY through the tick-indexed InputFrame.
    const frame: InputFrame = {
      tick: currentTick,
      sourceId: "keyboard",
      controlSlot: humanControlSlot,
      moveX: humanMove?.x ?? 0,
      moveY: humanMove?.y ?? 0,
      sprint: humanMove ? 1 : 0,
      heldButtons: 0,
      pressedButtons: 0,
      releasedButtons: 0,
    };
    sim.applyInputs([frame]);

    const step = sim.step();
    const post = sim.snapshot();
    const humanPlayer = post.players.find((p) => p.playerId === humanControlledPlayerId);

    const gate = isHumanDirectedRestartActive(post, humanTeamId, humanControlledPlayerId);
    if (gate) humanGateTicks++;

    let capturedServe: SimulationEvent | null = null;
    for (const event of step.events) {
      if (event.kind === serveEventKind) capturedServe = event;
    }

    ticks.push({
      tick: post.tick,
      stateHash: step.stateHash,
      matchPhase: post.matchPhase,
      humanGate: gate,
      humanMove,
      humanPlayer: humanPlayer
        ? { x: humanPlayer.groundPosition.x, y: humanPlayer.groundPosition.y }
        : { x: Number.NaN, y: Number.NaN },
      serveEvent: capturedServe,
    });

    if (serveEvent === null && capturedServe !== null) serveEvent = capturedServe;
  }

  // Read the serve direction/target from the committed event's payload. Where
  // the serve is read from a per-tick step event, the payload carries the
  // core's own recorded direction/target.
  let serveDirection: { x: number; y: number } | null = null;
  let serveTarget: { x: number; y: number } | null = null;
  // Fall back to scanning the committed state events for the serve: the core
  // writes the restart-executed event into persistent `state.events`, which is
  // the authoritative record even though it is not echoed in the per-step
  // `StepResult.events`.
  const committed: WorldState = sim.snapshot();
  const serve = serveEvent ?? committed.events.find((e) => e.kind === serveEventKind) ?? null;
  if (serveEvent === null && serve !== null) serveEvent = serve;
  if (serve) {
    const payload = serve.payload as Record<string, unknown>;
    const throwDir = payload.throwDirection as { x?: number; y?: number } | undefined;
    const kickDir = payload.kickDirection as { x?: number; y?: number } | undefined;
    const crossDir = payload.crossDirection as { x?: number; y?: number } | undefined;
    const dir = (throwDir ?? kickDir ?? crossDir) as { x?: number; y?: number } | undefined;
    if (dir && typeof dir.x === "number" && typeof dir.y === "number") {
      serveDirection = { x: dir.x, y: dir.y };
    }
    const target = (payload.targetPosition ?? payload.cornerPosition) as
      | { x?: number; y?: number }
      | undefined;
    if (target && typeof target.x === "number" && typeof target.y === "number") {
      serveTarget = { x: target.x, y: target.y };
    }
  }

  return {
    scenarioId: config.scenario.id,
    kind: config.window.kind,
    humanControlSlot: config.humanControlSlot,
    humanTeamId: config.humanTeamId,
    humanControlledPlayerId: config.humanControlledPlayerId,
    totalTicks: config.maxTicks,
    humanMoveDirection: config.humanMoveDirection ? { ...config.humanMoveDirection } : null,
    serveEvent,
    serveDirection,
    serveTarget,
    humanGateTicks,
    ticks,
  };
}

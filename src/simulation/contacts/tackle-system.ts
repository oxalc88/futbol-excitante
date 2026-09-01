/**
 * @module @pes/simulation/contacts/tackle-system
 *
 * Standing / sliding defensive tackle action system.
 *
 * A tackle is an ordered commit driven by an explicit input bit
 * (`STANDING_TACKLE_BIT`, `SLIDE_TACKLE_BIT`):
 *
 *   prepare → active → recover → released
 *
 * Contact with the ball or an opposing player is geometrically eligible ONLY
 * inside the explicit active window declared by `FOUNDATION_TACKLE_V1`, and
 * only within that attempt's finite reach and the forward cone around the
 * direction the body committed to at the input tick. There is no permanent
 * collider, no omnidirectional collider, and no second contact inside the
 * same attempt.
 *
 * Recovery is a cost: body speed is capped while recovering, and any tackle
 * bit pressed before the attempt is released is rejected with an
 * `input-rejection` diagnostic — recovery prevents an instant re-tackle. When
 * an active-window tackle beats an opposing carrier who pressed a ball action
 * on that same tick, that action is rejected too (the duel denied it) and the
 * carrier is excluded from ball contact for the tick.
 *
 * The ball stays an independent 3D entity: a tackled ball changes velocity,
 * never position. Players are likewise only velocity-modified — no body is
 * teleported or repositioned from input.
 *
 * Phase bookkeeping is closure-held (`Map<playerId, TackleState>`, owned by
 * the simulation loop, mirroring the dribble machine): only world effects
 * (ball velocity, player velocity) and the ordered tackle/duel events enter
 * canonical state and hashes.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { BallState, PlayerState } from "../../contracts/state.js";
import type { InputFrame } from "../../contracts/input.js";
import {
  STANDING_TACKLE_BIT,
  SLIDE_TACKLE_BIT,
  FIRST_TOUCH_BIT,
  PASS_BIT,
  SHOT_BIT,
  LOFTED_PASS_BIT,
  THROUGH_BALL_BIT,
} from "../../contracts/input.js";
import type { SimulationEvent } from "../../contracts/scenario.js";
import {
  FOUNDATION_TACKLE_V1,
  FOUNDATION_LOCOMOTION_V1,
} from "../config/foundation.js";
import { endDribble } from "./second-touch-system.js";
import type { DribbleState } from "./second-touch-system.js";
import type { BallContactStateSnapshot } from "./contact-system.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which defensive action was committed to. */
export type TackleKind = "standing" | "slide";

/** Ordered phase of a tackle attempt. */
export type TacklePhase = "prepare" | "active" | "recover";

/**
 * Tackle state for a single player.
 * External to PlayerState — tracked in a Map keyed by playerId held by the
 * simulation closure, and rebuilt on restore from the ordered tackle events.
 */
export interface TackleState {
  /** Standing or sliding attempt. */
  kind: TackleKind;
  /** World tick on which the attempt was consumed (first prepare tick). */
  startTick: number;
  /** Current phase, recomputed from the versioned windows every tick. */
  phase: TacklePhase;
  /** Committed unit direction, frozen at the input tick. */
  dirX: number;
  dirY: number;
  /** True once this attempt has resolved its single allowed contact. */
  contactMade: boolean;
}

/** Ball-action bits a tackle commitment or duel contest can deny. */
export const BALL_ACTION_BITS =
  FIRST_TOUCH_BIT | PASS_BIT | SHOT_BIT | LOFTED_PASS_BIT | THROUGH_BALL_BIT;

/**
 * Config shape (matches FOUNDATION_TACKLE_V1).
 */
export interface TackleConfig {
  standingReach: { value: number };
  slideReach: { value: number };
  standingPrepareTicks: { value: number };
  standingActiveTicks: { value: number };
  standingRecoverTicks: { value: number };
  slidePrepareTicks: { value: number };
  slideActiveTicks: { value: number };
  slideRecoverTicks: { value: number };
  prepareSpeedFactor: { value: number };
  activeSpeedFactor: { value: number };
  recoverySpeedFactor: { value: number };
  slideLungeSpeed: { value: number };
  ballDeflectionSpeed: { value: number };
  ballDeflectionLift: { value: number };
  carrierImpulseSpeed: { value: number };
  contactConeMinCos: { value: number };
}

/** Window lengths (ticks) and reach for one tackle kind. */
export interface TackleWindows {
  prepareTicks: number;
  activeTicks: number;
  recoverTicks: number;
  reach: number;
}

/**
 * Outcome of one tackle-system step.
 */
export interface TackleStepResult {
  /** Ordered events generated this tick (phase / contact / rejection). */
  events: SimulationEvent[];
  /**
   * Players whose ball action is denied by this tick's tackle activity (their
   * own commitment, or an opponent's duel contest). The ball-contact stage
   * excludes them for this tick.
   */
  suppressedPlayerIds: Set<string>;
  /** True when a tackle already played the ball this tick (one touch per tick). */
  ballTouched: boolean;
}

/** Control-assignment shape accepted by the contact/tackle stages. */
type ControlAssignments = Record<
  string,
  { teamId: string; controlledPlayerId: string; mode: string }
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Magnitude of a planar velocity. */
function mag2d(v: { x: number; y: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/**
 * Versioned phase windows for a tackle kind.
 */
export function tackleWindows(
  kind: TackleKind,
  config: TackleConfig = FOUNDATION_TACKLE_V1,
): TackleWindows {
  return kind === "standing"
    ? {
        prepareTicks: config.standingPrepareTicks.value,
        activeTicks: config.standingActiveTicks.value,
        recoverTicks: config.standingRecoverTicks.value,
        reach: config.standingReach.value,
      }
    : {
        prepareTicks: config.slidePrepareTicks.value,
        activeTicks: config.slideActiveTicks.value,
        recoverTicks: config.slideRecoverTicks.value,
        reach: config.slideReach.value,
      };
}

/**
 * Absolute active-contact window `[startTick, endTick]` (inclusive) for an
 * attempt that started on `startTick`. Contact outside these ticks is never
 * eligible.
 */
export function activeWindow(
  state: TackleState,
  config: TackleConfig = FOUNDATION_TACKLE_V1,
): { startTick: number; endTick: number } {
  const w = tackleWindows(state.kind, config);
  const startTick = state.startTick + w.prepareTicks;
  return { startTick, endTick: startTick + w.activeTicks - 1 };
}

/** Tick on which the attempt is released (recovery finished). */
export function releaseTick(
  state: TackleState,
  config: TackleConfig = FOUNDATION_TACKLE_V1,
): number {
  const w = tackleWindows(state.kind, config);
  return state.startTick + w.prepareTicks + w.activeTicks + w.recoverTicks;
}

/**
 * Derive the phase for a given tick from the versioned windows.
 * Returns null once the attempt has been released.
 */
function phaseAtTick(
  state: TackleState,
  tick: number,
  config: TackleConfig,
): TacklePhase | null {
  const w = tackleWindows(state.kind, config);
  const elapsed = tick - state.startTick;
  if (elapsed < w.prepareTicks) return "prepare";
  if (elapsed < w.prepareTicks + w.activeTicks) return "active";
  if (elapsed < w.prepareTicks + w.activeTicks + w.recoverTicks) return "recover";
  return null;
}

/** True when `playerId` currently holds an unconcluded tackle attempt. */
export function isTackling(
  tackleStates: Map<string, TackleState>,
  playerId: string,
): boolean {
  return tackleStates.has(playerId);
}

/** Current phase for `playerId`, or null when not tackling. */
export function tacklePhase(
  tackleStates: Map<string, TackleState>,
  playerId: string,
): TacklePhase | null {
  return tackleStates.get(playerId)?.phase ?? null;
}

/**
 * Rebuild tackle bookkeeping from the ordered event history on restore.
 *
 * The simulation loop calls this for every `tackle-phase` event so restoring
 * a checkpoint reproduces the same closure bookkeeping a continuous run
 * would have had.
 *
 * @param tackleStates - Mutable tackle state map.
 * @param event - A `tackle-phase` event (other kinds are ignored).
 */
export function replayTackleEvent(
  tackleStates: Map<string, TackleState>,
  event: SimulationEvent,
): void {
  if (event.kind !== "tackle-phase") return;
  const payload = event.payload as Record<string, unknown>;
  const playerId = payload.playerId as string | undefined;
  const phase = payload.phase as TacklePhase | "release" | undefined;
  const startTick = payload.startTick as number | undefined;
  const kind = payload.tackleKind as TackleKind | undefined;
  if (!playerId || phase === undefined || startTick === undefined || !kind) {
    return;
  }
  if (phase === "release") {
    tackleStates.delete(playerId);
    return;
  }
  tackleStates.set(playerId, {
    kind,
    startTick,
    phase,
    dirX: (payload.dirX as number) ?? 1,
    dirY: (payload.dirY as number) ?? 0,
    contactMade: payload.contactMade === true,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Step the tackle action system for one tick.
 *
 * Runs AFTER locomotion and player-player contact resolution and BEFORE
 * player-ball contact resolution, so an active-window tackle can modify
 * ball/player state and deny the contested player's ball action on the same
 * tick.
 *
 * @param players - All players (mutated: velocity only, never position).
 * @param ball - Mutable ball state (velocity only, never position).
 * @param tackleStates - Mutable per-player tackle bookkeeping (closure-held).
 * @param framesForTick - Input frames consumed on this tick.
 * @param controlAssignments - Slot → player assignments.
 * @param config - Tackle coefficient set.
 * @param eventCounter - Global event counter (mutated in place).
 * @param tick - Current committed simulation tick.
 * @param dribbleStates - Dribble map; a won ball ends the carrier's dribble.
 * @param locoMaxSpeed - Versioned locomotion cap the commitment caps derive from.
 * @returns Events plus the suppression facts the ball-contact stage needs.
 */
export function stepTackle(
  players: readonly PlayerState[],
  ball: BallState,
  tackleStates: Map<string, TackleState>,
  framesForTick: readonly InputFrame[],
  controlAssignments: ControlAssignments,
  config: TackleConfig = FOUNDATION_TACKLE_V1,
  eventCounter: { value: number },
  tick: number,
  dribbleStates: Map<string, DribbleState> = new Map(),
  locoMaxSpeed: number = FOUNDATION_LOCOMOTION_V1.maxSpeed.value,
): TackleStepResult {
  const events: SimulationEvent[] = [];
  const suppressedPlayerIds = new Set<string>();
  let ballTouched = false;

  // --- playerId → frame lookup (same convention as the contact system) ----
  const frameBySlot = new Map<string, InputFrame>();
  for (const f of framesForTick) {
    frameBySlot.set(f.controlSlot, f);
  }
  const frameByPlayerId = new Map<string, InputFrame>();
  const slotByPlayerId = new Map<string, string>();
  for (const slot of Object.keys(controlAssignments)) {
    const assignment = controlAssignments[slot];
    if (assignment?.controlledPlayerId) {
      const frame = frameBySlot.get(slot);
      if (frame) {
        frameByPlayerId.set(assignment.controlledPlayerId, frame);
        slotByPlayerId.set(assignment.controlledPlayerId, slot);
      }
    }
  }

  // --- 1. Advance / release attempts already in progress ------------------
  // Sorted by playerId so event order never depends on array position.
  for (const playerId of [...tackleStates.keys()].sort()) {
    const state = tackleStates.get(playerId);
    const player = players.find((p) => p.playerId === playerId);
    if (!state || !player) {
      tackleStates.delete(playerId);
      continue;
    }
    const nextPhase = phaseAtTick(state, tick, config);
    if (nextPhase === null) {
      // Released: the lock-out ends here, a new attempt becomes legal.
      tackleStates.delete(playerId);
      events.push(phaseEvent(player, state, "release", tick, eventCounter, config, false));
      continue;
    }
    const changed = nextPhase !== state.phase;
    state.phase = nextPhase;
    if (changed) {
      events.push(
        phaseEvent(player, state, nextPhase, tick, eventCounter, config, state.contactMade),
      );
    }
    applyCommitment(player, state, config, locoMaxSpeed);
  }

  // --- 2. Consume new tackle presses --------------------------------------
  for (const player of players) {
    const frame = frameByPlayerId.get(player.playerId);
    if (!frame) continue;
    const pressed = frame.pressedButtons;
    const wantsStanding = (pressed & STANDING_TACKLE_BIT) !== 0;
    const wantsSlide = (pressed & SLIDE_TACKLE_BIT) !== 0;
    if (!wantsStanding && !wantsSlide) continue;
    // Standing takes priority when both edges arrive on one tick.
    const kind: TackleKind = wantsStanding ? "standing" : "slide";

    const existing = tackleStates.get(player.playerId);
    if (existing) {
      // prepare / active / recover lock-out: no instant re-tackle.
      const rejectedBits =
        (wantsStanding ? STANDING_TACKLE_BIT : 0) |
        (wantsSlide ? SLIDE_TACKLE_BIT : 0);
      events.push(
        rejectionEvent({
          tick,
          sequence: ++eventCounter.value,
          playerId: player.playerId,
          controlSlot: slotByPlayerId.get(player.playerId) ?? "",
          sourceId: frame.sourceId,
          policy: "tackle-lockout",
          rejectedButtons: rejectedBits,
          activePhase: existing.phase,
          lockoutUntilTick: releaseTick(existing, config),
        }),
      );
      continue;
    }

    const dir = committedDirection(player, frame);
    const state: TackleState = {
      kind,
      startTick: tick,
      phase: "prepare",
      dirX: dir.x,
      dirY: dir.y,
      contactMade: false,
    };
    const initialPhase = phaseAtTick(state, tick, config) ?? "prepare";
    state.phase = initialPhase;
    tackleStates.set(player.playerId, state);
    events.push(phaseEvent(player, state, initialPhase, tick, eventCounter, config, false));
    applyCommitment(player, state, config, locoMaxSpeed);

    // The body is committed: a ball action requested on the same tick is
    // denied by the tackle itself.
    if (((pressed | frame.heldButtons) & BALL_ACTION_BITS) !== 0) {
      suppressBallAction(
        player,
        frame,
        slotByPlayerId,
        tick,
        eventCounter,
        events,
        suppressedPlayerIds,
        "tackle-commitment",
        null,
      );
    }
  }

  // --- 3. Active-window contact resolution (one contact per attempt) ------
  const coneMinCos = config.contactConeMinCos.value;
  for (const playerId of [...tackleStates.keys()].sort()) {
    const state = tackleStates.get(playerId);
    if (!state || state.contactMade) continue;
    if (state.phase !== "active") continue;
    const tackler = players.find((p) => p.playerId === playerId);
    if (!tackler) continue;

    const contactWindow = activeWindow(state, config);
    const reach = tackleWindows(state.kind, config).reach;

    // Ball reachability: finite reach plus the committed forward cone.
    const toBallX = ball.position.x - tackler.groundPosition.x;
    const toBallY = ball.position.y - tackler.groundPosition.y;
    const ballDistance = Math.sqrt(toBallX * toBallX + toBallY * toBallY);
    const ballConeCos =
      ballDistance < 1e-9
        ? 1
        : (toBallX * state.dirX + toBallY * state.dirY) / ballDistance;
    const ballReachable = ballDistance <= reach && ballConeCos >= coneMinCos;

    // Nearest opposing player inside the same finite reach and cone.
    let opponent: PlayerState | null = null;
    let opponentDistance = Number.POSITIVE_INFINITY;
    for (const other of players) {
      if (other.playerId === tackler.playerId) continue;
      if (other.teamId === tackler.teamId) continue;
      const dx = other.groundPosition.x - tackler.groundPosition.x;
      const dy = other.groundPosition.y - tackler.groundPosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const coneCos =
        dist < 1e-9 ? 1 : (dx * state.dirX + dy * state.dirY) / dist;
      if (dist > reach || coneCos < coneMinCos) continue;
      if (
        dist < opponentDistance ||
        (dist === opponentDistance && opponent !== null && other.playerId < opponent.playerId)
      ) {
        opponent = other;
        opponentDistance = dist;
      }
    }

    if (!ballReachable && opponent === null) continue;

    const incoming = snapshotBall(ball);
    let outX = state.dirX;
    let outY = state.dirY;
    if (ballReachable && ballDistance > 1e-9) {
      outX = toBallX / ballDistance;
      outY = toBallY / ballDistance;
    }

    if (ballReachable) {
      // Ball deflection: velocity only. Position is never assigned.
      ball.linearVelocity.x = outX * config.ballDeflectionSpeed.value;
      ball.linearVelocity.y = outY * config.ballDeflectionSpeed.value;
      ball.linearVelocity.z =
        config.ballDeflectionLift.value * config.ballDeflectionSpeed.value;
      ball.angularVelocity.x *= 0.5;
      ball.angularVelocity.y *= 0.5;
      ball.angularVelocity.z *= 0.5;
      if (ball.position.z <= 0.15 && ball.linearVelocity.z < 0) {
        ball.linearVelocity.z = 0;
      }
      ballTouched = true;
    }

    let duelWon = false;
    if (opponent !== null) {
      // Separation impulse along the tackler → opponent normal (velocity only).
      const nX =
        opponentDistance > 1e-9
          ? (opponent.groundPosition.x - tackler.groundPosition.x) / opponentDistance
          : state.dirX;
      const nY =
        opponentDistance > 1e-9
          ? (opponent.groundPosition.y - tackler.groundPosition.y) / opponentDistance
          : state.dirY;
      opponent.linearVelocity.x += nX * config.carrierImpulseSpeed.value;
      opponent.linearVelocity.y += nY * config.carrierImpulseSpeed.value;
      const oppCap = locoMaxSpeed * config.activeSpeedFactor.value;
      const oppSpeed = mag2d(opponent.linearVelocity);
      if (oppSpeed > oppCap && oppSpeed > 0) {
        opponent.linearVelocity.x *= oppCap / oppSpeed;
        opponent.linearVelocity.y *= oppCap / oppSpeed;
      }
      // The tackler gives up momentum in the exchange.
      tackler.linearVelocity.x *= 0.5;
      tackler.linearVelocity.y *= 0.5;
      duelWon = ballReachable;
      if (duelWon) {
        // The carrier is dispossessed: their dribble control ends, and any
        // ball action they pressed on this tick is denied by the duel.
        endDribble(dribbleStates, opponent.playerId);
        const carrierFrame = frameByPlayerId.get(opponent.playerId);
        if (
          carrierFrame &&
          ((carrierFrame.pressedButtons | carrierFrame.heldButtons) & BALL_ACTION_BITS) !== 0
        ) {
          suppressBallAction(
            opponent,
            carrierFrame,
            slotByPlayerId,
            tick,
            eventCounter,
            events,
            suppressedPlayerIds,
            "tackle-contest",
            tackler.playerId,
          );
        }
      }
    }

    state.contactMade = true;
    const contactKind = state.kind === "standing" ? "standing-tackle" : "slide-tackle";
    const outgoing = snapshotBall(ball);

    if (opponent !== null) {
      // Genuine player-player duel evidence.
      eventCounter.value++;
      events.push({
        id: `tackle-player-contact-${tick}-${eventCounter.value}`,
        tick,
        sequence: eventCounter.value,
        kind: "player-player-contact",
        label:
          `Tackle duel: ${tackler.playerId} ${contactKind} contacts ${opponent.playerId} ` +
          `in active window ${contactWindow.startTick}–${contactWindow.endTick}`,
        payload: {
          playerIdA: tackler.playerId,
          playerIdB: opponent.playerId,
          teamIdA: tackler.teamId,
          teamIdB: opponent.teamId,
          contactType: contactKind,
          tacklePhase: "active",
          attemptStartTick: state.startTick,
          activeWindowStartTick: contactWindow.startTick,
          activeWindowEndTick: contactWindow.endTick,
          reach,
          planarDistance: opponentDistance,
          committedDirection: { x: state.dirX, y: state.dirY },
          ballReachable,
          duelWon,
        },
      });
    }

    if (ballReachable) {
      // The ball touch itself: velocity-only deflection of the independent
      // ball, recorded so the ball's last-touch reference stays evidence-backed.
      eventCounter.value++;
      const touchId = `tackle-ball-contact-${tick}-${eventCounter.value}`;
      events.push({
        id: touchId,
        tick,
        sequence: eventCounter.value,
        kind: "player-ball-contact",
        label: `Player ${tackler.playerId} ${contactKind} ball contact`,
        payload: {
          playerId: tackler.playerId,
          teamId: tackler.teamId,
          contactType: contactKind,
          tacklePhase: "active",
          incoming,
          outgoing,
          planarDistance: ballDistance,
          reach,
          attemptStartTick: state.startTick,
          activeWindowStartTick: contactWindow.startTick,
          activeWindowEndTick: contactWindow.endTick,
        },
      });
      ball.lastTouchRef = touchId;
    }
  }

  return { events, suppressedPlayerIds, ballTouched };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Snapshot a ball's kinematic state (before/after contact evidence). */
function snapshotBall(ball: BallState): BallContactStateSnapshot {
  return {
    position: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
    linearVelocity: {
      x: ball.linearVelocity.x,
      y: ball.linearVelocity.y,
      z: ball.linearVelocity.z,
    },
    angularVelocity: {
      x: ball.angularVelocity.x,
      y: ball.angularVelocity.y,
      z: ball.angularVelocity.z,
    },
    regime: ball.regime,
  };
}

/** Committed tackle direction: movement intent when present, else body heading. */
function committedDirection(
  player: PlayerState,
  frame: InputFrame,
): { x: number; y: number } {
  const mag = Math.sqrt(frame.moveX * frame.moveX + frame.moveY * frame.moveY);
  if (mag > 1e-9) {
    return { x: frame.moveX / mag, y: frame.moveY / mag };
  }
  return { x: Math.cos(player.bodyHeading), y: Math.sin(player.bodyHeading) };
}

/**
 * Apply the phase commitment to a body: a speed cap, plus the sliding lunge
 * toward the committed direction during the slide's active window. Velocity
 * only — position integration stays owned by locomotion, so nothing teleports.
 */
function applyCommitment(
  player: PlayerState,
  state: TackleState,
  config: TackleConfig,
  locoMaxSpeed: number,
): void {
  const factor =
    state.phase === "prepare"
      ? config.prepareSpeedFactor.value
      : state.phase === "active"
        ? config.activeSpeedFactor.value
        : config.recoverySpeedFactor.value;
  const cap = locoMaxSpeed * factor;

  if (state.kind === "slide" && state.phase === "active") {
    const lunge = Math.min(config.slideLungeSpeed.value, cap);
    player.linearVelocity.x = state.dirX * lunge;
    player.linearVelocity.y = state.dirY * lunge;
    return;
  }

  const speed = mag2d(player.linearVelocity);
  if (speed > cap) {
    const s = cap / speed;
    player.linearVelocity.x *= s;
    player.linearVelocity.y *= s;
  }
}

/** Build a `tackle-phase` event. */
function phaseEvent(
  player: PlayerState,
  state: TackleState,
  phase: TacklePhase | "release",
  tick: number,
  eventCounter: { value: number },
  config: TackleConfig,
  contactMade: boolean,
): SimulationEvent {
  const windows = tackleWindows(state.kind, config);
  const contactWindow = activeWindow(state, config);
  eventCounter.value++;
  return {
    id: `tackle-phase-${tick}-${eventCounter.value}`,
    tick,
    sequence: eventCounter.value,
    kind: "tackle-phase",
    label: `Player ${player.playerId} ${state.kind} tackle phase ${phase}`,
    payload: {
      playerId: player.playerId,
      teamId: player.teamId,
      tackleKind: state.kind,
      phase,
      startTick: state.startTick,
      dirX: state.dirX,
      dirY: state.dirY,
      contactMade,
      prepareTicks: windows.prepareTicks,
      activeTicks: windows.activeTicks,
      recoverTicks: windows.recoverTicks,
      reach: windows.reach,
      activeWindowStartTick: contactWindow.startTick,
      activeWindowEndTick: contactWindow.endTick,
      releaseTick: releaseTick(state, config),
    },
  };
}

/** Build an `input-rejection` diagnostic event. */
function rejectionEvent(args: {
  tick: number;
  sequence: number;
  playerId: string;
  controlSlot: string;
  sourceId: string;
  policy: string;
  rejectedButtons: number;
  /** Subset of the rejected bits that were newly pressed on this tick. */
  pressedButtons?: number;
  activePhase?: TacklePhase;
  lockoutUntilTick?: number;
  contestedByPlayerId?: string | null;
}): SimulationEvent {
  const {
    tick,
    sequence,
    playerId,
    controlSlot,
    sourceId,
    policy,
    rejectedButtons,
    pressedButtons,
    activePhase,
    lockoutUntilTick,
    contestedByPlayerId,
  } = args;
  return {
    id: `input-tackle-reject-${controlSlot || playerId}-${tick}-${sequence}`,
    tick,
    sequence,
    kind: "input-rejection",
    label:
      `Input rejected for player ${playerId} (slot "${controlSlot}"): ${policy}` +
      (activePhase ? ` during ${activePhase}` : ""),
    payload: {
      rejectedTick: tick,
      rejectedControlSlot: controlSlot,
      rejectedSourceId: sourceId,
      playerId,
      policy,
      rejectedButtons,
      ...(pressedButtons !== undefined ? { pressedButtons } : {}),
      ...(activePhase !== undefined ? { activePhase } : {}),
      ...(lockoutUntilTick !== undefined ? { lockoutUntilTick } : {}),
      ...(contestedByPlayerId ? { contestedByPlayerId } : {}),
    },
  };
}

/**
 * Deny a player's pressed ball-action bits for this tick: emit the
 * `input-rejection` diagnostic and register them for the ball-contact stage.
 */
function suppressBallAction(
  player: PlayerState,
  frame: InputFrame,
  slotByPlayerId: Map<string, string>,
  tick: number,
  eventCounter: { value: number },
  events: SimulationEvent[],
  suppressedPlayerIds: Set<string>,
  policy: string,
  contestedByPlayerId: string | null,
): void {
  suppressedPlayerIds.add(player.playerId);
  events.push(
    rejectionEvent({
      tick,
      sequence: ++eventCounter.value,
      playerId: player.playerId,
      controlSlot: slotByPlayerId.get(player.playerId) ?? "",
      sourceId: frame.sourceId,
      policy,
      rejectedButtons: (frame.pressedButtons | frame.heldButtons) & BALL_ACTION_BITS,
      pressedButtons: frame.pressedButtons & BALL_ACTION_BITS,
      contestedByPlayerId,
    }),
  );
}

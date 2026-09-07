/**
 * @module eval/oracles/human-serve
 *
 * Protected human-serve oracles (objectives HUMAN-BALL-SERVER-LITERAL). These
 * adjudicate the pass-gated serving path's named conformance criteria over the
 * committed observation stream:
 *   - HUMAN-SERVE-DIRECTION          -> checkHumanServeDirection
 *   - HUMAN-SERVE-WAIT-TIMER-FREEZE  -> checkHumanServeWaitTimerFreeze
 *   - HUMAN-SERVE-WINDOW-CLOSE       -> checkHumanServeWindowClose
 *
 * Each oracle is a pure `TelemetryObservation[] → InvariantResult[]` function
 * and reads only committed, observable fields (the executed serve event's
 * payload, the runner-injected `core-match-phase` facts, and the ball's
 * authoritative `lastTouchRef`). Where the stream genuinely cannot carry a
 * verdict the oracle returns NOT_EVALUATED; a mutated (contradictory) stream
 * returns FAIL. No PES 2017 value or invented envelope is used.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

/** Position comparison tolerance (m) for serve-direction alignment. */
const DIRECTION_TOLERANCE = 0.05;
/** Dead-zone below which the human stick is treated as a body-heading fallback. */
const INPUT_DEADZONE = 0.05;

/** Kinds of served-restart execution events. */
const SERVED_KINDS = new Set(["throw-in-executed", "goal-kick-executed", "corner-kick-executed"]);

/** A NOT_EVALUATED result for a criterion with nothing to observe. */
function notEvaluated(id: string, description: string): InvariantResult[] {
  return [{ id, status: "not_evaluated", description, details: {} }];
}

/** A single PASS result. */
function pass(id: string, description: string, details?: Record<string, unknown>): InvariantResult[] {
  return [{ id, status: "pass", description, details }];
}

/** A single FAIL result. */
function fail(id: string, description: string, details?: Record<string, unknown>): InvariantResult[] {
  return [{ id: `${id}-mutated`, status: "fail", description, details }];
}

/**
 * Collect every human-served executed event (payload carries `humanServed:
 * true`) with its tick and the direction fields.
 */
function collectHumanServed(
  observations: TelemetryObservation[],
): Array<{ tick: number; kind: string; payload: Record<string, unknown> }> {
  const out: Array<{ tick: number; kind: string; payload: Record<string, unknown> }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (!SERVED_KINDS.has(ev.kind)) continue;
      const p = (ev.payload ?? {}) as Record<string, unknown>;
      if (p.humanServed !== true) continue;
      out.push({ tick: ev.tick, kind: ev.kind, payload: p });
    }
  }
  out.sort((a, b) => a.tick - b.tick);
  return out;
}

/**
 * Collect the runner-injected per-tick core post-step phase + timer facts.
 */
function collectCorePhaseFacts(
  observations: TelemetryObservation[],
): Array<{ tick: number; phase: string; timer: number }> {
  const facts: Array<{ tick: number; phase: string; timer: number }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "core-match-phase") continue;
      const payload = ev.payload as { matchPhase?: unknown; matchTimer?: unknown } | undefined;
      if (typeof payload?.matchPhase !== "string" || typeof payload?.matchTimer !== "number") continue;
      facts.push({ tick: o.tick, phase: payload.matchPhase, timer: payload.matchTimer });
    }
  }
  facts.sort((a, b) => a.tick - b.tick);
  return facts;
}

/** Map observation tick -> ball lastTouchRef. */
function lastTouchByTick(observations: TelemetryObservation[]): Map<number, string | null> {
  const m = new Map<number, string | null>();
  for (const o of observations) m.set(o.tick, o.ball.lastTouchRef);
  return m;
}

// ---------------------------------------------------------------------------
// HUMAN-SERVE-DIRECTION
// ---------------------------------------------------------------------------

/**
 * The executed serve direction on a human-served restart matches the human's
 * chosen input direction. Reads the serve direction (`throwDirection` /
 * `kickDirection` / `crossDirection`) and the `serveInputDirection` (raw
 * moveX/moveY) carried by the executed event. When the input is within the
 * body-heading dead-zone the direction came from the taker's heading, so the
 * alignment is NOT checked for that serve (the human did not steer); FAIL on a
 * mismatch; NOT_EVALUATED when no human-served execution is observed.
 */
export function checkHumanServeDirection(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const served = collectHumanServed(observations);
  if (served.length === 0) {
    return notEvaluated("rules-human-serve-direction", "No human-served restart execution was observed in the run");
  }

  const failures: string[] = [];
  let verified = 0;
  for (const s of served) {
    const dir = s.payload.throwDirection ?? s.payload.kickDirection ?? s.payload.crossDirection;
    const input = s.payload.serveInputDirection;
    if (typeof input !== "object" || input === null) {
      // No input direction recorded (CPU fallback mislabeled) — cannot adjudicate.
      continue;
    }
    const iv = input as { x?: unknown; y?: unknown };
    if (typeof iv.x !== "number" || typeof iv.y !== "number") continue;
    const inputMag = Math.hypot(iv.x, iv.y);
    if (inputMag < INPUT_DEADZONE) continue; // body-heading fallback; human did not steer.
    const dv = dir as { x?: unknown; y?: unknown } | undefined;
    if (typeof dv?.x !== "number" || typeof dv?.y !== "number") {
      failures.push(`human-served ${s.kind} at tick ${s.tick} has no serve direction`);
      continue;
    }
    const dMag = Math.hypot(dv.x, dv.y);
    if (Math.abs(dMag - 1) > DIRECTION_TOLERANCE) {
      failures.push(`human-served ${s.kind} at tick ${s.tick}: serve direction is not a unit vector (mag ${dMag.toFixed(3)})`);
      continue;
    }
    const dot = (dv.x * iv.x + dv.y * iv.y) / (inputMag * dMag);
    if (dot < 1 - DIRECTION_TOLERANCE) {
      failures.push(
        `human-served ${s.kind} at tick ${s.tick}: serve dir (${dv.x.toFixed(3)},${dv.y.toFixed(3)}) does not match input dir (${(iv.x / inputMag).toFixed(3)},${(iv.y / inputMag).toFixed(3)})`,
      );
    }
    verified++;
  }

  if (failures.length > 0) {
    return fail("human-serve-direction", `Human-chosen serve direction violated: ${failures.join("; ")}`, { failures });
  }
  if (verified === 0) {
    return notEvaluated("rules-human-serve-direction", "Human-served executions exist but none carried a steerable input direction");
  }
  return pass("rules-human-serve-direction-held", `${verified} human-served restart(s) served along the human's chosen direction`, { verified });
}

// ---------------------------------------------------------------------------
// HUMAN-SERVE-WAIT-TIMER-FREEZE
// ---------------------------------------------------------------------------

/**
 * The match timer stays frozen across the human-gated serve wait (the wait is
 * a non-playing phase, so the ball-in-play clock must not decrement). For each
 * `restart-serve-wait` → served-execution interval the oracle reads the
 * `core-match-phase` facts and FAILs if the timer decremented inside the wait;
 * NOT_EVALUATED when no wait + execution pair is observed (or no phase facts).
 */
export function checkHumanServeWaitTimerFreeze(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const facts = collectCorePhaseFacts(observations);
  if (facts.length === 0) {
    return notEvaluated("rules-human-serve-wait-timer-freeze", "The committed observation stream does not carry the core matchTimer per tick");
  }
  const factsByTick = new Map(facts.map((f) => [f.tick, f]));

  // Collect wait-entry ticks and served-execution ticks.
  const waitEntries: Array<{ tick: number; kind: string }> = [];
  const servedTicks: number[] = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind === "restart-serve-wait") {
        const p = (ev.payload ?? {}) as { kind?: unknown };
        waitEntries.push({ tick: ev.tick, kind: typeof p.kind === "string" ? p.kind : "restart" });
      } else if (SERVED_KINDS.has(ev.kind) && (ev.payload as { humanServed?: unknown })?.humanServed === true) {
        servedTicks.push(ev.tick);
      }
    }
  }
  if (waitEntries.length === 0 || servedTicks.length === 0) {
    return notEvaluated("rules-human-serve-wait-timer-freeze", "No human-serve wait + served-execution pair was observed");
  }

  const failures: string[] = [];
  let checked = 0;
  for (const w of waitEntries) {
    // Find the first served tick after the wait entry.
    const serveTick = servedTicks.find((t) => t > w.tick);
    if (serveTick === undefined) continue;
    // The wait interval is the ticks BEFORE the serve tick: the serve tick is
    // where play resumes (the phase becomes "playing" and the ball-in-play
    // clock legitimately decrements there). Every tick strictly inside
    // [w.tick, serveTick) must hold the timer frozen.
    let baseTimer = factsByTick.get(w.tick)?.timer;
    for (let t = w.tick + 1; t < serveTick; t++) {
      const f = factsByTick.get(t);
      if (!f) continue;
      if (baseTimer === undefined) { baseTimer = f.timer; continue; }
      if (f.timer < baseTimer) {
        failures.push(`tick ${t} (${w.kind} human-serve wait): matchTimer ${baseTimer}→${f.timer} (decremented during a frozen wait)`);
      }
      baseTimer = f.timer;
    }
    checked++;
  }

  if (checked === 0) {
    return notEvaluated("rules-human-serve-wait-timer-freeze", "No wait + served-execution interval overlapped the phase facts");
  }
  if (failures.length > 0) {
    return fail("human-serve-wait-timer-freeze", `Human-serve wait timer froze incorrectly: ${failures.join("; ")}`, { failures });
  }
  return pass("rules-human-serve-wait-timer-freeze-held", `The match timer stayed frozen across ${checked} human-serve wait interval(s)`, { checked });
}

// ---------------------------------------------------------------------------
// HUMAN-SERVE-WINDOW-CLOSE
// ---------------------------------------------------------------------------

/**
 * The restart window stays open through the human-gated serve wait (the ball
 * is untouched and the restart phase persists) and closes on the served pass
 * (the phase returns to `playing` at the served execution). FAIL when the
 * window appears to have closed at countdown zero (phase left the restart
 * before the serve) or the served ball was already touched during the wait;
 * NOT_EVALUATED when no human-serve wait + served-execution pair is observed.
 */
export function checkHumanServeWindowClose(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const facts = collectCorePhaseFacts(observations);
  const lastTouch = lastTouchByTick(observations);
  const served = collectHumanServed(observations);

  const waitEntries: Array<{ tick: number; kind: string }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "restart-serve-wait") continue;
      const p = (ev.payload ?? {}) as { kind?: unknown };
      waitEntries.push({ tick: ev.tick, kind: typeof p.kind === "string" ? p.kind : "restart" });
    }
  }
  if (waitEntries.length === 0 || served.length === 0) {
    return notEvaluated("rules-human-serve-window-close", "No human-serve wait + served-execution pair was observed");
  }
  const factsByTick = new Map(facts.map((f) => [f.tick, f]));

  const failures: string[] = [];
  let checked = 0;
  for (const w of waitEntries) {
    const serve = served.find((s) => s.tick > w.tick);
    if (serve === undefined) continue;
    // The restart phase must persist across the wait (each post-step tick from
    // w.tick to serve.tick is a restart phase, i.e. NOT "playing").
    let phaseLeftEarly = false;
    for (let t = w.tick; t <= serve.tick; t++) {
      const f = factsByTick.get(t);
      if (!f) continue;
      // The serve tick itself transitions to playing (the window closed).
      if (t === serve.tick) {
        if (f.phase !== "playing" && f.phase !== w.kind) {
          phaseLeftEarly = true;
        }
        continue;
      }
      if (f.phase === "playing" || f.phase === "goal" || f.phase === "halftime") {
        phaseLeftEarly = true;
      }
    }
    if (phaseLeftEarly) {
      failures.push(`${w.kind} human-serve wait at tick ${w.tick}: the restart phase left the restart window before the serve fired`);
    }
    // The ball must remain untouched through the wait (served ball is a new
    // independent entity). A non-null lastTouchRef during the wait means the
    // window was broken before the serve.
    for (let t = w.tick + 1; t < serve.tick; t++) {
      if (lastTouch.get(t) !== null && lastTouch.get(t) !== undefined) {
        failures.push(`${w.kind} human-serve wait tick ${t}: the required restart ball was touched (lastTouchRef set) before the serve`);
      }
    }
    checked++;
  }

  if (checked === 0) {
    return notEvaluated("rules-human-serve-window-close", "No wait + served-execution interval was observable");
  }
  if (failures.length > 0) {
    return fail("human-serve-window-close", `Human-serve window-close/first-touch semantics violated: ${failures.join("; ")}`, { failures });
  }
  return pass("rules-human-serve-window-close-held", `${checked} human-serve window(s) stayed open through the wait and closed on the served pass`, { checked });
}

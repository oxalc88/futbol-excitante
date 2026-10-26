// Pure, serializable evidence for the touch smoke pass assert (stage 4a).
//
// A slot-0 pass counts only with a NEW contact by the original passer after the
// press, at the exact contact tick of his own RESOLVED pass action, plus proof
// that the ball left: a speed rise above the press sample, a growing ball-to-passer
// distance, or a later touch by any other player. A stale lastTouch, an action-start
// before the contact, a changed selected identity or an opponent-only touch never
// count, and the press must also grow the slot pass counter.
//
// Every input and output is plain JSON: the smoke injects this same source into
// the page (the export keywords are stripped) and polls it from waitForFunction,
// so the page keeps the accumulator between samples and Node reads it back.
const SPEED_RISE = 1; // m/s above the press sample: a kick, never a dribble tap.
const SEPARATION_GAIN = .5; // m of extra ball-to-passer distance after contact.

const speedOf = (state) => Math.hypot(state.ball.vx, state.ball.vy);
function separationOf(state, id) {
  const p = state.players.find((q) => q.id === id);
  return p ? Math.hypot(p.x - state.ball.x, p.y - state.ball.y) : null;
}

/** Snapshot taken before the press: identity, ticks and ball state to beat. */
export function beginPassEvidence(state, slot = 0) {
  const passerId = state.selected[slot];
  if (!passerId) throw new Error('beginPassEvidence: no selected player to pass with');
  const touch = state.ball.lastTouch;
  const speed = speedOf(state);
  return {
    slot, passerId, pressTick: state.tick,
    passActions: state.passes.actions[slot], passEvents: state.passes.events[slot],
    passActionsNow: state.passes.actions[slot], passEventsNow: state.passes.events[slot],
    lastTouchId: touch ? touch.id : null, lastTouchTick: touch ? touch.tick : null,
    speed, separation: separationOf(state, passerId),
    passAction: null, contact: null, departure: null,
    samples: 0, maxSpeed: speed, selectedChanged: false,
  };
}

/** Folds one __fe sample into the accumulator and returns the new state. */
export function recordPassSample(ev, state) {
  const next = { ...ev, samples: ev.samples + 1 };
  const speed = speedOf(state);
  next.maxSpeed = Math.max(ev.maxSpeed, speed);
  next.passActionsNow = state.passes.actions[ev.slot];
  next.passEventsNow = state.passes.events[ev.slot];
  const passer = state.players.find((p) => p.id === ev.passerId) ?? null;
  const action = passer ? passer.action : null;
  // The pass action of this attempt: it starts at or after the press. It is
  // remembered because the player record may outlive the sampled action.
  if (!next.passAction && action && action.kind === 'pass' && action.start >= ev.pressTick) {
    next.passAction = { kind: action.kind, start: action.start, contact: action.contact,
      end: action.end, resolved: action.resolved === true };
  } else if (next.passAction && action && action.resolved === true
      && action.kind === next.passAction.kind && action.start === next.passAction.start
      && action.contact === next.passAction.contact) {
    // Only the very same action may mark the remembered pass as resolved.
    next.passAction = { ...next.passAction, resolved: true };
  }
  if (state.selected[ev.slot] !== ev.passerId) next.selectedChanged = true;
  const touch = state.ball.lastTouch;
  // Fresh contact: a new contact record of the original passer, after the press
  // and exactly at the contact tick of his own resolved pass action. A missed
  // pass resolves at the same tick without touching the ball, so its later
  // dribble touch sits past action.contact and never ties to the pass.
  if (!next.contact && !next.selectedChanged && touch && next.passAction
      && next.passAction.resolved === true
      && touch.playerId === ev.passerId && touch.id !== ev.lastTouchId
      && (ev.lastTouchTick === null || touch.tick > ev.lastTouchTick)
      && touch.tick > ev.pressTick && touch.tick === next.passAction.contact) {
    next.contact = { tick: touch.tick, id: touch.id, playerId: touch.playerId,
      point: touch.point ?? null, separation: separationOf(state, ev.passerId) };
  }
  // Departure is only ever judged after that contact, never before it.
  if (next.contact && !next.departure) {
    const c = next.contact;
    if (state.tick >= c.tick && speed > ev.speed + SPEED_RISE) {
      next.departure = { kind: 'speed', tick: state.tick, speed, before: ev.speed };
    } else {
      const sep = separationOf(state, ev.passerId);
      if (state.tick > c.tick && sep !== null && c.separation !== null && sep > c.separation + SEPARATION_GAIN) {
        next.departure = { kind: 'separation', tick: state.tick, separation: sep, before: c.separation };
      } else if (touch && touch.id !== c.id && touch.tick > c.tick && touch.playerId !== ev.passerId) {
        next.departure = { kind: 'other-touch', tick: touch.tick, playerId: touch.playerId };
      }
    }
  }
  return next;
}

/** Verdict of one attempt: contact AND departure AND a grown pass counter. */
export function passEvidenceVerdict(ev) {
  const counter = ev.passActionsNow > ev.passActions;
  const ok = counter && !!ev.contact && !!ev.departure;
  const reason = ok ? 'ok'
    : !counter ? 'the slot pass counter did not grow'
    : !ev.contact ? (ev.selectedChanged
      ? 'the selected identity changed before a passer contact'
      : 'no new post-press passer contact at the resolved pass contact tick')
    : 'fresh passer contact but the ball never left';
  return {
    ok, reason, passerId: ev.passerId, pressTick: ev.pressTick,
    passActions: { before: ev.passActions, after: ev.passActionsNow },
    passEvents: { before: ev.passEvents, after: ev.passEventsNow },
    passAction: ev.passAction, contact: ev.contact, departure: ev.departure,
    samples: ev.samples, selectedChanged: ev.selectedChanged,
    preSpeed: ev.speed, maxSpeed: ev.maxSpeed, preSeparation: ev.separation,
  };
}

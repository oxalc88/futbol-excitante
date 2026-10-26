// Regressions for the strict pass evidence of the touch smoke (stage 4a):
// only a NEW post-press passer contact tied to his pass action, followed by
// proof that the ball left, may satisfy the assertion.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginPassEvidence, recordPassSample, passEvidenceVerdict,
  type PassEvidenceState, type PassSampleState,
} from '../scripts/touch-pass-evidence.mjs';

const PASSER = 'p0';
const MATE = 't1';
const RIVAL = 'x1';

/** A press sample: the passer last touched the ball at tick 90, ball at his feet. */
function base(over: Partial<PassSampleState> = {}): PassSampleState {
  return {
    tick: 100,
    passes: { actions: [3, 1], events: [2, 0] },
    selected: [PASSER, RIVAL],
    ball: { x: 10, y: 0, vx: 0, vy: 0, lastTouch: { id: 'c1', tick: 90, playerId: PASSER, point: { x: 10, y: 0, z: .11 } } },
    players: [
      { id: PASSER, x: 9.5, y: 0, action: null },
      { id: MATE, x: 4, y: 2, action: null },
      { id: RIVAL, x: 2, y: -3, action: null },
    ],
    ...over,
  };
}
/** The pass action of the attempt: starts at 102, contact at 109, ends at 129. */
function passingAction(state: PassSampleState, resolved = true): PassSampleState {
  return { ...state, players: state.players.map((p) => p.id === PASSER
    ? { ...p, action: { kind: 'pass', start: 102, contact: 109, end: 129, resolved } } : p) };
}
function run(ev: PassEvidenceState, ...states: PassSampleState[]): PassEvidenceState {
  return states.reduce(recordPassSample, ev);
}
function verdict(ev: PassEvidenceState) { return passEvidenceVerdict(ev); }

test('rejects a stale lastTouch even with a grown pass counter', () => {
  const ev = beginPassEvidence(base());
  const after = run(ev, base({ tick: 130,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, vx: 6, vy: 0 },
    players: passingAction(base()).players }));
  const v = verdict(after);
  assert.equal(v.ok, false);
  assert.equal(v.contact, null);
  assert.match(v.reason, /passer contact/);
  assert.equal(v.passActions.after, 4);
});

test('rejects an action-start before the contact and a contact before it', () => {
  // The action starts after the press but lastTouch still predates its contact.
  const early = run(beginPassEvidence(base()), base({ tick: 105,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, vx: 12, vy: 0, lastTouch: { id: 'c2', tick: 105, playerId: PASSER, point: { x: 11, y: 0, z: .11 } } },
    players: passingAction(base(), false).players }));
  assert.equal(early.contact, null);
  assert.equal(verdict(early).ok, false);
  // A pass action that started before the press never ties a contact either.
  const stale = run(beginPassEvidence(base()), base({ tick: 120,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, vx: 12, vy: 0, lastTouch: { id: 'c2', tick: 110, playerId: PASSER, point: { x: 11, y: 0, z: .11 } } },
    players: base().players.map((p) => p.id === PASSER
      ? { ...p, action: { kind: 'pass', start: 95, contact: 102, end: 122, resolved: true } } : p) }));
  assert.equal(stale.passAction, null);
  assert.equal(verdict(stale).ok, false);
});

test('rejects an unrelated or opponent-only contact', () => {
  const ev = run(beginPassEvidence(base()), base({ tick: 115,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, vx: 8, vy: 0, lastTouch: { id: 'c2', tick: 112, playerId: RIVAL, point: { x: 8, y: 0, z: .11 } } },
    players: passingAction(base()).players }));
  assert.equal(ev.contact, null);
  const v = verdict(ev);
  assert.equal(v.ok, false);
  assert.match(v.reason, /passer contact/);
});

test('rejects a fresh passer contact with no departure proof', () => {
  const contact = base({ tick: 112,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, lastTouch: { id: 'c2', tick: 109, playerId: PASSER, point: { x: 10.4, y: 0, z: .11 } } },
    players: passingAction(base()).players });
  const ev = run(beginPassEvidence(base()), contact, { ...contact, tick: 140 });
  assert.ok(ev.contact, 'the fresh contact itself must be recorded');
  assert.equal(ev.departure, null);
  const v = verdict(ev);
  assert.equal(v.ok, false);
  assert.match(v.reason, /never left/);
});

test('accepts a real post-press contact with a speed rise', () => {
  const contact = base({ tick: 112,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, lastTouch: { id: 'c2', tick: 109, playerId: PASSER, point: { x: 10.4, y: 0, z: .11 } } },
    players: passingAction(base()).players });
  const ev = run(beginPassEvidence(base()), contact,
    { ...contact, tick: 118, ball: { ...contact.ball, vx: 16, vy: 0 } });
  const v = verdict(ev);
  assert.equal(v.ok, true);
  assert.equal(v.reason, 'ok');
  assert.equal(v.contact?.tick, 109);
  assert.equal(v.contact?.id, 'c2');
  assert.equal(v.departure?.kind, 'speed');
  assert.equal(v.departure?.tick, 118);
  assert.deepEqual(v.passActions, { before: 3, after: 4 });
  assert.equal(v.passAction?.kind, 'pass');
  assert.equal(v.passAction?.contact, 109);
});

test('accepts a growing separation from the passer as the departure', () => {
  const contact = base({ tick: 112,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, lastTouch: { id: 'c2', tick: 109, playerId: PASSER, point: { x: 10.4, y: 0, z: .11 } } },
    players: passingAction(base()).players });
  const ev = run(beginPassEvidence(base()), contact,
    { ...contact, tick: 125, ball: { ...contact.ball, x: 14, y: 0 } });
  const v = verdict(ev);
  assert.equal(v.ok, true);
  assert.equal(v.departure?.kind, 'separation');
  assert.equal(v.departure?.separation, 4.5);
});

test('accepts a later other-player touch once the contact was recorded first', () => {
  const contact = base({ tick: 112,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, lastTouch: { id: 'c2', tick: 109, playerId: PASSER, point: { x: 10.4, y: 0, z: .11 } } },
    players: passingAction(base()).players });
  const ev = run(beginPassEvidence(base()), contact, { ...contact, tick: 120,
    ball: { ...contact.ball, lastTouch: { id: 'c3', tick: 118, playerId: MATE, point: { x: 14, y: 2, z: .11 } } } });
  const v = verdict(ev);
  assert.equal(v.ok, true);
  assert.equal(v.departure?.kind, 'other-touch');
  assert.equal(v.departure?.playerId, MATE);
  assert.equal(v.departure?.tick, 118);
});

test('ignores another player touching before the passer contact', () => {
  const rivalFirst = base({ tick: 106,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, vx: 9, vy: 0, lastTouch: { id: 'c2', tick: 105, playerId: RIVAL, point: { x: 9, y: 0, z: .11 } } },
    players: passingAction(base(), false).players });
  const contact = { ...rivalFirst, tick: 112,
    ball: { ...rivalFirst.ball, vx: 0, vy: 0,
      lastTouch: { id: 'c3', tick: 109, playerId: PASSER, point: { x: 10.4, y: 0, z: .11 } } },
    players: passingAction(base()).players };
  const ev = run(beginPassEvidence(base()), rivalFirst, contact, { ...contact, tick: 140 });
  assert.ok(ev.contact, 'the passer contact must still be recorded');
  assert.equal(ev.departure, null, 'the earlier rival touch is never a departure');
  assert.equal(verdict(ev).ok, false);
});

test('never counts a changed selected identity', () => {
  const ev = run(beginPassEvidence(base()), base({ tick: 115,
    passes: { actions: [4, 1], events: [3, 0] },
    selected: [MATE, RIVAL],
    ball: { ...base().ball, vx: 14, vy: 0, lastTouch: { id: 'c2', tick: 112, playerId: MATE, point: { x: 12, y: 0, z: .11 } } },
    players: passingAction(base()).players }));
  assert.equal(ev.contact, null);
  assert.equal(ev.selectedChanged, true);
  const v = verdict(ev);
  assert.equal(v.ok, false);
  assert.match(v.reason, /selected identity/);
});

test('rejects a contact on the press tick even at the action contact tick', () => {
  // action.contact === pressTick: everything ties except that the touch is not
  // strictly after the press.
  const atPress = base({ tick: 110,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, lastTouch: { id: 'c2', tick: 100, playerId: PASSER, point: { x: 10.4, y: 0, z: .11 } } },
    players: base().players.map((p) => p.id === PASSER
      ? { ...p, action: { kind: 'pass', start: 100, contact: 100, end: 120, resolved: true } } : p) });
  const ev = run(beginPassEvidence(base()), atPress, { ...atPress, tick: 140 });
  assert.equal(ev.contact, null);
  assert.equal(verdict(ev).ok, false);
});

test('rejects a contact while the pass action is unresolved', () => {
  const unresolved = base({ tick: 112,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, lastTouch: { id: 'c2', tick: 109, playerId: PASSER, point: { x: 10.4, y: 0, z: .11 } } },
    players: passingAction(base(), false).players });
  const ev = run(beginPassEvidence(base()), unresolved, { ...unresolved, tick: 140 });
  assert.equal(ev.passAction?.resolved, false);
  assert.equal(ev.contact, null);
  assert.equal(verdict(ev).ok, false);
});

test('rejects the dribble touch that follows a resolved missed pass', () => {
  // The action resolved at contact 109 but the kick missed, so no ball contact
  // exists at 109; the passer's next dribble touch sits at tick 120.
  const missed = base({ tick: 124,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, vx: 7, vy: 0, lastTouch: { id: 'c2', tick: 120, playerId: PASSER, point: { x: 12, y: 0, z: .11 } } },
    players: passingAction(base(), true).players });
  const ev = run(beginPassEvidence(base()), missed, { ...missed, tick: 150 });
  assert.equal(ev.passAction?.resolved, true);
  assert.equal(ev.contact, null);
  assert.equal(ev.departure, null);
  assert.equal(verdict(ev).ok, false);
});

test('an unrelated resolved pass action cannot resolve the stored one', () => {
  // The stored action starts at 102 with contact 109; a later, different pass
  // action (start 110, contact 113) resolved must not certify the first one.
  const stored = base({ tick: 105,
    passes: { actions: [4, 1], events: [3, 0] },
    players: passingAction(base(), false).players });
  const unrelated = base({ tick: 114,
    passes: { actions: [4, 1], events: [3, 0] },
    ball: { ...base().ball, vx: 9, vy: 0, lastTouch: { id: 'c2', tick: 113, playerId: PASSER, point: { x: 12, y: 0, z: .11 } } },
    players: base().players.map((p) => p.id === PASSER
      ? { ...p, action: { kind: 'pass', start: 110, contact: 113, end: 134, resolved: true } } : p) });
  const ev = run(beginPassEvidence(base()), stored, unrelated, { ...unrelated, tick: 150 });
  assert.deepEqual(ev.passAction, { kind: 'pass', start: 102, contact: 109, end: 129, resolved: false });
  assert.equal(ev.contact, null);
  assert.equal(verdict(ev).ok, false);
});

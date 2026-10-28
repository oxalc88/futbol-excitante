import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUCH_BUTTONS, TOUCH_BUTTON_INDEX, STICK_RADIUS, STICK_DEAD, TouchPad, touchLabels,
} from '../src/adapters/touch-pad';
import { ControllerMapper } from '../src/adapters/controller';
import { PS_BUTTON } from '../src/browser/pad-presets';

/** One sample of the virtual pad in slot 0. */
function sample(pad: TouchPad, mapper: ControllerMapper, tick: number) {
  return mapper.sample([pad.reading(true)], tick, 0);
}

test('touch buttons use the PS standard indices', () => {
  assert.deepEqual([...TOUCH_BUTTONS], ['cross', 'circle', 'square', 'triangle', 'r1', 'r2', 'l1', 'l2']);
  assert.deepEqual(TOUCH_BUTTON_INDEX, { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, r2: 7, l2: 6 });
});

test('press l2 reads the standard l2 button', () => {
  const pad = new TouchPad();
  pad.press(1, 'l2');
  assert.equal(pad.reading(true).buttons[6].pressed, true);
  pad.release(1);
  assert.equal(pad.reading(true).buttons[6].pressed, false);
});

test('stick dead zone reads zero and a clear move reads its axis', () => {
  const pad = new TouchPad();
  assert.equal(pad.stickDown(1, 100, 200), true);
  assert.deepEqual(pad.stick, { active: true, origin: { x: 100, y: 200 }, x: 0, y: 0 });
  // Half of the dead length gives no move.
  pad.stickMove(1, 100 + STICK_RADIUS * STICK_DEAD / 2, 200);
  assert.deepEqual({ x: pad.stick.x, y: pad.stick.y }, { x: 0, y: 0 });
  pad.stickMove(1, 100 + STICK_RADIUS * .5, 200);
  assert.deepEqual({ x: pad.stick.x, y: pad.stick.y }, { x: .5, y: 0 });
  pad.stickUp(1);
  assert.equal(pad.stick.active, false);
  assert.deepEqual({ x: pad.stick.x, y: pad.stick.y }, { x: 0, y: 0 });
});

test('stick clamps the vector length to one', () => {
  const pad = new TouchPad();
  pad.stickDown(1, 0, 0);
  pad.stickMove(1, STICK_RADIUS * 2, 0);
  assert.deepEqual({ x: pad.stick.x, y: pad.stick.y }, { x: 1, y: 0 });
  pad.stickMove(1, STICK_RADIUS, STICK_RADIUS);
  const len = Math.hypot(pad.stick.x, pad.stick.y);
  assert(Math.abs(len - 1) < 1e-12, `length ${len}`);
  assert(Math.abs(pad.stick.x - 1 / Math.SQRT2) < 1e-12);
});

test('second stick pointer is ignored', () => {
  const pad = new TouchPad();
  assert.equal(pad.stickDown(1, 10, 10), true);
  assert.equal(pad.stickDown(2, 90, 90), false);
  pad.stickMove(2, 400, 400);
  assert.deepEqual({ x: pad.stick.x, y: pad.stick.y }, { x: 0, y: 0 });
  assert.deepEqual(pad.stick.origin, { x: 10, y: 10 });
  pad.stickMove(1, 10 + STICK_RADIUS, 10);
  assert.equal(pad.stick.x, 1);
  // The lift of the foreign pointer keeps the stick of the first pointer.
  pad.release(2);
  assert.equal(pad.stick.active, true);
  pad.stickUp(1);
  assert.equal(pad.stickDown(2, 5, 5), true);
});

test('multitouch: stick, r1 and cross from three pointers', () => {
  const pad = new TouchPad();
  assert.equal(pad.stickDown(10, 0, 0), true);
  pad.stickMove(10, STICK_RADIUS, 0);
  pad.press(11, 'r1');
  pad.press(12, 'cross');
  const reading = pad.reading(true);
  assert.equal(reading.index, 99);
  assert.equal(reading.id, 'touch-pad');
  assert.equal(reading.mapping, 'standard');
  assert.equal(reading.connected, true);
  assert.deepEqual([...reading.axes], [1, 0, 0, 0]);
  assert.equal(reading.buttons.length, 17);
  assert.equal(reading.buttons[5].pressed, true);
  assert.equal(reading.buttons[0].pressed, true);
  assert.equal(reading.buttons[TOUCH_BUTTON_INDEX.r1].pressed, true);
  assert.equal(reading.buttons[TOUCH_BUTTON_INDEX.cross].pressed, true);
  assert.equal(reading.buttons[TOUCH_BUTTON_INDEX.square].pressed, false);
  assert.equal(reading.buttons.filter((b) => b.pressed).length, 2);
  assert.equal(pad.reading(false).connected, false);
});

test('slide adds a button and the lift drops both', () => {
  const pad = new TouchPad();
  pad.press(1, 'cross');
  // The pointer slides onto R1: the new button adds, ✕ stays held. This is the feint.
  pad.press(1, 'r1');
  assert.equal(pad.held('cross'), true);
  assert.equal(pad.held('r1'), true);
  assert.equal(pad.held('l1'), false);
  pad.release(1);
  assert.equal(pad.held('cross'), false);
  assert.equal(pad.held('r1'), false);
  // The lift of the pointer also lifts its stick.
  pad.stickDown(1, 0, 0);
  pad.stickMove(1, STICK_RADIUS, 0);
  pad.press(1, 'l1');
  assert.equal(pad.stick.active, true);
  pad.release(1);
  assert.equal(pad.stick.active, false);
  assert.deepEqual({ x: pad.stick.x, y: pad.stick.y }, { x: 0, y: 0 });
  assert.equal(pad.held('l1'), false);
  pad.clear();
  assert.deepEqual({ x: pad.stick.x, y: pad.stick.y }, { x: 0, y: 0 });
  assert.equal(pad.stick.active, false);
});

test('labels pick one row per context', () => {
  const attack = touchLabels({ defending: false, aerial: false, keeper: false, hold: false });
  assert.deepEqual(attack, { cross: 'Pase', circle: 'Centro', square: 'Tiro', triangle: 'Filtrado' });
  const defense = touchLabels({ defending: true, aerial: false, keeper: false, hold: false });
  assert.deepEqual(defense, { cross: 'Entrada', circle: 'Barrida', square: 'Despeje', triangle: 'Presión' });
  const keeper = touchLabels({ defending: true, aerial: false, keeper: true, hold: false });
  assert.deepEqual(keeper, { cross: 'Lanzarse', circle: 'Barrida', square: 'Despeje', triangle: 'Salir' });
  const aerial = touchLabels({ defending: false, aerial: true, keeper: false, hold: false });
  assert.deepEqual(aerial, { cross: 'Cabeza', circle: 'Cabeza', square: 'Cabeza', triangle: 'Cabeza' });
  // The hold row wins over defense, keeper and aerial at once.
  const hold = touchLabels({ defending: true, aerial: true, keeper: true, hold: true });
  assert.deepEqual(hold, { cross: 'Mano', circle: 'Volea', square: 'Patear', triangle: 'Al espacio' });
  // Short words: 9 chars at most, and 10 for the long hold label.
  for (const row of [attack, defense, keeper, aerial, hold]) {
    for (const key of ['cross', 'circle', 'square', 'triangle'] as const) {
      const max = row[key] === 'Al espacio' ? 10 : 9;
      assert(row[key].length <= max, `${row[key]} is too long`);
      assert(row[key].length > 0, 'empty label');
    }
  }
});

test('cancel drops the pointer buttons and arms one discard', () => {
  const pad = new TouchPad();
  pad.press(1, 'square');
  pad.press(2, 'cross');
  pad.cancel(1);
  assert.equal(pad.held('square'), false);
  assert.equal(pad.held('cross'), true);
  assert.equal(pad.takeCancelled(), true);
  assert.equal(pad.takeCancelled(), false, 'the flag clears after one read');
  pad.cancel(2);
  assert.equal(pad.held('cross'), false);
  assert.equal(pad.takeCancelled(), true);
  pad.clear();
  assert.equal(pad.takeCancelled(), false, 'clear drops the flag');
});

test('a cancelled charged square never fires the shot on lift', () => {
  const pad = new TouchPad();
  const mapper = new ControllerMapper();
  mapper.sample([pad.reading(true)], 0, 0);
  pad.press(1, 'square');
  for (let tick = 1; tick <= 12; tick++) mapper.sample([pad.reading(true)], tick, 0);
  assert(mapper.chargeLevel(0) > 0, 'the charge builds');
  // The view cancels the pointer: the adapter discards the charge, so the
  // lift reads as no press at all.
  pad.cancel(1);
  mapper.discardCharge();
  const f = mapper.sample([pad.reading(true)], 13, 0);
  assert.equal(f.action, undefined);
  assert.equal(mapper.chargeLevel(0), 0);
});

test('l1 + r2 held together reads r3 and no l1 or r2', () => {
  const pad = new TouchPad();
  const mapper = new ControllerMapper();
  // One empty sample assigns the reading, so the first press is an edge.
  assert.equal(sample(pad, mapper, 0).switchPlayer, false);
  pad.press(1, 'l1');
  assert.equal(pad.reading(true).buttons[PS_BUTTON.l1].pressed, true);
  assert.equal(sample(pad, mapper, 1).switchPlayer, true, 'l1 alone still switches player');
  pad.press(2, 'r2');
  const reading = pad.reading(true);
  assert.equal(reading.buttons[PS_BUTTON.l1].pressed, false);
  assert.equal(reading.buttons[PS_BUTTON.r2].pressed, false);
  assert.equal(reading.buttons[PS_BUTTON.r3].pressed, true);
  assert.equal(pad.held('l1'), true, 'the pointers keep their buttons');
  assert.equal(pad.held('r2'), true);
  const f = sample(pad, mapper, 2);
  assert.equal(f.switchKeeper, true, 'the combo edges r3');
  assert.equal(f.switchPlayer, false, 'the combo never switches player');
  // The l1 lift keeps the latch: r2 stays consumed and r3 stays down, so the
  // lone r2 never reads and no second switch fires.
  pad.release(1);
  const latched = pad.reading(true);
  assert.equal(latched.buttons[PS_BUTTON.l1].pressed, false);
  assert.equal(latched.buttons[PS_BUTTON.r2].pressed, false, 'the still-held r2 stays consumed');
  assert.equal(latched.buttons[PS_BUTTON.r3].pressed, true, 'the latch holds r3 up until both lift');
  const g = sample(pad, mapper, 3);
  assert.equal(g.switchKeeper, false, 'the l1 lift gives no second keeper switch');
  assert.equal(g.switchPlayer, false, 'the l1 lift gives no player switch');
  // Both up: the latch ends and the reading is clean again.
  pad.release(2);
  const up = pad.reading(true);
  assert.equal(up.buttons[PS_BUTTON.r2].pressed, false);
  assert.equal(up.buttons[PS_BUTTON.r3].pressed, false);
  const h = sample(pad, mapper, 4);
  assert.equal(h.switchKeeper, false);
  assert.equal(h.switchPlayer, false);
});

test('keeper combo latches through either release order and one re-press', () => {
  for (const first of ['l1', 'r2'] as const) {
    const second: 'l1' | 'r2' = first === 'l1' ? 'r2' : 'l1';
    const pad = new TouchPad();
    const mapper = new ControllerMapper();
    assert.equal(sample(pad, mapper, 0).switchPlayer, false, `${first}: first sample`);
    pad.press(1, first);
    sample(pad, mapper, 1);
    pad.press(2, second);
    const combo = sample(pad, mapper, 2);
    assert.equal(combo.switchKeeper, true, `${first}+${second}: the combo edges r3 once`);
    assert.equal(combo.switchPlayer, false, `${first}+${second}: no player switch`);
    // Release order 1: the pointer of the FIRST button lifts, the other stays.
    pad.release(1);
    const afterLift = sample(pad, mapper, 3);
    assert.equal(afterLift.switchKeeper, false, `${first} lift: no extra keeper switch`);
    assert.equal(afterLift.switchPlayer, false, `${first} lift: no player switch`);
    const heldReading = pad.reading(true);
    assert.equal(heldReading.buttons[PS_BUTTON.l1].pressed, false, `${first} lift: l1 consumed`);
    assert.equal(heldReading.buttons[PS_BUTTON.r2].pressed, false, `${first} lift: r2 consumed`);
    assert.equal(heldReading.buttons[PS_BUTTON.r3].pressed, true, `${first} lift: the latch keeps r3`);
    // Re-press the released button while the other still holds: same reading.
    pad.press(3, first);
    const rePress = sample(pad, mapper, 4);
    assert.equal(rePress.switchKeeper, false, `${first} re-press: no extra keeper switch`);
    assert.equal(rePress.switchPlayer, false, `${first} re-press: no player switch`);
    const reReading = pad.reading(true);
    assert.equal(reReading.buttons[PS_BUTTON.l1].pressed, false, `${first} re-press: l1 consumed`);
    assert.equal(reReading.buttons[PS_BUTTON.r2].pressed, false, `${first} re-press: r2 consumed`);
    assert.equal(reReading.buttons[PS_BUTTON.r3].pressed, true, `${first} re-press: r3 stays down`);
    // Release order 2: the last two pointers lift, the latch ends.
    pad.release(3);
    pad.release(2);
    const clean = sample(pad, mapper, 5);
    assert.equal(clean.switchKeeper, false, `${first}: both up, no edge`);
    assert.equal(clean.switchPlayer, false, `${first}: both up, no edge`);
    const cleanReading = pad.reading(true);
    assert.equal(cleanReading.buttons[PS_BUTTON.r3].pressed, false, `${first}: the latch is open`);
    // Fresh L1 after both up switches player, and the next combo still works.
    pad.press(1, 'l1');
    assert.equal(sample(pad, mapper, 6).switchPlayer, true, `${first}: fresh l1 after both up`);
    pad.press(2, 'r2');
    const next = sample(pad, mapper, 7);
    assert.equal(next.switchKeeper, true, `${first}: the next combo switches the keeper`);
    assert.equal(next.switchPlayer, false, `${first}: the next combo never switches player`);
  }
});

test('the latch ends when both buttons lift between two readings', () => {
  const pad = new TouchPad();
  const mapper = new ControllerMapper();
  assert.equal(sample(pad, mapper, 0).switchPlayer, false);
  pad.press(1, 'l1');
  pad.press(2, 'r2');
  assert.equal(sample(pad, mapper, 1).switchKeeper, true, 'the combo edges r3');
  // Both pointers lift with no reading in between, then a fresh l1 presses.
  pad.release(1);
  pad.release(2);
  pad.press(1, 'l1');
  const reading = pad.reading(true);
  assert.equal(reading.buttons[PS_BUTTON.l1].pressed, true, 'the fresh l1 reads alone');
  assert.equal(reading.buttons[PS_BUTTON.r3].pressed, false, 'the latch already ended');
  const f = sample(pad, mapper, 2);
  assert.equal(f.switchPlayer, true, 'the fresh l1 after both up switches player');
  assert.equal(f.switchKeeper, false);
  // The next combo still gives its own keeper switch.
  pad.press(2, 'r2');
  assert.equal(sample(pad, mapper, 3).switchKeeper, true, 'the next combo switches the keeper');
});

test('clear drops the keeper latch', () => {
  const pad = new TouchPad();
  const mapper = new ControllerMapper();
  assert.equal(sample(pad, mapper, 0).switchPlayer, false);
  pad.press(1, 'l1');
  pad.press(2, 'r2');
  assert.equal(sample(pad, mapper, 1).switchKeeper, true, 'the combo edges r3');
  pad.clear();
  pad.press(1, 'l1');
  const reading = pad.reading(true);
  assert.equal(reading.buttons[PS_BUTTON.l1].pressed, true, 'after clear the l1 is a fresh press');
  assert.equal(reading.buttons[PS_BUTTON.r3].pressed, false);
  assert.equal(sample(pad, mapper, 2).switchPlayer, true, 'the l1 switches player again');
  assert.equal(sample(pad, mapper, 2).switchKeeper, false);
});

test('keeper dive labels win over the aerial row, as the mapper dives', () => {
  // A keeper at head height dives, so the dive row shows, not the header row.
  const dive = touchLabels({ defending: true, aerial: true, keeper: true, hold: false });
  assert.deepEqual(dive, { cross: 'Lanzarse', circle: 'Barrida', square: 'Despeje', triangle: 'Salir' });
  // The keeper row needs no defense flag: at head height the keeper dives too.
  const airKeeper = touchLabels({ defending: false, aerial: true, keeper: true, hold: false });
  assert.deepEqual(airKeeper, { cross: 'Lanzarse', circle: 'Barrida', square: 'Despeje', triangle: 'Salir' });
  // An outfield player at head height still gets the header row.
  const aerial = touchLabels({ defending: true, aerial: true, keeper: false, hold: false });
  assert.deepEqual(aerial, { cross: 'Cabeza', circle: 'Cabeza', square: 'Cabeza', triangle: 'Cabeza' });
});

test('mapper: cross press edge plays the pass and the release gives nothing', () => {
  const pad = new TouchPad();
  const mapper = new ControllerMapper();
  assert.equal(sample(pad, mapper, 0).action, undefined);
  pad.press(1, 'cross');
  assert.equal(sample(pad, mapper, 1).action, 'pass');
  pad.release(1);
  assert.equal(sample(pad, mapper, 2).action, undefined);
});

test('mapper: a held r1 sprints', () => {
  const pad = new TouchPad();
  const mapper = new ControllerMapper();
  assert.equal(sample(pad, mapper, 0).sprint, false);
  pad.press(2, 'r1');
  assert.equal(sample(pad, mapper, 1).sprint, true);
  pad.release(2);
  assert.equal(sample(pad, mapper, 2).sprint, false);
});

test('mapper: l2 on the touch pad during an attacking restart places the second taker', () => {
  const pad = new TouchPad();
  const mapper = new ControllerMapper();
  const restart = { kind: 'free-kick', attacking: true };
  const withRestart = (tick: number) =>
    mapper.sample([pad.reading(true)], tick, 0, false, false, false, false, restart);
  // One empty sample assigns the reading, so the first press is an edge.
  assert.equal(withRestart(0).secondTaker, undefined);
  pad.press(1, 'l2');
  const press = withRestart(1);
  assert.equal(press.secondTaker, 'side', 'the press places the taker beside the ball');
  assert.equal(press.secondKick, true, 'the press still gives the kick');
  const next = withRestart(2);
  assert.equal(next.secondTaker, undefined, 'the placement is one edge, not a hold');
  assert.equal(next.secondKick, true, 'the held l2 keeps the kick');
  pad.release(1);
  assert.equal(withRestart(3).secondKick, undefined, 'the release gives no kick');
});

test('mapper: a 48 tick square hold gives more power than a 12 tick hold', () => {
  const shoot = (ticks: number) => {
    const pad = new TouchPad();
    const mapper = new ControllerMapper();
    mapper.sample([pad.reading(true)], 0, 0);
    pad.press(1, 'square');
    for (let tick = 1; tick <= ticks; tick++) mapper.sample([pad.reading(true)], tick, 0);
    pad.release(1);
    return mapper.sample([pad.reading(true)], ticks + 1, 0);
  };
  const short = shoot(12);
  const long = shoot(48);
  assert.equal(short.action, 'shoot');
  assert.equal(long.action, 'shoot');
  assert(short.power > 0, `power ${short.power}`);
  assert(long.power > short.power, `${long.power} !> ${short.power}`);
  assert(long.power <= 1);
});

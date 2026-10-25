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
  assert.deepEqual([...TOUCH_BUTTONS], ['cross', 'circle', 'square', 'triangle', 'r1', 'r2', 'l1']);
  assert.deepEqual(TOUCH_BUTTON_INDEX, { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, r2: 7 });
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
  // The l1 lift ends the combo: r2 reads alone again and r3 is up.
  pad.release(1);
  assert.equal(pad.reading(true).buttons[PS_BUTTON.r2].pressed, true);
  assert.equal(pad.reading(true).buttons[PS_BUTTON.r3].pressed, false);
  assert.equal(sample(pad, mapper, 3).switchKeeper, false);
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

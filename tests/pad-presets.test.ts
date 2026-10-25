import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PES_2017_PS4_PRESET, PES_2017_PS4_ROWS, KEYBOARD_MAP, KEYBOARD_MOVE, PS_GLYPHS, PS_GLYPH_BY_BUTTON, PS_BUTTON,
  buttonConflicts, keyboardConflicts, pesButton, pesRow, pesRows,
  type PadContext, type PadPresetRow, type PsGlyph,
} from '../src/browser/pad-presets';
import { ControllerMapper, type PadReading } from '../src/adapters/controller';

const IDENTICAL = ['move', 'pass', 'through', 'switchPlayer', 'pause'] as const;
const REMAPPED = ['cross', 'switchPlay', 'crossHigh', 'shot', 'header', 'sprint', 'shield',
  'standingTackle', 'slide', 'clearance', 'shoulderCharge', 'camera'] as const;
const MISSING = ['pressure'] as const;
/** The 17 phase-1 rows of the research: 5 identical and 12 remapped. */
const PHASE_1 = [...IDENTICAL, ...REMAPPED];

const TABLE: readonly [string, PadPresetRow['state'], PadContext, number | null, readonly PsGlyph[], string][] = [
  ['move', 'identical', 'attack', null, [], 'Left stick'],
  ['pass', 'identical', 'attack', 0, ['✕'], '✕'],
  ['through', 'identical', 'attack', 3, ['△'], '△'],
  ['switchPlayer', 'identical', 'defense', 4, ['L1'], 'L1'],
  ['pause', 'identical', 'system', 9, ['OPTIONS'], 'OPTIONS'],
  ['cross', 'remapped', 'attack', 1, ['○'], '○'],
  ['switchPlay', 'remapped', 'attack', 1, ['○'], 'Stick left to other wing + ○'],
  ['crossHigh', 'remapped', 'attack', 1, ['○'], '○'],
  ['shot', 'remapped', 'attack', 2, ['□'], '□ hold'],
  ['header', 'remapped', 'attack', 2, ['□'], '□ or pass at head height'],
  ['sprint', 'remapped', 'attack', 5, ['R1'], 'R1 + stick left'],
  ['shield', 'remapped', 'attack', null, [], 'Automatic'],
  ['standingTackle', 'remapped', 'defense', 0, ['✕'], '✕ ×2'],
  ['slide', 'remapped', 'defense', 1, ['○'], '○ (defending)'],
  ['clearance', 'remapped', 'defense', 2, ['□'], '□'],
  ['shoulderCharge', 'remapped', 'defense', null, [], 'Automatic'],
  ['camera', 'remapped', 'system', null, [], 'Touchpad click'],
  ['pressure', 'missing', 'defense', 0, ['✕'], '✕ hold'],
];

const KEYS: readonly [string, readonly string[], readonly string[]][] = [
  ['move', ['KeyW', 'KeyS', 'KeyA', 'KeyD'], ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']],
  ['pass', ['KeyJ'], ['Numpad1']],
  ['through', ['KeyL'], ['Numpad3']],
  ['switchPlayer', ['KeyQ'], ['Enter']],
  ['pause', ['Escape', 'KeyP'], ['Escape', 'KeyP']],
  ['cross', ['KeyI'], ['Numpad5']],
  ['switchPlay', ['KeyI'], ['Numpad5']],
  ['crossHigh', ['KeyI'], ['Numpad5']],
  ['shot', ['KeyK'], ['Numpad2']],
  ['header', ['KeyK'], ['Numpad2']],
  ['sprint', ['ShiftLeft'], ['ShiftRight']],
  ['shield', [], []],
  ['standingTackle', ['KeyU'], ['Numpad0']],
  ['slide', ['KeyB'], ['Numpad7']],
  ['clearance', ['KeyK'], ['Numpad2']],
  ['shoulderCharge', [], []],
  ['camera', ['KeyC'], ['KeyC']],
  ['pressure', ['KeyU'], ['Numpad0']],
];

test('preset has the 17 phase-1 rows and 1 missing row with the PES table ids', () => {
  assert.equal(PHASE_1.length, 17);
  assert.equal(PES_2017_PS4_ROWS.length, 18);
  assert.deepEqual(pesRows('identical').map((row) => row.id), [...IDENTICAL]);
  assert.deepEqual(pesRows('remapped').map((row) => row.id), [...REMAPPED]);
  assert.deepEqual(pesRows('missing').map((row) => row.id), [...MISSING]);
  assert.equal(PES_2017_PS4_PRESET.rows, PES_2017_PS4_ROWS);
  assert.deepEqual(PES_2017_PS4_ROWS.map((row) => row.id), [...PHASE_1, ...MISSING]);
  assert.equal(PHASE_1.filter((id) => pesRow(id).state === 'identical').length, 5);
  assert.equal(PHASE_1.filter((id) => pesRow(id).state === 'remapped').length, 12);
});

test('each mapping row matches the PES 2017 PS4 table', () => {
  for (const [id, state, context, button, glyphs, text] of TABLE) {
    const row = pesRow(id);
    assert.equal(row.state, state, id);
    assert.equal(row.context, context, id);
    assert.equal(row.button, button, id);
    assert.deepEqual([...row.glyphs], glyphs, id);
    assert.equal(row.text, text, id);
    assert.equal(row.pes.length > 0, true, id);
  }
});

test('the full PS button and glyph tables match literal values', () => {
  assert.deepEqual([...PS_GLYPHS], ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'OPTIONS']);
  assert.deepEqual({ ...PS_BUTTON },
    { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, options: 9, l3: 10, r3: 11 });
  assert.equal(PS_BUTTON.cross, 0);
  assert.equal(PS_BUTTON.circle, 1);
  assert.equal(PS_BUTTON.square, 2);
  assert.equal(PS_BUTTON.triangle, 3);
  assert.equal(PS_BUTTON.l1, 4);
  assert.equal(PS_BUTTON.r1, 5);
  assert.equal(PS_BUTTON.l2, 6);
  assert.equal(PS_BUTTON.r2, 7);
  assert.equal(PS_BUTTON.options, 9);
  assert.equal(PS_BUTTON.l3, 10);
  assert.equal(PS_BUTTON.r3, 11);
  assert.deepEqual({ ...PS_GLYPH_BY_BUTTON },
    { 0: '✕', 1: '○', 2: '□', 3: '△', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 9: 'OPTIONS', 10: 'L3', 11: 'R3' });
  for (const row of PES_2017_PS4_ROWS) {
    for (const glyph of row.glyphs) assert.ok((PS_GLYPHS as readonly string[]).includes(glyph), `${row.id}: ${glyph}`);
    if (row.button === null) continue;
    assert.equal(PS_GLYPH_BY_BUTTON[row.button], row.glyphs[0], `${row.id}: glyph for button ${row.button}`);
  }
  for (const index of Object.keys(PS_GLYPH_BY_BUTTON)) assert.ok(Number(index) >= 0 && Number(index) <= 11);
});

test('shield is automatic: the row has no button, no glyph and no key', () => {
  const shield = pesRow('shield');
  assert.equal(shield.button, null);
  assert.equal(shield.glyphs.length, 0);
  assert.equal(shield.text, 'Automatic');
  assert.deepEqual([...shield.keys.p1], []);
  assert.deepEqual([...shield.keys.p2], []);
  assert.throws(() => pesButton('shield'), /no button/);
  // No row maps R2, L2 or L3: shield, jockey and the old FE key are gone.
  for (const row of PES_2017_PS4_ROWS) {
    if (row.button === null) continue;
    assert.notEqual(row.button, PS_BUTTON.r2, row.id);
    assert.notEqual(row.button, PS_BUTTON.l2, row.id);
    assert.notEqual(row.button, PS_BUTTON.l3, row.id);
  }
});

test('pressure (hold ✕) and standing tackle (✕ ×2) are separate gestures', () => {
  const pressure = pesRow('pressure');
  const tackle = pesRow('standingTackle');
  assert.equal(pressure.text, '✕ hold');
  assert.equal(tackle.text, '✕ ×2');
  assert.equal(pressure.context, 'defense');
  assert.equal(tackle.context, 'defense');
  assert.equal(pressure.button, PS_BUTTON.cross);
  assert.equal(tackle.button, PS_BUTTON.cross);
  assert.equal(pressure.state, 'missing');
  assert.deepEqual([...pressure.shares], ['standingTackle']);
  assert.deepEqual([...tackle.shares], ['pressure']);
  // No row mixes a hold with a double tap.
  for (const row of PES_2017_PS4_ROWS) assert.equal(/hold.*then|hold.*×2/i.test(row.text), false, row.id);
});

test('the header row documents its shares and keeps the shot button', () => {
  const header = pesRow('header');
  const shot = pesRow('shot');
  assert.equal(header.text, '□ or pass at head height');
  assert.equal(header.button, shot.button);
  assert.equal(header.glyphs[0], '□');
  for (const id of ['shot', 'pass', 'through', 'cross']) assert.ok(header.shares.includes(id), `header -> ${id}`);
  for (const id of header.shares) assert.ok(pesRow(id).shares.includes('header'), `${id} -> header`);
});

test('no two actions in one context share a button unless the PES table says so', () => {
  assert.deepEqual(buttonConflicts(), []);
  assert.deepEqual(keyboardConflicts(), []);
  // PES shares are declared on both rows.
  for (const row of PES_2017_PS4_ROWS) {
    for (const other of row.shares) assert.ok(pesRow(other).shares.includes(row.id), `${row.id} <-> ${other}`);
  }
  // An undeclared repeat in one context is a conflict.
  const bad: PadPresetRow[] = [...PES_2017_PS4_ROWS,
    { ...pesRow('pass'), id: 'fakePass', shares: [] }];
  assert.deepEqual(buttonConflicts(bad).map((conflict) => conflict.ids), [['pass', 'fakePass']]);
  // The same button in another context is fine.
  const moved: PadPresetRow[] = [...PES_2017_PS4_ROWS, { ...pesRow('pass'), id: 'fakePass', context: 'system', shares: [] }];
  assert.deepEqual(buttonConflicts(moved), []);
  // A share declared by the PES table is fine.
  const shared: PadPresetRow[] = [
    { ...pesRow('pass'), id: 'a', shares: ['b'] },
    { ...pesRow('pass'), id: 'b', shares: ['a'] },
    { ...pesRow('through'), id: 'c', shares: [] },
  ];
  assert.deepEqual(buttonConflicts(shared), []);
  const half: PadPresetRow[] = [{ ...shared[0], shares: [] }, shared[1], shared[2]];
  assert.deepEqual(buttonConflicts(half).map((conflict) => conflict.ids), [['a', 'b']]);
});

test('attack and defense use the PES buttons, and both contexts stay free', () => {
  const attack = PES_2017_PS4_ROWS.filter((row) => row.context === 'attack' && row.button !== null);
  const defense = PES_2017_PS4_ROWS.filter((row) => row.context === 'defense' && row.button !== null);
  assert.deepEqual(attack.map((row) => [row.id, row.button]),
    [['pass', 0], ['through', 3], ['cross', 1], ['switchPlay', 1], ['crossHigh', 1], ['shot', 2], ['header', 2], ['sprint', 5]]);
  assert.deepEqual(defense.map((row) => [row.id, row.button]),
    [['switchPlayer', 4], ['standingTackle', 0], ['slide', 1], ['clearance', 2], ['pressure', 0]]);
  // ✕ ○ □ mean one thing in attack and another in defense.
  assert.equal(pesRow('pass').button, pesRow('standingTackle').button);
  assert.equal(pesRow('pass').button, pesButton('pressure'));
  assert.equal(pesRow('cross').button, pesRow('slide').button);
  assert.equal(pesRow('shot').button, pesRow('clearance').button);
  // R1 and L1 work in both contexts.
  assert.equal(pesRow('sprint').button, PS_BUTTON.r1);
  assert.equal(pesRow('switchPlayer').button, PS_BUTTON.l1);
  // R3 keeps the keeper switch and OPTIONS keeps the pause.
  assert.equal(PS_BUTTON.r3, 11);
  assert.equal(pesButton('pause'), PS_BUTTON.options);
});

test('keyboard rows carry the FE key codes of the preset', () => {
  assert.deepEqual(PES_2017_PS4_ROWS.map((row) => row.id), KEYS.map(([id]) => id));
  for (const [id, p1, p2] of KEYS) {
    const row = pesRow(id);
    assert.deepEqual([...row.keys.p1], p1, id);
    assert.deepEqual([...row.keys.p2], p2, id);
    if (row.button !== null) assert.equal(row.keys.p1.length > 0, true, id);
    if (row.button === null && !row.axis && id !== 'camera') assert.equal(row.keys.p1.length, 0, id);
  }
});

test('the exported keyboard map derives from the preset rows', () => {
  assert.deepEqual(KEYBOARD_MOVE.p1, ['KeyW', 'KeyS', 'KeyA', 'KeyD']);
  assert.deepEqual(KEYBOARD_MOVE.p2, ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  assert.deepEqual(KEYBOARD_MAP.p1.KeyJ, { attack: 'pass' });
  assert.deepEqual(KEYBOARD_MAP.p1.KeyL, { attack: 'through' });
  assert.deepEqual(KEYBOARD_MAP.p1.KeyI, { attack: 'cross' });
  assert.deepEqual(KEYBOARD_MAP.p1.KeyK, { attack: 'shoot', defense: 'shoot', charge: true });
  assert.deepEqual(KEYBOARD_MAP.p1.KeyU, { defense: 'tackle' });
  assert.deepEqual(KEYBOARD_MAP.p1.KeyB, { defense: 'slide' });
  assert.deepEqual(KEYBOARD_MAP.p1.ShiftLeft, { sprint: true });
  assert.deepEqual(KEYBOARD_MAP.p1.KeyQ, { switchPlayer: true });
  assert.deepEqual(KEYBOARD_MAP.p2.Numpad1, { attack: 'pass' });
  assert.deepEqual(KEYBOARD_MAP.p2.Numpad2, { attack: 'shoot', defense: 'shoot', charge: true });
  assert.deepEqual(KEYBOARD_MAP.p2.Numpad0, { defense: 'tackle' });
  assert.deepEqual(KEYBOARD_MAP.p2.ShiftRight, { sprint: true });
  // Shield is automatic and the old FE keys are gone.
  assert.equal(KEYBOARD_MAP.p1.Space, undefined);
  assert.equal(KEYBOARD_MAP.p1.NumpadDecimal, undefined);
  assert.equal(KEYBOARD_MAP.p1.KeyO, undefined);
  assert.equal(KEYBOARD_MAP.p1.KeyH, undefined);
  // Player one uses Key codes and player two uses Numpad and arrow codes.
  for (const code of Object.keys(KEYBOARD_MAP.p1)) assert.equal(code.startsWith('Key') || code.startsWith('Shift') || code.startsWith('Arrow'), true, code);
  for (const code of Object.keys(KEYBOARD_MAP.p2)) assert.equal(code.startsWith('Key'), false, code);
});

test('the preset is wired into the input, controller and help UI', () => {
  const source = readFileSync(new URL('../src/browser/pad-presets.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('Not wired'), false);
  for (const file of ['src/adapters/input.ts', 'src/adapters/controller.ts']) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.equal(text.includes('pad-presets'), true, file);
  }
  const main = readFileSync(new URL('../src/browser/main.ts', import.meta.url), 'utf8');
  for (const glyph of ['✕', '○', '□', '△', 'L1', 'R1', 'R3', 'OPTIONS']) assert.equal(main.includes(glyph), true, glyph);
  assert.equal(main.includes('Mando (PS4)'), true);
  assert.equal(PES_2017_PS4_PRESET.source, 'pes2017-ps4-controls.md');
});

function pad(index = 0, buttons: number[] = [], axes: number[] = []): PadReading {
  return { index, id: `pad${index}`, mapping: 'standard', connected: true, axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i) })) };
}
/** One pressed frame after a clean frame. attacking by default. */
function press(buttons: number[], defending = false, axes: number[] = []) {
  const mapper = new ControllerMapper();
  mapper.sample([pad()], 0, 0, defending);
  return mapper.sample([pad(0, buttons, axes)], 1, 0, defending);
}
/** A script of frames for one pad. */
function run(frames: readonly { buttons: number[]; axes?: number[] }[], defending = false) {
  const mapper = new ControllerMapper();
  const out = [mapper.sample([pad()], 0, 0, defending)];
  frames.forEach((frame, i) => out.push(mapper.sample([pad(0, frame.buttons, frame.axes ?? [0, 0, 0, 0])], i + 1, 0, defending)));
  return out;
}

test('move row: the left stick moves the player', () => {
  assert.equal(pesRow('move').button, null);
  assert.equal(pesRow('move').axis, 'left');
  const frame = press([], false, [0, -1, 0, 0]);
  assert.deepEqual(frame.move, { x: 0, y: -1 });
  assert.equal(frame.action, undefined);
});

test('pass row: ✕ passes with the ball and tackles without it', () => {
  assert.equal(pesRow('pass').button, PS_BUTTON.cross);
  assert.equal(press([PS_BUTTON.cross]).action, 'pass');
  assert.equal(press([PS_BUTTON.cross], true).action, 'tackle');
  // No defending flag: the pad keeps the attack mapping.
  assert.equal(press([pesButton('pass')]).action, 'pass');
});

test('through row: △ plays the through ball only with the ball', () => {
  assert.equal(pesRow('through').button, PS_BUTTON.triangle);
  assert.equal(press([PS_BUTTON.triangle]).action, 'through');
  assert.equal(press([PS_BUTTON.triangle], true).action, undefined);
});

test('switch player row: L1 changes the cursor in both contexts', () => {
  assert.equal(pesRow('switchPlayer').button, PS_BUTTON.l1);
  assert.equal(press([PS_BUTTON.l1]).switchPlayer, true);
  assert.equal(press([PS_BUTTON.l1], true).switchPlayer, true);
  // L1 + ○ is the lob, so it does not change the cursor.
  const frames = run([{ buttons: [PS_BUTTON.l1] }, { buttons: [PS_BUTTON.l1, PS_BUTTON.circle] }]);
  assert.equal(frames[2].action, 'lob');
  assert.equal(frames[2].switchPlayer, false);
});

test('pause row: OPTIONS starts the pause on an edge', () => {
  assert.equal(pesButton('pause'), PS_BUTTON.options);
  const mapper = new ControllerMapper();
  assert.equal(mapper.pauseRequested([pad()]), false);
  assert.equal(mapper.pauseRequested([pad(0, [PS_BUTTON.options])]), true);
  assert.equal(mapper.pauseRequested([pad(0, [PS_BUTTON.options])]), false);
});

test('cross row: ○ crosses with the ball and slides without it', () => {
  assert.equal(pesRow('cross').button, PS_BUTTON.circle);
  assert.equal(press([PS_BUTTON.circle]).action, 'cross');
  assert.equal(press([PS_BUTTON.circle], true).action, 'slide');
});

test('switch play row: ○ with a wing direction crosses to the other wing', () => {
  const frame = press([PS_BUTTON.circle], false, [1, 0, 0, 0]);
  assert.equal(frame.action, 'cross');
  assert.equal(frame.move.x > 0, true);
});

test('cross high row: the wing cross shares the ○ button', () => {
  assert.equal(pesRow('crossHigh').button, PS_BUTTON.circle);
  assert.equal(pesRow('crossHigh').shares.includes('cross'), true);
  assert.equal(press([PS_BUTTON.circle]).action, 'cross');
});

test('shot row: □ charges and the release shoots', () => {
  assert.equal(pesRow('shot').button, PS_BUTTON.square);
  const frames = run([{ buttons: [PS_BUTTON.square] }, { buttons: [PS_BUTTON.square] }, { buttons: [PS_BUTTON.square] }]);
  assert.equal(frames[1].action, undefined);
  assert.equal(frames[2].action, undefined);
  const charged = run(Array.from({ length: 40 }, () => ({ buttons: [PS_BUTTON.square] })).concat({ buttons: [] }));
  const shot = charged.at(-1)!;
  assert.equal(shot.action, 'shoot');
  assert.equal(shot.power > .5, true);
  // A quick tap gives the weak shot.
  const tap = run([{ buttons: [PS_BUTTON.square] }, { buttons: [] }]);
  assert.equal(tap.at(-1)!.action, 'shoot');
  assert.equal(tap.at(-1)!.power, .15);
});

test('header row: no own button, it shares the shot and pass gestures', () => {
  const header = pesRow('header');
  assert.equal(header.button, PS_BUTTON.square);
  assert.equal(header.button, pesRow('shot').button);
  assert.equal(header.shares.includes('pass'), true);
  // The shared □ gesture is the charge, as for the shot.
  assert.equal(press([PS_BUTTON.square]).action, undefined);
  // The pass gesture stays a pass with the ball.
  assert.equal(press([PS_BUTTON.cross]).action, 'pass');
});

test('sprint row: R1 runs with and without the ball', () => {
  assert.equal(pesRow('sprint').button, PS_BUTTON.r1);
  assert.equal(press([PS_BUTTON.r1]).sprint, true);
  assert.equal(press([PS_BUTTON.r1], true).sprint, true);
  assert.equal(press([PS_BUTTON.r2]).sprint, false);
});

test('shield row: the pad never sets shield, it is automatic', () => {
  assert.equal(pesRow('shield').button, null);
  for (const buttons of [[], [PS_BUTTON.r2], [PS_BUTTON.l3], [PS_BUTTON.l2], [PS_BUTTON.r1]]) {
    assert.equal(press(buttons).shield, false, buttons.join(','));
    assert.equal(press(buttons, true).shield, false, buttons.join(','));
  }
});

test('pressure row: a hold gives one tackle and no hold-then-tap sequence', () => {
  const held = run([{ buttons: [PS_BUTTON.cross] }, { buttons: [PS_BUTTON.cross] },
    { buttons: [PS_BUTTON.cross] }, { buttons: [PS_BUTTON.cross] }], true);
  assert.equal(held[1].action, 'tackle');
  for (const frame of held.slice(2)) assert.equal(frame.action, undefined);
  // The hold does nothing with the ball.
  assert.equal(press([PS_BUTTON.cross], false).action, 'pass');
});

test('standing tackle row: a double tap gives two tackle edges', () => {
  const frames = run([{ buttons: [PS_BUTTON.cross] }, { buttons: [] }, { buttons: [PS_BUTTON.cross] }], true);
  assert.equal(frames[1].action, 'tackle');
  assert.equal(frames[2].action, undefined);
  assert.equal(frames[3].action, 'tackle');
});

test('slide row: ○ slides only without the ball', () => {
  assert.equal(pesRow('slide').button, PS_BUTTON.circle);
  assert.equal(press([PS_BUTTON.circle], true).action, 'slide');
  assert.equal(press([PS_BUTTON.circle], false).action, 'cross');
});

test('clearance row: □ charges a shot without the ball', () => {
  assert.equal(pesRow('clearance').button, PS_BUTTON.square);
  const charged = run(Array.from({ length: 20 }, () => ({ buttons: [PS_BUTTON.square] })).concat({ buttons: [] }), true);
  const clear = charged.at(-1)!;
  assert.equal(clear.action, 'shoot');
  assert.equal(clear.power > .15, true);
});

test('shoulder charge row: automatic, no button and no action', () => {
  assert.equal(pesRow('shoulderCharge').button, null);
  const frame = press([PS_BUTTON.l2, PS_BUTTON.r2, PS_BUTTON.l3], true);
  assert.equal(frame.action, undefined);
  assert.equal(frame.shield, false);
  assert.equal(frame.sprint, false);
});

test('camera row: the touchpad click is outside the standard mapping', () => {
  assert.equal(pesRow('camera').button, null);
  assert.deepEqual([...pesRow('camera').keys.p1], ['KeyC']);
  // OPTIONS only pauses; it plays no action.
  assert.equal(press([PS_BUTTON.options]).action, undefined);
  assert.equal(press([PS_BUTTON.options], true).action, undefined);
});

test('R3 keeps the keeper switch as an edge', () => {
  const frames = run([{ buttons: [PS_BUTTON.r3] }, { buttons: [PS_BUTTON.r3] }, { buttons: [] }]);
  assert.equal(frames[1].switchKeeper, true);
  assert.equal(frames[2].switchKeeper, false);
  assert.equal(frames[3].switchKeeper, false);
});

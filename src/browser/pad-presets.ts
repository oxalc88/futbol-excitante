// PES 2017 PS4 button preset ("Tipo de botón 1", DualShock 4).
// Rows come from pes2017-ps4-controls.md:
// 5 rows marked "existe-igual" (identical), 12 marked "existe-distinto" (remapped)
// and 1 row marked "falta" (missing): pressure.
// The preset is the default pad and keyboard mapping of the game.

import type { ActionKind } from '../contracts/types';

export type PadContext = 'attack' | 'defense' | 'system' | 'keeper';
/** identical: FE has the same control. remapped: FE has another button. missing: FE has no control. */
export type PadState = 'identical' | 'remapped' | 'missing';

/** PS glyph labels of the preset. */
export const PS_GLYPHS = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'OPTIONS', 'TOUCHPAD'] as const;
export type PsGlyph = (typeof PS_GLYPHS)[number];

/** Gamepad standard-mapping button indices (W3C). Chrome exposes the DS4 touchpad as button 17. */
export const PS_BUTTON = {
  cross: 0, circle: 1, square: 2, triangle: 3,
  l1: 4, r1: 5, l2: 6, r2: 7, options: 9, l3: 10, r3: 11, touchpad: 17,
} as const;

/** Glyph label for each standard button index used here. */
export const PS_GLYPH_BY_BUTTON: Readonly<Record<number, PsGlyph>> = {
  0: '✕', 1: '○', 2: '□', 3: '△', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 9: 'OPTIONS', 10: 'L3', 11: 'R3', 17: 'TOUCHPAD',
};

/** Two tackle edges at most this many ticks apart play the standing tackle (✕ x2).
 * One edge, a hold or a slower pair gives no action: pressure is a missing mechanic (phase 2). */
export const TACKLE_TAP_TICKS = 15;

/** KeyboardEvent.code list per player. For movement: up, down, left, right. */
export interface PadKeys { p1: readonly string[]; p2: readonly string[] }

export interface PadPresetRow {
  /** FE action id. */
  id: string;
  state: PadState;
  context: PadContext;
  /** PES 2017 table row. */
  pes: string;
  /** PES button text, e.g. "✕" or "R1 + left stick". */
  text: string;
  glyphs: readonly PsGlyph[];
  /** Standard-mapping button index, or null when the row has no button. */
  button: number | null;
  keys: PadKeys;
  /** Rows in the same context that use the same button. The PES table says so. */
  shares: readonly string[];
  axis?: 'left';
  note?: string;
}

export const PES_2017_PS4_ROWS: readonly PadPresetRow[] = [
  // 5 identical rows.
  { id: 'move', state: 'identical', context: 'attack', pes: 'Move player', text: 'Left stick', glyphs: [], button: null,
    keys: { p1: ['KeyW', 'KeyS', 'KeyA', 'KeyD'], p2: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] },
    shares: [], axis: 'left', note: 'Left stick. Same as FE.' },
  { id: 'pass', state: 'identical', context: 'attack', pes: 'Short pass', text: '✕', glyphs: ['✕'], button: PS_BUTTON.cross,
    keys: { p1: ['KeyJ'], p2: ['Numpad1'] }, shares: ['header'], note: 'Same as FE. While defending, ✕ is the tackle.' },
  { id: 'through', state: 'identical', context: 'attack', pes: 'Through ball', text: '△', glyphs: ['△'], button: PS_BUTTON.triangle,
    keys: { p1: ['KeyL'], p2: ['Numpad3'] }, shares: ['header'], note: 'Same as FE. No action while defending.' },
  { id: 'switchPlayer', state: 'identical', context: 'defense', pes: 'Switch player', text: 'L1', glyphs: ['L1'], button: PS_BUTTON.l1,
    keys: { p1: ['KeyQ'], p2: ['Enter'] }, shares: [], note: 'Same as FE. L1 + ○ is the lob.' },
  { id: 'pause', state: 'identical', context: 'system', pes: 'Pause', text: 'OPTIONS', glyphs: ['OPTIONS'], button: PS_BUTTON.options,
    keys: { p1: ['Escape', 'KeyP'], p2: ['Escape', 'KeyP'] }, shares: [], note: 'Same as FE.' },
  // 12 remapped rows.
  { id: 'cross', state: 'remapped', context: 'attack', pes: 'High pass / cross', text: '○', glyphs: ['○'], button: PS_BUTTON.circle,
    keys: { p1: ['KeyI'], p2: ['Numpad5'] }, shares: ['switchPlay', 'crossHigh', 'header'], note: 'FE uses □ for cross.' },
  { id: 'switchPlay', state: 'remapped', context: 'attack', pes: 'Switch play', text: 'Left stick to other wing + ○', glyphs: ['○'],
    button: PS_BUTTON.circle, keys: { p1: ['KeyI'], p2: ['Numpad5'] }, shares: ['cross', 'crossHigh'],
    note: 'Same ○ button with a direction. FE uses a directed lob (L1 + ✕).' },
  { id: 'crossHigh', state: 'remapped', context: 'attack', pes: 'High cross in wing', text: '○', glyphs: ['○'], button: PS_BUTTON.circle,
    keys: { p1: ['KeyI'], p2: ['Numpad5'] }, shares: ['cross', 'switchPlay'], note: 'Same ○ button in the wing. FE uses □ for cross.' },
  { id: 'shot', state: 'remapped', context: 'attack', pes: 'Shot', text: '□ hold', glyphs: ['□'], button: PS_BUTTON.square,
    keys: { p1: ['KeyK'], p2: ['Numpad2'] }, shares: ['header'], note: 'Hold to charge, release to shoot. FE uses ○ for shot.' },
  { id: 'header', state: 'remapped', context: 'attack', pes: 'Header', text: '□ or pass at head height', glyphs: ['□'],
    button: PS_BUTTON.square, keys: { p1: ['KeyK'], p2: ['Numpad2'] },
    shares: ['shot', 'pass', 'through', 'cross'],
    note: 'There is no separate header button. Use □ or a pass button when the ball is at head height. Shares □ with shot and pass buttons with pass rows.' },
  { id: 'sprint', state: 'remapped', context: 'attack', pes: 'Sprint', text: 'R1 + left stick', glyphs: ['R1'], button: PS_BUTTON.r1,
    keys: { p1: ['ShiftLeft'], p2: ['ShiftRight'] }, shares: [], note: 'R1 sprints in both contexts. FE uses L2 for sprint.' },
  { id: 'shield', state: 'remapped', context: 'attack', pes: 'Shield ball', text: 'Automatic', glyphs: [], button: null,
    keys: { p1: [], p2: [] }, shares: [], note: 'Automatic on contact. No button, no glyph and no key. FE uses L3.' },
  { id: 'standingTackle', state: 'remapped', context: 'defense', pes: 'Standing tackle', text: '✕ ×2', glyphs: ['✕'],
    button: PS_BUTTON.cross, keys: { p1: ['KeyU'], p2: ['Numpad0'] }, shares: ['pressure'],
    note: 'Two ✕ edges within 15 ticks. A single tap or a hold gives no action. FE uses R1 for tackle.' },
  { id: 'slide', state: 'remapped', context: 'defense', pes: 'Slide tackle', text: '○ (defending)', glyphs: ['○'],
    button: PS_BUTTON.circle, keys: { p1: ['KeyB'], p2: ['Numpad7'] }, shares: [], note: 'FE uses L2 + R1 for slide.' },
  { id: 'clearance', state: 'remapped', context: 'defense', pes: 'Clearance (no ball: shot)', text: '□', glyphs: ['□'],
    button: PS_BUTTON.square, keys: { p1: ['KeyK'], p2: ['Numpad2'] }, shares: [], note: 'Hold to charge. FE uses ○ for the clearance shot.' },
  { id: 'shoulderCharge', state: 'remapped', context: 'defense', pes: 'Shoulder charge', text: 'Automatic', glyphs: [], button: null,
    keys: { p1: [], p2: [] }, shares: [], note: 'Automatic while running into a rival. No button.' },
  { id: 'camera', state: 'remapped', context: 'system', pes: 'Change camera (fixed camera)', text: 'Touchpad click', glyphs: ['TOUCHPAD'],
    button: PS_BUTTON.touchpad, keys: { p1: ['KeyC'], p2: ['KeyC'] }, shares: [],
    note: 'Touchpad click on standard-mapping button 17. FE keeps key C.' },
  // 1 missing row.
  { id: 'pressure', state: 'missing', context: 'defense', pes: 'Pressure', text: '✕ hold', glyphs: ['✕'], button: PS_BUTTON.cross,
    keys: { p1: ['KeyU'], p2: ['Numpad0'] }, shares: ['standingTackle'],
    note: 'Hold ✕. Separate gesture from the tackle double tap. Pressure is a missing mechanic (phase 2), so a hold gives no action.' },
  // 10 keeper rows (PES table: "Arquero", plus the foul-dive chord row).
  { id: 'keeperRush', state: 'missing', context: 'keeper', pes: 'Keeper rush out', text: 'Hold △', glyphs: ['△'], button: PS_BUTTON.triangle,
    keys: { p1: ['KeyL'], p2: ['Numpad3'] }, shares: ['keeperThrowSpace'],
    note: 'Without the ball. The keeper leaves the goal radius while the key is held. R1 + △ is the sprint rush. C10 control.' },
  { id: 'keeperRushSprint', state: 'missing', context: 'keeper', pes: 'Keeper rush out in sprint', text: 'R1 + hold △', glyphs: ['R1'], button: PS_BUTTON.r1,
    keys: { p1: ['ShiftLeft'], p2: ['ShiftRight'] }, shares: ['keeperDropPick'],
    note: 'Sprint rush: 1.25x goalkeeper speed while △ is held. Keyboard: hold Shift + L / Num 3.' },
  { id: 'keeperHandThrow', state: 'missing', context: 'keeper', pes: 'Hand throw', text: '✕', glyphs: ['✕'], button: PS_BUTTON.cross,
    keys: { p1: ['KeyJ'], p2: ['Numpad1'] }, shares: ['keeperFeint'],
    note: 'With the ball in the hands: low hand throw. Keyboard: J / Num 1.' },
  { id: 'keeperThrowSpace', state: 'missing', context: 'keeper', pes: 'Hand throw into space', text: '△', glyphs: ['△'], button: PS_BUTTON.triangle,
    keys: { p1: ['KeyL'], p2: ['Numpad3'] }, shares: ['keeperRush'],
    note: 'With the ball in the hands: hand throw ahead of the best receiver. Keyboard: L / Num 3.' },
  { id: 'keeperPunt', state: 'missing', context: 'keeper', pes: 'Volley punt', text: '○ hold', glyphs: ['○'], button: PS_BUTTON.circle,
    keys: { p1: ['KeyI'], p2: ['Numpad5'] }, shares: ['keeperHighPunt'],
    note: 'With the ball in the hands: hold to charge power, release to volley with the foot. Keyboard: hold I / Num 5.' },
  { id: 'keeperHighPunt', state: 'missing', context: 'keeper', pes: 'High volley punt', text: 'R2 + ○ hold', glyphs: ['○'], button: PS_BUTTON.circle,
    keys: { p1: ['KeyG'], p2: ['Numpad6'] }, shares: ['keeperPunt'],
    note: 'R2 raises the punt: higher apex and longer flight. Keyboard: hold G / Num 6 + hold I / Num 5.' },
  { id: 'keeperDropPick', state: 'missing', context: 'keeper', pes: 'Put down / pick up the ball', text: 'R1 + left stick released', glyphs: ['R1'], button: PS_BUTTON.r1,
    keys: { p1: ['ShiftLeft'], p2: ['ShiftRight'] }, shares: ['keeperRushSprint'],
    note: 'While holding: put the ball down at the feet. Without the ball and inside the own box: pick it up. Keyboard: Shift with the movement keys released.' },
  { id: 'keeperRun', state: 'missing', context: 'keeper', pes: 'Run with the ball', text: 'Left stick (+ R1 sprint)', glyphs: [], button: null,
    keys: { p1: ['KeyW', 'KeyS', 'KeyA', 'KeyD'], p2: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] },
    shares: [], axis: 'left', note: 'With the ball in the hands: goalkeeper speed inside the own penalty area. R1 sprints at 1.25x.' },
  { id: 'keeperFeint', state: 'missing', context: 'keeper', pes: 'Keeper pass feint', text: '✕ before release', glyphs: ['✕'], button: PS_BUTTON.cross,
    keys: { p1: ['KeyJ'], p2: ['Numpad1'] }, shares: ['keeperHandThrow'],
    note: 'While a throw or kick charge is held, press ✕ before the release: no ball leaves the hands. Keyboard: J / Num 1.' },
  // Foul dive chord (PES table row "Simular falta", decided without R2).
  { id: 'simulateDive', state: 'missing', context: 'attack', pes: 'Simulate foul (dive)', text: 'L1 + L2 + L3 + R3 (no R2)', glyphs: ['L3'], button: PS_BUTTON.l3,
    keys: { p1: ['KeyF'], p2: ['Numpad4'] }, shares: [],
    note: 'All four held in the same sample, R2 not held: the selected player falls. No foul and no card. Keyboard: F / Num 4.' },
];

export interface PadPreset { name: string; source: string; rows: readonly PadPresetRow[] }

export const PES_2017_PS4_PRESET: PadPreset = {
  name: 'PES 2017 PS4 (Tipo de botón 1)',
  source: 'pes2017-ps4-controls.md',
  rows: PES_2017_PS4_ROWS,
};

export function pesRows(state: PadState): readonly PadPresetRow[] {
  return PES_2017_PS4_ROWS.filter((row) => row.state === state);
}

export function pesRow(id: string): PadPresetRow {
  const row = PES_2017_PS4_ROWS.find((item) => item.id === id);
  if (!row) throw new Error(`unknown preset row: ${id}`);
  return row;
}

/** Standard button index of a row. Fails when the row has no button. */
export function pesButton(id: string): number {
  const button = pesRow(id).button;
  if (button === null) throw new Error(`preset row has no button: ${id}`);
  return button;
}

/** Actions that the header row replaces when the aerial context is on. */
export const HEADER_ACTIONS: readonly ActionKind[] = ['pass', 'through', 'cross', 'lob', 'shoot'];

/** Header row: with the ball at head height, □ or a pass button heads the ball.
 * `aerial` is the context that the match shell computes from the ball and the
 * selected player of each team. */
export function pesHeader(action: ActionKind, aerial: boolean): ActionKind {
  return aerial && HEADER_ACTIONS.includes(action) ? 'header' : action;
}

/** Engine action role of one keyboard code. Derived from the preset rows. */
export interface KeyRole {
  /** Action while the team has the ball. */
  attack?: ActionKind;
  /** Action while the team has no ball. */
  defense?: ActionKind;
  /** Hold to charge power. Release fires the action. */
  charge?: boolean;
  /** Hold to sprint. */
  sprint?: boolean;
  /** Press edge changes the controlled player. */
  switchPlayer?: boolean;
  /** Held by the keeper cursor without the ball: run out to the ball. */
  keeperRush?: boolean;
  /** Held by the keeper cursor with the ball: charge the volley punt. */
  keeperKick?: boolean;
  /** Held with the kick key: raise the volley punt to the high punt. */
  keeperHigh?: boolean;
  /** Press edge: the selected player falls (foul dive). */
  simulateDive?: boolean;
}

/** Engine action role of each row. Rows without a role need no key action. */
const KEY_ROLE: Readonly<Record<string, Pick<KeyRole, 'attack' | 'defense' | 'sprint' | 'switchPlayer' | 'keeperRush' | 'keeperKick' | 'keeperHigh' | 'simulateDive'>>> = {
  pass: { attack: 'pass' },
  through: { attack: 'through' },
  cross: { attack: 'cross' },
  switchPlay: { attack: 'cross' },
  crossHigh: { attack: 'cross' },
  shot: { attack: 'shoot' },
  header: { attack: 'shoot' },
  sprint: { sprint: true },
  switchPlayer: { switchPlayer: true },
  pressure: { defense: 'tackle' },
  standingTackle: { defense: 'tackle' },
  slide: { defense: 'slide' },
  clearance: { defense: 'shoot' },
  keeperRush: { keeperRush: true },
  keeperPunt: { keeperKick: true },
  keeperHighPunt: { keeperHigh: true },
  simulateDive: { simulateDive: true },
};

function keyboardRoles(player: 'p1' | 'p2'): Record<string, KeyRole> {
  const out: Record<string, KeyRole> = {};
  for (const row of PES_2017_PS4_ROWS) {
    const role = KEY_ROLE[row.id];
    if (!role) continue;
    for (const code of row.keys[player]) {
      const merged: KeyRole = { ...out[code], ...role };
      if (merged.attack === 'shoot' || merged.defense === 'shoot') merged.charge = true;
      out[code] = merged;
    }
  }
  return out;
}

/** KeyboardEvent.code roles per player, derived from the preset rows.
 * L1 (switch key) plus ○ (cross key) plays the lob. The keeper rows add the
 * run-out key (△), the punt charge (○ with the high modifier G) and the foul-dive key. */
export const KEYBOARD_MAP: Record<'p1' | 'p2', Readonly<Record<string, KeyRole>>> = {
  p1: keyboardRoles('p1'),
  p2: keyboardRoles('p2'),
};

function keyboardMove(player: 'p1' | 'p2'): readonly [string, string, string, string] {
  const keys = pesRow('move').keys[player];
  if (keys.length !== 4) throw new Error('move row needs 4 keys');
  return [keys[0], keys[1], keys[2], keys[3]];
}

/** Movement codes per player: up, down, left, right. */
export const KEYBOARD_MOVE: Record<'p1' | 'p2', readonly [string, string, string, string]> = {
  p1: keyboardMove('p1'),
  p2: keyboardMove('p2'),
};

export interface PadConflict { context: PadContext; key: number | string; ids: readonly string[] }

/** Same context + same button, without a PES share. */
export function buttonConflicts(rows: readonly PadPresetRow[] = PES_2017_PS4_ROWS): PadConflict[] {
  return conflicts(rows, (row) => (row.button === null ? [] : [row.button]));
}

/** Same context + same keyboard key, without a PES share. One run per player. */
export function keyboardConflicts(rows: readonly PadPresetRow[] = PES_2017_PS4_ROWS): PadConflict[] {
  const out: PadConflict[] = [];
  for (const player of ['p1', 'p2'] as const) {
    const runs = conflicts(rows, (row) => [...row.keys[player]]);
    for (const run of runs) out.push({ ...run, key: `${player}:${run.key}` });
  }
  return out;
}

function conflicts(rows: readonly PadPresetRow[], keysOf: (row: PadPresetRow) => readonly (number | string)[]): PadConflict[] {
  const groups = new Map<string, PadPresetRow[]>();
  for (const row of rows) {
    for (const key of keysOf(row)) {
      const id = `${row.context}::${key}`;
      const group = groups.get(id) ?? [];
      if (!group.includes(row)) groups.set(id, [...group, row]);
    }
  }
  const out: PadConflict[] = [];
  for (const [id, group] of groups) {
    if (group.length < 2) continue;
    const clean = group.every((row) => group.every((other) => row === other || row.shares.includes(other.id)));
    if (!clean) {
      const [context, key] = id.split('::');
      out.push({ context: context as PadContext, key: Number.isNaN(Number(key)) ? key : Number(key), ids: group.map((row) => row.id) });
    }
  }
  return out;
}

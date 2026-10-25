// On-screen PS-style touch pad. Pure logic with no DOM code.
// The pad writes one virtual gamepad reading. ControllerMapper reads it,
// so all context rules and combo rules stay in the mapper.

import { PS_BUTTON } from '../browser/pad-presets';
import type { PadReading } from './controller';

export type TouchButton = 'cross'|'circle'|'square'|'triangle'|'r1'|'r2'|'l1';

export const TOUCH_BUTTONS: readonly TouchButton[] = ['cross','circle','square','triangle','r1','r2','l1'];

/** Standard button index of each touch button, from the PS preset. */
export const TOUCH_BUTTON_INDEX: Record<TouchButton, number> = {
  cross: PS_BUTTON.cross, circle: PS_BUTTON.circle, square: PS_BUTTON.square, triangle: PS_BUTTON.triangle,
  l1: PS_BUTTON.l1, r1: PS_BUTTON.r1, r2: PS_BUTTON.r2,
};

/** Pixels of finger travel that give full stick deflection. */
export const STICK_RADIUS = 56;
/** Stick length under this value reads as no move. */
export const STICK_DEAD = .12;

/** Game state that picks one label row of the touch buttons. */
export interface TouchContext { defending: boolean; aerial: boolean; keeper: boolean; hold: boolean }

/** Label row of the four kick buttons. The hold row wins over every other row. */
export function touchLabels(c: TouchContext): Record<'cross'|'circle'|'square'|'triangle', string> {
  if (c.hold) return { cross: 'Mano', circle: 'Volea', square: 'Patear', triangle: 'Al espacio' };
  if (c.aerial) return { cross: 'Cabeza', circle: 'Cabeza', square: 'Cabeza', triangle: 'Cabeza' };
  if (c.defending && c.keeper) return { cross: 'Lanzarse', circle: 'Barrida', square: 'Despeje', triangle: 'Salir' };
  if (c.defending) return { cross: 'Entrada', circle: 'Barrida', square: 'Despeje', triangle: 'Presión' };
  return { cross: 'Pase', circle: 'Centro', square: 'Tiro', triangle: 'Filtrado' };
}

/** Touch button of each standard button index, or undefined when no touch button uses it. */
const TOUCH_BY_INDEX: Readonly<Partial<Record<number, TouchButton>>> = (() => {
  const map: Partial<Record<number, TouchButton>> = {};
  for (const b of TOUCH_BUTTONS) map[TOUCH_BUTTON_INDEX[b]] = b;
  return map;
})();

/** Virtual pad state: one stick and a set of buttons per pointer id.
 * A pointer holds every button it has pressed until the lift. */
export class TouchPad {
  private stickId = -1;
  private ox = 0;
  private oy = 0;
  private ax = 0;
  private ay = 0;
  private buttons = new Map<number, Set<TouchButton>>();

  /** Starts the stick at the origin for the first pointer only. */
  stickDown(id: number, x: number, y: number): boolean {
    if (this.stickId !== -1) return false;
    this.stickId = id; this.ox = x; this.oy = y; this.ax = 0; this.ay = 0;
    return true;
  }

  /** Moves the stick of its own pointer. The length never passes one. */
  stickMove(id: number, x: number, y: number) {
    if (id !== this.stickId) return;
    let dx = (x - this.ox) / STICK_RADIUS;
    let dy = (y - this.oy) / STICK_RADIUS;
    const len = Math.hypot(dx, dy);
    if (len < STICK_DEAD) { this.ax = 0; this.ay = 0; return; }
    if (len > 1) { dx /= len; dy /= len; }
    this.ax = dx; this.ay = dy;
  }

  /** Lifts the stick of its own pointer and sets the axes to zero. */
  stickUp(id: number) {
    if (id !== this.stickId) return;
    this.stickId = -1; this.ax = 0; this.ay = 0;
  }

  /** Stick state: active flag, last origin and current axes. */
  get stick(): { active: boolean; origin: { x: number; y: number }; x: number; y: number } {
    return { active: this.stickId !== -1, origin: { x: this.ox, y: this.oy }, x: this.ax, y: this.ay };
  }

  /** Pointer `id` now holds `b`. A slide over another button adds it. */
  press(id: number, b: TouchButton) {
    let set = this.buttons.get(id);
    if (!set) { set = new Set(); this.buttons.set(id, set); }
    set.add(b);
  }

  /** Lift of pointer `id` anywhere: drop its buttons and its stick. */
  release(id: number) {
    this.buttons.delete(id);
    this.stickUp(id);
  }

  /** True when any pointer holds `b`. */
  held(b: TouchButton): boolean {
    for (const set of this.buttons.values()) if (set.has(b)) return true;
    return false;
  }

  /** Drops all pointers, the stick and the axes. */
  clear() {
    this.buttons.clear(); this.stickId = -1; this.ox = 0; this.oy = 0; this.ax = 0; this.ay = 0;
  }

  /** Standard-mapping reading that ControllerMapper consumes. */
  reading(connected: boolean): PadReading {
    const buttons: { pressed: boolean }[] = [];
    for (let i = 0; i < 17; i++) {
      const b = TOUCH_BY_INDEX[i];
      buttons.push({ pressed: b !== undefined && this.held(b) });
    }
    return { index: 99, id: 'touch-pad', mapping: 'standard', connected, axes: [this.ax, this.ay, 0, 0], buttons };
  }
}

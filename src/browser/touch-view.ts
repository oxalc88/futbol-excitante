// DOM of the on-screen PS-style touch pad. Pointer Events only: no pointer
// capture, so every synthetic event works. Visibility never depends on the
// window size: a coarse pointer or a touch press shows the pad, a key press or
// a physical pad hides it. The view only forwards to the TouchPad adapter.

import { STICK_RADIUS, touchLabels, type TouchButton } from '../adapters/touch-pad';
import type { BrowserInput } from '../adapters/input';

/** The four kick buttons: their context action changes with the game. */
const FACE = ['cross', 'circle', 'square', 'triangle'] as const;
const GLYPH: Record<(typeof FACE)[number], string> = { cross: '✕', circle: '○', square: '□', triangle: '△' };

const faceButtons = FACE.map(name =>
  `<button type="button" class="tp-btn tp-${name}" data-touch="${name}" aria-label="Botón ${GLYPH[name]}"><b class="tp-glyph">${GLYPH[name]}</b></button>`).join('');

const shoulder = (name: TouchButton, body: string, aria: string) =>
  `<button type="button" class="tp-btn tp-${name}" data-touch="${name}" aria-label="${aria}">${body}</button>`;

const markup = `<div id="touch-pad" hidden>
<div class="tp-zone" data-zone="stick"></div>
<div class="tp-stick" hidden><span class="tp-knob"></span></div>
${faceButtons}
${shoulder('r1', '<b>R1</b>', 'Correr')}
${shoulder('r2', '<b>R2</b>', 'R2, con L1: portero')}
${shoulder('l1', '<b>L1</b>', 'Cambiar')}
${shoulder('l2', '<b>L2</b>', 'L2: tira el 2º lanzador')}
</div>
<div id="rotate-notice" hidden>Gira el teléfono para jugar en horizontal.</div>`;

/** Builds the touch pad inside `root` and returns the per-HUD-refresh update. */
export function mountTouchPad(root: HTMLElement, input: BrowserInput): { update(): void; setSuspended(on:boolean):void } {
  root.insertAdjacentHTML('beforeend', markup);
  const pad = root.querySelector<HTMLElement>('#touch-pad')!;
  const stick = root.querySelector<HTMLElement>('.tp-stick')!;
  const knob = root.querySelector<HTMLElement>('.tp-knob')!;
  const rotate = root.querySelector<HTMLElement>('#rotate-notice')!;
  const buttons = Array.from(pad.querySelectorAll<HTMLElement>('[data-touch]'));
  const nameOf = (el: HTMLElement): TouchButton => el.dataset.touch as TouchButton;
  // Pointers that already hold a button: only they can slide onto another one.
  const buttonPointers = new Set<number>();
  let active = false;
  let suspended = false;

  const refresh = () => { for (const el of buttons) el.classList.toggle('on', input.touch.held(nameOf(el))); };
  const showStick = (x: number, y: number) => {
    // The stick is positioned inside #touch-pad, so the point shifts to its box.
    const box = pad.getBoundingClientRect();
    stick.hidden = false; stick.style.left = `${x - box.left}px`; stick.style.top = `${y - box.top}px`; knob.style.transform = '';
  };
  const hideStick = () => { stick.hidden = true; knob.style.transform = ''; };
  const moveKnob = () => {
    const s = input.touch.stick;
    knob.style.transform = `translate(${s.x * STICK_RADIUS}px,${s.y * STICK_RADIUS}px)`;
  };
  const setActive = (on: boolean) => {
    if (on === active) return;
    active = on;
    input.setTouchActive(on);
    document.body.classList.toggle('touch-on', on);
    pad.hidden = !on || suspended;
    if (!on) { buttonPointers.clear(); hideStick(); refresh(); }
  };
  const buttonAt = (x: number, y: number): HTMLElement | null => {
    const over = document.elementFromPoint(x, y);
    const found = over?.closest?.('[data-touch]') as HTMLElement | null;
    return found && pad.contains(found) ? found : null;
  };

  pad.addEventListener('pointerdown', e => {
    e.preventDefault();
    const target = e.target as Element | null;
    const button = target?.closest?.('[data-touch]') as HTMLElement | null;
    if (button && pad.contains(button)) {
      input.touch.press(e.pointerId, nameOf(button));
      buttonPointers.add(e.pointerId);
      refresh();
      return;
    }
    if (target?.closest?.('[data-zone="stick"]') && input.touch.stickDown(e.pointerId, e.clientX, e.clientY)) {
      showStick(e.clientX, e.clientY);
    }
  });

  window.addEventListener('pointermove', e => {
    input.touch.stickMove(e.pointerId, e.clientX, e.clientY);
    if (input.touch.stick.active) moveKnob();
    // A finger that holds buttons slides onto another one: the press adds.
    if (!buttonPointers.has(e.pointerId)) return;
    const button = buttonAt(e.clientX, e.clientY);
    if (button) { input.touch.press(e.pointerId, nameOf(button)); refresh(); }
  });

  const end = (e: PointerEvent) => {
    input.touch.release(e.pointerId);
    buttonPointers.delete(e.pointerId);
    if (!input.touch.stick.active) hideStick();
    refresh();
  };
  // A cancelled pointer drops its buttons without a release action: a charged
  // □ or ○ never fires on a system cancel.
  const cancel = (e: PointerEvent) => {
    input.touch.cancel(e.pointerId);
    buttonPointers.delete(e.pointerId);
    if (!input.touch.stick.active) hideStick();
    refresh();
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', cancel);

  pad.addEventListener('contextmenu', e => e.preventDefault());
  pad.addEventListener('selectstart', e => e.preventDefault());

  window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') setActive(true); });
  window.addEventListener('keydown', () => setActive(false));
  window.addEventListener('gamepadconnected', () => setActive(false));
  if (window.matchMedia?.('(pointer: coarse)').matches) setActive(true);

  return {
    setSuspended(on:boolean) {
      if(on&&!suspended){input.touch.clear();buttonPointers.clear();hideStick();refresh();}
      suspended=on;pad.hidden=!active||suspended;
    },
    update() {
      // A pressed physical button hands the screen back to the real pad.
      if (input.gamepads.some(p => p.buttons.some(b => b.pressed))) setActive(false);
      const labels = touchLabels(input.context(0));
      for (const name of FACE) {
        const button = pad.querySelector<HTMLElement>(`.tp-${name}`)!;
        button.dataset.action = labels[name];
        button.setAttribute('aria-label', `Botón ${GLYPH[name]}: ${labels[name]}`);
      }
      // L2 shows only while the own waiting free kick of slot 0 waits: that is
      // the one touch state where L2 gives the kick to the second taker.
      const sp = input.setPieceOf(0);
      pad.querySelector<HTMLElement>('.tp-l2')!.hidden = !(sp?.attacking && sp.kind === 'free-kick');
      rotate.hidden = !(active && window.innerHeight > window.innerWidth);
    },
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../eval/scenarios';
import { Simulation } from '../src/simulation/engine';
import type { InputFrame, World } from '../src/contracts/types';
import { C7_TARGETS, measureC7Movement } from '../scripts/measure-c7-movement';

// C7 part 3 movement timing against the resumen_final.md criteria (tanda 5 ignored):
// time_to_top_speed ~384 ms (300-434), turn180 ~500 ms (434-534).
test('C7 movement: sprint ramp and 180-degree turn land inside the resumen_final.md ranges', () => {
  const [top, turn] = measureC7Movement();
  assert.deepEqual(measureC7Movement(), [top, turn], 'measurements must be deterministic');
  for (const sample of [top, turn]) {
    assert.equal(sample.status, 'WITHIN', `${sample.metric}: ${sample.value_ms.toFixed(1)} ms outside ${sample.range_ms.join('..')} ms`);
    assert.ok(sample.value_ms >= sample.range_ms[0] && sample.value_ms <= sample.range_ms[1]);
    assert.equal(sample.target_ms, C7_TARGETS[sample.metric].target_ms);
    assert.ok(Number.isFinite(sample.value_ms) && sample.value_ms > 0);
    assert.ok(sample.end_tick > sample.start_tick);
    assert.equal(sample.value_ms, (sample.end_tick - sample.start_tick) * 1000 / 60);
  }
  console.log(`C7 movement: time_to_top_speed ${top.value_ms.toFixed(1)} ms, turn180 ${turn.value_ms.toFixed(1)} ms, both WITHIN`);
});

// Independent small implementation: raw trace, centered 5-sample mean, zero-crossing pivot,
// fixed 0.13-0.4 s windows and 90% thresholds. It shares no helper with the script.
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const smooth5 = (v: readonly number[], i: number) => mean(v.slice(Math.max(0, i - 2), Math.min(v.length, i + 3)));
const dot = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.x + a.y * b.y;
const from = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k);

function rawTrace(id: string, ticks: number) {
  const s = createScenario(id, 2017);
  const sim = new Simulation(s.initial.config, s.initial.teams);
  sim.restore(s.initial);
  const frames: World[] = [sim.snapshot()];
  for (let i = 0; i < ticks; i++) { sim.applyInputs(s.input(sim.tick)); sim.step(); frames.push(sim.snapshot()); }
  const move = (tick: number): { x: number; y: number } => s.input(tick).find((f: InputFrame) => f.tick === tick && f.slot === 0)!.move;
  const focal = (w: World) => w.players.find(p => p.id === s.focal)!;
  return { frames, first: frames[0].tick, move, vx: frames.map(f => focal(f).vx), vy: frames.map(f => focal(f).vy) };
}

function independentTopSpeed() {
  const { frames, first, vx, vy } = rawTrace('LOC-ACC-001', 180);
  const speed = vx.map((x, i) => Math.hypot(x, vy[i]));
  const smooth = speed.map((_, i) => smooth5(speed, i));
  let start = -1;
  for (let i = 0; i < speed.length; i++) if (speed[i] < 0.05) start = i;
  assert.ok(start >= 0, 'no tick at rest');
  const last = Math.min(frames.length - 1, start + 90); // 1.5 s window
  let max = -Infinity;
  for (let i = start; i <= last; i++) max = Math.max(max, smooth[i]);
  let end = -1;
  for (let i = start; i <= last; i++) if (smooth[i] >= 0.9 * max) { end = i; break; }
  assert.ok(end > start, 'no tick at 90% of max speed');
  return { startTick: first + start, endTick: first + end };
}

function independentTurn180() {
  const { frames, first, move, vx, vy } = rawTrace('LOC-REV-001', 180);
  const svx = vx.map((_, i) => smooth5(vx, i)), svy = vy.map((_, i) => smooth5(vy, i));
  const oldDir = move(first - 1);
  const reversalTick = frames.map(f => f.tick).find(t => dot(move(t - 1), oldDir) < 0);
  assert.ok(reversalTick !== undefined, 'input reversal not observed');
  const newDir = move(reversalTick);
  const projIn = (i: number) => svx[i] * oldDir.x + svy[i] * oldDir.y;
  const projOut = (i: number) => svx[i] * newDir.x + svy[i] * newDir.y;
  const pivot = svx.findIndex((_, i) => projIn(i) <= 0); // zero crossing: physical turning point
  assert.ok(pivot >= 24 && pivot + 90 < frames.length, 'run too short for the pivot windows');
  const vIn = mean(from(pivot - 24, pivot - 8).map(projIn)); // 0.4-0.13 s before the pivot
  const vOut = mean(from(pivot + 8, pivot + 24).map(projOut)); // 0.13-0.4 s after the pivot
  assert.ok(vIn > 0 && vOut > 0, 'projected reference speed not observed');
  const last = Math.min(frames.length - 1, pivot + 90);
  let start = -1;
  for (let i = Math.max(0, pivot - 90); i <= last; i++) if (projIn(i) >= 0.9 * vIn) start = i;
  assert.ok(start >= 0, 'entry tick at 90% of v_in not observed');
  let end = -1;
  for (let i = start; i <= last; i++) if (projOut(i) >= 0.9 * vOut) { end = i; break; }
  assert.ok(end > start, 'exit tick at 90% of v_out not observed');
  return { startTick: first + start, endTick: first + end };
}

test('C7 movement: an independent re-implementation finds the same start and end ticks', () => {
  const [top, turn] = measureC7Movement();
  assert.deepEqual(independentTopSpeed(), { startTick: top.start_tick, endTick: top.end_tick });
  assert.deepEqual(independentTurn180(), { startTick: turn.start_tick, endTick: turn.end_tick });
  console.log(`C7 movement ticks: time_to_top_speed ${top.start_tick}..${top.end_tick}, turn180 ${turn.start_tick}..${turn.end_tick} (both implementations agree)`);
});

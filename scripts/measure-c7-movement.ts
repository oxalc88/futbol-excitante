// C7 part 3 movement timing (time_to_top_speed, turn180).
// Method and targets: resumen_final.md "Criterios" + "Principal"/"Corpus completo"
// (tanda 5 addendum ignored). These targets supersede the older pes-observed ranges
// used by scripts/measure-game-timing.ts (timing:compare).
// Deterministic: one human-controlled outfield player per fixture, public Simulation
// API only (restore / applyInputs / step / snapshot), fixtures LOC-ACC-001 / LOC-REV-001.
import { pathToFileURL } from 'node:url';
import { createScenario } from '../eval/scenarios';
import { Simulation } from '../src/simulation/engine';
import type { InputFrame, World } from '../src/contracts/types';

export type C7MetricId = 'time_to_top_speed' | 'turn180';
export type C7Sample = {
  metric: C7MetricId;
  value_ms: number;
  start_tick: number;
  end_tick: number;
  target_ms: number;
  range_ms: [number, number];
  status: 'WITHIN' | 'OUTSIDE';
  method: string;
};
export const C7_TARGETS: Record<C7MetricId, { target_ms: number; range_ms: [number, number] }> = {
  time_to_top_speed: { target_ms: 384, range_ms: [300, 434] },
  turn180: { target_ms: 500, range_ms: [434, 534] },
};
const REST_SPEED = .05; // ground speed below 0.05 m/s counts as "at rest"
const WINDOW_TICKS = 90; // 1.5 s at 60 Hz, the validated search window
const MEAN_FROM = 8; // 0.13 s
const MEAN_TO = 24; // 0.4 s

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const dot = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.x + a.y * b.y;
// Centered 5-sample mean with clamped edges (media centrada de 5 cuadros).
const smooth5 = (values: readonly number[], i: number) => mean(values.slice(Math.max(0, i - 2), Math.min(values.length, i + 3)));
const sample = (metric: C7MetricId, start_tick: number, end_tick: number, method: string): C7Sample => {
  const { target_ms, range_ms } = C7_TARGETS[metric];
  const value_ms = (end_tick - start_tick) * 1000 / 60;
  return { metric, value_ms, start_tick, end_tick, target_ms, range_ms, status: value_ms >= range_ms[0] && value_ms <= range_ms[1] ? 'WITHIN' : 'OUTSIDE', method };
};

// Fixtures are detached checkpoints. No production state, config or evaluator is modified.
function runMovement(id: string, ticks: number) {
  const s = createScenario(id, 2017);
  const sim = new Simulation(s.initial.config, s.initial.teams);
  sim.restore(s.initial);
  const trace: World[] = [sim.snapshot()];
  for (let i = 0; i < ticks; i++) { sim.applyInputs(s.input(sim.tick)); sim.step(); trace.push(sim.snapshot()); }
  const player = (w: World) => w.players.find(p => p.id === s.focal)!;
  return { s, trace, dt: s.initial.config.dt, vx: trace.map(w => player(w).vx), vy: trace.map(w => player(w).vy) };
}
const inputMove = (inputs: readonly InputFrame[], tick: number) => inputs.find(f => f.tick === tick && f.slot === 0)!.move;

/** LOC-ACC-001, seed 2017: standstill to full sprint. start = last tick at rest;
 *  max = max centered-5 mean ground speed in [start, start+1.5 s];
 *  end = first tick with centered-5 mean speed >= 90% of that max. */
export function measureTimeToTopSpeed(): C7Sample {
  const { s, trace, vx, vy } = runMovement('LOC-ACC-001', 180);
  const speed = vx.map((x, i) => Math.hypot(x, vy[i]));
  const smooth = speed.map((_, i) => smooth5(speed, i));
  const startIdx = speed.reduce((last, v, i) => v < REST_SPEED ? i : last, -1);
  if (startIdx < 0) throw new Error('c7 time_to_top_speed: no resting start tick');
  const firstTick = trace[0].tick;
  const windowEnd = trace.findIndex(w => w.tick > firstTick + startIdx + WINDOW_TICKS) - 1;
  const endIdx = windowEnd < 0 ? trace.length - 1 : windowEnd;
  const maxSpeed = Math.max(...smooth.slice(startIdx, endIdx + 1));
  const end = smooth.findIndex((v, i) => i >= startIdx && i <= endIdx && v >= .9 * maxSpeed);
  if (end < startIdx) throw new Error('c7 time_to_top_speed: 90% of max speed not observed inside the 1.5 s window');
  const startTick = trace[startIdx].tick, endTick = trace[end].tick;
  return sample('time_to_top_speed', startTick, endTick, 'LOC-ACC-001 seed 2017, sprint from rest; start = last tick at rest (speed < 0.05 m/s); end = first tick with centered-5 mean ground speed >= 90% of the max inside [start, start+1.5 s]');
}

/** LOC-REV-001, seed 2017: full sprint, input reverses 180 deg.
 *  Pivot = the physical turning point of the body path, not the input tick: the first recorded
 *  state where the centered-5 mean velocity projected on the old direction is <= 0.
 *  v_in / v_out = mean projected speed over the fixed 0.13-0.4 s windows before/after the pivot;
 *  start = last tick with projection on the old direction >= 90% of v_in;
 *  end = first tick with projection on the new direction >= 90% of v_out. */
export function measureTurn180(): C7Sample {
  const { s, trace, vx, vy } = runMovement('LOC-REV-001', 180);
  const svx = vx.map((_, i) => smooth5(vx, i)), svy = vy.map((_, i) => smooth5(vy, i));
  const firstTick = trace[0].tick, indexOf = (tick: number) => tick - firstTick;
  const reversalTick = trace.map(w => w.tick).find(t => dot(inputMove(s.input(t - 1), t - 1), inputMove(s.input(firstTick - 1), firstTick - 1)) < 0);
  if (reversalTick === undefined) throw new Error('c7 turn180: input reversal not observed');
  const oldDir = inputMove(s.input(firstTick - 1), firstTick - 1), newDir = inputMove(s.input(reversalTick), reversalTick);
  const projIn = (i: number) => svx[i] * oldDir.x + svy[i] * oldDir.y;
  const projOut = (i: number) => svx[i] * newDir.x + svy[i] * newDir.y;
  const pivotIdx = svx.findIndex((_, i) => projIn(i) <= 0); // velocity reversal: physical turning point
  if (pivotIdx < 0) throw new Error('c7 turn180: velocity reversal not observed');
  const p = pivotIdx;
  if (p - MEAN_TO < 0 || p + WINDOW_TICKS >= trace.length) throw new Error('c7 turn180: run too short for the pivot windows');
  const meanWindow = (project: (i: number) => number, from: number, to: number) => {
    if (from < 0 || to >= trace.length) throw new Error('c7 turn180: run too short for a 0.13-0.4 s window');
    return mean(Array.from({ length: to - from + 1 }, (_, k) => project(from + k)));
  };
  const v_in = meanWindow(projIn, p - MEAN_TO, p - MEAN_FROM); // 0.13-0.4 s before the pivot
  const v_out = meanWindow(projOut, p + MEAN_FROM, p + MEAN_TO); // 0.13-0.4 s after the pivot
  if (!(v_in > 0) || !(v_out > 0)) throw new Error('c7 turn180: projected reference velocity not observed');
  const startTick = (() => {
    let found = -1;
    for (let k = Math.max(0, p - WINDOW_TICKS); k <= Math.min(trace.length - 1, p + WINDOW_TICKS); k++) if (projIn(k) >= .9 * v_in) found = k;
    return found;
  })();
  const end = (() => {
    for (let k = startTick; k <= Math.min(trace.length - 1, p + WINDOW_TICKS); k++) if (projOut(k) >= .9 * v_out) return k;
    return -1;
  })();
  if (startTick < 0 || end <= startTick) throw new Error('c7 turn180: velocity thresholds not observed inside the 1.5 s window');
  return sample('turn180', trace[startTick].tick, trace[end].tick, `LOC-REV-001 seed 2017, sprint reversal; pivot = first zero crossing of the centered-5 mean velocity on the old direction; v_in/v_out = mean projected velocity over the fixed windows 0.13-0.4 s before/after the pivot`);
}
export function measureC7Movement(): [C7Sample, C7Sample] {
  return [measureTimeToTopSpeed(), measureTurn180()];
}
export function printC7(samples: readonly C7Sample[]) {
  console.table(samples.map(s => ({
    metric: s.metric,
    game_ms: Math.round(s.value_ms * 10) / 10,
    target_ms: s.target_ms,
    range_ms: `${s.range_ms[0]}..${s.range_ms[1]}`,
    ticks: s.end_tick - s.start_tick,
    status: s.status,
  })));
  for (const s of samples) console.log(`${s.metric}: ${s.value_ms.toFixed(1)} ms (target ${s.target_ms} ms, accept ${s.range_ms[0]}-${s.range_ms[1]} ms) ${s.status}\n  ${s.method}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const samples = measureC7Movement();
  printC7(samples);
  if (samples.some(s => s.status !== 'WITHIN')) process.exitCode = 1;
}

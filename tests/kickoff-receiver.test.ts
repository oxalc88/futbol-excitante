import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { Simulation } from '../src/simulation/engine';
import type { InputFrame, World } from '../src/contracts/types';

// Headless check that replaces the old browser kickoff-receiver scenario of the
// pad smoke: the human kickoff taker passes backward and a team-0 receiver takes
// the ball before any team-1 player touches it.
function frame(tick: number, changes: Partial<InputFrame> = {}): InputFrame {
  return { tick, slot: 0, move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, sprint: false, shield: false, ...changes };
}
interface Run { taker: string; receiver: string | null; receiverTick: number | null; teamOneTouchTick: number | null; phase: string; hash: string }
function runKickoffPass(): Run {
  const config = createConfig({ human: [true, false] });
  const sim = new Simulation(config, [makeTeam(0, config.teamSize), makeTeam(1, config.teamSize)]);
  const start: World = sim.snapshot();
  const taker = start.restart?.taker ?? start.selected[0];
  assert.ok(taker, 'Kickoff taker missing');
  const back = -start.teams[0].direction; // Team 0 attacks +x, so the backward move is -x.
  sim.applyInputs([frame(sim.tick, { move: { x: back, y: 0 }, aim: { x: back, y: 0 }, action: 'pass' })]);
  let receiver: string | null = null, receiverTick: number | null = null, teamOneTouchTick: number | null = null;
  let reachedPlaying = false;
  const observe = (events: readonly { type: string; team?: 0 | 1 }[]) => {
    const w = sim.snapshot();
    if (sim.phase === 'playing') reachedPlaying = true;
    if (teamOneTouchTick === null && w.ball.lastTouch?.team === 1) teamOneTouchTick = w.tick;
    if (teamOneTouchTick === null) for (const e of events) if (e.type === 'ball-contact' && e.team === 1) teamOneTouchTick = w.tick;
    const holder = w.carrier ?? w.ball.lastTouch?.playerId ?? null;
    if (receiverTick === null && holder && holder !== taker && w.players.find(p => p.id === holder)?.team === 0) {
      receiver = holder; receiverTick = w.tick;
    }
  };
  observe(sim.step().events);
  for (let i = 0; i < 299 && (receiverTick === null || teamOneTouchTick === null); i++) {
    sim.applyInputs([frame(sim.tick)]);
    observe(sim.step().events);
  }
  assert.ok(reachedPlaying, 'Phase never reached playing');
  return { taker, receiver, receiverTick, teamOneTouchTick, phase: sim.presentation().phase, hash: sim.stateHash() };
}

test('kickoff backward pass reaches a team-0 receiver before any team-1 touch', () => {
  const run = runKickoffPass();
  assert.equal(run.phase, 'playing', 'Match is not in playing phase after 300 ticks');
  assert.ok(run.receiver, 'No team-0 player other than the taker took the ball');
  assert.notEqual(run.receiver, run.taker, 'The kickoff taker kept the ball');
  if (run.teamOneTouchTick !== null) {
    assert.ok(run.receiverTick !== null && run.receiverTick < run.teamOneTouchTick,
      `Team 1 touched the ball first (receiver tick ${run.receiverTick}, team-1 tick ${run.teamOneTouchTick})`);
  }
});
test('kickoff receiver run is deterministic', () => {
  const a = runKickoffPass(), b = runKickoffPass();
  assert.equal(a.receiver, b.receiver);
  assert.equal(a.receiverTick, b.receiverTick);
  assert.equal(a.hash, b.hash, 'Two identical runs produced different final state hashes');
});

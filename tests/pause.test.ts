import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPause, showPauseMenu } from '../src/browser/pause-state';
import { isFulltime, rematchSetup } from '../src/browser/fulltime-flow';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { Simulation } from '../src/simulation/engine';

for (const manual of [false, true]) {
  test(`dialog close/cancel preserves manual pause=${manual}`, () => {
    assert.equal(shouldPause(manual, false, false), manual);
    assert.equal(shouldPause(manual, true, false), true);
    // Another dialog remains open, then the last dialog closes.
    assert.equal(shouldPause(manual, true, false), true);
    assert.equal(shouldPause(manual, false, false), manual);
  });
}
test('fulltime and completed replay remain paused after closing dialogs', () => {
  assert.equal(shouldPause(false, false, true), true);
  assert.equal(shouldPause(true, true, true), true);
});
test('only fulltime enables the end-of-match flow', () => {
  for (const phase of ['kickoff', 'playing', 'halftime', 'goal']) assert.equal(isFulltime(phase), false);
  assert.equal(isFulltime('fulltime'), true);
});
test('pause menu only shows for an unblocked manual pause in a live match', () => {
  assert.equal(showPauseMenu(true,false,true), false);
  assert.equal(showPauseMenu(true,true,false), false);
  assert.equal(showPauseMenu(true,false,false), true);
  assert.equal(showPauseMenu(false,false,false), false);
  assert.equal(showPauseMenu(true,false,false,true), false);
  assert.equal(shouldPause(false,false,true), true);
});
test('rematch preserves kickoff config and teams independently of match and form edits', () => {
  const config=createConfig({seed:42,teamSize:2,human:[false,false],halfSeconds:1});
  const teams:[ReturnType<typeof makeTeam>,ReturnType<typeof makeTeam>]=[makeTeam(0,2),makeTeam(1,2)];
  const saved=rematchSetup(config,teams);
  const original=structuredClone(saved);
  teams[0].name='Form edit';config.seed=99;
  const setup=rematchSetup(saved.config,saved.teams);
  const sim=new Simulation(setup.config,setup.teams);
  for(let i=0;i<1000&&sim.presentation().phase!=='fulltime';i++)sim.step();
  assert.equal(sim.presentation().phase,'fulltime');
  const next=rematchSetup(saved.config,saved.teams);
  const fresh=new Simulation(next.config,next.teams);
  assert.equal(fresh.presentation().phase,'kickoff');
  assert.equal(fresh.tick,0);
  assert.deepEqual(fresh.presentation().score,[0,0]);
  assert.deepEqual(next,original);
  next.teams[0].name='Changed rematch';
  assert.deepEqual(saved,original);
});

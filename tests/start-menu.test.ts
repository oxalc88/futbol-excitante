import test from 'node:test';
import assert from 'node:assert/strict';
import { quickPlaySetup, menuReducer, initialMenuState } from '../src/browser/start-menu';
test('quick play uses the documented defaults',()=>{
  assert.deepEqual(quickPlaySetup(),{home:0,away:1,mode:'solo',duration:360,teamSize:11,seed:2017});
  assert.deepEqual(quickPlaySetup(),quickPlaySetup());
});
test('menu reducer walks setup and match',()=>{
  let state=initialMenuState;
  assert.equal(state.view,'setup');
  state=menuReducer(state,{type:'start-match'});
  assert.equal(state.view,'match');
  state=menuReducer(state,{type:'open-setup'});
  assert.equal(state.view,'setup');
  state=menuReducer(state,{type:'close-setup'});
  assert.equal(state.view,'closed');
});

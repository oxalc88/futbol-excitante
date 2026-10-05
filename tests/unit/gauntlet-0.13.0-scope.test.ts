import { describe, it, expect } from 'vitest';
import { scopedPlan, type Snapshot } from '../../gauntlet/runtime/scoped-quality.js';
const memory=(files:Record<string,string>):Snapshot=>({files:Object.keys(files).sort(),read:p=>p in files?Buffer.from(files[p]!):null});

describe('0.13 explicit simulation verification boundaries',()=>{
  it('maps gameplay helper bodies, but refuses stepping, signatures, imports, clock, RNG and unknown impacts',()=>{
    const loop='src/simulation/loop/simulation.ts',base={
      'gauntlet/VERSION.json':'{"version":"0.13.0"}',[loop]:'export function createSimulation() { function resolveServeDirection(x: number) { return x + 1; } return { step() { return 0; } }; }',
      'tests/unit/loop/test.test.ts':"import '../../../src/simulation/loop/simulation.js';",'tests/unit/gauntlet-base.test.ts':'',
    };
    const before=memory(base),mapped=memory({...base,[loop]:base[loop].replace('x + 1','x + 2')});
    const p=scopedPlan([loop],before,mapped);expect(p.full_required).toBe(false);expect(p.reviews_required).toBe(true);expect(p.checks.map(c=>c.id)).toContain('browser-tests');expect(p.expected_tests['regression-tests']).toContain('tests/unit/loop/test.test.ts');
    for(const change of [base[loop].replace('return 0','return 1'),base[loop].replace('x: number','x: string'),`import './new.js';${base[loop]}`,base[loop].replace('return x + 1','state.tick += 1; return x'),base[loop].replace('x + 1','rng()'),base[loop].replace('return x + 1','state["tick"] += 1; return x'),base[loop].replace('x + 1','Math["random"]()'),base[loop].replace('x + 1','fetch("https://example.com")'),base[loop].replace('x + 1','step()'),base[loop].replace('return x + 1','state = { ...state, tick: 0 }; return x + 1')])expect(scopedPlan([loop],before,memory({...base,[loop]:change})).full_required).toBe(true);
    for(const path of ['src/simulation/determinism/rng.ts','src/simulation/world/create.ts','src/simulation/config/foundation.ts','src/contracts/input.ts','src/simulation/new.ts'])expect(scopedPlan([path],before,mapped).full_required).toBe(true);
    const ball='src/simulation/ball/ball-system.ts',ballBase=memory({...base,[ball]:'export function stepBall(x: number) { return x + 1; }'});
    expect(scopedPlan([ball],ballBase,memory({...base,[ball]:'export function stepBall(x: number) { return x + 2; }'})).full_required).toBe(false);
    for(const text of ['export function stepBall(x: string) { return x + 1; }','export function stepBall(x: number) { world.tick += 1; return x + 1; }',"import './other.js'; export function stepBall(x: number) { return x + 1; }"])expect(scopedPlan([ball],ballBase,memory({...base,[ball]:text})).full_required).toBe(true);
    const input='src/simulation/input/input-system.ts',inputBase=memory({...base,[input]:'export function selectNearestTeammate(x: number) { return x + 1; }'});
    expect(scopedPlan([input],inputBase,memory({...base,[input]:'export function selectNearestTeammate(x: number) { return x + 2; }'})).full_required).toBe(false);
    for(const text of ['export function selectNearestTeammate(x: string) { return x + 1; }','export function selectNearestTeammate(x: number) { schedulerMemory = {}; return x + 1; }','export function resolveInputForPlayer(x: number) { return x + 2; }'])expect(scopedPlan([input],inputBase,memory({...base,[input]:text})).full_required).toBe(true);
    expect(scopedPlan(['gauntlet/runtime/check-proof.ts'],before,mapped).full_required).toBe(true);
    const dynamic=memory({...base,'tests/unit/dynamic.test.ts':'import(moduleName)'});expect(scopedPlan([loop],dynamic,memory({...base,...Object.fromEntries(dynamic.files.map(p=>[p,dynamic.read(p)!.toString()])),[loop]:mapped.read(loop)!.toString()})).full_required).toBe(true);
  });
});

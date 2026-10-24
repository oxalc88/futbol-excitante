import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, teamSilhouettes, keeperSilhouette, luminance, type Kit } from '../src/adapters/presentation-model';
const kit=(shirt:string):Kit=>({shirt,shorts:'#17232b',accent:'#ffffff',pattern:'band'});
test('team value bands stay separate for matching and extreme kits',()=>{
  for(const a of ['#ffffff','#000000','#ff0000','#00ff00','#0000ff'])for(const b of ['#ffffff','#000000','#ff0000','#00ff00','#0000ff']){
    const kits=[kit(a),kit(b)] as const,before=JSON.stringify(kits),teams=teamSilhouettes(kits);
    assert(luminance(teams[0].body)-luminance(teams[1].body)>.24);
    assert.equal(JSON.stringify(kits),before);
    for(const t of teams)assert(Math.abs(luminance(t.body)-luminance(t.limb))<.03);
  }
});
test('ball is brighter than ground, stands, teams, and keeper',()=>{
  const teams=teamSilhouettes([kit('#ffffff'),kit('#ffff00')]),keeper=keeperSilhouette(teams);
  for(const color of [...PALETTE.pitch,...PALETTE.stands,PALETTE.lines,...[...teams,keeper].flatMap(t=>[t.body,t.trim,t.limb])])assert(luminance(PALETTE.ball)>luminance(color));
  assert(Math.abs(luminance(PALETTE.pitch[0])-luminance(PALETTE.pitch[1]))<.02);
});
test('keeper stays distinct from both teams',()=>{
  for(const color of ['#f3cb32','#df62de','#35d9dc','#ffffff','#000000']){
    const teams=teamSilhouettes([kit(color),kit(color)]),keeper=keeperSilhouette(teams);
    for(const t of teams){assert.notEqual(keeper.body,t.body);assert(Math.abs(luminance(keeper.body)-luminance(t.body))>.2);}
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { playerPose, PLAYER_PROPORTIONS as d, playerHeightScale } from '../src/adapters/presentation-model';
const player=()=>structuredClone(new Simulation(createConfig(),[makeTeam(0),makeTeam(1)]).presentation().players[0]);
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
test('pose is deterministic and accepts deeply frozen snapshots without mutation',()=>{
  const p=freeze(player()),before=JSON.stringify(p);
  assert.deepEqual(playerPose(p,100,.5),playerPose(p,100,.5));assert.equal(JSON.stringify(p),before);
});
test('travel drives phase, speed grows swing, and idle breath is deterministic',()=>{
  const p=player();p.action=null;p.recovery=0;p.keeperMode='ready';p.travel=.4;p.vx=p.vy=0;
  const idle=playerPose(p,100);assert.equal(idle.state,'idle');assert.notEqual(idle.bob,playerPose(p,120).bob);
  p.vx=2;const slow=playerPose(p,100);p.vx=6;const fast=playerPose(p,100);
  assert.equal(fast.state,'run');assert.notDeepEqual(idle,fast);assert(Math.abs(fast.hipL)>Math.abs(slow.hipL));
  assert(fast.elbowL>slow.elbowL);assert(fast.lean>slow.lean);assert(fast.hipL*fast.shoulderL<0);
  assert.equal(fast.phase,playerPose(p,999).phase);
});
test('kick winds up, strikes and follows through on the chosen foot',()=>{
  for(const foot of ['left','right'] as const)for(const kind of ['pass','shoot','cross','through','lob'] as const){
    const p=player();p.foot=foot;p.vx=p.vy=0;p.recovery=0;p.keeperMode='ready';
    p.action={kind,start:10,contact:20,end:40,aim:{x:1,y:0},power:1,resolved:false};
    const before=playerPose(p,19),at=playerPose(p,20),after=playerPose(p,35);
    const hip=foot==='left'?'hipL':'hipR',knee=foot==='left'?'kneeL':'kneeR',support=foot==='left'?'hipR':'hipL';
    assert.equal(at.state,'kick');assert(before[hip]>0);assert(at[hip]<0);assert(after[hip]>at[hip]);
    assert(before[knee]>at[knee]);assert(Math.abs(at[support])<1e-9);assert.notDeepEqual(before,at);assert.notDeepEqual(at,after);
  }
});
test('turn roll follows wrapped heading change and vanishes at rest',()=>{
  const p=player();p.action=null;p.recovery=0;p.keeperMode='ready';p.vx=5;p.vy=0;p.heading=.2;
  assert(playerPose(p,10,1,0).roll>0);assert(playerPose(p,10,1,.4).roll<0);
  p.vx=0;assert.equal(playerPose(p,10,1,0).roll,0);
});
test('special actions and keeper states remain represented',()=>{
  const p=player();p.recovery=0;p.keeperMode='ready';
  for(const kind of ['tackle','slide','header'] as const){p.action={kind,start:0,contact:10,end:30,aim:{x:1,y:0},power:1,resolved:false};assert.equal(playerPose(p,10).state,kind==='header'?'header':'tackle');}
  p.recovery=5;assert.equal(playerPose(p,10).state,'down');p.keeperMode='dive';assert.equal(playerPose(p,10).state,'dive');p.keeperMode='recover';assert.equal(playerPose(p,10).state,'down');
});
test('standing dimensions have human proportions across height classes',()=>{
  assert(d.head/d.height>=1/8&&d.head/d.height<=1/7);
  assert((d.upperLeg+d.lowerLeg+.1)/d.height>=.45&&(d.upperLeg+d.lowerLeg+.1)/d.height<=.55);
  assert(d.shoulderWidth>d.waistWidth);assert(Math.abs(d.head+d.neck+d.torso+d.hips+d.upperLeg+d.lowerLeg+.1-d.height)<1e-9);
  const p=player();for(let number=1;number<=4;number++){p.number=number;const height=d.height*playerHeightScale(p);assert(height>=1.7&&height<=1.95);}
});
test('figure model keeps the simulation import boundary',()=>{
  const source=readFileSync('src/adapters/presentation-model.ts','utf8');
  assert.deepEqual([...source.matchAll(/from ['"]([^'"]*simulation[^'"]*)['"]/g)].map(m=>m[1]),['../simulation/math']);
});
test('tackle and slide move the preferred foot',()=>{
  for(const foot of ['left','right'] as const){const p=player();p.foot=foot;p.recovery=0;p.keeperMode='ready';p.action={kind:'slide',start:0,contact:10,end:30,aim:{x:1,y:0},power:1,resolved:false};
    const pose=playerPose(p,10);assert.equal(foot==='left'?pose.hipL:pose.hipR,-1.25);}
});

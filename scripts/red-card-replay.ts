// Deterministic browser evidence: a dangerous slide, resolved by the real engine.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { Recorder, parseReplay } from '../src/adapters/replay';
import { cardAlert } from '../src/browser/card-alert';

const config = createConfig({human:[true,true],halfSeconds:60});
config.ai.cadence = 100000;
const sim = new Simulation(config,[makeTeam(0),makeTeam(1)]);
const world = sim.snapshot();
world.tick=1;world.phase='playing';world.restart=null;world.restartRestriction=null;
for(const p of world.players){p.x=p.team===0?-40:40;p.y=20+p.number*.8;p.touchCooldown=9999;p.intent.move={x:0,y:0};}
const a=world.players.find(p=>p.team===0&&!p.keeper)!;
const b=world.players.find(p=>p.team===1&&!p.keeper)!;
Object.assign(a,{x:0,y:0,vx:12,touchCooldown:0});
Object.assign(b,{x:1.5,y:0,vx:-4});
world.selected=[a.id,b.id];
Object.assign(world.ball,{x:1.9,y:0,z:.11});
world.ball.lastTouch={id:'fixture:1',playerId:b.id,team:1,tick:0,surface:'foot',point:{x:1.9,y:0,z:.11}};
a.action={kind:'slide',start:0,contact:1,end:50,aim:{x:1,y:0},power:.6,resolved:false};
sim.restore(world);
const recorder=new Recorder(sim);
const result=sim.step();
const event=result.events.find(e=>e.type==='red-card');
assert(event && event.data?.secondYellow===false, 'fixture must produce a direct red');
const expected={tick:sim.tick,text:cardAlert(result.events,sim.presentation()),event};
while(sim.tick<160)sim.step();
writeFileSync(process.argv[2],JSON.stringify(parseReplay(recorder.finish(sim))));
writeFileSync(process.argv[3],JSON.stringify(expected));

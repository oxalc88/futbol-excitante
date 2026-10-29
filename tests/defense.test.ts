import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { decidePlayer } from '../src/simulation/tactics';
import { ControllerMapper, type PadReading } from '../src/adapters/controller';
import type { InputFrame, MatchEvent, PlayerState, TeamIndex, World } from '../src/contracts/types';

/** One playing match where team 1 carries the ball at (10,0) and the team 0
 * outfielders wait between the carrier and his goal at -x. */
function defenseMatch(){
  const events:MatchEvent[]=[];
  const s=new Simulation(createConfig({teamSize:5,human:[true,false],seed:7}),[makeTeam(0,5),makeTeam(1,5)],(e)=>events.push(...e));
  const w=s.snapshot();
  w.phase='playing';w.restart=null;
  const foe=w.players.find(p=>p.team===1&&!p.keeper)!;
  for(const p of w.players)if(p.team===1&&p.id!==foe.id){p.x=40;p.y=20;p.vx=0;p.vy=0;}
  foe.x=10;foe.y=0;foe.vx=0;foe.vy=0;
  const ids=w.players.filter(p=>p.team===0&&!p.keeper).map(p=>p.id).sort();
  const spots:[number,number][]=[[0,0],[-6,6],[-6,-9],[-16,0]];
  ids.forEach((id,i)=>{const p=w.players.find(q=>q.id===id)!;p.x=spots[i][0];p.y=spots[i][1];p.vx=0;p.vy=0;});
  Object.assign(w.ball,{x:foe.x,y:foe.y,z:.11,vx:0,vy:0,vz:0,flight:'loose'});
  w.carrier=foe.id;w.possession=1;w.selected[0]=ids[0];
  s.restore(w);
  return {s,events,foeId:foe.id,ids};
}
function frame(s:Simulation,slot:TeamIndex,extra:Partial<InputFrame>={}):InputFrame{
  return {tick:s.tick,slot,move:{x:0,y:0},aim:{x:slot===0?1:-1,y:0},sprint:false,shield:false,...extra};
}
function player(w:World,id:string):PlayerState{return w.players.find(p=>p.id===id)!;}
function dist(a:{x:number;y:number},b:{x:number;y:number}):number{return Math.hypot(a.x-b.x,a.y-b.y);}

test('press: hold ✕ chases the carrier, closes the distance and emits one event',()=>{
  const {s,events,foeId}=defenseMatch();
  const w0=s.snapshot(),sel=w0.selected[0]!;
  const start=dist(player(w0,sel),player(w0,foeId));
  const after=s.tick+30;
  while(s.tick<after){s.applyInputs([frame(s,0,{press:true,sprint:true})]);s.step();}
  const w=s.snapshot(),p=player(w,sel),foe=player(w,foeId);
  const end=dist(p,foe);
  assert(end<start,`distance ${start.toFixed(2)} -> ${end.toFixed(2)} must close`);
  const pressEvents=events.filter((e)=>e.type==='defense-press');
  assert.equal(pressEvents.length,1,'one press event per hold');
  assert.equal(pressEvents[0].playerId,sel);
  // A held hold never repeats the event.
  for(let i=0;i<10;i++){s.applyInputs([frame(s,0,{press:true})]);s.step();}
  assert.equal(events.filter((e)=>e.type==='defense-press').length,1);
  // Release: the flag dies.
  for(let i=0;i<5;i++){s.applyInputs([frame(s,0)]);s.step();}
  assert.equal('pressing' in player(s.snapshot(),sel),false);
});

test('teamPress: hold □ marks one teammate, count 2 marks two, and they close in',()=>{
  for(const count of [1,2] as const){
    const {s,events,foeId}=defenseMatch();
    const w0=s.snapshot(),sel=w0.selected[0]!,foe0=player(w0,foeId);
    const before=new Map(w0.players.filter(p=>p.team===0&&!p.keeper&&p.id!==sel)
      .map(p=>[p.id,dist(p,foe0)] as const));
    const after=s.tick+30;
    while(s.tick<after){s.applyInputs([frame(s,0,{teamPress:count})]);s.step();}
    const w=s.snapshot(),foe=player(w,foeId);
    const marked=w.players.filter(p=>p.teamPressing===true).map(p=>p.id);
    assert.equal(marked.length,count,`count ${count}: marked ${marked.join(',')}`);
    assert.ok(marked.every(id=>id!==sel),'the cursor never marks himself');
    // The marked players are the nearest teammates of the cursor.
    const nearest=w.players.filter(p=>p.team===0&&!p.keeper&&p.id!==sel)
      .sort((a,b)=>dist(a,foe0)-dist(b,foe0)||a.id.localeCompare(b.id)).slice(0,count).map(p=>p.id);
    assert.deepEqual([...marked].sort(),[...nearest].sort());
    for(const id of marked){
      const p=player(w,id);
      const now=dist(p,foe);
      assert(now<(before.get(id)??Infinity),`${id}: ${before.get(id)?.toFixed(2)} -> ${now.toFixed(2)} must close`);
      assert.equal(p.intent.sprint,true,`${id} sprints at the carrier`);
    }
    const pressEvents=events.filter((e)=>e.type==='team-press');
    assert.equal(pressEvents.length,1,'one team-press event per hold');
    assert.equal(pressEvents[0].data?.count,count);
  }
});

test('jockey: hold R2 contains the carrier, runs slower than a chase and faces him',()=>{
  const run=(jockey:boolean)=>{
    const {s,foeId}=defenseMatch();
    const sel=s.snapshot().selected[0]!;
    const after=s.tick+30;
    while(s.tick<after){s.applyInputs([frame(s,0,jockey?{jockey:true}:{press:true,sprint:true})]);s.step();}
    const w=s.snapshot(),p=player(w,sel),foe=player(w,foeId);
    const toFoe=Math.hypot(foe.x-p.x,foe.y-p.y);
    const facing=toFoe>0?(p.intent.aim.x*(foe.x-p.x)+p.intent.aim.y*(foe.y-p.y))/toFoe:1;
    return {speed:Math.hypot(p.vx,p.vy),facing,flag:p.jockeying===true};
  };
  const contain=run(true),chase=run(false);
  assert.equal(contain.flag,true,'the selected player carries the jockey flag');
  assert(contain.speed<chase.speed,`contain ${contain.speed.toFixed(2)} must run slower than chase ${chase.speed.toFixed(2)}`);
  assert(contain.facing>.99,`contain faces the carrier (dot ${contain.facing.toFixed(3)})`);
});

test('jockey: the body faces the carrier while the player retreats and strafes',()=>{
  for(const move of [{x:-1,y:0},{x:0,y:1}] as const){
    const {s,foeId}=defenseMatch();
    const start=s.snapshot(),sel=start.selected[0]!,from=player(start,sel);
    const after=s.tick+40;
    while(s.tick<after){s.applyInputs([frame(s,0,{jockey:true,move:{...move}})]);s.step();}
    const w=s.snapshot(),p=player(w,sel),foe=player(w,foeId);
    const gap=Math.hypot(foe.x-p.x,foe.y-p.y);
    const dot=(Math.cos(p.heading)*(foe.x-p.x)+Math.sin(p.heading)*(foe.y-p.y))/gap;
    const travelled=dist(p,from);
    assert(travelled>1,`move ${move.x},${move.y}: the player moves (${travelled.toFixed(2)} m)`);
    assert(dot>.99,`move ${move.x},${move.y}: the heading faces the carrier (dot ${dot.toFixed(3)})`);
  }
});

test('teamPress: a checkpoint inside a held □ press resumes without a second team-press event',()=>{
  const {s,events}=defenseMatch();
  const hold=(sim:Simulation,n:number)=>{for(let i=0;i<n;i++){sim.applyInputs([frame(sim,0,{teamPress:1})]);sim.step();}};
  hold(s,12);
  assert.equal(events.filter(e=>e.type==='team-press').length,1,'one team-press event per hold');
  const checkpoint=s.snapshot(),marked=checkpoint.players.filter(p=>p.teamPressing===true).map(p=>p.id);
  assert.equal(marked.length,1,'the hold marks one teammate');
  // The same match resumes the hold from the checkpoint.
  s.restore(checkpoint);
  assert.equal(player(s.snapshot(),marked[0]).teamPressing,true,'the hold survives the restore');
  hold(s,12);
  assert.equal(events.filter(e=>e.type==='team-press').length,1,'a restored hold never repeats the event');
  // A second match loads the same checkpoint, as a restored session does.
  const resumed:MatchEvent[]=[];
  const other=new Simulation(createConfig({teamSize:5,human:[true,false],seed:7}),[makeTeam(0,5),makeTeam(1,5)],(e)=>resumed.push(...e));
  other.restore(checkpoint);hold(other,12);
  assert.equal(resumed.filter(e=>e.type==='team-press').length,0,'a loaded hold never repeats the event');
  assert.equal(s.stateHash(),other.stateHash(),'both continuations agree');
  assert.deepEqual(player(s.snapshot(),marked[0]).intent,player(other.snapshot(),marked[0]).intent);
});

test('teamPress release: the teammates drop the forced chase on the release tick',()=>{
  const {s}=defenseMatch();
  const cadence=s.snapshot().config.ai.cadence;
  const hold=()=>{s.applyInputs([frame(s,0,{teamPress:1})]);s.step();};
  for(let i=0;i<12;i++)hold();
  // The AI rewrites intents only on its cadence: release on any other tick.
  while(s.tick%cadence===0)hold();
  const before=s.snapshot();
  const marked=before.players.filter(p=>p.teamPressing===true).map(p=>p.id);
  assert.equal(marked.length,1,'the hold marks one teammate');
  s.applyInputs([frame(s,0)]);s.step();
  const after=s.snapshot();
  for(const id of marked){
    const q=player(before,id),now=player(after,id),forced=q.intent,ai=decidePlayer(before,q);
    assert.equal(now.teamPressing,undefined,'the flag dies on the release');
    assert.equal(forced.sprint,true,'the hold forces a sprint at the carrier');
    assert.notDeepEqual({move:forced.move,sprint:forced.sprint},{move:ai.move,sprint:ai.sprint},
      'the fixture: the forced chase is not the AI choice');
    assert.deepEqual(now.intent,ai,`${id} keeps no forced chase one tick after the release`);
  }
});

test('switchTarget: a right stick flick moves the cursor to the teammate in that direction',()=>{
  const {s,events,ids}=defenseMatch();
  const w=s.snapshot();
  const sel=player(w,ids[0]),helper=player(w,ids[1]);
  helper.x=sel.x+12;helper.y=sel.y;helper.vx=0;helper.vy=0;
  s.restore(w);
  s.applyInputs([frame(s,0,{switchTarget:{x:1,y:0}})]);s.step();
  const w1=s.snapshot();
  assert.equal(w1.selected[0],ids[1],'the +x teammate takes the cursor');
  assert.equal(events.filter((e)=>e.type==='control-switched').length,1);
  // A flick with no teammate in that direction keeps the cursor.
  s.applyInputs([frame(s,0,{switchTarget:{x:0,y:1}})]);s.step();
  const w2=s.snapshot();
  assert.equal(w2.selected[0],ids[1],'no teammate up: the cursor stays');
  assert.equal(events.filter((e)=>e.type==='control-switched').length,1);
});

test('switchTarget: a flick with a slide or a move in the same frame gives the input to the new cursor only',()=>{
  // The frame reaches the old cursor before the flick moves the cursor. A fix
  // gives the old player his AI intent back, so the frame input runs once.
  const run=(extra:Partial<InputFrame>)=>{
    const {s,ids}=defenseMatch();
    const w0=s.snapshot();
    const old=player(w0,ids[0]),mate=player(w0,ids[1]);
    old.x=8;old.y=0;old.vx=0;old.vy=0;old.action=null;old.recovery=0;
    mate.x=12;mate.y=0;mate.vx=0;mate.vy=0;mate.action=null;mate.recovery=0;
    Object.assign(w0.ball,{x:10,y:0,z:.11,vx:0,vy:0,vz:0,flight:'loose'});
    s.restore(w0);
    s.applyInputs([frame(s,0,{switchTarget:{x:1,y:0},...extra})]);s.step();
    const w=s.snapshot();
    assert.equal(w.selected[0],ids[1],'the +x teammate takes the cursor');
    return {now:player(w,ids[1]),prev:player(w,ids[0]),start:mate};
  };
  // Reference run: the flick alone, so the old player can only read the AI.
  const ai=run({}).prev;
  assert.equal(ai.intent.action,undefined,'the fixture: the AI gives the old player no slide');
  assert.notDeepEqual({move:ai.intent.move,action:ai.intent.action},{move:{x:0,y:1},action:'slide'},
    'the fixture: the AI choice is not the frame input');
  // Slide: the new cursor slides, the old player never does.
  const slid=run({move:{x:0,y:1},action:'slide'});
  assert.equal(slid.now.intent.action,'slide','the new cursor reads the frame slide');
  assert.equal(slid.now.action?.kind,'slide','the new cursor slides from the frame input');
  assert.deepEqual(slid.now.intent.move,{x:0,y:1},'the new cursor reads the frame move');
  assert.deepEqual(slid.prev.intent,ai.intent,'the old player keeps the AI intent');
  assert.equal(slid.prev.action?.kind,undefined,'the old player never slides from the frame input');
  assert.deepEqual([+slid.prev.x.toFixed(6),+slid.prev.y.toFixed(6)],[+ai.x.toFixed(6),+ai.y.toFixed(6)],
    'the old player moves on the AI intent only');
  // Move only: the same rule holds without an action.
  const moved=run({move:{x:0,y:1}});
  assert.deepEqual(moved.now.intent.move,{x:0,y:1},'the new cursor reads the frame move');
  assert.ok(moved.now.y>moved.start.y,'the new cursor moves from the frame input');
  assert.deepEqual(moved.prev.intent,ai.intent,'the old player keeps the AI intent');
  assert.deepEqual([+moved.prev.x.toFixed(6),+moved.prev.y.toFixed(6)],[+ai.x.toFixed(6),+ai.y.toFixed(6)],
    'the old player moves on the AI intent only');
});

test('CPU-only determinism: two runs share the hash and carry no defense flags',()=>{
  const run=()=>{
    const s=new Simulation(createConfig({teamSize:5,human:[false,false],seed:11}),[makeTeam(0,5),makeTeam(1,5)]);
    for(let i=0;i<300;i++){
      s.step();
      const w=s.snapshot();
      for(const p of w.players){
        assert.equal(p.pressing,undefined,`${p.id} pressing at tick ${w.tick}`);
        assert.equal(p.jockeying,undefined,`${p.id} jockeying at tick ${w.tick}`);
        assert.equal(p.teamPressing,undefined,`${p.id} teamPressing at tick ${w.tick}`);
      }
    }
    return s.stateHash();
  };
  assert.equal(run(),run(),'two CPU-only runs must share the final hash');
});

/** Pad helpers, same shape as the preset tests. */
function pad(index=0,buttons:number[]=[],axes:number[]=[]):PadReading{
  return {index,id:`pad${index}`,mapping:'standard',connected:true,axes,buttons:Array.from({length:24},(_,i)=>({pressed:buttons.includes(i)}))};
}
function run(frames:readonly {buttons:number[];axes?:number[]}[]){
  const mapper=new ControllerMapper();
  const out=[mapper.sample([pad()],0,0,true)];
  frames.forEach((f,i)=>out.push(mapper.sample([pad(0,f.buttons,f.axes??[0,0,0,0])],i+1,0,true)));
  return out;
}

test('controller: ✕ held gives press and never a tackle',()=>{
  const frames=run([{buttons:[0]},{buttons:[0]},{buttons:[0]}]);
  for(const f of frames.slice(1)){assert.equal(f.press,true);assert.equal(f.action,undefined);}
  const released=run([{buttons:[0]},{buttons:[]}]);
  assert.equal(released[2].press,undefined);
});

test('controller: □ held sends one teammate, □ ×2 hold sends two',()=>{
  const single=run([{buttons:[2]},{buttons:[2]},{buttons:[2]}]);
  assert.equal(single[1].teamPress,1);
  assert.equal(single[2].teamPress,1);
  assert.equal(single[3].teamPress,1);
  const double=run([{buttons:[2]},{buttons:[]},{buttons:[2]},{buttons:[2]}]);
  assert.equal(double[1].teamPress,1,'the first tap is a single press');
  assert.equal(double[3].teamPress,2,'the second tap inside the window is the double press');
  assert.equal(double[4].teamPress,2);
});

test('controller: R2 held gives jockey',()=>{
  const frames=run([{buttons:[7]},{buttons:[7]}]);
  assert.equal(frames[1].jockey,true);
  assert.equal(frames[2].jockey,true);
  const released=run([{buttons:[7]},{buttons:[]}]);
  assert.equal(released[2].jockey,undefined);
});

test('controller: one right stick flick gives one switchTarget and clears the aim',()=>{
  const frames=run([{buttons:[]},{buttons:[],axes:[0,0,1,0]},{buttons:[],axes:[0,0,1,0]}]);
  assert.equal(frames[1].switchTarget,undefined,'the stick starts at the centre');
  assert.equal(frames[2].switchTarget?.x,1);
  assert.equal(frames[2].aim,undefined,'the flick tick keeps no aim');
  assert.equal(frames[3].switchTarget,undefined,'a held stick never repeats the flick');
});

test('controller: a stick that jumps past the half band to full still gives one switchTarget',()=>{
  // The reported sequence: centre, half deflection, then full deflection.
  const frames=run([{buttons:[],axes:[0,0,0,0]},{buttons:[],axes:[0,0,.45,0]},{buttons:[],axes:[0,0,.8,0]},{buttons:[],axes:[0,0,1,0]}]);
  assert.equal(frames[1].switchTarget,undefined,'the centre sample never switches');
  assert.equal(frames[2].switchTarget,undefined,'half deflection never switches');
  assert.equal(frames[3].switchTarget?.x,1,'the full deflection switches once');
  assert.equal(frames[4].switchTarget,undefined,'the held stick disarms after the switch');
  // Back to the centre arms the next flick.
  const again=run([{buttons:[],axes:[0,0,.45,0]},{buttons:[],axes:[0,0,.8,0]},{buttons:[],axes:[0,0,1,0]},{buttons:[],axes:[0,0,0,0]},{buttons:[],axes:[0,0,1,0]}]);
  assert.equal(again[1].switchTarget,undefined,'half deflection before the centre never switches');
  assert.equal(again[2].switchTarget?.x,1,'the first full deflection switches');
  assert.equal(again[3].switchTarget,undefined,'the held stick stays disarmed');
  assert.equal(again[5].switchTarget?.x,1,'a new flick from the centre switches again');
});

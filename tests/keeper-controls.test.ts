import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { BrowserInput, defendingFlags } from '../src/adapters/input';
import { PeerSession } from '../src/adapters/network';
import type { PadReading } from '../src/adapters/controller';
import type { InputFrame, MatchEvent, PlayerState, TeamIndex, World } from '../src/contracts/types';

/** One playing match with both keepers human, an event log and a2v2 roster. */
function match(){
  const events:MatchEvent[]=[];
  const s=new Simulation(createConfig({teamSize:2,human:[true,true],seed:41}),[makeTeam(0,2),makeTeam(1,2)],(e)=>events.push(...e));
  const w=s.snapshot();w.phase='playing';w.restart=null;s.restore(w);
  return {s,events};
}
function frame(s:Simulation,slot:TeamIndex,extra:Partial<InputFrame>={}):InputFrame{
  return {tick:s.tick,slot,move:{x:0,y:0},aim:{x:slot===0?1:-1,y:0},sprint:false,shield:false,...extra};
}
function keeperOf(w:World,slot:TeamIndex):PlayerState{return w.players.find(p=>p.keeper&&p.team===slot)!;}
/** Moves every outfield player away from the keeper box so no AI body reaches the ball. */
function parkOthers(s:Simulation,slot:TeamIndex){
  const w=s.snapshot();
  for(const p of w.players)if(!(p.keeper&&p.team===slot)){p.x=p.team===0?25:30;p.y=p.team===0?25:-25;p.vx=0;p.vy=0;}
  s.restore(w);
}
function selectKeeper(s:Simulation,slot:TeamIndex):string{
  s.applyInputs([frame(s,slot,{switchKeeper:true})]);s.step();
  return keeperOf(s.snapshot(),slot).id;
}
/** Selected keeper with the ball in the hands at his position. */
function heldKeeper(slot:TeamIndex=0){
  const m=match(),id=selectKeeper(m.s,slot);
  const w=m.s.snapshot(),k=w.players.find(p=>p.id===id)!;
  w.keeperHold={playerId:id,since:w.tick};k.keeperMode='hold';k.action=null;
  Object.assign(w.ball,{x:k.x,y:k.y,z:.8,vx:0,vy:0,vz:0,spin:{x:0,y:0,z:0},flight:'loose'});
  m.s.restore(w);parkOthers(m.s,slot);
  return {...m,id};
}
function goalDistance(w:World,slot:TeamIndex){
  const p=keeperOf(w,slot);return Math.hypot(p.x+52.5,p.y);
}
function until(s:Simulation,limit:number,predicate:()=>boolean){
  for(let i=0;i<limit&&!predicate();i++)s.step();
}

test('keeper rush: one keeper-rush event, the radius opens while held and he walks back on release',()=>{
  const {s,events}=match();
  const id=selectKeeper(s,0);
  parkOthers(s,0);
  const w=s.snapshot(),k=w.players.find(p=>p.id===id)!;
  Object.assign(w.ball,{x:k.x+8,y:k.y,z:.11,vx:0,vy:0,vz:0,flight:'loose'});
  s.restore(w);
  let open=0;
  for(let i=0;i<300;i++){s.applyInputs([frame(s,0,{keeperRush:true})]);s.step();open=Math.max(open,goalDistance(s.snapshot(),0));}
  assert(open>4+1,'the rushing keeper leaves the goal radius');
  assert.equal(events.filter((e)=>e.type==='keeper-rush').length,1,'one rush event on start');
  const ball=s.snapshot().ball;
  assert(Math.hypot(keeperOf(s.snapshot(),0).x-ball.x,keeperOf(s.snapshot(),0).y-ball.y)<1.5,'the keeper runs to the ball');
  const atRelease=goalDistance(s.snapshot(),0);
  for(let i=0;i<20;i++){s.applyInputs([frame(s,0)]);s.step();}
  const released=goalDistance(s.snapshot(),0);
  assert(released>4,'on release no snap pulls the keeper back into the radius');
  assert(released<=atRelease+0.15,'out of the radius he stops instead of running farther');
  assert.equal(events.filter((e)=>e.type==='keeper-rush').length,1,'a held run never repeats the event');
  // With the stick he walks back into the radius; no jump brings him home.
  for(let i=0;i<600;i++){s.applyInputs([frame(s,0,{move:{x:-1,y:0}})]);s.step();}
  assert(goalDistance(s.snapshot(),0)<=4+1e-9,'he walks back into the goal radius');
});

test('sprint rush: R1 + △ runs at1.25x the plain rush speed',()=>{
  const run=(withSprint:boolean):{plain:number,sprint:number}=>{
    const {s}=match();
    const id=selectKeeper(s,0);parkOthers(s,0);
    const w=s.snapshot(),k=w.players.find(p=>p.id===id)!;
    Object.assign(w.ball,{x:k.x+40,y:k.y,z:.11,vx:0,vy:0,vz:0,flight:'loose'});
    s.restore(w);
    for(let i=0;i<90;i++){s.applyInputs([frame(s,0,{keeperRush:true,sprint:false})]);s.step();}
    const plain=Math.hypot(keeperOf(s.snapshot(),0).vx,keeperOf(s.snapshot(),0).vy);
    for(let i=0;i<60;i++){s.applyInputs([frame(s,0,{keeperRush:true,sprint:withSprint})]);s.step();}
    const sprint=Math.hypot(keeperOf(s.snapshot(),0).vx,keeperOf(s.snapshot(),0).vy);
    return {plain,sprint};
  };
  const off=run(false),on=run(true);
  assert(Math.abs(off.plain-2)<1e-6,'the plain rush runs at goalkeeper speed');
  assert(Math.abs(off.sprint-2)<1e-6,'without R1 the keeper speed stays');
  assert(on.sprint>2.4,'R1 + △ runs at 1.25x goalkeeper speed');
  assert(on.sprint>off.sprint+0.3,'the sprint rush is faster than the plain rush');
});

test('keeper hand throw: ✕ releases a low hand throw into play',()=>{
  const {s,events,id}=heldKeeper();
  s.applyInputs([frame(s,0,{action:'pass'})]);
  until(s,60,()=>s.snapshot().keeperHold===null);
  const w=s.snapshot();
  assert.equal(w.keeperHold,null,'the throw releases the ball');
  const kick=events.find((e)=>e.type==='keeper-throw');
  assert(kick,'keeper-throw event missing');
  assert.equal(kick.data?.kind,'pass');
  assert.equal(w.ball.lastTouch?.surface,'hand','the throw uses the hand');
  assert.equal(w.ball.lastTouch?.playerId,id);
  assert(w.stats[0].passes>0);
});

test('keeper throw into space: △ throws with the hand ahead of the best receiver',()=>{
  const {s,events,id}=heldKeeper();
  s.applyInputs([frame(s,0,{action:'through'})]);
  until(s,60,()=>s.snapshot().keeperHold===null);
  const w=s.snapshot();
  assert.equal(w.keeperHold,null);
  const kick=events.find((e)=>e.type==='keeper-throw');
  assert(kick,'keeper-throw event missing');
  assert.equal(kick.data?.kind,'through');
  assert.equal(w.ball.lastTouch?.surface,'hand');
  assert.equal(w.ball.lastTouch?.playerId,id);
  assert(w.ball.vx>0,'the throw goes upfield, ahead of the receiver');
  assert(w.pendingPass&&w.pendingPass.team===0,'the throw targets a teammate');
});

test('keeper volley punt: the release is a long lofted foot ball with the punt event',()=>{
  const {s,events,id}=heldKeeper();
  s.applyInputs([frame(s,0,{keeperKick:'punt',power:.6})]);
  assert.equal(s.snapshot().keeperHold?.playerId,id,'the wind-up keeps the hold');
  until(s,40,()=>events.some((e)=>e.type==='keeper-punt'));
  const kick=events.find((e)=>e.type==='keeper-punt');
  assert(kick,'keeper-punt event missing');
  assert.equal(kick.data?.high,false);
  const w=s.snapshot();
  assert.equal(w.keeperHold,null,'the punt releases the ball');
  assert.equal(w.ball.lastTouch?.surface,'foot','the punt uses the foot');
  assert.equal(w.ball.flight,'pass','the punt is not a shot');
  assert(w.ball.vz>5&&Math.hypot(w.ball.vx,w.ball.vy)>15,'the punt is long and lofted');
  assert.equal(w.stats[0].shots,0);
});

test('high punt: R2 raises the apex above the plain punt at the same power',()=>{
  const apex=(kind:'punt'|'high'):number=>{
    const {s,events}=heldKeeper();
    s.applyInputs([frame(s,0,{keeperKick:kind,power:.6})]);
    let top=0;
    for(let i=0;i<300;i++){s.step();top=Math.max(top,s.snapshot().ball.z);
      if(i>20&&events.some((e)=>e.type==='restart-awarded'))break;}
    assert(events.some((e)=>e.type==='keeper-punt'),`${kind} event missing`);
    return top;
  };
  const punt=apex('punt'),high=apex('high');
  assert(high>punt+1,`high ${high} must exceed punt ${punt}`);
});

test('keeper put down: R1 with the stick released drops the ball at the feet',()=>{
  const {s,events,id}=heldKeeper();
  s.applyInputs([frame(s,0,{keeperDrop:true})]);s.step();
  const w=s.snapshot(),p=w.players.find((q)=>q.id===id)!;
  assert.equal(w.keeperHold,null,'the ball leaves the hands');
  assert(events.some((e)=>e.type==='keeper-put-down'),'keeper-put-down event missing');
  assert.equal(p.keeperDropped,true);
  assert.equal(p.keeperMode,'ready');
  assert(Math.hypot(w.ball.x-p.x,w.ball.y-p.y)>.4&&Math.hypot(w.ball.x-p.x,w.ball.y-p.y)<.6,'the ball lies0.5 m ahead');
  assert.equal(w.ball.z,w.config.physics.radius);
  assert.equal(w.ball.vx,0);assert.equal(w.ball.vy,0);assert.equal(w.ball.vz,0);
  assert.equal(w.carrier,id,'the keeper plays as carrier with the feet');
});

test('keeper pick up: the same command takes a low ball inside the own box',()=>{
  const {s,events}=match();
  const id=selectKeeper(s,0);
  parkOthers(s,0);
  const w=s.snapshot(),k=w.players.find((p)=>p.id===id)!;
  // A loose ball in the box: no own-team foot pass back to the keeper.
  Object.assign(w.ball,{x:k.x+.9,y:k.y,z:.11,vx:0,vy:0,vz:0,flight:'loose',lastTouch:null});
  w.offside=null;
  s.restore(w);
  s.applyInputs([frame(s,0,{keeperDrop:true})]);s.step();
  const after=s.snapshot(),p=after.players.find((q)=>q.id===id)!;
  assert.equal(after.keeperHold?.playerId,id,'the keeper takes the ball');
  assert(events.some((e)=>e.type==='keeper-pick-up'),'keeper-pick-up event missing');
  assert.equal(p.keeperDropped,undefined,'the dropped marker is gone');
  assert.equal(after.keeperHold?.since,after.tick-1,'the hold starts at the pick-up tick');
  assert(Math.hypot(after.ball.x-p.x,after.ball.y-p.y)<1e-6,'the ball returns to the hands');
  assert.equal(after.ball.z,.8);
});

test('keeper run with the ball: the stick moves him at goalkeeper speed inside the box',()=>{
  const {s,id}=heldKeeper();
  let maxPlain=0;
  const inside=(w:World):boolean=>{
    const p=w.players.find((q)=>q.id===id)!;
    return Math.abs(p.x+52.5)<=16.5+1e-9&&Math.abs(p.y)<=20.16+1e-9;
  };
  for(let i=0;i<100;i++){
    s.applyInputs([frame(s,0,{move:{x:1,y:0}})]);s.step();
    const w=s.snapshot(),p=w.players.find((q)=>q.id===id)!;
    assert.equal(w.keeperHold?.playerId,id,'the ball stays in the hands');
    assert(Math.hypot(w.ball.x-p.x,w.ball.y-p.y)<1e-6,'the ball follows the keeper');
    assert(inside(w),'the holder stays inside the own penalty area');
    maxPlain=Math.max(maxPlain,Math.hypot(p.vx,p.vy));
  }
  assert(maxPlain<=2+1e-6,'the plain run uses goalkeeper speed');
  assert(goalDistance(s.snapshot(),0)>4,'the holder leaves the goal radius inside the box');
  for(let i=0;i<300;i++){
    s.applyInputs([frame(s,0,{move:{x:1,y:0},sprint:true})]);s.step();
    const w=s.snapshot();assert(inside(w),'the sprint run stays inside the own penalty area');
    assert.equal(w.keeperHold?.playerId,id);
  }
  const keeper=keeperOf(s.snapshot(),0);
  assert(Math.hypot(keeper.vx,keeper.vy)>2.2,'R1 sprints at1.25x goalkeeper speed');
  assert(Math.abs(keeper.x-(-36))<1e-6,'the box edge stops the run');
});

test('keeper pass feint: no release and the hold timer never restarts',()=>{
  const {s,events,id}=heldKeeper();
  const w=s.snapshot();w.keeperHold={playerId:id,since:w.tick-500};s.restore(w);
  const since=w.keeperHold!.since;
  s.applyInputs([frame(s,0,{keeperFeint:true})]);s.step();
  const after=s.snapshot();
  assert.equal(after.keeperHold?.playerId,id,'the feint keeps the ball in the hands');
  assert.equal(after.keeperHold?.since,since,'the feint never restarts the hold timer');
  assert(events.some((e)=>e.type==='keeper-feint'),'keeper-feint event missing');
  assert(!events.some((e)=>e.type==='keeper-time-limit'),'the auto-release must not run');
  assert(!events.some((e)=>e.type==='keeper-throw'),'the feint must not throw');
  assert.equal(after.keeperHold===null,false);
});

test('foul dive: the chord falls the selected keeper without foul and without card',()=>{
  const {s,events}=match();
  const id=selectKeeper(s,0);
  s.applyInputs([frame(s,0,{simulateDive:true})]);s.step();
  const w=s.snapshot(),k=w.players.find((p)=>p.id===id)!;
  assert.equal(k.recovery,w.config.goalkeeper.recoveryTicks-1,'the keeper falls for recovery ticks');
  assert.equal(k.keeperMode,'recover');
  assert(events.some((e)=>e.type==='simulate-dive'&&e.playerId===id),'simulate-dive event missing');
  assert(!events.some((e)=>['foul','yellow-card','red-card','advantage'].includes(e.type)),'no foul and no card');
  assert.equal(w.stats[0].fouls+w.stats[1].fouls,0);
  for(let i=0;i<60;i++){s.applyInputs([frame(s,0)]);s.step();}
  const up=keeperOf(s.snapshot(),0);
  assert.equal(up.recovery,0,'the keeper stands up after recovery');
  assert.equal(up.keeperMode,'ready');
});

test('foul dive: the chord falls the selected outfield player and keeps his keeper mode',()=>{
  const {s,events}=match();
  const before=s.snapshot(),p=before.players.find((q)=>q.id===before.selected[0])!;
  assert.equal(p.keeper,false,'the selection starts on an outfield player');
  const mode=p.keeperMode;
  s.applyInputs([frame(s,0,{simulateDive:true})]);s.step();
  const w=s.snapshot(),after=w.players.find((q)=>q.id===p.id)!;
  assert.equal(after.recovery,w.config.goalkeeper.recoveryTicks-1);
  assert.equal(after.keeperMode,mode,'the outfield keeper mode stays unchanged');
  assert(events.some((e)=>e.type==='simulate-dive'&&e.playerId===p.id));
  assert(!events.some((e)=>['foul','yellow-card','red-card'].includes(e.type)));
});

// ------------------------------------------------- review findings fixes

/** Selected keeper of team 0 in his own box, a loose low ball at his feet. */
function looseBallBox(){
  const m=match(),id=selectKeeper(m.s,0);
  parkOthers(m.s,0);
  const w=m.s.snapshot(),k=w.players.find((p)=>p.id===id)!;
  Object.assign(w.ball,{x:k.x+.9,y:k.y,z:.11,vx:0,vy:0,vz:0,flight:'loose',lastTouch:null});
  w.keeperHold=null;w.offside=null;w.restartRestriction=null;
  m.s.restore(w);
  return {...m,id};
}

test('review fix 2: the pick-up obeys hand legality, offside and double touch',()=>{
  // The ball that the keeper put down himself goes back into his own hands.
  const own=heldKeeper();
  own.s.applyInputs([frame(own.s,0,{keeperDrop:true})]);own.s.step();
  let w=own.s.snapshot(),k=w.players.find((p)=>p.id===own.id)!;
  assert.equal(k.keeperDropped,true,'the put-down marks his own ball');
  w.ball.lastTouch={id:k.id,tick:w.tick,playerId:k.id,team:0,surface:'hand',point:{x:w.ball.x,y:w.ball.y,z:w.ball.z}};
  w.offside=null;w.restartRestriction=null;
  own.s.restore(w);
  own.s.applyInputs([frame(own.s,0,{keeperDrop:true})]);own.s.step();
  assert.equal(own.s.snapshot().keeperHold?.playerId,own.id,'the own put-down returns to the hands');
  assert(own.events.some((e)=>e.type==='keeper-pick-up'),'the exception still picks the ball up');

  // A back-pass from a teammate with the foot never goes into the hands.
  const back=looseBallBox();
  const backW=back.s.snapshot(),mate=backW.players.find((p)=>p.team===0&&!p.keeper)!,backKeeper=backW.players.find((p)=>p.id===back.id)!;
  backKeeper.keeperDropped=true;
  backW.ball.lastTouch={id:mate.id,tick:backW.tick,playerId:mate.id,team:0,surface:'foot',point:{x:backW.ball.x,y:backW.ball.y,z:backW.ball.z}};
  back.s.restore(backW);
  back.s.applyInputs([frame(back.s,0,{keeperDrop:true})]);back.s.step();
  assert.equal(back.s.snapshot().keeperHold,null,'the back-pass stays on the floor');
  assert(!back.events.some((e)=>e.type==='keeper-pick-up'),'no keeper-pick-up for a foot back-pass');

  // Offside stops a legal pick-up.
  const off=looseBallBox();
  const offW=off.s.snapshot(),offKeeper=offW.players.find((p)=>p.id===off.id)!;
  offW.offside={team:0,candidates:[offKeeper.id]};
  off.s.restore(offW);
  off.s.applyInputs([frame(off.s,0,{keeperDrop:true})]);off.s.step();
  assert.equal(off.s.snapshot().keeperHold,null,'offside stops the pick-up');
  assert(off.events.some((e)=>e.type==='offside'&&e.playerId===off.id),'the offside still fires');
  assert(!off.events.some((e)=>e.type==='keeper-pick-up'));

  // The double touch of a restart stops a legal pick-up.
  const dbl=looseBallBox();
  const dblW=dbl.s.snapshot(),dblKeeper=dblW.players.find((p)=>p.id===dbl.id)!;
  dblW.restartRestriction={taker:dblKeeper.id,team:0,indirect:false,kind:'free-kick'};
  dbl.s.restore(dblW);
  dbl.s.applyInputs([frame(dbl.s,0,{keeperDrop:true})]);dbl.s.step();
  assert.equal(dbl.s.snapshot().keeperHold,null,'the double touch stops the pick-up');
  assert(dbl.events.some((e)=>e.type==='restart-double-touch'&&e.playerId===dbl.id),'the double touch still fires');
  assert(!dbl.events.some((e)=>e.type==='keeper-pick-up'));
});

test('review fix 3: the put-down out of the goal radius never teleports the keeper',()=>{
  const {s,id}=heldKeeper();
  for(let i=0;i<300;i++){s.applyInputs([frame(s,0,{move:{x:1,y:0},sprint:true})]);s.step();}
  const radius=s.snapshot().config.goalkeeper.radius;
  assert(goalDistance(s.snapshot(),0)>radius+4,'the holder runs out of the goal radius');
  s.applyInputs([frame(s,0,{keeperDrop:true})]);s.step();
  const dropped=s.snapshot(),k=dropped.players.find((p)=>p.id===id)!;
  assert.equal(k.keeperDropped,true);
  assert(goalDistance(dropped,0)>radius+4,'the put-down keeps his place out of the radius');
  assert(Math.hypot(dropped.ball.x-k.x,dropped.ball.y-k.y)<=s.snapshot().config.goalkeeper.reach,'the ball lies at his feet');
  for(let i=0;i<60;i++){s.applyInputs([frame(s,0)]);s.step();}
  const stayed=s.snapshot(),stayedKeeper=stayed.players.find((p)=>p.id===id)!;
  assert(goalDistance(stayed,0)>radius+4,'the keeper stays by the ball he put down');
  assert(Math.hypot(stayed.ball.x-stayedKeeper.x,stayed.ball.y-stayedKeeper.y)<=s.snapshot().config.goalkeeper.reach+1e-9,'the ball stays at his feet');
  // Away from the ball his feet stop him; the clamp never snaps him back.
  const fromBall=goalDistance(s.snapshot(),0);
  const cfg=s.snapshot().config,maxStep=cfg.goalkeeper.speed*1.25*cfg.dt*2;
  let far=0,jumps=0;
  for(let i=0;i<180;i++){
    const from=s.snapshot().players.find((p)=>p.id===id)!;
    s.applyInputs([frame(s,0,{move:{x:1,y:0}})]);s.step();
    const to=s.snapshot().players.find((p)=>p.id===id)!;
    if(Math.hypot(to.x-from.x,to.y-from.y)>maxStep)jumps++;
    far=Math.max(far,goalDistance(s.snapshot(),0));
  }
  assert.equal(jumps,0,'no tick moves him with a snap when he leaves the ball');
  assert(far>radius,'the ball at his feet carries him out of the goal radius');
  assert(far<=fromBall+2,'the ball out of his reach stops him; no snap pulls him back');
  for(let i=0;i<600;i++){s.applyInputs([frame(s,0,{move:{x:-1,y:0}})]);s.step();}
  assert(goalDistance(s.snapshot(),0)<=radius+1e-9,'he walks back into the goal radius');
});

test('review fix 4: after the put-down the keeper plays the pass and the shot with the foot',()=>{
  for(const action of ['pass','shoot'] as const){
    const {s,events,id}=heldKeeper();
    s.applyInputs([frame(s,0,{keeperDrop:true})]);s.step();
    assert.equal(s.snapshot().keeperHold,null,'the put-down clears the hold');
    const base=s.snapshot().stats[0];
    const count=(stats:{passes:number;shots:number})=>action==='pass'?stats.passes:stats.shots;
    s.applyInputs([frame(s,0,{action,aim:{x:1,y:0}})]);
    until(s,60,()=>count(s.snapshot().stats[0])>count(base));
    const after=s.snapshot();
    assert(count(after.stats[0])>count(base),`${action} never left his foot`);
    assert.equal(after.keeperHold,null,'the foot action never needs the hold');
    assert.equal(after.ball.lastTouch?.playerId,id,`${action} touches the ball for the keeper`);
    assert.equal(after.ball.lastTouch?.surface,'foot',`${action} uses the foot, not the hand`);
    assert(events.some((e)=>e.type==='action-start'&&e.playerId===id&&e.data?.kind===action),`${action} action-start event missing`);
    assert(!events.some((e)=>e.type==='keeper-throw'),'a foot action is never a throw');
  }
});

// ---------------------------------------------------------------- input side

class ElementStub {
  constructor(public tagName='DIV', public isContentEditable=false) {}
}
function pad(index=0, buttons:number[]=[], axes:number[]=[]):PadReading {
  return {index,id:`pad${index}`,mapping:'standard',connected:true,axes,
    buttons:Array.from({length:24},(_,i)=>({pressed:buttons.includes(i)}))};
}
function browser(t:TestContext) {
  const listeners=new Map<string,((event:any)=>void)[]>();
  const on=(name:string,fn:(event:any)=>void)=>listeners.set(name,[...listeners.get(name)??[],fn]);
  let now=0;
  const doc={hidden:false,addEventListener:on};
  const pads:PadReading[]=[];
  const replacements={window:{addEventListener:on},document:doc,HTMLElement:ElementStub,
    navigator:{getGamepads:()=>pads},performance:{now:()=>now}};
  for(const [key,value] of Object.entries(replacements)) {
    const original=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else Reflect.deleteProperty(globalThis,key);});
  }
  const input=new BrowserInput();input.enabled=true;
  const emit=(name:string,event:object={})=>listeners.get(name)?.forEach(fn=>fn(event));
  const key=(name:string,code:string,target:object|null=null)=>{
    let prevented=false;emit(name,{code,target,preventDefault:()=>{prevented=true;}});return prevented;
  };
  return {input,key,emit,doc,pads,time:(value:number)=>{now=value;}};
}
/** Browser harness with both pads connected, the keeper cursor on and a free tick counter. */
function keeperBrowser(t:TestContext){
  const h=browser(t);
  h.pads.push(pad(0),pad(1));
  h.input.sample(-1,0);h.input.sample(-1,1);
  h.input.setKeeper([true,true]);
  return Object.assign(h,{next:1});
}
type KeeperHarness=ReturnType<typeof keeperBrowser>;

test('rush input: hold △ without the ball on pad and keyboard, never while holding',t=>{
  const h:KeeperHarness=keeperBrowser(t);const {input,key,pads}=h;
  key('keydown','KeyL');
  assert.equal(input.sample(h.next++,0).keeperRush,true,'keyboard run-out');
  key('keyup','KeyL');
  assert.equal(input.sample(h.next++,0).keeperRush,undefined,'the rush stops on release');
  pads[0]=pad(0,[3]);
  assert.equal(input.sample(h.next++,0).keeperRush,true,'pad run-out');
  pads[0]=pad(0,[]);
  assert.equal(input.sample(h.next++,0).keeperRush,undefined);
  // With the ball in the hands △ is the throw into space, never the rush.
  input.setKeeperHold([true,true]);
  pads[0]=pad(0,[3]);
  const held=input.sample(h.next++,0);
  assert.equal(held.keeperRush,undefined);assert.equal(held.action,'through');
  pads[0]=pad(0,[]);
  input.sample(h.next++,0);
  key('keydown','KeyL');
  const typed=input.sample(h.next++,0);
  assert.equal(typed.keeperRush,undefined);assert.equal(typed.action,'through');
  key('keyup','KeyL');
});

test('sprint rush input: R1 + △ on pad and keyboard, the chord never drops',t=>{
  const h:KeeperHarness=keeperBrowser(t);const {input,key,pads}=h;
  key('keydown','ShiftLeft');key('keydown','KeyL');
  let f=input.sample(h.next++,0);
  assert.equal(f.keeperRush,true);assert.equal(f.sprint,true);
  key('keyup','ShiftLeft');key('keyup','KeyL');
  pads[0]=pad(0,[3,5]);
  f=input.sample(h.next++,0);
  assert.equal(f.keeperRush,true);assert.equal(f.sprint,true);
  assert.equal(f.keeperDrop,undefined,'the rush chord never drops the ball');
  pads[0]=pad(0,[]);
});

test('hand throw input: ✕ with the ball in the hands on pad and keyboard',t=>{
  const h:KeeperHarness=keeperBrowser(t);const {input,key,pads}=h;
  input.setKeeperHold([true,true]);
  input.setDefending([true,true]);
  key('keydown','KeyJ');
  assert.equal(input.sample(h.next++,0).action,'pass','keyboard throw wins over defense');
  key('keyup','KeyJ');
  input.sample(h.next++,0);
  pads[0]=pad(0,[0]);
  assert.equal(input.sample(h.next++,0).action,'pass','pad throw wins over the dive');
  pads[0]=pad(0,[]);
  input.sample(h.next++,0);
  // Without the hold the same pad press dives once, as before.
  input.setKeeperHold([false,false]);
  pads[0]=pad(0,[0]);
  assert.equal(input.sample(h.next++,0).action,'tackle');
});

test('throw into space input: △ with the ball in the hands on pad and keyboard',t=>{
  const h:KeeperHarness=keeperBrowser(t);const {input,key,pads}=h;
  input.setKeeperHold([true,true]);
  key('keydown','KeyL');
  assert.equal(input.sample(h.next++,0).action,'through');
  key('keyup','KeyL');
  input.sample(h.next++,0);
  pads[0]=pad(0,[3]);
  assert.equal(input.sample(h.next++,0).action,'through');
  pads[0]=pad(0,[]);
  assert.equal(input.sample(h.next++,0).action,undefined,'the throw is an edge');
});

test('punt input: hold and release ○ on pad and on the keyboard',t=>{
  const h:KeeperHarness=keeperBrowser(t);const {input,key,pads,time}=h;
  input.setKeeperHold([true,true]);
  // Keyboard: hold the kick key, one sample charges, the release kicks.
  time(0);key('keydown','KeyI');
  assert.equal(input.sample(h.next++,0).action,undefined,'the charge never crosses');
  time(425);key('keyup','KeyI');
  let f=input.sample(h.next++,0);
  assert.equal(f.keeperKick,'punt');assert.equal(f.power,.5);assert.equal(f.action,undefined);
  input.sample(h.next++,0);
  // Pad: charge on a held ○, kick on release with no cross action.
  pads[0]=pad(0,[]);input.sample(h.next++,0);
  pads[0]=pad(0,[1]);
  for(let i=0;i<30;i++){const held=input.sample(h.next++,0);assert.equal(held.action,undefined);assert.equal(held.keeperKick,undefined);}
  pads[0]=pad(0,[]);
  f=input.sample(h.next++,0);
  assert.equal(f.keeperKick,'punt');assert((f.power??0)>.4,'the pad charge gives power');assert.equal(f.action,undefined);
  assert.equal(input.sample(h.next++,0).keeperKick,undefined,'the kick is one frame');
});

test('high punt input: R2 + ○ on pad and the modifier key on the keyboard',t=>{
  const h:KeeperHarness=keeperBrowser(t);const {input,key,pads,time}=h;
  input.setKeeperHold([true,true]);
  // Keyboard: hold the high key, then hold and release the kick key.
  time(0);key('keydown','KeyG');key('keydown','KeyI');input.sample(h.next++,0);
  time(300);key('keyup','KeyI');
  let f=input.sample(h.next++,0);
  assert.equal(f.keeperKick,'high');assert((f.power??0)>.3);
  key('keyup','KeyG');input.sample(h.next++,0);
  // Pad: R2 stays held through the release.
  pads[0]=pad(0,[7]);input.sample(h.next++,0);
  pads[0]=pad(0,[7,1]);
  for(let i=0;i<20;i++)input.sample(h.next++,0);
  pads[0]=pad(0,[7]);
  f=input.sample(h.next++,0);
  assert.equal(f.keeperKick,'high');assert.equal(f.action,undefined);
  pads[0]=pad(0,[]);
  assert.equal(input.sample(h.next++,0).keeperKick,undefined);
});

test('put down input: R1 with the stick released is one edge on pad and keyboard',t=>{
  const h:KeeperHarness=keeperBrowser(t);const {input,key,pads}=h;
  input.setKeeperHold([true,true]);
  key('keydown','ShiftLeft');
  let f=input.sample(h.next++,0);
  assert.equal(f.keeperDrop,true);assert.equal(f.sprint,true);
  key('keyup','ShiftLeft');
  assert.equal(input.sample(h.next++,0).keeperDrop,undefined,'the drop is an edge');
  key('keydown','KeyD');key('keydown','ShiftLeft');
  f=input.sample(h.next++,0);
  assert.equal(f.keeperDrop,undefined,'a held stick never drops');
  assert.equal(f.move.x,1);
  key('keyup','ShiftLeft');key('keyup','KeyD');
  input.sample(h.next++,0);
  pads[0]=pad(0,[5]);
  assert.equal(input.sample(h.next++,0).keeperDrop,true,'pad drop edge');
  pads[0]=pad(0,[5]);
  assert.equal(input.sample(h.next++,0).keeperDrop,undefined);
  pads[0]=pad(0,[]);input.sample(h.next++,0);
  pads[0]=pad(0,[5],[1,0,0,0]);
  f=input.sample(h.next++,0);
  assert.equal(f.keeperDrop,undefined,'a held stick never drops');assert.equal(f.sprint,true);
  pads[0]=pad(0,[]);
});

test('pick up input: the same R1 edge works without the hold',t=>{
  const h:KeeperHarness=keeperBrowser(t);const {input,key,pads}=h;
  input.setKeeperHold([false,false]);
  key('keydown','ShiftLeft');
  assert.equal(input.sample(h.next++,0).keeperDrop,true,'keyboard pick-up command');
  key('keyup','ShiftLeft');
  pads[0]=pad(0,[5]);
  assert.equal(input.sample(h.next++,0).keeperDrop,true,'pad pick-up command');
  pads[0]=pad(0,[]);
  assert.equal(input.sample(h.next++,0).keeperDrop,undefined);
  // Away from the keeper cursor the sprint key never picks up.
  input.setKeeper([false,false]);
  pads[0]=pad(0,[]);input.sample(h.next++,0);
  pads[0]=pad(0,[5]);
  assert.equal(input.sample(h.next++,0).keeperDrop,undefined);
});

test('run with the ball input: the stick passes through with the hold and R1 sprints',t=>{
  const h:KeeperHarness=keeperBrowser(t);const {input,key,pads}=h;
  input.setKeeperHold([true,true]);
  pads[0]=pad(0,[],[.9,0,0,0]);
  let f=input.sample(h.next++,0);
  assert.equal(f.move.x>.8,true,'the stick moves the holder');
  assert.equal(f.keeperDrop,undefined);
  pads[0]=pad(0,[5],[.9,0,0,0]);
  f=input.sample(h.next++,0);
  assert.equal(f.sprint,true,'R1 sprints with the ball');
  assert.equal(f.keeperDrop,undefined,'a deflected stick never drops');
  pads[0]=pad(0,[],[0,0,0,0]);
  input.sample(h.next++,0);
  key('keydown','KeyW');
  f=input.sample(h.next++,0);
  assert.equal(f.move.y,-1,'the keyboard stick also moves the holder');
  key('keyup','KeyW');
});

test('feint input: press ✕ before the kick release on pad and keyboard',t=>{
  const h:KeeperHarness=keeperBrowser(t);const {input,key,pads,time}=h;
  input.setKeeperHold([true,true]);
  // Pad: charge □, press ✕, then release □ with no shot.
  pads[0]=pad(0,[2]);input.sample(h.next++,0);
  pads[0]=pad(0,[2]);input.sample(h.next++,0);
  pads[0]=pad(0,[2,0]);
  let f=input.sample(h.next++,0);
  assert.equal(f.keeperFeint,true);assert.equal(f.action,undefined);
  pads[0]=pad(0,[]);
  f=input.sample(h.next++,0);
  assert.equal(f.action,undefined,'the spent charge never shoots');
  assert.equal(f.keeperKick,undefined);
  // Pad: press ✕ while the punt charge is held, then release ○ with no kick.
  pads[0]=pad(0,[]);input.sample(h.next++,0);
  pads[0]=pad(0,[1]);input.sample(h.next++,0);input.sample(h.next++,0);
  pads[0]=pad(0,[1,0]);
  f=input.sample(h.next++,0);
  assert.equal(f.keeperFeint,true);assert.equal(f.action,undefined);
  pads[0]=pad(0,[]);
  f=input.sample(h.next++,0);
  assert.equal(f.keeperKick,undefined,'the feint spends the punt charge');
  // Keyboard: hold □, press ✕, release both with no shot.
  time(0);key('keydown','KeyK');input.sample(h.next++,0);
  key('keydown','KeyJ');
  f=input.sample(h.next++,0);
  assert.equal(f.keeperFeint,true);assert.equal(f.action,undefined);
  key('keyup','KeyJ');key('keyup','KeyK');
  f=input.sample(h.next++,0);
  assert.equal(f.action,undefined,'the spent keyboard charge never shoots');
});

test('foul dive input: the pad chord dives once and R2 cancels the dive',t=>{
  const h:KeeperHarness=keeperBrowser(t);const {input,key,pads}=h;
  // Keyboard: one press of the dive key.
  key('keydown','KeyF');
  assert.equal(input.sample(h.next++,0).simulateDive,true,'keyboard dive');
  key('keyup','KeyF');
  assert.equal(input.sample(h.next++,0).simulateDive,undefined,'one press, one dive');
  // Pad: L1 + L2 + L3 + R3 in one sample, without R2.
  pads[0]=pad(0,[4,6,10,11]);
  let f=input.sample(h.next++,0);
  assert.equal(f.simulateDive,true,'pad chord dive');
  assert.equal(f.switchKeeper,false,'the chord never switches the cursor');
  assert.equal(f.switchPlayer,false,'the chord never switches the player');
  f=input.sample(h.next++,0);
  assert.equal(f.simulateDive,undefined,'a held chord does not repeat');
  pads[0]=pad(0,[]);input.sample(h.next++,0);
  // With R2 held the same chord gives no dive.
  pads[0]=pad(0,[7]);input.sample(h.next++,0);
  pads[0]=pad(0,[4,6,10,11,7]);
  f=input.sample(h.next++,0);
  assert.equal(f.simulateDive,undefined,'R2 cancels the dive');
  assert.equal(f.switchKeeper,false,'the four buttons still block the switch');
  pads[0]=pad(0,[]);
  input.sample(h.next++,0);
  // Without the chord R3 alone keeps the keeper switch.
  pads[0]=pad(0,[11]);
  let keeperSwitch=false;for(let i=0;i<=6;i++)keeperSwitch=input.sample(h.next++,0).switchKeeper||keeperSwitch;assert.equal(keeperSwitch,true,'R3 alone switches after the wait');
});

// ------------------------------------------------------------------ network

type FakeChannel={readyState:string;bufferedAmount:number;onopen:null;onclose:null;onmessage:((e:{data:string})=>void)|null;close():void;send(data:string):void};
/** Host session with a fake data channel. The test needs no WebRTC stack. */
function hostSession(){
  const sent:string[]=[];
  const channel:FakeChannel={readyState:'open',bufferedAmount:0,onopen:null,onclose:null,onmessage:null,close(){},send:(data)=>{sent.push(data);}};
  const session=new PeerSession();
  session.role='host';
  (session as unknown as {bind:(c:FakeChannel)=>void}).bind(channel);
  return {session,channel,sent};
}
function deliver(channel:FakeChannel,sequence:number,frame:unknown){
  channel.onmessage!({data:JSON.stringify({type:'input',sequence,frame})});
}

test('review fix 1: the host carries and sequences every keeper control field',()=>{
  const {session,channel,sent}=hostSession();
  const base:InputFrame={tick:1,slot:0,move:{x:0,y:0},aim:{x:1,y:0},power:.5,sprint:false,shield:false};
  deliver(channel,1,{...base,keeperRush:true,keeperDrop:true,keeperFeint:true,simulateDive:true,keeperKick:'punt'});
  const first=session.hostFrame(1);
  assert.equal(first.keeperRush,true,'the run-out level field reaches the host');
  assert.equal(first.keeperDrop,true,'the drop edge reaches the host');
  assert.equal(first.keeperFeint,true,'the feint edge reaches the host');
  assert.equal(first.simulateDive,true,'the dive edge reaches the host');
  assert.equal(first.keeperKick,'punt','the kick edge reaches the host');
  const second=session.hostFrame(2);
  assert.equal(second.keeperRush,true,'the run-out stays while it is held');
  assert.equal(second.keeperDrop,undefined,'the drop is one frame only');
  assert.equal(second.keeperFeint,undefined,'the feint is one frame only');
  assert.equal(second.simulateDive,undefined,'the dive is one frame only');
  assert.equal(second.keeperKick,undefined,'the kick is one frame only');
  // An unknown kick value never reaches the host.
  deliver(channel,2,{...base,keeperKick:'volley'});
  assert.equal(session.hostFrame(3).keeperKick,undefined,'the kick value is validated');
  // One keeper edge spends a send sequence. A plain frame keeps the sequence.
  session.input({...base,tick:4,keeperDrop:true});
  session.input({...base,tick:5});
  const sequences=sent.map((raw)=>(JSON.parse(raw)as {sequence:number}).sequence);
  assert.deepEqual(sequences,[1,1],'only the edge frame spends a sequence');
});

// ------------------------------------------------- review findings, round 2

test('review finding 1: the foot kick of the keeper ends the ball that he put down',()=>{
  const {s,events,id}=heldKeeper();
  s.applyInputs([frame(s,0,{keeperDrop:true})]);s.step();
  let w=s.snapshot(),k=w.players.find((p)=>p.id===id)!;
  assert.equal(k.keeperDropped,true,'the put-down marks his own ball');
  const base=w.stats[0].passes;
  s.applyInputs([frame(s,0,{action:'pass',aim:{x:1,y:0}})]);
  until(s,60,()=>s.snapshot().stats[0].passes>base);
  const kicked=s.snapshot(),keeper=kicked.players.find((p)=>p.id===id)!;
  assert(kicked.stats[0].passes>base,'the foot pass never left his foot');
  assert.equal(kicked.ball.lastTouch?.playerId,id);
  assert.equal(kicked.ball.lastTouch?.surface,'foot');
  assert.equal(keeper.keeperDropped,undefined,'his own foot touch ends the ball that he put down');
  // The ball lies at his feet again. The hands stay closed after his own kick.
  Object.assign(keeper,{vx:0,vy:0,recovery:0,touchCooldown:0,action:null});
  Object.assign(kicked.ball,{x:keeper.x+.3,y:keeper.y,z:kicked.config.physics.radius,vx:0,vy:0,vz:0,spin:{x:0,y:0,z:0},flight:'loose',freeTicks:0});
  kicked.offside=null;kicked.restartRestriction=null;kicked.pendingPass=null;
  s.restore(kicked);
  const from=events.length;
  s.applyInputs([frame(s,0,{keeperDrop:true})]);s.step();
  const refused=s.snapshot();
  assert.equal(refused.keeperHold,null,'the ball of his own foot kick never returns to the hands');
  assert(!events.slice(from).some((e)=>e.type==='keeper-pick-up'),'no keeper-pick-up after his own foot kick');
  assert.equal(refused.players.find((p)=>p.id===id)!.keeperDropped,undefined,'the marker stays gone');
});

test('review finding 2: the pick-up is a hand touch and the carrier keeper attacks',t=>{
  // The pick-up runs the same touch path as a keeper claim.
  const {s,events,id}=looseBallBox();
  const w=s.snapshot(),rival=w.players.find((p)=>p.team===1)!;
  w.pendingPass={playerId:rival.id,team:1};
  w.restartRestriction={taker:rival.id,team:1,indirect:false,kind:'free-kick'};
  s.restore(w);
  s.applyInputs([frame(s,0,{keeperDrop:true})]);s.step();
  const after=s.snapshot();
  assert.equal(after.keeperHold?.playerId,id,'the keeper takes the ball');
  assert.equal(after.ball.lastTouch?.playerId,id,'the pick-up sets the last touch');
  assert.equal(after.ball.lastTouch?.surface,'hand','the pick-up uses the hand');
  assert.equal(after.pendingPass,null,'the pending pass resolves at the pick-up');
  assert.equal(after.restartRestriction,null,'the restart restriction clears at the pick-up');
  assert(events.some((e)=>e.type==='keeper-ball-contact'&&e.playerId===id),'the hand claim touch path runs');
  assert(events.some((e)=>e.type==='interception'&&e.playerId===id),'the pending pass resolves as an interception');
  // The shell: the selected keeper with the ball at his feet is the carrier, so
  // his team attacks and the pass key gives a normal pass.
  const h=keeperBrowser(t);
  const held=defendingFlags({ball:{lastTouch:{team:1}},selected:[id,null],carrier:id});
  assert.deepEqual(held,[false,false],'the carrier keeper of team 0 attacks although team 1 touched the ball last');
  h.input.setDefending(held);
  h.pads[0]=pad(0,[0]);
  assert.equal(h.input.sample(h.next++,0).action,'pass','✕ gives a normal pass to the carrier keeper');
  h.pads[0]=pad(0,[]);h.input.sample(h.next++,0);
  const free=defendingFlags({ball:{lastTouch:{team:1}},selected:[id,null],carrier:null});
  assert.deepEqual(free,[true,false],'without the ball at his feet team 0 defends');
  h.input.setDefending(free);
  h.pads[0]=pad(0,[0]);
  assert.equal(h.input.sample(h.next++,0).action,'tackle','without the ball the same press dives');
});

test('review finding 3: the feints never restart the eight-second hold limit',()=>{
  const {s,events,id}=heldKeeper();
  const limit=Math.round(8/s.snapshot().config.dt);
  const w=s.snapshot();w.keeperHold={playerId:id,since:s.tick-limit+2};s.restore(w);
  const since=w.keeperHold!.since;
  let releasedAt=-1;
  for(let i=0;i<8;i++){
    s.applyInputs([frame(s,0,{keeperFeint:true})]);
    const at=s.tick;s.step();
    const hold=s.snapshot().keeperHold;
    if(hold===null){releasedAt=at;break;}
    assert.equal(hold.since,since,`the feint never restarts the timer at tick ${at}`);
  }
  assert(releasedAt>=0,'the eight-second limit ends the hold despite a feint on every tick');
  assert(events.filter((e)=>e.type==='keeper-feint').length>=2,'the feints still run');
  assert(events.some((e)=>e.type==='keeper-time-limit'&&e.tick===releasedAt),'the keeper-time-limit ends the hold');
  assert(events.some((e)=>e.type==='restart-awarded'&&e.data?.kind==='corner'),'the corner follows the time limit');
});

test('review finding 4: every foot action of the keeper leaves his foot after the put-down',()=>{
  for(const action of ['pass','through','cross','lob','shoot'] as const){
    const {s,events,id}=heldKeeper();
    s.applyInputs([frame(s,0,{keeperDrop:true})]);s.step();
    assert.equal(s.snapshot().keeperHold,null,'the put-down clears the hold');
    const stats=s.snapshot().stats[0],base=stats.passes+stats.shots;
    const from=events.length;
    s.applyInputs([frame(s,0,{action,aim:{x:1,y:0}})]);
    until(s,60,()=>{const n=s.snapshot().stats[0];return n.passes+n.shots>base;});
    const after=s.snapshot(),log=events.slice(from);
    assert(after.stats[0].passes+after.stats[0].shots>base,`${action} never left his foot`);
    assert.equal(after.keeperHold,null,'the foot action never needs the hold');
    assert.equal(after.ball.lastTouch?.playerId,id,`${action} touches the ball for the keeper`);
    assert.equal(after.ball.lastTouch?.surface,'foot',`${action} uses the foot, not the hand`);
    assert(log.some((e)=>e.type==='action-start'&&e.playerId===id&&e.data?.kind===action),`${action} action-start event missing`);
    assert(!log.some((e)=>e.type==='keeper-throw'),`${action} is a foot action, not a throw`);
  }
});

// ------------------------------------------------- review findings, round 3

test('review finding 5: the goal radius never moves the human keeper with a snap',()=>{
  const {s,id}=heldKeeper();
  const cfg=s.snapshot().config,radius=cfg.goalkeeper.radius;
  const maxStep=cfg.goalkeeper.speed*1.25*cfg.dt*2;
  // The holder runs out of the goal radius with the ball in the hands.
  for(let i=0;i<300;i++){s.applyInputs([frame(s,0,{move:{x:1,y:0},sprint:true})]);s.step();}
  assert(goalDistance(s.snapshot(),0)>radius+4,'the holder leaves the goal radius');
  // He puts the ball down and plays the pass with the foot.
  s.applyInputs([frame(s,0,{keeperDrop:true})]);s.step();
  assert.equal(s.snapshot().players.find((p)=>p.id===id)!.keeperDropped,true,'the put-down marks his own ball');
  const base=s.snapshot().stats[0].passes;
  s.applyInputs([frame(s,0,{action:'pass',aim:{x:1,y:0}})]);
  until(s,60,()=>s.snapshot().stats[0].passes>base);
  const kicked=s.snapshot(),before=kicked.players.find((p)=>p.id===id)!;
  assert(kicked.stats[0].passes>base,'the foot pass never left his foot');
  assert.equal(before.keeperDropped,undefined,'the foot kick clears the put-down marker');
  const place=goalDistance(kicked,0);
  assert(place>radius,'the keeper is still out of the goal radius');
  // The foot kick clears the marker, and the next ticks never pull him back.
  for(let i=0;i<60;i++){
    const from=s.snapshot().players.find((p)=>p.id===id)!;
    s.applyInputs([frame(s,0,{move:{x:1,y:0}})]);s.step();
    const to=s.snapshot().players.find((p)=>p.id===id)!;
    assert(Math.hypot(to.x-from.x,to.y-from.y)<=maxStep,`the keeper teleports at tick ${s.tick}`);
    const at=goalDistance(s.snapshot(),0);
    assert(at>=place-1e-9,'the goal radius never pulls him back to the goal');
    assert(at<=place+1e-9,'out of the radius he never runs farther from the goal');
  }
  // With the stick he walks back into the radius; no jump brings him home.
  for(let i=0;i<600;i++){s.applyInputs([frame(s,0,{move:{x:-1,y:0}})]);s.step();}
  assert(goalDistance(s.snapshot(),0)<=radius+1e-9,'he walks back into the goal radius');
});

test('review finding 6: the keyboard charge and feint keep the keeper hold over the aerial row',t=>{
  const h:KeeperHarness=keeperBrowser(t);const {input,key,time}=h;
  // After a high catch the shell reports the head-height band and the hold.
  input.setAerial([true,true]);input.setKeeperHold([true,true]);
  time(0);key('keydown','KeyK');
  input.sample(h.next++,0);
  time(425);
  assert(input.charging>.4,'the keyboard shot charge starts at head height with the ball in the hands');
  // One ✕ press before the release is the feint, never a throw.
  key('keydown','KeyJ');
  const feint=input.sample(h.next++,0);
  assert.equal(feint.keeperFeint,true,'the keeper hold wins over the aerial row');
  assert.equal(feint.action,undefined,'the feint keeps the ball in the hands');
  key('keyup','KeyJ');key('keyup','KeyK');
  const released=input.sample(h.next++,0);
  assert.equal(released.action,undefined,'the feint spends the keyboard charge');
  assert.equal(released.keeperKick,undefined,'the spent charge never kicks');
  // Without the hold the same press at head height spends its charge.
  input.setKeeperHold([false,false]);
  time(0);key('keydown','KeyK');
  input.sample(h.next++,0);
  time(425);
  assert.equal(input.charging,0,'without the hold the aerial row spends the keyboard press');
  key('keyup','KeyK');
  input.sample(h.next++,0);
});

// ------------------------------------------------- review findings, round 4

test('pass feint: △ held then ✕ = feint, no throw',t=>{
  // Pad: hold △, press ✕ before the release, then release both buttons.
  const h:KeeperHarness=keeperBrowser(t);const {input,key,pads}=h;
  input.setKeeperHold([true,true]);
  pads[0]=pad(0,[3]);
  assert.equal(input.sample(h.next++,0).action,'through','the △ edge is the throw into space');
  pads[0]=pad(0,[3,0]);
  const padFeint=input.sample(h.next++,0);
  assert.equal(padFeint.keeperFeint,true,'△ held and ✕ pressed is the pass feint');
  assert.equal(padFeint.action,undefined,'the feint never queues a hand throw');
  pads[0]=pad(0,[]);
  assert.equal(input.sample(h.next++,0).action,undefined,'the release of both buttons throws nothing');
  assert.equal(input.sample(h.next++,0).keeperFeint,undefined,'the feint is one frame');
  // Keyboard: hold △, press ✕ before the release, then release both keys.
  key('keydown','KeyL');
  assert.equal(input.sample(h.next++,0).action,'through','the keyboard △ edge is the throw into space');
  key('keydown','KeyJ');
  const typedFeint=input.sample(h.next++,0);
  assert.equal(typedFeint.keeperFeint,true,'△ held and ✕ pressed feints on the keyboard too');
  assert.equal(typedFeint.action,undefined,'the keyboard feint never queues a hand throw');
  key('keyup','KeyJ');key('keyup','KeyL');
  assert.equal(input.sample(h.next++,0).action,undefined,'the release of both keys throws nothing');
  // Engine: the wind-up of the △ press never releases the ball after the feint.
  const {s,events,id}=heldKeeper();
  s.applyInputs([frame(s,0,{action:'through'})]);s.step();
  const started=s.snapshot(),pending=started.players.find(p=>p.id===id)!;
  assert(pending.action,'the △ press starts the throw wind-up');
  assert.equal(started.keeperHold?.playerId,id,'the ball is still in the hands');
  s.applyInputs([frame(s,0,{keeperFeint:true})]);s.step();
  const feinted=s.snapshot();
  assert(events.some((e)=>e.type==='keeper-feint'),'keeper-feint event missing');
  assert.equal(feinted.keeperHold?.playerId,id,'the feint keeps the ball in the hands');
  assert.equal(feinted.players.find((p)=>p.id===id)!.action,null,'the feint cancels the pending throw');
  for(let i=0;i<40;i++)s.step();
  const after=s.snapshot();
  assert.equal(after.keeperHold?.playerId,id,'the pending throw never leaves the hands');
  assert(!events.some((e)=>e.type==='keeper-throw'),'the feint never throws');
  assert(!events.some((e)=>e.type==='through-pass'),'the feint never passes');
  assert.equal(after.stats[0].passes,0,'no pass of the keeper after the feint');
  // A fresh △ press throws again: the feint never wedges the hold.
  s.applyInputs([frame(s,0,{action:'through'})]);
  until(s,60,()=>s.snapshot().keeperHold===null);
  assert(events.some((e)=>e.type==='keeper-throw'),'a new △ press throws after the feint');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation/engine';
import { bestPass } from '../src/simulation/tactics';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import type { InputFrame, MatchEvent, Phase, PlayerState, TeamIndex, Vec2, World } from '../src/contracts/types';

/** One match with both slots human, an event log and an 11-a-side roster. */
function match(){
  const events:MatchEvent[]=[];
  const s=new Simulation(createConfig({teamSize:11,human:[true,true],seed:41}),[makeTeam(0,11),makeTeam(1,11)],(e)=>events.push(...e));
  return {s,events};
}
function frame(s:Simulation,slot:TeamIndex,extra:Partial<InputFrame>={}):InputFrame{
  return {tick:s.tick,slot,move:{x:0,y:0},aim:{x:0,y:0},sprint:false,shield:false,...extra};
}
function run(s:Simulation,slot:TeamIndex,extra:Partial<InputFrame>={},ticks=1){
  for(let i=0;i<ticks;i++){s.applyInputs([frame(s,slot,extra)]);s.step();}
}
function dist(a:Vec2,b:Vec2){return Math.hypot(a.x-b.x,a.y-b.y);}
function keeperOf(w:World,slot:TeamIndex):PlayerState{return w.players.find(p=>p.keeper&&p.team===slot)!;}
/** The four closest defending outfielders: the wall of the free kick. */
function wallOf(w:World,slot:TeamIndex,point:Vec2):PlayerState[]{
  return w.players.filter(p=>p.team===slot&&!p.keeper&&!p.sentOff)
    .sort((a,b)=>dist(a,point)-dist(b,point)||a.id.localeCompare(b.id)).slice(0,4);
}
/** The teammate closest to the ball that is not the taker: the second taker. */
function secondOf(w:World,slot:TeamIndex,point:Vec2,taker:string):PlayerState{
  return w.players.filter(p=>p.team===slot&&!p.keeper&&!p.sentOff&&p.id!==taker)
    .sort((a,b)=>dist(a,point)-dist(b,point)||a.id.localeCompare(b.id))[0];
}
/** Plants a waiting restart of one kind at one point, exactly as startRestart leaves it. */
function setRestart(s:Simulation,kind:Phase,team:TeamIndex,point:Vec2):string{
  const w=s.snapshot(),dir=w.teams[team].direction;
  const taker=w.players.filter(p=>p.team===team&&!p.keeper&&!p.sentOff)
    .sort((a,b)=>dist(a,point)-dist(b,point)||a.id.localeCompare(b.id))[0];
  w.phase=kind;
  w.restart={kind,team,point:{...point},taker:taker.id,remaining:w.config.rules.humanRestartTicks};
  Object.assign(w.ball,{x:point.x,y:point.y,z:w.config.physics.radius,vx:0,vy:0,vz:0,spin:{x:0,y:0,z:0},lastTouch:null,freeTicks:0,flight:'loose'});
  for(const p of w.players){p.vx=0;p.vy=0;p.action=null;p.touchCooldown=0;delete p.wallJump;}
  taker.x=point.x-dir*.5;taker.y=point.y;taker.heading=dir===1?0:Math.PI;
  w.selected[team]=taker.id;
  s.restore(w);
  return taker.id;
}
/** A waiting free kick for team 0 far from the goal, so the default kick stays a pass. */
function freeKick(){const m=match();const taker=setRestart(m.s,'free-kick',0,{x:20,y:10});return {...m,taker};}
/** A waiting penalty for team 0, with the defending keeper on his line. */
function penalty(){
  const m=match(),point={x:41.5,y:0},taker=setRestart(m.s,'penalty',0,point);
  const w=m.s.snapshot(),k=keeperOf(w,1);
  k.x=-w.config.pitch.length/2+.05;k.y=0;
  m.s.restore(w);
  return {...m,taker,point};
}
function restartOf(s:Simulation){return s.snapshot().restart!;}

test('secondTaker: L1 + dpad up places the second taker beside the ball and dpad down behind it',()=>{
  const {s,events,taker}=freeKick();
  const point=restartOf(s).point,second=secondOf(s.snapshot(),0,point,taker);
  // dpad up: beside the ball, one step to the +y side, stopped and facing upfield.
  run(s,0,{secondTaker:'side'});
  let w=s.snapshot(),r=restartOf(s);
  const beside=w.players.find(p=>p.id===second.id)!;
  assert.equal(r.second?.id,second.id);
  assert.equal(r.second?.placement,'side');
  assert.equal(beside.x,point.x);
  assert.equal(beside.y,point.y+1.5);
  assert.equal(beside.vx,0);assert.equal(beside.vy,0);
  assert.equal(events.filter(e=>e.type==='second-taker'&&e.playerId===second.id).length,1);
  assert.equal(events.at(-1)?.data?.placement,'side');
  // dpad down: behind the ball, two meters against the attack direction.
  run(s,0,{secondTaker:'behind'});
  w=s.snapshot();r=restartOf(s);
  const moved=w.players.find(p=>p.id===second.id)!;
  assert.equal(r.second?.placement,'behind');
  assert.equal(moved.x,point.x-w.teams[0].direction*2);
  assert.equal(moved.y,point.y);
  assert.equal(events.filter(e=>e.type==='second-taker').length,2,'one event per placement change');
  // The taker himself and the keeper are never chosen.
  assert.notEqual(r.second?.id,taker);
  assert.notEqual(r.second?.id,keeperOf(w,0).id);
  // A penalty never takes a second taker.
  const pen=penalty();
  run(pen.s,0,{secondTaker:'side'});
  assert.equal(restartOf(pen.s).second,undefined);
  assert.equal(pen.events.some(e=>e.type==='second-taker'),false);
});

test('secondKick: hold L2 and the restart leaves the second taker, the cursor follows him',()=>{
  const {s,events,taker}=freeKick();
  const point=restartOf(s).point,second=secondOf(s.snapshot(),0,point,taker);
  run(s,0,{secondTaker:'side'});
  // Without L2 the taker kicks: ✕ with a short aim executes the restart.
  run(s,0,{action:'pass',aim:{x:1,y:.2}});
  let w=s.snapshot();
  assert.equal(w.phase,'playing');
  assert.equal(w.restart,null);
  assert.equal(w.ball.lastTouch?.playerId,taker,'without L2 the taker kicks');
  assert.equal(w.selected[0],taker);
  // With L2 the second taker kicks and the cursor follows him.
  const withSecond=freeKick();
  const point2=restartOf(withSecond.s).point;
  const second2=secondOf(withSecond.s.snapshot(),0,point2,withSecond.taker);
  run(withSecond.s,0,{secondTaker:'side'});
  run(withSecond.s,0,{secondKick:true,action:'pass',aim:{x:1,y:.2}});
  w=withSecond.s.snapshot();
  assert.equal(w.phase,'playing');
  assert.equal(w.restart,null);
  assert.equal(w.ball.lastTouch?.playerId,second2.id,'L2 gives the kick to the second taker');
  assert.equal(w.selected[0],second2.id,'the cursor follows the second taker');
  assert.equal(w.pendingPass?.playerId,second2.id);
  const executed=withSecond.events.find(e=>e.type==='free-kick-executed');
  assert.ok(executed,'free-kick-executed event missing');
  assert.equal(executed.playerId,second2.id);
  // The second taker is a real kick: a touch of the foot, not the taker's.
  assert.equal(w.ball.lastTouch?.surface,'foot');
});

test('cornerSide: the dpad stores the corner strategy of the attack and of the defence',()=>{
  const {s,events}=match();
  setRestart(s,'corner',0,{x:52.5,y:34});
  const before=s.snapshot().players.map(p=>({id:p.id,x:p.x,y:p.y}));
  // dpad up of the attacking slot: fast delivery.
  run(s,0,{cornerSide:'up'});
  let r=restartOf(s);
  assert.equal(r.strategy?.attack,'fast');
  assert.equal(events.filter(e=>e.type==='corner-strategy').length,1);
  assert.deepEqual(events.at(-1)?.data,{attack:'fast'});
  assert.ok(s.snapshot().players.some(p=>p.team===0&&before.some(q=>q.id===p.id&&(q.x!==p.x||q.y!==p.y))),'attack strategy moves off-ball runners');
  // A second direction never overwrites the stored attack strategy.
  run(s,0,{cornerSide:'left'});
  assert.equal(restartOf(s).strategy?.attack,'fast');
  assert.equal(events.filter(e=>e.type==='corner-strategy').length,1);
  // dpad left of the defending slot: man to man.
  run(s,1,{cornerSide:'left'});
  r=restartOf(s);
  assert.equal(r.strategy?.defence,'man');
  assert.equal(events.filter(e=>e.type==='corner-strategy').length,2);
  assert.deepEqual(events.at(-1)?.data,{defence:'man'});
  assert.ok(s.snapshot().players.some(p=>p.team===1&&before.some(q=>q.id===p.id&&(q.x!==p.x||q.y!==p.y))),'defence strategy moves markers');
  // The defence has no down row: nothing is stored and nothing is emitted.
  const other=match();
  setRestart(other.s,'corner',0,{x:52.5,y:34});
  run(other.s,1,{cornerSide:'down'});
  assert.equal(restartOf(other.s).strategy?.defence,undefined);
  assert.equal(other.events.some(e=>e.type==='corner-strategy'),false);
});

test('human corner defence against a CPU taker moves defenders in either slot only',()=>{
  for(const taker of [0,1] as const){
    const defender=taker===0?1:0;
    const human:[boolean,boolean]=taker===0?[false,true]:[true,false];
    const events:MatchEvent[]=[];
    const s=new Simulation(createConfig({teamSize:11,human,seed:41}),[makeTeam(0,11),makeTeam(1,11)],e=>events.push(...e));
    setRestart(s,'corner',taker,{x:taker===0?52.5:-52.5,y:34});
    const before=s.snapshot();
    run(s,defender,{cornerSide:'left'});
    const after=s.snapshot();
    assert.equal(after.restart?.strategy?.defence,'man');
    assert.deepEqual(events.filter(e=>e.type==='corner-strategy').map(e=>({team:e.team,data:e.data})),[{team:defender,data:{defence:'man'}}]);
    assert.ok(after.players.some(p=>p.team===defender&&before.players.some(q=>q.id===p.id&&(p.x!==q.x||p.y!==q.y))),`defenders move in slot ${defender}`);
    assert.deepEqual(after.players.filter(p=>p.team===taker).map(p=>({id:p.id,x:p.x,y:p.y})),before.players.filter(p=>p.team===taker).map(p=>({id:p.id,x:p.x,y:p.y})),`CPU attackers stay in place for slot ${taker}`);
  }
});

test('CPU corner defenders ignore strategy commands',()=>{
  for(const human of [[true,false],[false,false]] as const){
    const config=createConfig({teamSize:11,human:[...human],seed:41});
    const teams:[ReturnType<typeof makeTeam>,ReturnType<typeof makeTeam>]=[makeTeam(0,11),makeTeam(1,11)];
    const left=new Simulation(config,teams),right=new Simulation(config,teams);
    setRestart(left,'corner',0,{x:52.5,y:34});right.restore(left.snapshot());
    left.applyInputs([frame(left,1,{cornerSide:'left'})]);left.step();right.step();
    assert.deepEqual(left.snapshot(),right.snapshot());
  }
});

test('wallJump: one □ press lifts the four wall players for 40 ticks and clears after expiry',()=>{
  const {s,events}=match();
  setRestart(s,'free-kick',0,{x:20,y:10});
  const point=restartOf(s).point;
  const before=s.snapshot().tick;
  run(s,1,{wallJump:true});
  let w=s.snapshot();
  const wall=wallOf(w,1,point);
  assert.equal(wall.length,4);
  for(const p of wall)assert.equal(p.wallJump,before+40,'each wall player jumps until tick+40');
  // Nobody outside the wall jumps.
  for(const p of w.players)if(!wall.includes(p))assert.equal(p.wallJump,undefined,p.id);
  assert.equal(events.filter(e=>e.type==='wall-jump').length,4);
  // A second press while the jump is alive repeats nothing.
  run(s,1,{wallJump:true});
  assert.equal(events.filter(e=>e.type==='wall-jump').length,4);
  // The jump clears in play once the 40 ticks pass.
  run(s,0,{action:'pass',aim:{x:1,y:0}});
  assert.equal(s.snapshot().phase,'playing');
  for(let i=0;i<45;i++)s.step();
  w=s.snapshot();
  for(const p of w.players)assert.equal(p.wallJump,undefined,`${p.id} keeps a stale jump`);
});

test('wallCharge: the held ○ sends the wall out of the ball with the charged speed',()=>{
  const {s,events}=match();
  setRestart(s,'free-kick',0,{x:20,y:10});
  const point=restartOf(s).point;
  // Half charge: the wall leaves at 2 + .5*6 = 5 m/s, away from the ball.
  run(s,1,{wallCharge:.5});
  let w=s.snapshot();
  const wall=wallOf(w,1,point);
  for(const p of wall){
    const speed=Math.hypot(p.vx,p.vy);
    assert.ok(Math.abs(speed-5)<1e-9,`${p.id} runs at ${speed}`);
    const away={x:(point.x-p.x)/dist(p,point),y:(point.y-p.y)/dist(p,point)};
    assert.ok((p.vx*away.x+p.vy*away.y)/speed>.999,`${p.id} runs away from the ball`);
  }
  // A full charge runs faster; a non-wall player keeps still.
  run(s,1,{wallCharge:1});
  w=s.snapshot();
  for(const p of wallOf(w,1,point))assert.ok(Math.abs(Math.hypot(p.vx,p.vy)-8)<1e-9,p.id);
  const taker=w.players.find(p=>p.id===restartOf(s).taker)!;
  assert.equal(Math.hypot(taker.vx,taker.vy),0,'only the wall moves');
});

test('keeperMove: △ + stick walks the defending keeper; on a penalty the stick alone moves him sideways on the line',()=>{
  // Free kick: the defending slot needs △ (keeperMove) besides the stick.
  const {s}=match();
  setRestart(s,'free-kick',0,{x:20,y:10});
  const freeKeeper=keeperOf(s.snapshot(),1);
  run(s,1,{keeperMove:{x:0,y:1}},20);
  let w=s.snapshot(),moved=w.players.find(p=>p.id===freeKeeper.id)!;
  assert.ok(moved.y>1.5,'the stick walks the keeper along y');
  assert.equal(moved.x,freeKeeper.x,'the pure y stick never moves x');
  // Penalty: the stick alone moves the keeper, but only sideways on the line.
  const pen=penalty();
  const lineKeeper=keeperOf(pen.s.snapshot(),1);
  const lineX=lineKeeper.x;
  run(pen.s,1,{move:{x:1,y:1}},60);
  const k=pen.s.snapshot().players.find(p=>p.id===lineKeeper.id)!;
  assert.equal(k.x,lineX,'on the line the keeper never leaves x');
  const limit=pen.s.snapshot().config.pitch.goalWidth/2+1;
  assert.ok(k.y>2,'the stick alone walks him on a penalty');
  assert.ok(k.y<=limit+1e-9,`the lateral limit of the line is ${limit}`);
});

test('setKick power rows: □ shoots (counted as a shot), ○ lofts high and ✕ keeps the ball low',()=>{
  const kick=(action:'shoot'|'cross'|'pass')=>{
    const m=match();
    setRestart(m.s,'free-kick',0,{x:20,y:10});
    run(m.s,0,{setKick:true,action,aim:{x:1,y:0},power:.5});
    return m.s.snapshot();
  };
  const shoot=kick('shoot');
  assert.ok(Math.abs(Math.hypot(shoot.ball.vx,shoot.ball.vy)-21)<1e-9,'□ runs at 16 + power*10');
  assert.ok(Math.abs(shoot.ball.vz-2.5)<1e-9,'□ keeps the low shot height of the power bar');
  assert.equal(shoot.ball.flight,'shot');
  assert.equal(shoot.stats[0].shots,1,'the □ free kick counts as a shot');
  const loft=kick('cross');
  assert.ok(Math.abs(Math.hypot(loft.ball.vx,loft.ball.vy)-15)<1e-9,'○ runs at 12 + power*6');
  assert.ok(Math.abs(loft.ball.vz-6)<1e-9,'○ lofts the ball high');
  assert.equal(loft.ball.flight,'pass');
  assert.equal(loft.stats[0].shots,0,'○ and ✕ are never shots');
  const low=kick('pass');
  assert.ok(Math.abs(Math.hypot(low.ball.vx,low.ball.vy)-12)<1e-9,'✕ runs at 8 + power*8');
  assert.ok(Math.abs(low.ball.vz-.9)<1e-9,'✕ keeps the ball on the ground');
  assert.equal(low.ball.flight,'pass');
});

test('setKick curl: the stick deviation from the facing bends the flight with the curve of the taker',()=>{
  const {s,taker}=freeKick();
  const kicker=s.snapshot().players.find(p=>p.id===taker)!;
  assert.equal(kicker.heading,0,'the taker faces the attack direction');
  // A stick off the facing curls the spin: deviation * 5 * curve.
  run(s,0,{setKick:true,action:'pass',aim:{x:1,y:1},power:.5});
  let w=s.snapshot();
  const expected=Math.atan2(1,1)*5*kicker.capabilities.curve;
  assert.ok(Math.abs(w.ball.spin.z-expected)<1e-6,`spin ${w.ball.spin.z} vs expected ${expected}`);
  assert.ok(w.ball.spin.z>0,'the deviation curls to one side');
  // A stick aligned with the facing gives no curl.
  const straight=freeKick();
  run(straight.s,0,{setKick:true,action:'pass',aim:{x:1,y:0},power:.5});
  assert.equal(straight.s.snapshot().ball.spin.z,0);
});

test('shortRoll: L1 + ✕ rolls the ball on the ground to a teammate',()=>{
  const {s,taker,events}=freeKick();
  const kicker=s.snapshot().players.find(p=>p.id===taker)!;
  // The roll targets the receiver that bestPass picks for the same waiting state.
  const receiver=bestPass(s.snapshot(),kicker);
  assert.ok(receiver,'a teammate is available for the short roll');
  run(s,0,{shortRoll:true,action:'pass',power:.5});
  const w=s.snapshot();
  assert.equal(w.phase,'playing');
  assert.ok(Math.abs(w.ball.vz-0)<1e-9,'the roll never leaves the ground');
  assert.ok(Math.abs(Math.hypot(w.ball.vx,w.ball.vy)-8)<1e-9,'the roll runs at 6 + power*4');
  assert.equal(w.ball.flight,'pass');
  assert.equal(w.stats[0].shots,0);
  // The ball leaves towards the receiver, not towards the goal.
  const target=w.players.find(p=>p.id===receiver.id)!;
  const u={x:(target.x-kicker.x)/dist(kicker,target),y:(target.y-kicker.y)/dist(kicker,target)};
  const v=Math.hypot(w.ball.vx,w.ball.vy);
  assert.ok((w.ball.vx*u.x+w.ball.vy*u.y)/v>.999,'the roll goes to the receiver');
  const executed=events.find(e=>e.type==='free-kick-executed');
  assert.ok(executed&&executed.playerId===taker);
});

test('setFeint: ✕ during the charge fakes the kick, the ball stays and the restart stays alive',()=>{
  const {s,events,taker}=freeKick();
  const remaining=restartOf(s).remaining;
  // Three feinted ticks, the last one even with a kick action: nothing leaves the foot.
  run(s,0,{setFeint:true});
  run(s,0,{setFeint:true});
  run(s,0,{setFeint:true,action:'pass',aim:{x:1,y:0}});
  const w=s.snapshot();
  assert.equal(w.phase,'free-kick','the feint keeps the restart');
  assert.ok(w.restart,'the restart is still waiting');
  assert.equal(restartOf(s).remaining,remaining,'the feint never consumes the countdown');
  assert.equal(Math.hypot(w.ball.vx,w.ball.vy),0,'no ball leaves the foot');
  assert.equal(w.ball.lastTouch,null);
  assert.equal(events.filter(e=>e.type==='set-feint'&&e.playerId===taker).length,3,'one event per feint');
  // The same restart executes normally once the feint is released.
  run(s,0,{action:'pass',aim:{x:1,y:0}});
  assert.equal(s.snapshot().phase,'playing');
  assert.equal(s.snapshot().restart,null);
});

test('panenka: L1 + □ at a penalty chips the ball slow and down the middle',()=>{
  const {s,events,taker}=penalty();
  const dir=s.snapshot().teams[0].direction;
  run(s,0,{panenka:true,action:'shoot'});
  const w=s.snapshot();
  assert.equal(w.phase,'playing');
  assert.equal(w.restart,null);
  assert.ok(Math.abs(w.ball.vx-dir*16)<1e-9,'the panenka runs at 16 m/s down the middle');
  assert.ok(Math.abs(w.ball.vy)<1e-9,'the panenka never goes to a corner');
  assert.ok(Math.abs(w.ball.vz-4.5)<1e-9,'the panenka is a chip, higher than the 3.5 cap of a normal penalty');
  assert.equal(w.ball.flight,'shot');
  assert.equal(w.stats[0].shots,1);
  assert.equal(w.ball.lastTouch?.playerId,taker);
  const executed=events.find(e=>e.type==='penalty-executed');
  assert.ok(executed&&executed.playerId===taker);
  // Without L1 the same □ shoots hard and flat by contrast.
  const hard=penalty();
  const hardDir=hard.s.snapshot().teams[0].direction;
  run(hard.s,0,{action:'shoot',aim:{x:1,y:0}});
  const hw=hard.s.snapshot();
  assert.ok(Math.hypot(hw.ball.vx,hw.ball.vy)>=20,'without L1 the penalty runs at 20 m/s or more');
  assert.ok(hw.ball.vz<=3.5,'without L1 the penalty height stays under the cap');
  assert.ok(Math.abs(hardDir)>0,'the shot keeps the attack direction');
});

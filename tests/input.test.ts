import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { BrowserInput } from '../src/adapters/input';
import { ControllerMapper, type PadReading } from '../src/adapters/controller';
import type { ActionKind } from '../src/contracts/types';

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

test('keyboard movement, modifiers, aim and key-up are independent for both players',t=>{
  const {input,key}=browser(t);
  for(const code of ['KeyD','KeyW','ShiftLeft','ArrowLeft','ArrowDown','ShiftRight'])key('keydown',code);
  for(const slot of [0,1] as const){const f=input.sample(0,slot);const sign=slot===0?1:-1;assert(Math.abs(f.move.x-sign/Math.sqrt(2))<1e-12);assert(Math.abs(f.move.y+sign/Math.sqrt(2))<1e-12);assert.deepEqual(f.aim,f.move);assert(f.sprint);assert.equal(f.shield,false);}
  for(const code of ['KeyD','KeyW','ShiftLeft'])key('keyup',code);
  assert.deepEqual(input.sample(1,0).move,{x:0,y:0});assert(input.sample(1,1).sprint);
  key('keyup','ArrowLeft');key('keyup','ArrowDown');assert.deepEqual(input.sample(2,1).move,{x:0,y:0});
});

test('with the ball each keyboard action is an edge and each player consumes only their own keys',t=>{
  const {input,key}=browser(t);
  const pairs:[string,string,ActionKind][]=[['KeyJ','Numpad1','pass'],['KeyL','Numpad3','through'],['KeyI','Numpad5','cross']];
  for(const [a,b,action] of pairs){key('keydown',a);key('keydown',b);assert.equal(input.sample(0,1).action,action);assert.equal(input.sample(0,0).action,action);key('keydown',a);assert.equal(input.sample(1,0).action,undefined);assert.equal(input.sample(1,1).action,undefined);key('keyup',a);key('keyup',b);}
  key('keydown','KeyQ');key('keydown','Enter');assert(input.sample(2,1).switchPlayer);assert(input.sample(2,0).switchPlayer);assert.equal(input.sample(3,0).switchPlayer,false);assert.equal(input.sample(3,1).switchPlayer,false);
  // L1 (switch key) + ○ (cross key) is the lob.
  key('keydown','KeyQ');key('keydown','KeyI');const lob=input.sample(4,0);assert.equal(lob.action,'lob');assert.equal(lob.switchPlayer,false);key('keyup','KeyQ');key('keyup','KeyI');
  assert.equal(input.sample(5,0).action,undefined);
});

test('without the ball the defensive keys act and the attack keys do not',t=>{
  const {input,key,time}=browser(t);
  input.setDefending([true,true]);
  for(const [code,other] of [['KeyJ','Numpad1'],['KeyI','Numpad5'],['KeyL','Numpad3']] as const){
    key('keydown',code);key('keydown',other);assert.equal(input.sample(0,0).action,undefined,code);assert.equal(input.sample(0,1).action,undefined,other);key('keyup',code);key('keyup',other);
  }
  // Pressure hold: the first ✕ tap alone gives no tackle.
  key('keydown','KeyU');assert.equal(input.sample(1,0).action,undefined);assert.equal(input.sample(2,0).action,undefined);key('keyup','KeyU');
  // Standing tackle: the second tap inside the window gives the tackle.
  key('keydown','KeyU');assert.equal(input.sample(3,0).action,'tackle');key('keyup','KeyU');
  key('keydown','Numpad0');assert.equal(input.sample(3,1).action,undefined);key('keyup','Numpad0');
  key('keydown','Numpad0');assert.equal(input.sample(4,1).action,'tackle');key('keyup','Numpad0');
  key('keydown','KeyB');assert.equal(input.sample(5,0).action,'slide');key('keyup','KeyB');
  // The clearance key charges like the shot key.
  time(0);key('keydown','KeyK');time(425);key('keyup','KeyK');const clear=input.sample(6,0);assert.equal(clear.action,'shoot');assert.equal(clear.power,.5);
  // The shield key of FE is gone: shielding is automatic.
  key('keydown','Space');assert.equal(input.sample(7,0).shield,false);key('keyup','Space');
});

test('keyboard shots charge until release, clamp power and fire once for each player',t=>{
  const {input,key,time}=browser(t);
  for(const [slot,code,duration,power] of [[0,'KeyK',425,.5],[1,'Numpad2',1700,1],[0,'KeyK',1,.15]] as const){
    time(0);key('keydown',code);time(duration);key('keydown',code);assert.equal(input.sample(0,slot).action,undefined);
    key('keyup',code);assert.equal(input.sample(1,slot===0?1:0).action,undefined);
    const f=input.sample(1,slot);assert.equal(f.action,'shoot');assert.equal(f.power,power);assert.equal(input.sample(2,slot).action,undefined);
  }
});

test('touch joystick, buttons, switching and charge/release affect only player one',t=>{
  const {input,time}=browser(t);
  input.setTouchMove({x:1,y:1});input.setTouchSprint(true);input.setTouchShield(true);input.switchTouch();input.touchAction('pass');
  const other=input.sample(0,1);assert.deepEqual(other.move,{x:0,y:0});assert(!other.sprint&&!other.shield&&!other.switchPlayer);assert.equal(other.action,undefined);
  const f=input.sample(0,0);assert(Math.abs(Math.hypot(f.move.x,f.move.y)-1)<1e-12);assert(f.sprint&&f.shield&&f.switchPlayer);assert.equal(f.action,'pass');assert.equal(input.sample(1,0).action,undefined);assert.equal(input.sample(1,0).switchPlayer,false);
  for(const action of ['through','cross','tackle','header','lob','slide'] as const){input.touchAction(action);assert.equal(input.sample(2,0).action,action);}
  time(0);input.startTouchShot();time(425);assert.equal(input.charging,.5);assert.equal(input.sample(3,0).action,undefined);input.endTouchShot();assert.equal(input.charging,0);const shot=input.sample(4,0);assert.equal(shot.action,'shoot');assert.equal(shot.power,.5);assert.equal(input.sample(5,0).action,undefined);
  input.startTouchShot();time(2000);assert.equal(input.charging,1);input.endTouchShot(true);assert.equal(input.sample(6,0).action,undefined);
  input.setTouchMove({x:.05,y:0});input.setTouchSprint(false);input.setTouchShield(false);const stopped=input.sample(7,0);assert.deepEqual(stopped.move,{x:0,y:0});assert(!stopped.sprint&&!stopped.shield);
});

test('disabled and editing targets ignore keydown; browser defaults are prevented for game keys',t=>{
  const {input,key}=browser(t);input.enabled=false;key('keydown','KeyD');assert.deepEqual(input.sample(0,0).move,{x:0,y:0});input.enabled=true;
  for(const target of [new ElementStub('INPUT'),new ElementStub('SELECT'),new ElementStub('TEXTAREA'),new ElementStub('DIV',true)])key('keydown','KeyD',target);
  assert.deepEqual(input.sample(1,0).move,{x:0,y:0});
  for(const code of ['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'])assert(key('keydown',code));
  assert.equal(key('keydown','KeyD'),false);key('keyup','KeyD',new ElementStub('INPUT'));assert.equal(input.sample(2,0).move.x,0);
});

test('blur and hidden-document transitions clear held keys, queued actions and touch charges',t=>{
  const {input,key,emit,doc}=browser(t);
  for(const event of ['blur','visibilitychange']){
    for(const code of ['KeyD','KeyJ','KeyQ','KeyK','Numpad2'])key('keydown',code);
    input.setTouchMove({x:1,y:0});input.setTouchSprint(true);input.setTouchShield(true);input.touchAction('cross');input.switchTouch();input.startTouchShot();
    doc.hidden=true;emit(event);key('keyup','KeyK');key('keyup','Numpad2');input.endTouchShot();assert.equal(input.charging,0);
    for(const slot of [0,1] as const){const f=input.sample(0,slot);assert.deepEqual(f.move,{x:0,y:0});assert(!f.sprint&&!f.shield&&!f.switchPlayer);assert.equal(f.action,undefined);}
  }
  key('keydown','KeyD');doc.hidden=false;emit('visibilitychange');assert.equal(input.sample(1,0).move.x,1);
});

test('keyboard tackle: hold, single tap and slow pair give no action, the fast pair gives one',t=>{
  const {input,key,time}=browser(t);
  input.setDefending([true,true]);
  // Hold: the press edge arms and the hold adds nothing.
  time(0);key('keydown','KeyU');assert.equal(input.sample(0,0).action,undefined);
  assert.equal(input.sample(1,0).action,undefined);time(400);assert.equal(input.sample(2,0).action,undefined);key('keyup','KeyU');
  // Single tap: no action.
  time(800);key('keydown','KeyU');assert.equal(input.sample(3,0).action,undefined);key('keyup','KeyU');
  assert.equal(input.sample(4,0).action,undefined);
  // A pair beyond the 250 ms window is not a tackle.
  time(1200);key('keydown','KeyU');assert.equal(input.sample(5,0).action,undefined);key('keyup','KeyU');
  time(2000);key('keydown','KeyU');assert.equal(input.sample(6,0).action,undefined);key('keyup','KeyU');
  // The fast pair fires exactly one tackle, and a third tap only arms.
  time(2100);key('keydown','KeyU');assert.equal(input.sample(7,0).action,'tackle');key('keyup','KeyU');
  assert.equal(input.sample(8,0).action,undefined);
  time(2200);key('keydown','KeyU');assert.equal(input.sample(9,0).action,undefined);key('keyup','KeyU');
});

test('the keyboard tackle tap resets with clear and needs a fresh pair',t=>{
  const {input,key,time}=browser(t);
  input.setDefending([true,true]);
  time(0);key('keydown','KeyU');assert.equal(input.sample(0,0).action,undefined);key('keyup','KeyU');
  // clear() drops the armed tap: the next tap only arms again.
  input.clear();time(50);key('keydown','KeyU');assert.equal(input.sample(1,0).action,undefined);key('keyup','KeyU');
  time(100);key('keydown','KeyU');assert.equal(input.sample(2,0).action,'tackle');key('keyup','KeyU');
});

test('browser pause delegates standard-pad start edges and ignores disconnected pads',t=>{
  const {input,pads}=browser(t);pads.push(pad());assert.equal(input.pauseRequested(),false);pads[0]=pad(0,[9]);assert(input.pauseRequested());assert.equal(input.pauseRequested(),false);pads[0].connected=false;assert.equal(input.pauseRequested(),false);pads[0]=pad(0,[9]);assert.equal(input.pauseRequested(),false);
});

test('browser camera delegates the touchpad click edge and ignores disconnected pads',t=>{
  const {input,pads}=browser(t);pads.push(pad());assert.equal(input.cameraRequested(),false);
  pads[0]=pad(0,[17]);assert.equal(input.cameraRequested(),true);assert.equal(input.cameraRequested(),false);
  // A disconnected pad forgets its edge, so a reconnect needs a fresh click.
  pads[0].connected=false;assert.equal(input.cameraRequested(),false);
  pads[0]=pad(0,[17]);assert.equal(input.cameraRequested(),false);
  // Non-standard pads never reach the camera.
  pads[0]={...pad(0,[17]),mapping:''};assert.equal(input.cameraRequested(),false);
});

test('controller dead-zone boundaries, clamping and invalid axes stay finite',()=>{
  for(const value of [-Infinity,NaN,Infinity,-.18,0,.18]){const m=new ControllerMapper();assert.deepEqual(m.sample([pad(0,[],[value,value,value,value])],0,0).move,{x:0,y:0});assert.equal(m.sample([pad(0,[],[value,value,value,value])],0,0).aim,undefined);}
  for(const value of [-.180001,.180001,-1,1,-2,2]){const m=new ControllerMapper();const f=m.sample([pad(0,[],[value,0])],0,0);const expected=Math.sign(value)*Math.min(1,(Math.abs(value)-.18)/.82);assert(Math.abs(f.move.x-expected)<1e-12);assert.equal(f.move.y,0);}
});

test('nonstandard pads are ignored for assignment, actions and pause',()=>{
  const m=new ControllerMapper(),unknown={...pad(0,[0,9],[1,1]),mapping:''};
  assert.deepEqual(m.sample([unknown],0,0).move,{x:0,y:0});assert.deepEqual(m.assignments(),[null,null]);assert.equal(m.pauseRequested([unknown]),false);
  unknown.buttons[9].pressed=false;m.pauseRequested([unknown]);unknown.buttons[9].pressed=true;assert.equal(m.pauseRequested([unknown]),false);
  m.sample([unknown,pad(1)],1,0);assert.deepEqual(m.assignments(),['1:pad1',null]);
});

test('extra pads wait for a free slot without displacing either local player',()=>{
  const m=new ControllerMapper();m.sample([pad(0),pad(1),pad(2)],0,0);assert.deepEqual(m.assignments(),['0:pad0','1:pad1']);
  assert.equal(m.sample([pad(2,[0]),pad(1),pad(0)],1,0).action,undefined);assert.deepEqual(m.assignments(),['0:pad0','1:pad1']);
  const f=m.sample([pad(1),pad(2,[1])],2,0);assert.equal(f.action,undefined);assert.deepEqual(m.assignments(),['2:pad2','1:pad1']);assert.equal(m.sample([pad(1),pad(2)],3,0).action,undefined);
});

test('browser routes two connected pads and applies their movement, aim and action overrides',t=>{
  const {input,key,pads}=browser(t);
  pads.push({...pad(9,[0],[1,0]),connected:false},pad(0),pad(1));
  input.sample(0,0);input.sample(0,1);
  key('keydown','KeyA');key('keydown','KeyJ');key('keydown','ArrowRight');
  pads[1]=pad(0,[1,5],[1,0,0,-1]);pads[2]=pad(1,[0],[-1,0,0,1]);
  const first=input.sample(1,0),second=input.sample(1,1);
  assert.deepEqual(first.move,{x:1,y:0});assert.deepEqual(first.aim,{x:0,y:-1});assert.equal(first.action,'cross');assert(first.sprint);assert.equal(first.shield,false);
  assert.deepEqual(second.move,{x:-1,y:0});assert.deepEqual(second.aim,{x:0,y:1});assert.equal(second.action,'pass');assert(!second.sprint&&!second.shield);
  assert.equal(input.sample(2,0).action,undefined);assert.equal(input.sample(2,1).action,undefined);
});

test('the pad follows the defending flag that input passes to the mapper',t=>{
  const {input,pads}=browser(t);pads.push(pad(0),pad(1));input.sample(0,0);input.sample(0,1);
  // The first ✕ tap arms the tackle, the ✕ ×2 tap fires it.
  input.setDefending([true,true]);pads[0]=pad(0,[0]);assert.equal(input.sample(1,0).action,undefined);
  pads[0]=pad(0,[]);input.sample(2,0);pads[0]=pad(0,[0]);assert.equal(input.sample(3,0).action,'tackle');
  input.setDefending([false,false]);pads[0]=pad(0,[]);input.sample(4,0);pads[0]=pad(0,[0]);assert.equal(input.sample(5,0).action,'pass');
  // The flag of one player does not touch the other player.
  input.setDefending([true,false]);pads[0]=pad(0,[]);pads[1]=pad(1,[0]);input.sample(6,0);
  assert.equal(input.sample(6,1).action,'pass');
  pads[0]=pad(0,[0]);assert.equal(input.sample(7,0).action,undefined);
  pads[0]=pad(0,[]);input.sample(8,0);pads[0]=pad(0,[0]);assert.equal(input.sample(9,0).action,'tackle');
});

test('with the aerial context every kick button and key heads the ball',t=>{
  const {input,key,pads}=browser(t);
  pads.push(pad(0));input.sample(0,0);
  let tick=1;
  // Without the aerial context each key keeps its own action.
  for(const [code,action] of [['KeyJ','pass'],['KeyL','through'],['KeyI','cross']] as const){
    key('keydown',code);assert.equal(input.sample(tick++,0).action,action,code);key('keyup',code);
  }
  // Aerial: ✕, △, ○ and □ keys head the ball, the defense keys of the same
  // buttons included, and □ skips its shot charge.
  input.setAerial([true,true]);
  for(const code of ['KeyJ','KeyL','KeyI','KeyB','KeyU','KeyK']){
    key('keydown',code);assert.equal(input.sample(tick++,0).action,'header',code);key('keyup',code);
    assert.equal(input.sample(tick++,0).action,undefined,code);
  }
  // The pad buttons ✕, △, ○ and □ head the ball too, with and without the ball.
  for(const defending of [false,true]){
    input.setDefending([defending,defending]);
    for(const button of [0,3,1,2]){
      pads[0]=pad(0,[button]);assert.equal(input.sample(tick++,0).action,'header',`button ${button} defending=${defending}`);
      pads[0]=pad(0);assert.equal(input.sample(tick++,0).action,undefined,`button ${button} release`);
    }
  }
  input.setDefending([false,false]);
  // Below head height the same pad press charges the shot again.
  input.setAerial([false,false]);
  pads[0]=pad(0,[2]);assert.equal(input.sample(tick++,0).action,undefined);pads[0]=pad(0);
  assert.equal(input.sample(tick++,0).action,'shoot');
  key('keydown','KeyJ');assert.equal(input.sample(tick++,0).action,'pass');key('keyup','KeyJ');
});

test('aim follows movement, persists at rest and resets when playing direction changes',t=>{
  const {input,key}=browser(t);
  assert.deepEqual(input.sample(0,0).aim,{x:1,y:0});assert.deepEqual(input.sample(0,1).aim,{x:-1,y:0});
  key('keydown','KeyW');input.sample(1,0);key('keyup','KeyW');assert.deepEqual(input.sample(2,0).aim,{x:0,y:-1});
  input.setDirections([-1,1]);assert.deepEqual(input.sample(3,0).aim,{x:-1,y:0});assert.deepEqual(input.sample(3,1).aim,{x:1,y:0});
});

test('keeper keyboard and pad switches are isolated edges and clear on pause',t=>{
 const {input,key,pads}=browser(t);
 key('keydown','KeyR');key('keydown','Numpad8');
 assert(input.sample(0,0).switchKeeper);assert(input.sample(0,1).switchKeeper);
 assert(!input.sample(1,0).switchKeeper);assert(!input.sample(1,1).switchKeeper);
 pads.push(pad(0),pad(1));input.sample(2,0);input.sample(2,1);
 pads[0]=pad(0,[11]);pads[1]=pad(1,[11]);
 assert(input.sample(3,0).switchKeeper);assert(input.sample(3,1).switchKeeper);
 input.clear();input.enabled=false;
 assert(!input.sample(4,0).switchKeeper);
 input.enabled=true;assert(!input.sample(5,0).switchKeeper);
});


test('touch keeper switch is a player-one edge and clears with browser input',t=>{
 const {input,emit}=browser(t);
 input.switchKeeperTouch();assert(!input.sample(0,1).switchKeeper);
 assert(input.sample(0,0).switchKeeper);assert(!input.sample(1,0).switchKeeper);
 input.switchKeeperTouch();emit('blur');assert(!input.sample(2,0).switchKeeper);
 input.enabled=false;input.switchKeeperTouch();assert(!input.sample(3,0).switchKeeper);
 input.clear();input.enabled=true;assert(!input.sample(4,0).switchKeeper);
});

for(const source of ['keyboard','touch','gamepad'] as const)test(`browser ${source} adapter switches keeper in and out`,t=>{
 const {input,key,pads}=browser(t);
 const sim=new Simulation(createConfig({teamSize:2,human:[true,true],seed:41}),[makeTeam(0,2),makeTeam(1,2)]);
 const initial=sim.snapshot();initial.phase='playing';initial.restart=null;sim.restore(initial);
 pads.push(pad(0),pad(1));input.sample(-1,0);input.sample(-1,1);
 for(const slot of (source==='touch'?[0] as const:[0,1] as const)){
  const keeper=initial.players.find(p=>p.team===slot&&p.keeper)!;
  for(const entering of [true,false]){
   if(source==='keyboard')key('keydown',slot===0?'KeyR':'Numpad8');
   if(source==='touch')input.switchKeeperTouch();
   if(source==='gamepad')pads[slot]=pad(slot,[11]);
   sim.applyInputs([input.sample(sim.tick,0),input.sample(sim.tick,1)]);sim.step();
   const world=sim.snapshot();assert.equal(world.selected[slot]===keeper.id,entering);
   assert.equal(world.players.find(p=>p.id===keeper.id)!.manualControl,entering?true:undefined);
   const hash=sim.stateHash();assert(sim.presentation().players.every(p=>!('manualControl' in p)));assert.equal(sim.stateHash(),hash);
   if(source==='keyboard')key('keyup',slot===0?'KeyR':'Numpad8');
   if(source==='gamepad')pads[slot]=pad(slot);
   sim.applyInputs([input.sample(sim.tick,0),input.sample(sim.tick,1)]);sim.step();
   assert.equal(sim.snapshot().selected[slot]===keeper.id,entering,'held/released input must not toggle again');
  }
 }
});

test('an aerial pad □ press heads once and its release never shoots',()=>{
  const m=new ControllerMapper();
  let tick=0;
  assert.equal(m.sample([pad(0)],tick++,0,false,true).action,undefined);
  // □ down while aerial: the header fires and the press is spent.
  assert.equal(m.sample([pad(0,[2])],tick++,0,false,true).action,'header');
  assert.equal(m.sample([pad(0,[2])],tick++,0,false,true).action,undefined);
  // Release with aerial off: the spent press gives no shot.
  assert.equal(m.sample([pad(0)],tick++,0,false,false).action,undefined);
  // The next press below head height charges and shoots again.
  assert.equal(m.sample([pad(0,[2])],tick++,0,false,false).action,undefined);
  assert.equal(m.sample([pad(0)],tick++,0,false,false).action,'shoot');
});

test('an aerial keyboard □ press heads once and its release never shoots',t=>{
  const {input,key}=browser(t);
  input.sample(0,0);
  input.setAerial([true,true]);
  key('keydown','KeyK');
  assert.equal(input.sample(1,0).action,'header');
  input.setAerial([false,false]);
  key('keyup','KeyK');
  assert.equal(input.sample(2,0).action,undefined);
  // The next press below head height charges and shoots again.
  key('keydown','KeyK');
  assert.equal(input.sample(3,0).action,undefined);
  key('keyup','KeyK');
  assert.equal(input.sample(4,0).action,'shoot');
});

test('the keeper dive key fires one press while the outfield tackle keeps the double tap',t=>{
  const {input,key,pads}=browser(t);
  pads.push(pad(0),pad(1));input.sample(0,0);input.sample(0,1);
  input.setDefending([true,true]);
  // Outfield: the first keyboard tap only arms, the second tap inside the window fires.
  key('keydown','KeyU');assert.equal(input.sample(1,0).action,undefined);key('keyup','KeyU');
  key('keydown','KeyU');assert.equal(input.sample(2,0).action,'tackle');key('keyup','KeyU');
  // Outfield: the pad keeps the same double tap on ✕.
  pads[0]=pad(0,[0]);assert.equal(input.sample(3,0).action,undefined);
  pads[0]=pad(0);input.sample(4,0);
  pads[0]=pad(0,[0]);assert.equal(input.sample(5,0).action,'tackle');
  pads[0]=pad(0);input.sample(6,0);
  // Keeper: one keyboard press dives, for both players.
  input.setKeeper([true,true]);
  key('keydown','KeyU');assert.equal(input.sample(7,0).action,'tackle');key('keyup','KeyU');
  assert.equal(input.sample(8,0).action,undefined);
  key('keydown','Numpad0');assert.equal(input.sample(9,1).action,'tackle');key('keyup','Numpad0');
  // Keeper: one pad press dives too.
  pads[0]=pad(0,[0]);assert.equal(input.sample(10,0).action,'tackle');
  pads[0]=pad(0);assert.equal(input.sample(11,0).action,undefined);
  // Away from the keeper cursor the double tap returns.
  input.setKeeper([false,false]);
  key('keydown','KeyU');assert.equal(input.sample(12,0).action,undefined);key('keyup','KeyU');
  key('keydown','KeyU');assert.equal(input.sample(13,0).action,'tackle');key('keyup','KeyU');
});

test('a keyboard □ press made in the air arms no shot until the key is up',t=>{
  const {input,key}=browser(t);
  input.sample(0,0);
  // The press starts in the air, the band ends before the next sample.
  input.setAerial([true,true]);
  key('keydown','KeyK');
  input.setAerial([false,false]);
  key('keyup','KeyK');
  assert.equal(input.sample(1,0).action,undefined);
  // The next press below head height charges and shoots again.
  key('keydown','KeyK');
  assert.equal(input.sample(2,0).action,undefined);
  key('keyup','KeyK');
  assert.equal(input.sample(3,0).action,'shoot');
});

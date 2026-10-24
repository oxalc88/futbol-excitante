import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserInput } from '../src/adapters/input';
import { ControllerMapper, type PadReading } from '../src/adapters/controller';
import type { ActionKind } from '../src/contracts/types';

class ElementStub {
  constructor(public tagName='DIV', public isContentEditable=false) {}
}
function pad(index=0, buttons:number[]=[], axes:number[]=[]):PadReading {
  return {index,id:`pad${index}`,mapping:'standard',connected:true,axes,
    buttons:Array.from({length:17},(_,i)=>({pressed:buttons.includes(i)}))};
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
  for(const code of ['KeyD','KeyW','ShiftLeft','Space','ArrowLeft','ArrowDown','ShiftRight','NumpadDecimal'])key('keydown',code);
  for(const slot of [0,1] as const){const f=input.sample(0,slot);const sign=slot===0?1:-1;assert(Math.abs(f.move.x-sign/Math.sqrt(2))<1e-12);assert(Math.abs(f.move.y+sign/Math.sqrt(2))<1e-12);assert.deepEqual(f.aim,f.move);assert(f.sprint);assert(f.shield);}
  for(const code of ['KeyD','KeyW','ShiftLeft','Space'])key('keyup',code);
  assert.deepEqual(input.sample(1,0).move,{x:0,y:0});assert(input.sample(1,1).sprint);
  key('keyup','ArrowLeft');key('keyup','ArrowDown');assert.deepEqual(input.sample(2,1).move,{x:0,y:0});
});

test('every keyboard action is an edge and each player consumes only their own keys',t=>{
  const {input,key}=browser(t);
  const pairs:[string,string,ActionKind][]=[['KeyJ','Numpad1','pass'],['KeyL','Numpad3','through'],['KeyI','Numpad5','cross'],['KeyU','Numpad0','tackle'],['KeyO','Numpad6','header'],['KeyH','Numpad4','lob'],['KeyB','Numpad7','slide']];
  for(const [a,b,action] of pairs){key('keydown',a);key('keydown',b);assert.equal(input.sample(0,1).action,action);assert.equal(input.sample(0,0).action,action);key('keydown',a);assert.equal(input.sample(1,0).action,undefined);assert.equal(input.sample(1,1).action,undefined);key('keyup',a);key('keyup',b);}
  key('keydown','KeyQ');key('keydown','Enter');assert(input.sample(2,1).switchPlayer);assert(input.sample(2,0).switchPlayer);assert.equal(input.sample(3,0).switchPlayer,false);assert.equal(input.sample(3,1).switchPlayer,false);
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

test('browser pause delegates standard-pad start edges and ignores disconnected pads',t=>{
  const {input,pads}=browser(t);pads.push(pad());assert.equal(input.pauseRequested(),false);pads[0]=pad(0,[9]);assert(input.pauseRequested());assert.equal(input.pauseRequested(),false);pads[0].connected=false;assert.equal(input.pauseRequested(),false);pads[0]=pad(0,[9]);assert.equal(input.pauseRequested(),false);
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
  pads[1]=pad(0,[2,6,10],[1,0,0,-1]);pads[2]=pad(1,[0],[-1,0,0,1]);
  const first=input.sample(1,0),second=input.sample(1,1);
  assert.deepEqual(first.move,{x:1,y:0});assert.deepEqual(first.aim,{x:0,y:-1});assert.equal(first.action,'cross');assert(first.sprint&&first.shield);
  assert.deepEqual(second.move,{x:-1,y:0});assert.deepEqual(second.aim,{x:0,y:1});assert.equal(second.action,'pass');assert(!second.sprint&&!second.shield);
  assert.equal(input.sample(2,0).action,undefined);assert.equal(input.sample(2,1).action,undefined);
});

test('aim follows movement, persists at rest and resets when playing direction changes',t=>{
  const {input,key}=browser(t);
  assert.deepEqual(input.sample(0,0).aim,{x:1,y:0});assert.deepEqual(input.sample(0,1).aim,{x:-1,y:0});
  key('keydown','KeyW');input.sample(1,0);key('keyup','KeyW');assert.deepEqual(input.sample(2,0).aim,{x:0,y:-1});
  input.setDirections([-1,1]);assert.deepEqual(input.sample(3,0).aim,{x:-1,y:0});assert.deepEqual(input.sample(3,1).aim,{x:1,y:0});
});

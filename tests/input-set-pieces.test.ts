import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserInput } from '../src/adapters/input';

class ElementStub {
  constructor(public tagName='DIV', public isContentEditable=false) {}
}
function browser(t:TestContext) {
  const listeners=new Map<string,((event:any)=>void)[]>();
  const on=(name:string,fn:(event:any)=>void)=>listeners.set(name,[...listeners.get(name)??[],fn]);
  let now=0;
  const doc={hidden:false,addEventListener:on};
  const replacements={window:{addEventListener:on},document:doc,HTMLElement:ElementStub,
    navigator:{getGamepads:()=>[]},performance:{now:()=>now}};
  for(const [key,value] of Object.entries(replacements)) {
    const original=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else Reflect.deleteProperty(globalThis,key);});
  }
  const input=new BrowserInput();input.enabled=true;
  const emit=(name:string,event:object={})=>listeners.get(name)?.forEach(fn=>fn(event));
  const key=(name:string,code:string,target:object|null=null)=>emit(name,{code,target,preventDefault:()=>{}});
  return {input,key,emit,time:(value:number)=>{now=value;}};
}
type Restart=[{kind:string,attacking:boolean}|null,{kind:string,attacking:boolean}|null];

test('attacking free kick: kick, second taker, second kick, feint and short roll',t=>{
  const {input,key}=browser(t);
  input.setRestart([{kind:'free-kick',attacking:true},null] as Restart);
  key('keydown','KeyK');
  let frame=input.sample(1,0);
  assert.equal(frame.setKick,undefined);
  key('keyup','KeyK');
  frame=input.sample(2,0);
  assert.equal(frame.action,'shoot');assert.equal(frame.setKick,true);
  // Q held + up edge places the second taker beside the ball.
  key('keydown','KeyQ');key('keydown','KeyW');key('keyup','KeyW');
  frame=input.sample(2,0);
  assert.equal(frame.secondTaker,'side');
  key('keyup','KeyQ');
  // E held plays the second taker kick.
  key('keydown','KeyE');
  frame=input.sample(3,0);
  assert.equal(frame.secondKick,true);
  key('keyup','KeyE');
  // I held + J edge fakes the kick; no kick flag needed on that sample.
  key('keydown','KeyI');key('keydown','KeyJ');key('keyup','KeyJ');
  frame=input.sample(4,0);
  assert.equal(frame.setFeint,true);
  key('keyup','KeyI');
  // Q + J edge rolls the ball short.
  key('keydown','KeyQ');key('keydown','KeyJ');key('keyup','KeyJ');
  frame=input.sample(5,0);
  assert.equal(frame.shortRoll,true);
  key('keyup','KeyQ');
  // No restart: no set-piece flags at all.
  input.setRestart([null,null]);
  key('keydown','KeyK');key('keyup','KeyK');
  frame=input.sample(6,0);
  assert.equal(frame.setKick,undefined);
  assert.equal(frame.secondTaker,undefined);
});

test('attacking penalty panenka and corner strategy edge',t=>{
  const {input,key}=browser(t);
  input.setRestart([{kind:'penalty',attacking:true},null] as Restart);
  key('keydown','KeyQ');key('keydown','KeyK');key('keyup','KeyK');
  assert.equal(input.sample(1,0).panenka,true);
  key('keyup','KeyQ');
  input.setRestart([{kind:'corner',attacking:true},null] as Restart);
  key('keydown','KeyD');key('keyup','KeyD');
  assert.equal(input.sample(2,0).cornerSide,'right');
});

test('defending free kick: wall jump, wall charge and keeper move',t=>{
  const {input,key,time}=browser(t);
  input.setRestart([null,{kind:'free-kick',attacking:false}] as Restart);
  // Slot 1 uses the arrow keys and the numpad keys of player 2.
  key('keydown','Numpad2');key('keyup','Numpad2');
  assert.equal(input.sample(1,1).wallJump,true);
  // Hold ○ (Num 5): the wall charge grows with the hold time.
  key('keydown','Numpad5');time(200);
  const frame=input.sample(2,1);
  assert.ok(frame.wallCharge!==undefined&&frame.wallCharge>0&&frame.wallCharge<1);
  key('keyup','Numpad5');
  // △ + stick moves the keeper.
  key('keydown','Numpad3');key('keydown','ArrowUp');
  const moved=input.sample(3,1);
  assert.ok(moved.keeperMove&&moved.keeperMove.y<0);
  key('keyup','ArrowUp');key('keyup','Numpad3');
  // Wall keeps down while ✕ is held: no jump on the □ edge.
  key('keydown','Numpad1');key('keydown','Numpad2');key('keyup','Numpad2');
  assert.equal(input.sample(4,1).wallJump,undefined);
  key('keyup','Numpad1');
  // clear() resets the restart state.
  input.clear();
  key('keydown','Numpad2');key('keyup','Numpad2');
  assert.equal(input.sample(5,1).wallJump,undefined);
});

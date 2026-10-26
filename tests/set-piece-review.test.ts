import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserInput } from '../src/adapters/input';
import { ControllerMapper, type PadReading } from '../src/adapters/controller';
import { PeerSession } from '../src/adapters/network';
import type { InputFrame } from '../src/contracts/types';

function pad(buttons:number[]=[],axes:number[]=[0,0,0,0]):PadReading{return {index:0,id:'pad',mapping:'standard',connected:true,axes,buttons:Array.from({length:18},(_,i)=>({pressed:buttons.includes(i)}))};}
function browser(t:TestContext){
  const listeners=new Map<string,((e:any)=>void)[]>(),pads:PadReading[]=[];
  const on=(name:string,fn:(e:any)=>void)=>listeners.set(name,[...(listeners.get(name)??[]),fn]);
  let now=0;
  for(const [key,value] of Object.entries({window:{addEventListener:on},document:{hidden:false,addEventListener:on},HTMLElement:class{},navigator:{getGamepads:()=>pads},performance:{now:()=>now}})){
    const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(old)Object.defineProperty(globalThis,key,old);else Reflect.deleteProperty(globalThis,key);});
  }
  const input=new BrowserInput();input.enabled=true;
  const key=(name:string,code:string)=>listeners.get(name)?.forEach(fn=>fn({code,target:null,preventDefault(){}}));
  return {input,key,pads,time:(ms:number)=>{now=ms;}};
}

test('keyboard set-piece releases carry action and kick flags; feint spends both releases',t=>{
  const {input,key,time}=browser(t);input.setRestart([{kind:'free-kick',attacking:true},null]);
  let at=0,tick=0;for(const [code,action] of [['KeyK','shoot'],['KeyI','cross'],['KeyJ','pass']] as const){
    key('keydown',code);assert.equal(input.sample(tick++,0).action,undefined);
    at+=400;time(at);key('keyup',code);const released=input.sample(tick++,0);
    assert.equal(released.action,action);assert.equal(released.setKick,true);assert.ok((released.power??0)>.4);
  }
  key('keydown','KeyI');input.sample(tick++,0);key('keydown','KeyJ');const feint=input.sample(tick++,0);
  assert.equal(feint.setFeint,true);assert.equal(feint.action,undefined);
  key('keyup','KeyJ');assert.equal(input.sample(tick++,0).action,undefined);
  key('keyup','KeyI');assert.equal(input.sample(tick++,0).action,undefined);
  key('keydown','KeyI');input.sample(tick++,0);key('keydown','KeyJ');key('keyup','KeyJ');
  const quick=input.sample(tick++,0);assert.equal(quick.setFeint,true);assert.equal(quick.action,undefined);assert.equal(quick.setKick,undefined);
  key('keyup','KeyI');assert.equal(input.sample(tick++,0).action,undefined);
});

test('keyboard panenka and short roll latch across release, for both slots',t=>{
  const {input,key}=browser(t);
  for(const [slot,modifier,shot,pass] of [[0,'KeyQ','KeyK','KeyJ'],[1,'Enter','Numpad2','Numpad1']] as const){
    input.setRestart(slot===0?[{kind:'penalty',attacking:true},null]:[null,{kind:'penalty',attacking:true}]);
    key('keydown',modifier);key('keydown',shot);key('keyup',shot);
    const chip=input.sample(1,slot);assert.equal(chip.action,'shoot');assert.equal(chip.panenka,true);assert.equal(chip.setKick,true);
    key('keyup',modifier);input.sample(2,slot);
    input.setRestart(slot===0?[{kind:'free-kick',attacking:true},null]:[null,{kind:'free-kick',attacking:true}]);
    key('keydown',modifier);key('keydown',pass);key('keyup',pass);
    const roll=input.sample(3,slot);assert.equal(roll.action,'pass');assert.equal(roll.shortRoll,true);assert.equal(roll.setKick,true);
    key('keyup',modifier);input.sample(4,slot);
    key('keydown',modifier);key('keydown',shot);key('keyup',shot);
    const plain=input.sample(5,slot);assert.equal(plain.action,'shoot');assert.equal(plain.setKick,true);assert.equal(plain.panenka,undefined);
    key('keyup',modifier);input.sample(6,slot);
  }
});

test('keyboard and pad direction lock holds aim while movement changes',t=>{
  const {input,key,pads}=browser(t);input.setRestart([{kind:'free-kick',attacking:true},null]);
  pads[0]=pad();key('keydown','KeyW');assert.deepEqual(input.sample(1,0).aim,{x:0,y:-1});key('keyup','KeyW');
  key('keydown','KeyG');key('keydown','KeyD');assert.deepEqual(input.sample(2,0).aim,{x:0,y:-1});
  key('keyup','KeyG');assert.deepEqual(input.sample(3,0).aim,{x:1,y:0});key('keyup','KeyD');
  pads[0]=pad([],[0,0,0,1]);assert.deepEqual(input.sample(4,0).aim,{x:0,y:1});
  pads[0]=pad([7],[1,0,1,0]);assert.deepEqual(input.sample(5,0).aim,{x:0,y:1});
  pads[0]=pad([],[1,0,1,0]);assert.deepEqual(input.sample(6,0).aim,{x:1,y:0});
});

test('pad restarts charge on release and emit second taker, wall and corner rows',()=>{
  const mapper=new ControllerMapper(),restart={kind:'free-kick',attacking:true};
  mapper.sample([pad()],0,0,false,false,false,false,restart);
  assert.equal(mapper.sample([pad([1])],1,0,false,true,false,false,restart).action,undefined);
  const kick=mapper.sample([pad()],2,0,false,true,false,false,restart);
  assert.equal(kick.action,'cross');assert.equal(kick.setKick,true);
  mapper.sample([pad([1])],3,0,false,false,false,false,restart);
  const feint=mapper.sample([pad([1,0])],4,0,false,false,false,false,restart);
  assert.equal(feint.setFeint,true);assert.equal(feint.action,undefined);
  assert.equal(mapper.sample([pad([1])],5,0,false,false,false,false,restart).action,undefined);
  assert.equal(mapper.sample([pad()],6,0,false,false,false,false,restart).action,undefined);
  mapper.sample([pad([4,2])],7,0,false,false,false,false,{kind:'penalty',attacking:true});
  const chip=mapper.sample([pad([4])],8,0,false,false,false,false,{kind:'penalty',attacking:true});
  assert.equal(chip.action,'shoot');assert.equal(chip.panenka,true);assert.equal(chip.setKick,true);
  mapper.sample([pad()],9,0,false,false,false,false,{kind:'corner',attacking:false});
  assert.equal(mapper.sample([pad([14])],10,0,false,false,false,false,{kind:'corner',attacking:false}).cornerSide,'left');
  mapper.sample([pad()],11,0,false,false,false,false,{kind:'free-kick',attacking:false});
  assert.equal(mapper.sample([pad([2])],12,0,false,false,false,false,{kind:'free-kick',attacking:false}).wallJump,true);
  const wall=mapper.sample([pad([1,3],[0,1,0,0])],13,0,false,false,false,false,{kind:'free-kick',attacking:false});
  assert.ok(wall.keeperMove);assert.ok((wall.wallCharge??0)>0);
  mapper.sample([pad([0])],14,0,false,false,false,false,{kind:'free-kick',attacking:false});
  assert.equal(mapper.sample([pad([0,2])],15,0,false,false,false,false,{kind:'free-kick',attacking:false}).wallJump,undefined);
  const attack=new ControllerMapper();attack.sample([pad()],0,0,false,false,false,false,restart);
  const second=attack.sample([pad([4,12])],1,0,false,false,false,false,restart);assert.equal(second.secondTaker,'side');
  attack.sample([pad([6,0])],2,0,false,false,false,false,restart);
  const secondKick=attack.sample([pad([6])],3,0,false,false,false,false,restart);
  assert.equal(secondKick.action,'pass');assert.equal(secondKick.secondKick,true);assert.equal(secondKick.setKick,true);
  attack.sample([pad([4,0])],4,0,false,false,false,false,restart);
  const roll=attack.sample([pad([4])],5,0,false,false,false,false,restart);
  assert.equal(roll.action,'pass');assert.equal(roll.shortRoll,true);
  attack.sample([pad([2])],6,0,false,false,false,false,restart);
  assert.equal(attack.sample([pad()],7,0,false,false,false,false,restart).setKick,true);
  const kickoff=new ControllerMapper();kickoff.sample([pad()],0,0,false,false,false,false,{kind:'kickoff',attacking:true});
  assert.equal(kickoff.sample([pad([0])],1,0,false,false,false,false,{kind:'kickoff',attacking:true}).action,'pass');
});

test('pad mapper freezes restart aim and ignores a held button on connection',()=>{
  const mapper=new ControllerMapper(),restart={kind:'free-kick',attacking:true};
  mapper.sample([pad([],[0,1,0,0])],0,0,false,false,false,false,restart);
  assert.deepEqual(mapper.sample([pad([7],[1,0,1,0])],1,0,false,false,false,false,restart).aim,{x:0,y:1});
  assert.deepEqual(mapper.sample([pad([7],[0,-1,0,-1])],2,0,false,false,false,false,restart).aim,{x:0,y:1});
  assert.deepEqual(mapper.sample([pad([],[1,0,0,0])],3,0,false,false,false,false,restart).aim,{x:1,y:0});
  const reconnect=new ControllerMapper();
  reconnect.sample([pad([2])],0,0,false,false,false,false,restart);
  assert.equal(reconnect.sample([pad()],1,0,false,false,false,false,restart).action,undefined);
  reconnect.sample([pad([2])],2,0,false,false,false,false,restart);
  assert.equal(reconnect.sample([pad()],3,0,false,false,false,false,restart).action,'shoot');
});

test('host keeps kick fields together and transient controls for one frame',t=>{
  let now=0;const old=Object.getOwnPropertyDescriptor(globalThis,'performance');Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});t.after(()=>{if(old)Object.defineProperty(globalThis,'performance',old);});
  const sent:string[]=[];const channel:any={readyState:'open',bufferedAmount:0,onopen:null,onclose:null,onmessage:null,close(){},send(s:string){sent.push(s);}};
  const session=new PeerSession();session.role='host';(session as any).bind(channel);
  const base:InputFrame={tick:0,slot:0,move:{x:0,y:0},aim:{x:1,y:0},sprint:false,shield:false};
  const deliver=(seq:number,f:Partial<InputFrame>)=>channel.onmessage({data:JSON.stringify({type:'input',sequence:seq,frame:{...base,...f}})});
  now=1;deliver(1,{action:'shoot',aim:{x:.5,y:.5},power:.8,setKick:true,panenka:true});
  deliver(1,{action:'shoot',aim:{x:0,y:1},power:.1});
  deliver(2,{aim:{x:1,y:0},power:.2,keeperMove:{x:0,y:3},wallCharge:4});
  const kick=session.hostFrame(1);assert.equal(kick.action,'shoot');assert.deepEqual(kick.aim,{x:.5,y:.5});assert.equal(kick.power,.8);assert.equal(kick.setKick,true);assert.equal(kick.panenka,true);assert.deepEqual(kick.keeperMove,{x:0,y:1});assert.equal(kick.wallCharge,1);
  const next=session.hostFrame(2);assert.equal(next.action,undefined);assert.equal(next.setKick,undefined);assert.equal(next.panenka,undefined);assert.deepEqual(next.aim,{x:1,y:0});
  deliver(3,{secondKick:true});assert.equal(session.hostFrame(3).secondKick,true);
  deliver(4,{secondKick:true});deliver(5,{action:'pass'});assert.equal(session.hostFrame(4).secondKick,undefined);
  deliver(6,{action:'pass',secondKick:true,shortRoll:true,setKick:true});const rolled=session.hostFrame(5);
  assert.equal(rolled.secondKick,true);assert.equal(rolled.shortRoll,true);assert.equal(rolled.setKick,true);
  deliver(7,{cornerSide:'left',secondTaker:'behind',wallJump:true,setFeint:true});const flags=session.hostFrame(6);assert.equal(flags.cornerSide,'left');assert.equal(flags.secondTaker,'behind');assert.equal(flags.wallJump,true);assert.equal(flags.setFeint,true);assert.equal(session.hostFrame(7).cornerSide,undefined);
  deliver(8,{cornerSide:'invalid' as any,keeperMove:{x:Infinity,y:0}});assert.equal(session.hostFrame(8).cornerSide,undefined);
  session.input({...base,cornerSide:'up'});session.input(base);assert.deepEqual(sent.map(s=>JSON.parse(s).sequence),[1,1]);
  now=500;assert.equal(session.hostFrame(9).keeperMove,undefined);
  deliver(9,{secondKick:true,cornerSide:'up'});channel.onclose();assert.equal(session.hostFrame(10).secondKick,undefined);assert.equal(session.hostFrame(10).cornerSide,undefined);
  session.close();
});

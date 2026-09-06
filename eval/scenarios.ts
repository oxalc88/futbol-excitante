import catalog from './catalog.json';
import type { ActionKind, InputFrame, PlayerState, World } from '../src/contracts/types';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { CameraRig } from '../src/adapters/presentation-model';
import { distance, hash } from '../src/simulation/math';

export const TEST_IDS=catalog.tests.map(t=>t.test_id);
export type Scenario={id:string;seed:number;variant:0|1;duration:number;initial:World;focal:string;opponent:string;input:(tick:number)=>InputFrame[]};
const noop={move:{x:0,y:0},aim:{x:1,y:0},sprint:false,shield:false,power:.55};
export function createScenario(id:string,seed=2017,variant:0|1=0):Scenario {
  if(!TEST_IDS.includes(id))throw new Error(`Unknown scenario: ${id}`);
  const teamCase=/^(OFF-|DEF-|PRESS-|TACT-|AI-|TRANS-|TEMPO-)/.test(id);
  const config=createConfig({seed,human:teamCase?[false,false]:[true,true],halfSeconds:id.startsWith('TEMPO')?12:60});
  if(!teamCase)config.ai.cadence=100000;
  const sim=new Simulation(config,[makeTeam(0),makeTeam(1)]),w=sim.snapshot();
  w.tick=1;w.phase='playing';w.restart=null;w.restartRestriction=null;w.offside=null;w.events=[];
  if(!teamCase)for(const p of w.players){Object.assign(p,{x:-48+p.number*1.4,y:p.team===0?-27:27,vx:0,vy:0,touchCooldown:10000,intent:structuredClone(noop)});}
  const a=w.players.find(p=>p.team===0&&!p.keeper)!,b=w.players.find(p=>p.team===1&&!p.keeper)!;
  w.selected=[a.id,b.id];if(!teamCase){Object.assign(a,{x:-30,y:0,heading:0});Object.assign(b,{x:30,y:12,heading:Math.PI});}
  Object.assign(w.ball,{x:30,y:20,z:.11,vx:0,vy:0,vz:0});
  let duration=300,action:ActionKind|undefined,actionTick=1,move={x:0,y:0},otherMove={x:0,y:0},sprint=false,shield=false,power=.55;
  const contact=(p:PlayerState)=>{w.ball.lastTouch={id:'setup-contact',tick:0,playerId:p.id,team:p.team,surface:'foot',point:{x:w.ball.x,y:w.ball.y,z:w.ball.z}};};
  if(id.startsWith('LOC')||id==='CTRL-LAT-001'||id.startsWith('CAM')){
    sprint=true;move={x:1,y:0};a.capabilities.stamina=1;
    if(id==='LOC-ACC-002')a.capabilities.acceleration=variant?8:4;
    if(['LOC-DEC-001','LOC-REV-001','LOC-T45-001','LOC-T90-001','LOC-ORI-001','CTRL-LAT-001'].includes(id)){a.vx=7.5;duration=180;}
    if(id==='LOC-BALL-001'&&!variant){a.touchCooldown=0;Object.assign(w.ball,{x:a.x+.5,y:0});contact(a);}
  }else if(id.startsWith('PHY')){
    Object.assign(a,{x:0,y:-.30,vx:4,vy:.4});Object.assign(b,{x:.05,y:.30,vx:4,vy:-.4});
    move={x:1,y:.1};otherMove={x:1,y:-.1};sprint=true;shield=id==='PHY-SHLD-001';duration=120;
    a.capabilities={...a.capabilities,physical:70,balance:.7};b.capabilities={...a.capabilities};
    if(['PHY-STR-001','PHY-PC-001'].includes(id)){a.capabilities.physical=variant?100:50;move={x:1,y:0};otherMove={x:1,y:0};}
    if(id==='PHY-BC-001'){a.capabilities.balance=variant?.95:.2;b.vy=-6;}
    Object.assign(w.ball,{x:5,y:0});
  }else if(id.startsWith('BALL')){
    Object.assign(w.ball,{x:-25,y:0,z:.11,vx:variant?16:8,vy:0,vz:0});
    if(id==='BALL-BNC-001')Object.assign(w.ball,{z:4,vx:6});
    if(id.startsWith('BALL-SPN')){Object.assign(w.ball,{z:1,vx:id==='BALL-SPN-002'?(variant?24:12):16,vz:5});w.ball.spin.z=id==='BALL-SPN-001'?(variant?-10:10):8;duration=90;}
    if(id==='BALL-IND-001'){Object.assign(a,{x:-20,y:.2,touchCooldown:0});Object.assign(b,{x:-18,y:-.2,touchCooldown:0});move={x:1,y:variant?.4:-.4};otherMove={x:-1,y:0};}
  }else if(id.startsWith('TOUCH')||id.startsWith('INT')){
    Object.assign(a,{x:0,y:0,touchCooldown:0,heading:id==='TOUCH-BACK-001'?Math.PI:id==='TOUCH-90-001'?Math.PI/2:0});
    Object.assign(w.ball,{x:id.startsWith('INT')?-5:-1.5,y:id==='TOUCH-WF-001'?(variant?.4:-.4):0,z:.11,vx:id==='TOUCH-FAST-001'||(id==='INT-FAST-001'&&variant)?24:8,vy:0,vz:0});contact(b);w.pendingPass={playerId:b.id,team:1};
    if(id==='TOUCH-WF-001')a.capabilities.weakFoot=.3;
    if(id.startsWith('INT')){a.y=variant?1.5:.5;move={x:0,y:-1};actionTick=8;duration=100;}
    else {move={x:1,y:0};duration=100;}
  }else if(/^(PASS|CROSS|SHOT|HEAD|CTRL-ACT|TACK)/.test(id)){
    Object.assign(a,{x:0,y:0,touchCooldown:0});Object.assign(w.ball,{x:.5,y:0,z:.11,vx:0,vy:0,vz:0});contact(a);
    const receiver=w.players.find(p=>p.team===0&&!p.keeper&&p.id!==a.id)!;Object.assign(receiver,{x:14,y:6,vx:0,vy:id==='PASS-RUN-001'?3:0});
    action=id.startsWith('SHOT')||id==='CTRL-ACT-001'?'shoot':id.startsWith('HEAD')?'header':id.startsWith('TACK')?(id==='TACK-SL-001'?'slide':'tackle'):id==='PASS-THR-001'?'through':id==='PASS-LOFT-001'?'lob':id==='CROSS-HI-001'?'cross':'pass';
    if(id==='PASS-ANG-001')a.heading=variant?Math.PI:0;
    if(id==='SHOT-PWR-001')power=variant?.9:.2;
    if(id==='SHOT-IND-001')a.capabilities.power=variant?34:20;
    if(id==='SHOT-SWV-001')a.capabilities.curve=variant?1:0;
    if(id.startsWith('HEAD')){Object.assign(w.ball,{z:1.85,vz:1});if(id==='HEAD-DUEL-001'){Object.assign(b,{x:.6,y:.5,touchCooldown:0});b.action={kind:'header',start:1,contact:variant?8:10,end:40,aim:{x:-1,y:0},power:.55,resolved:false};}}
    if(id.startsWith('TACK')){Object.assign(w.ball,{x:1.1,y:0});contact(b);if(id==='TACK-ANG-001'){a.heading=variant?Math.PI/2:0;Object.assign(b,{x:.8,y:variant?0:2});}duration=120;}
    else duration=180;
  }else if(id.startsWith('GK')){
    const g=w.players.find(p=>p.team===1&&p.keeper)!;w.selected[1]=g.id;
    Object.assign(g,{x:50,y:0,touchCooldown:0,keeperReaction:id==='GK-REA-001'?1:-100,keeperMode:id==='GK-HIGH-001'?'dive':'ready',keeperUntil:70,vy:id==='GK-WF-001'?3:0});
    Object.assign(w.ball,{x:47,y:id==='GK-WF-001'?-.7:0,z:id==='GK-HIGH-001'?2.4:id==='GK-LEG-001'?.22:1,vx:id==='GK-HIGH-001'?9:28,vy:0,vz:0,flight:id==='GK-HIGH-001'?'pass':'shot'});contact(a);
    if(id==='GK-REA-001'&&variant)w.ball.x=49.2;
    if(id==='GK-PARRY-001'&&variant)w.ball.y=.75;
    otherMove=id==='GK-WF-001'?{x:0,y:-1}:{x:0,y:0};duration=150;if(id==='GK-REA-001'){w.ball.x=variant?49.2:42;w.config.ai.cadence=6;w.config.human[1]=false;}
  }else if(teamCase){
    Object.assign(a,{x:10,y:id==='AI-ADAPT-002'?20:0,touchCooldown:0});Object.assign(w.ball,{x:a.x+.5,y:a.y});contact(a);w.carrier=a.id;w.possession=0;
    for(const t of w.teams){t.phase=t===w.teams[0]?'attack':'defence';t.phaseTick=-500;}
    if(/^(PRESS|TRANS-AD)/.test(id)){Object.assign(b,{x:10,y:1});Object.assign(w.ball,{x:10.5,y:1});contact(b);w.carrier=b.id;w.possession=1;}
    if(id==='TRANS-DA-001'){w.teams[0].phase='defence';w.teams[1].phase='attack';}
    const tactic:Record<string,keyof typeof w.teams[0]['tactics']>={'TACT-COMP-001':'compactness','TACT-DLINE-001':'defensiveLine','TACT-SUP-001':'support','TACT-TIKI-001':'shortPossession','TACT-MARK-001':'tightMarking','PRESS-GG-001':'counterPress','PRESS-REC-001':'counterPress','AI-ADAPT-001':'adaptation','AI-ADAPT-002':'adaptation','PRESS-001':'pressing'};
    if(tactic[id]){const key=tactic[id];if(key!=='formation')w.teams[0].tactics[key]=variant?1:0;}
    if(id==='DEF-SHIFT-001')w.ball.y=variant?25:-25;
    duration=id.startsWith('TEMPO')?2200:id.startsWith('AI-')?900:360;
  }
  if(id==='CAM-FLW-001')Object.assign(w.ball,{x:-30,y:0,vx:12,vy:4,z:1,vz:3});
  const initial=structuredClone(w);
  const input=(tick:number)=>{
    if(teamCase)return [];
    let direction={...move};
    if(tick>30){if(id==='LOC-DEC-001')direction={x:0,y:0};if(id==='LOC-REV-001')direction={x:-1,y:0};if(id==='LOC-T45-001')direction={x:Math.SQRT1_2,y:Math.SQRT1_2};if(['LOC-T90-001','LOC-ORI-001','CTRL-LAT-001'].includes(id))direction={x:0,y:1};}
    const aim=id==='TACK-ANG-001'&&variant?{x:0,y:1}:{x:1,y:0};
    return [{tick,slot:0 as const,...noop,move:direction,aim,sprint,shield,action:tick===actionTick?action:undefined,power},{tick,slot:1 as const,...noop,move:otherMove,aim:{x:-1,y:0}}];
  };
  return{id,seed,variant,duration,initial,focal:a.id,opponent:b.id,input};
}
export type ScenarioRun={scenario:Scenario;trace:World[];inputs:InputFrame[];finalHash:string;camera:ReturnType<CameraRig['pose']>[];metrics:Record<string,number>;events:Record<string,number>};
export function runScenario(s:Scenario):ScenarioRun {
  const sim=new Simulation(s.initial.config,s.initial.teams);sim.restore(s.initial);const trace=[sim.snapshot()],inputs:InputFrame[]=[],camera:ReturnType<CameraRig['pose']>[]=[],rig=new CameraRig();
  if(s.id==='CAM-PER-001')rig.mode=s.variant?'close':'broadcast';
  for(let n=0;n<s.duration;n++){const f=s.input(sim.tick);inputs.push(...f);sim.applyInputs(f);sim.step();if(n%30===0)sim.assertInvariants();const w=sim.snapshot();trace.push(w);rig.advance(sim.presentation());camera.push(rig.pose());}
  const events:Record<string,number>={};for(const w of trace)for(const e of w.events)events[e.type]=(events[e.type]??0)+1;
  const path=trace.map(w=>w.players.find(p=>p.id===s.focal)!),speeds=path.map(p=>Math.hypot(p.vx,p.vy)),balls=trace.map(w=>w.ball),dt=s.initial.config.dt;
  const plateau=speeds.slice(-30).reduce((a,b)=>a+b,0)/30;
  const timeAt=(f:number)=>{const i=speeds.findIndex(v=>v>=plateau*f);return i<0?-1:i*dt;};
  const contactEvents=trace.flatMap(w=>w.events.filter(e=>e.type==='ball-contact'||e.type==='keeper-ball-contact'));
  const initialShot=trace.find(w=>w.events.some(e=>['shoot','pass','cross','lob','header','through-pass'].includes(e.type)));
  const firstTouch=trace.flatMap(w=>w.events).find(e=>e.type==='first-touch');
  const metrics:Record<string,number>={durationSeconds:s.duration*dt,earlyDistance:distance(path[0],path[Math.min(30,path.length-1)]),distance:distance(path[0],path.at(-1)!),plateau,t25:timeAt(.25),t50:timeAt(.5),t90:timeAt(.9),maxSpeed:Math.max(...speeds),minimumTurnSpeed:Math.min(...speeds.slice(31)),speedRetention:Math.min(...speeds.slice(31))/Math.max(.001,speeds[30]),peakAcceleration:Math.max(...speeds.slice(1).map((v,i)=>Math.abs(v-speeds[i])/dt)),ballRange:distance(balls[0],balls.at(-1)!),apex:Math.max(...balls.map(b=>b.z)),lateralDeviation:balls.at(-1)!.y-balls[0].y,contacts:contactEvents.length,freeTicks:trace.filter(w=>w.ball.freeTicks>0&&!w.keeperHold).length,initialStrikeSpeed:initialShot?Math.hypot(initialShot.ball.vx,initialShot.ball.vy,initialShot.ball.vz):0,initialStrikeSpin:initialShot?.ball.spin.z??0,firstTouchOutgoing:Number(firstTouch?.data?.outgoingSpeed??0),minimumStability:Math.min(...path.map(p=>p.stability)),maximumRecovery:Math.max(...path.map(p=>p.recovery)),lateralDisplacement:path.at(-1)!.y-path[0].y,bodyContacts:events['body-contact']??0,keeperContacts:trace.flatMap(w=>w.events).filter(e=>e.playerId&&wKeeper(s.initial,e.playerId)&&['ball-contact','keeper-ball-contact'].includes(e.type)).length,phaseTransitions:trace.slice(1).filter((w,i)=>w.teams[0].phase!==trace[i].teams[0].phase).length,maximumPressers:Math.max(...trace.map(w=>Object.values(w.teams[0].assignments).filter(a=>['press','counterpress'].includes(a.responsibility)).length)),finalTeamWidth:Math.max(...trace.at(-1)!.players.filter(p=>p.team===0&&!p.keeper).map(p=>p.y))-Math.min(...trace.at(-1)!.players.filter(p=>p.team===0&&!p.keeper).map(p=>p.y)),memoryEntries:Object.keys(trace.at(-1)!.teams[1].memory.touches).length,cameraHeight:camera.at(-1)!.position.z};
  if(!Object.values(metrics).every(Number.isFinite))throw new Error('Invalid metric output');
  return{scenario:s,trace,inputs,finalHash:sim.stateHash(),camera,metrics,events};
}
function wKeeper(w:World,id:string){return w.players.find(p=>p.id===id)?.keeper;}
export function traceDigest(r:ScenarioRun){return hash(r.trace.map(w=>({tick:w.tick,ball:w.ball,players:w.players.map(p=>[p.id,p.x,p.y,p.vx,p.vy,p.heading]),events:w.events})));}

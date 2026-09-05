import type { ActionKind, Config, InputFrame, Intent, MatchEvent, Phase, PlayerState, Presentation, TeamIndex, TeamProfile, Vec2, World } from '../contracts/types';
import { angleDelta, canonical, clamp, clone, delta, distance, hash, length, segmentPoint, unit } from './math';
import { bestPass, decidePlayer, decideTeams, formationAnchors } from './tactics';

const other=(t:TeamIndex):TeamIndex=>t===0?1:0;
const idle=():Intent=>({move:{x:0,y:0},aim:{x:0,y:0},sprint:false,shield:false,power:.5});
const stats=()=>({shots:0,onTarget:0,passes:0,completed:0,saves:0,tackles:0,fouls:0,possessionTicks:0,corners:0,offsides:0});
const ACTIONS: ActionKind[]=['pass','through','cross','shoot','tackle','header'];

/** Synchronous, DOM-free match authority. All clocks, random state and queued inputs serialize. */
export class Simulation {
  private world: World;
  private observer?: (events: readonly MatchEvent[])=>void;
  constructor(config:Config, teams:[TeamProfile,TeamProfile], observer?: (events:readonly MatchEvent[])=>void) {
    if(!Number.isFinite(config.halfSeconds)||config.halfSeconds<=0||!Number.isInteger(config.seed)||!Number.isFinite(config.dt)||config.dt<=0||config.dt>.05) throw new Error('Invalid match configuration');
    if(teams.some(t=>t.players.length!==config.teamSize)||config.teamSize<2||config.teamSize>11||new Set(teams.flatMap(t=>t.players.map(p=>p.id))).size!==config.teamSize*2) throw new Error('Invalid roster cardinality or duplicate player IDs');
    if(teams.some(t=>t.players.filter(p=>p.keeper).length!==1)) throw new Error('Exactly one keeper per team is required');
    this.observer=observer;
    this.world={version:'world-v1',tick:0,rng:config.seed>>>0||1,config:clone(config),
      teams:teams.map((t,i)=>({...clone(t),direction:i===0?1:-1,phase:'defence',phaseTick:0,assignments:{},chaser:null})) as World['teams'],
      players:teams.flatMap((t,team)=>t.players.map(p=>({...clone(p),team:team as TeamIndex,x:0,y:0,vx:0,vy:0,heading:team===0?0:Math.PI,energy:1,stability:1,intent:idle(),action:null,touchCooldown:0,recovery:0,travel:0,keeperReaction:-1000,heldSince:0}))),
      ball:{x:0,y:0,z:config.physics.radius,vx:0,vy:0,vz:0,spin:{x:0,y:0,z:0},lastTouch:null,freeTicks:0,flight:'loose'},phase:'kickoff',half:1,played:0,score:[0,0],stats:[stats(),stats()],selected:[null,null],restart:null,countdown:0,possession:null,carrier:null,offside:null,pendingPass:null,inputs:[],events:[],eventSeq:0};
    this.world.players.sort((a,b)=>a.id<b.id?-1:1);
    this.resetFormation(); this.startRestart('kickoff',0,{x:0,y:0}); this.assertInvariants();
  }
  get tick(){return this.world.tick;}
  get phase(){return this.world.phase;}
  snapshot():World{return clone(this.world);}
  restore(snapshot:World){
    if(snapshot.version!=='world-v1'||hash(snapshot.config)!==hash(this.world.config)) throw new Error('Incompatible checkpoint configuration');
    canonical(snapshot); const previous=this.world;this.world=clone(snapshot);
    try{this.assertInvariants();}catch(e){this.world=previous;throw e;}
  }
  stateHash(){return hash(this.world);}
  presentation():Presentation {
    const w=this.world;
    return clone({tick:w.tick,phase:w.phase,half:w.half,played:w.played,score:w.score,stats:w.stats,selected:w.selected,ball:w.ball,players:w.players,events:w.events,teams:w.teams.map(t=>({id:t.id,name:t.name,shortName:t.shortName,direction:t.direction,tactics:t.tactics})) as Presentation['teams']});
  }
  applyInputs(frames:readonly InputFrame[]){
    const w=this.world, incoming:InputFrame[]=[];
    for(const f of frames){
      if(!Number.isInteger(f.tick)||f.tick<w.tick||f.tick>w.tick+600||![0,1].includes(f.slot)) throw new Error('Invalid input tick or control slot');
      for(const v of [f.move?.x,f.move?.y,f.aim?.x,f.aim?.y,f.power??.5]) if(!Number.isFinite(v)) throw new Error('Non-finite input');
      if(f.action&&!ACTIONS.includes(f.action))throw new Error('Unknown action');
      if(w.inputs.some(q=>q.tick===f.tick&&q.slot===f.slot)||incoming.some(q=>q.tick===f.tick&&q.slot===f.slot))throw new Error('Duplicate input frame');
      if(f.tactics) for(const [k,v]of Object.entries(f.tactics)){if(!(k in w.teams[f.slot].tactics)|| (k==='formation'?!['4-3-3','4-4-2','3-5-2'].includes(String(v)):typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))throw new Error('Invalid tactical command');}
      incoming.push({...clone(f),move:length(f.move)>1?unit(f.move):clone(f.move),aim:length(f.aim)>1?unit(f.aim):clone(f.aim),power:clamp(f.power??.5,0,1)});
    }
    w.inputs.push(...incoming);w.inputs.sort((a,b)=>a.tick-b.tick||a.slot-b.slot);
  }
  private emit(type:string,player?:PlayerState,team?:TeamIndex,data?:Record<string,unknown>){
    const w=this.world,e:MatchEvent={id:`${w.tick}:${w.eventSeq++}`,tick:w.tick,type};
    if(player)e.playerId=player.id;if(team!==undefined)e.team=team;if(data)e.data=data;w.events.push(e);return e;
  }
  private random(){let x=this.world.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.world.rng=x>>>0;return (x>>>0)/4294967296;}
  private player(id:string|null){return this.world.players.find(p=>p.id===id);}
  private resetFormation(){
    const w=this.world;
    for(const ti of [0,1]as const){const anchors=formationAnchors(w,ti);for(const p of w.players.filter(p=>p.team===ti)){
      Object.assign(p,anchors[p.id]);p.vx=p.vy=0;p.heading=w.teams[ti].direction===1?0:Math.PI;p.action=null;p.recovery=0;p.intent=idle();
    }}
    decideTeams(w);
  }
  private startRestart(kind:Phase,team:TeamIndex,point:Vec2){
    const w=this.world,c=w.config;
    w.phase=kind;w.offside=null;w.pendingPass=null;w.carrier=null;w.possession=null;
    const taker=w.players.filter(p=>p.team===team&&!p.keeper).sort((a,b)=>distance(a,point)-distance(b,point)||a.id.localeCompare(b.id))[0];
    if(!taker)throw new Error('Restart requires an outfield player');
    w.restart={kind,team,point:clone(point),taker:taker.id,remaining:c.rules.restartTicks};
    w.ball={x:point.x,y:point.y,z:c.physics.radius,vx:0,vy:0,vz:0,spin:{x:0,y:0,z:0},lastTouch:null,freeTicks:0,flight:'loose'};
    for(const p of w.players){p.vx=p.vy=0;p.action=null;p.intent=idle();p.touchCooldown=0;
      if(p.id!==taker.id&&!p.keeper&&distance(p,point)<5){const u=unit(delta(point,p));p.x=clamp(point.x+(u.x||-w.teams[team].direction)*6,-c.pitch.length/2+1,c.pitch.length/2-1);p.y=clamp(point.y+(u.y||.5)*6,-c.pitch.width/2+1,c.pitch.width/2-1);}
    }
    taker.x=point.x-w.teams[team].direction*.5;taker.y=point.y;taker.heading=w.teams[team].direction===1?0:Math.PI;
    w.selected[team]=taker.id;w.selected[other(team)]=this.closestOutfield(other(team));
    this.emit('restart-awarded',taker,team,{kind,point,discontinuity:true});
  }
  private closestOutfield(team:TeamIndex){return this.world.players.filter(p=>p.team===team&&!p.keeper).sort((a,b)=>distance(a,this.world.ball)-distance(b,this.world.ball)||a.id.localeCompare(b.id))[0]?.id??null;}
  private executeRestart(){
    const w=this.world,r=w.restart;if(!r)return;const p=this.player(r.taker)!;const dir=w.teams[r.team].direction;
    const receiver=bestPass(w,p), target=receiver?{x:receiver.x+receiver.vx*.25,y:receiver.y+receiver.vy*.25}:{x:p.x+dir*14,y:p.y>0?p.y-8:p.y+8};
    let aim=unit(delta(p,target)),speed=12,vz=.7;
    if(r.kind==='corner'){aim=unit(delta(p,{x:dir*(w.config.pitch.length/2-8),y:0}));speed=17;vz=8;w.stats[r.team].corners++;}
    if(r.kind==='throw-in'){w.ball.z=1.5;aim=unit({x:target.x-p.x,y:p.y>0?-Math.max(6,Math.abs(target.y-p.y)):Math.max(6,Math.abs(target.y-p.y))});vz=3;}
    if(r.kind==='goal-kick'){speed=17;vz=5;}
    if(r.kind==='free-kick'&&distance(p,{x:dir*w.config.pitch.length/2,y:0})<28){aim=unit(delta(p,{x:dir*w.config.pitch.length/2,y:0}));speed=25;vz=3.5;}
    w.ball.vx=aim.x*speed;w.ball.vy=aim.y*speed;w.ball.vz=vz;this.touch(p,'foot');w.ball.flight='pass';
    p.touchCooldown=w.config.actions.touchTicks+8;
    p.action={kind:r.kind==='corner'?'cross':'pass',start:w.tick-7,contact:w.tick,end:w.tick+20,aim,power:.5,resolved:true};
    this.emit(`${r.kind}-executed`,p,r.team);w.phase='playing';w.restart=null;w.pendingPass={playerId:p.id,team:p.team};w.stats[p.team].passes++;
  }
  step(){
    const w=this.world,c=w.config;w.events=[];w.eventSeq=0;
    const frames=w.inputs.filter(f=>f.tick===w.tick);w.inputs=w.inputs.filter(f=>f.tick>w.tick);
    for(const f of frames){if(f.tactics){Object.assign(w.teams[f.slot].tactics,f.tactics);this.emit('tactics-changed',undefined,f.slot,{tactics:f.tactics});}if(f.switchPlayer){w.selected[f.slot]=this.closestOutfield(f.slot);this.emit('control-switched',this.player(w.selected[f.slot]),f.slot);}}
    if(w.phase==='fulltime'){w.tick++;return this.result();}
    if(w.phase==='goal'||w.phase==='halftime'){
      w.countdown--;
      if(w.phase==='goal'){w.ball.x+=w.ball.vx*c.dt*.15;w.ball.y+=w.ball.vy*c.dt*.15;w.ball.vx*=.9;w.ball.vy*=.9;}
      if(w.countdown<=0){const team=w.restart?.team??1;
        if(w.phase==='halftime'){w.half=2;w.played=0;for(const t of w.teams)t.direction=t.direction===1?-1:1;for(const p of w.players)p.energy=Math.min(1,p.energy+.12);}
        this.resetFormation();this.startRestart('kickoff',team,{x:0,y:0});
      }
      w.tick++;return this.result();
    }
    if(w.restart){w.restart.remaining--;if(w.restart.remaining<=0)this.executeRestart();w.tick++;return this.result();}
    this.derivePossession();
    if(w.tick%c.ai.cadence===0){decideTeams(w);const intents=w.players.map(p=>decidePlayer(w,p));w.players.forEach((p,i)=>{p.intent=intents[i];});}
    for(const slot of [0,1]as const){
      if(!c.human[slot])continue;
      const carrier=this.player(w.carrier);if(carrier&&carrier.team===slot&&!carrier.keeper&&w.selected[slot]!==carrier.id){w.selected[slot]=carrier.id;this.emit('control-switched',carrier,slot);}
      const p=this.player(w.selected[slot]);if(!p)continue;
      const f=frames.find(f=>f.slot===slot);p.intent=f?{move:f.move,aim:f.aim,sprint:f.sprint,shield:f.shield,action:f.action,power:f.power??.5}:idle();
    }
    for(const p of w.players){
      if(p.touchCooldown>0)p.touchCooldown--;if(p.recovery>0)p.recovery--;p.stability=Math.min(1,p.stability+c.dt*.7);
      if(p.action&&w.tick>=p.action.end)p.action=null;
      if(!p.action&&p.recovery===0&&p.intent.action)this.requestAction(p,p.intent.action);
    }
    this.movePlayers();this.resolveBodies();
    // scheduler-v1: tackle contact before kick contact, then substepped ball contacts/boundaries.
    for(const p of w.players)if(p.action?.kind==='tackle'&&w.tick>=p.action.contact&&!p.action.resolved){p.action.resolved=true;this.tackle(p);}
    for(const p of w.players)if(p.action&&p.action.kind!=='tackle'&&w.tick>=p.action.contact&&!p.action.resolved){p.action.resolved=true;this.kick(p);}
    if(w.phase==='playing')this.integrateBall();
    this.derivePossession();
    if(w.possession!==null)w.stats[w.possession].possessionTicks++;
    if(w.phase==='playing'){
      w.played+=c.dt;
      if(w.played+1e-7>=c.halfSeconds){w.played=c.halfSeconds;if(w.half===1){w.phase='halftime';w.countdown=c.rules.halftimeTicks;w.restart=null;this.emit('halftime');}else{w.phase='fulltime';this.emit('fulltime');}}
    }
    w.tick++;return this.result();
  }
  private result(){const result={tick:this.world.tick,events:clone(this.world.events)};this.observer?.(result.events);return result;}
  private derivePossession(){
    const w=this.world;const eligible=w.players.filter(p=>p.recovery===0&&w.ball.z<1.1&&distance(p,w.ball)<w.config.actions.reach+.25).sort((a,b)=>distance(a,w.ball)-distance(b,w.ball)||a.id.localeCompare(b.id));
    const p=eligible.find(p=>w.ball.lastTouch?.playerId===p.id)??eligible[0];
    if(p&&w.carrier!==p.id)p.heldSince=w.tick;
    w.carrier=p?.id??null;w.possession=p?.team??(w.ball.freeTicks<120?w.ball.lastTouch?.team??null:null);
  }
  private requestAction(p:PlayerState,kind:ActionKind){
    const w=this.world,c=w.config,d=distance(p,w.ball);
    if(kind!=='tackle'&&(d>c.actions.reach+1.1||w.ball.z>(kind==='header'?c.actions.headerHeight:1.15)))return;
    if(kind==='tackle'&&d>c.actions.tackleReach+1)return;
    let aim=length(p.intent.aim)>.15?unit(p.intent.aim):length(p.intent.move)>.15?unit(p.intent.move):{x:Math.cos(p.heading),y:Math.sin(p.heading)};
    if(kind==='pass'||kind==='through'||kind==='cross'){
      const receiver=bestPass(w,p,aim);if(receiver){const lead=kind==='through'?8:kind==='cross'?3:1;aim=unit(delta(p,{x:receiver.x+receiver.vx*.45+w.teams[p.team].direction*lead,y:receiver.y+receiver.vy*.45}));}
    }
    p.action={kind,start:w.tick,contact:w.tick+(kind==='tackle'?3:c.actions.preparationTicks),end:w.tick+c.actions.preparationTicks+c.actions.recoveryTicks+(kind==='tackle'?14:0),aim,power:p.intent.power,resolved:false};
    this.emit('action-start',p,p.team,{kind,contactTick:p.action.contact,aim});
  }
  private movePlayers(){
    const w=this.world,c=w.config,dt=c.dt;
    for(const p of w.players){
      const a=p.capabilities;let input=p.intent.move; if(p.recovery>0)input={x:0,y:0};
      const speedLimit=p.keeper?c.goalkeeper.speed:a.speed*(p.intent.sprint?1:c.movement.jog)*(.65+.35*p.energy)*(p.intent.shield ? .73 : 1);
      const desired={x:input.x*speedLimit,y:input.y*speedLimit};
      if(length(input)>.1){const wanted=Math.atan2(input.y,input.x),turn=angleDelta(p.heading,wanted);p.heading+=clamp(turn,-a.turnRate*dt,a.turnRate*dt);p.heading=Math.atan2(Math.sin(p.heading),Math.cos(p.heading));}
      const speed=Math.hypot(p.vx,p.vy),turn=length(input)>.1&&speed>.1?Math.abs(angleDelta(Math.atan2(p.vy,p.vx),Math.atan2(input.y,input.x))):0;
      const targetScale=1-c.movement.turnLoss*(turn/Math.PI)*(speed/a.speed);
      const change={x:desired.x*targetScale-p.vx,y:desired.y*targetScale-p.vy},amount=length(change);
      const rate=(length(input)<.1?a.braking:a.acceleration)*(p.action&&!p.action.resolved ? .7 : 1)*dt;
      const ratio=amount>rate?rate/amount:1;p.vx+=change.x*ratio;p.vy+=change.y*ratio;
      const dx=p.vx*dt,dy=p.vy*dt;p.x=clamp(p.x+dx,-c.pitch.length/2+.3,c.pitch.length/2-.3);p.y=clamp(p.y+dy,-c.pitch.width/2+.3,c.pitch.width/2-.3);p.travel+=Math.hypot(dx,dy);
      if(p.keeper){const goal={x:-w.teams[p.team].direction*c.pitch.length/2,y:0};const d=distance(p,goal);if(d>c.goalkeeper.radius){const u=unit(delta(goal,p));p.x=goal.x+u.x*c.goalkeeper.radius;p.y=u.y*c.goalkeeper.radius;}p.y=clamp(p.y,-c.goalkeeper.lateral,c.goalkeeper.lateral);}
      p.energy=clamp(p.energy+(p.intent.sprint&&speed>3?-c.movement.sprintDrain/(.6+a.stamina):c.movement.recoveryRate)*dt,.1,1);
    }
  }
  private resolveBodies(){
    const w=this.world,r=w.config.movement.radius,corrections=w.players.map(()=>({x:0,y:0}));
    for(let i=0;i<w.players.length;i++)for(let j=i+1;j<w.players.length;j++){
      const a=w.players[i],b=w.players[j],d=distance(a,b);if(d>=r*2)continue;
      const n=d<1e-8?{x:1,y:0}:unit(delta(a,b)),overlap=r*2-d,weight=a.capabilities.physical/(a.capabilities.physical+b.capabilities.physical);
      corrections[i].x-=n.x*overlap*(1-weight);corrections[i].y-=n.y*overlap*(1-weight);corrections[j].x+=n.x*overlap*weight;corrections[j].y+=n.y*overlap*weight;
      const closing=(a.vx-b.vx)*n.x+(a.vy-b.vy)*n.y;
      if(closing>0){a.vx-=n.x*closing*.4;a.vy-=n.y*closing*.4;b.vx+=n.x*closing*.4;b.vy+=n.y*closing*.4;
        a.stability=clamp(a.stability-closing*.015*(1-a.capabilities.balance),0,1);b.stability=clamp(b.stability-closing*.015*(1-b.capabilities.balance),0,1);
      }
      if(closing>2)this.emit('body-contact',a,a.team,{other:b.id,point:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}});
    }
    w.players.forEach((p,i)=>{if(!p.keeper){p.x+=corrections[i].x;p.y+=corrections[i].y;}});
  }
  private tackle(p:PlayerState){
    const w=this.world,c=w.config,b=w.ball,a=p.action!;
    const toBall=unit(delta(p,b)),alignment=toBall.x*a.aim.x+toBall.y*a.aim.y;
    if(distance(p,b)<=c.actions.tackleReach&&b.z<.6&&alignment>.25){
      b.vx=a.aim.x*(5+p.capabilities.tackling*4);b.vy=a.aim.y*(5+p.capabilities.tackling*4);b.vz=1;this.touch(p,'foot');p.touchCooldown=c.actions.touchTicks;
      w.stats[p.team].tackles++;this.emit('tackle-won',p,p.team);w.pendingPass=null;
    }else{
      const victim=w.players.find(q=>q.team!==p.team&&distance(p,q)<c.actions.tackleReach&&((q.x-p.x)*a.aim.x+(q.y-p.y)*a.aim.y)>.1);
      if(victim){victim.recovery=Math.round(c.movement.recoverySeconds/c.dt);victim.action=null;this.emit('stumble',victim,victim.team);
        if(c.rules.fouls){w.stats[p.team].fouls++;this.emit('foul',p,p.team,{victim:victim.id});this.startRestart('free-kick',victim.team,{x:victim.x,y:victim.y});}
      }
    }
  }
  private kick(p:PlayerState){
    const w=this.world,c=w.config,b=w.ball,a=p.action!;
    const isHeader=a.kind==='header';
    if(distance(p,b)>c.actions.reach+.2||b.z>(isHeader?c.actions.headerHeight:1.1)||(isHeader&&b.z<.75)){this.emit('action-missed',p,p.team,{kind:a.kind});return;}
    if(this.checkOffside(p))return;
    const skill=['shoot','header'].includes(a.kind)?p.capabilities.finishing:p.capabilities.passing;
    const bodyAngle=Math.abs(angleDelta(p.heading,Math.atan2(a.aim.y,a.aim.x)));
    const pressure=w.players.some(q=>q.team!==p.team&&distance(p,q)<2)?1.6:1;
    const weak=(a.aim.y*Math.cos(p.heading)-a.aim.x*Math.sin(p.heading))*(p.foot==='left'?1:-1)<0?1+(1-p.capabilities.weakFoot):1;
    const error=(this.random()-.5)*c.actions.error*(1.2-skill)*pressure*weak*(1+bodyAngle);
    const ang=Math.atan2(a.aim.y,a.aim.x)+error;let speed=10+a.power*12,vz=.25;
    if(a.kind==='through')speed=16+a.power*10;
    if(a.kind==='cross'){speed=14+a.power*12;vz=6+a.power*5;}
    if(a.kind==='shoot'){speed=p.capabilities.power*(.6+a.power*.5);vz=1.2+a.power*3.3;}
    if(isHeader){speed=13+a.power*9;vz=-1.3;}
    b.vx=Math.cos(ang)*speed;b.vy=Math.sin(ang)*speed;b.vz=vz;
    b.spin={x:0,y:0,z:(a.kind==='cross'?7:2)*p.capabilities.curve*(p.foot==='left'?-1:1)};
    this.touch(p,isHeader?'head':'foot');b.flight=['shoot','header'].includes(a.kind)?'shot':'pass';p.touchCooldown=c.actions.touchTicks+8;
    this.emit(a.kind==='through'?'through-pass':a.kind,p,p.team,{velocity:{x:b.vx,y:b.vy,z:b.vz},power:a.power});
    if(['shoot','header'].includes(a.kind)){
      w.stats[p.team].shots++;const goalX=w.teams[p.team].direction*c.pitch.length/2,time=(goalX-b.x)/b.vx;
      const y=b.y+b.vy*time,z=b.z+b.vz*time-.5*c.physics.gravity*time*time;
      if(time>0&&Math.abs(y)<c.pitch.goalWidth/2&&z<c.pitch.goalHeight)w.stats[p.team].onTarget++;
      for(const gk of w.players.filter(q=>q.keeper&&q.team!==p.team))gk.keeperReaction=w.tick;
      w.pendingPass=null;
    }else{w.stats[p.team].passes++;w.pendingPass={playerId:p.id,team:p.team};}
    this.offsideSnapshot(p);
  }
  private offsideSnapshot(p:PlayerState){
    const w=this.world;if(!w.config.rules.offside){w.offside=null;return;}const dir=w.teams[p.team].direction;
    const defenders=w.players.filter(q=>q.team!==p.team).map(q=>q.x*dir).sort((a,b)=>b-a);
    const line=Math.max(defenders[1]??w.config.pitch.length/2,w.ball.x*dir,0);
    w.offside={team:p.team,candidates:w.players.filter(q=>q.team===p.team&&q.id!==p.id&&q.x*dir>line+.05).map(q=>q.id)};
  }
  private checkOffside(p:PlayerState){
    const w=this.world;if(!w.offside?.candidates.includes(p.id))return false;
    w.stats[p.team].offsides++;this.emit('offside',p,p.team);this.startRestart('offside',other(p.team),{x:p.x,y:p.y});return true;
  }
  private touch(p:PlayerState,surface:'foot'|'head'|'hand'|'body'){
    const w=this.world,b=w.ball;
    const contact=this.emit(surface==='hand'?'keeper-ball-contact':'ball-contact',p,p.team,{surface,point:{x:b.x,y:b.y,z:b.z}});
    if(w.pendingPass&&p.id!==w.pendingPass.playerId){if(p.team===w.pendingPass.team){w.stats[p.team].completed++;this.emit('pass-completed',p,p.team);}else this.emit('interception',p,p.team);w.pendingPass=null;}
    if(w.offside&&w.offside.team!==p.team)w.offside=null;
    b.lastTouch={id:contact.id,tick:w.tick,playerId:p.id,team:p.team,surface,point:{x:b.x,y:b.y,z:b.z}};b.freeTicks=0;
  }
  private integrateBall(){
    const w=this.world,c=w.config,b=w.ball,dt=c.dt/c.physics.substeps,r=c.physics.radius;
    b.freeTicks++;
    for(let i=0;i<c.physics.substeps&&w.phase==='playing';i++){
      const prev={x:b.x,y:b.y,z:b.z};
      const speed=Math.hypot(b.vx,b.vy);const grounded=b.z<=r+.001&&Math.abs(b.vz)<.25;
      if(grounded){const next=Math.max(0,speed-c.physics.rolling*dt);if(speed>0){b.vx*=next/speed;b.vy*=next/speed;}b.z=r;b.vz=0;}
      else{b.vz-=c.physics.gravity*dt;const drag=Math.max(0,1-c.physics.drag*Math.hypot(speed,b.vz)*dt);b.vx*=drag;b.vy*=drag;b.vz*=drag;}
      const oldX=b.vx;b.vx-=b.vy*b.spin.z*c.physics.magnus*dt;b.vy+=oldX*b.spin.z*c.physics.magnus*dt;
      b.spin.x*=1-c.physics.spinDecay*dt;b.spin.y*=1-c.physics.spinDecay*dt;b.spin.z*=1-c.physics.spinDecay*dt;
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
      if(b.z<r){b.z=r;if(b.vz<-.5){b.vz=-b.vz*c.physics.restitution;this.emit('bounce',undefined,undefined,{point:{x:b.x,y:b.y,z:b.z}});}else b.vz=0;}
      this.posts(prev);
      // Earliest boundary crossing owns the event before contacts beyond the field.
      if(this.boundaries(prev))break;
      this.ballContacts(prev);
    }
  }
  private posts(prev:{x:number;y:number;z:number}){
    const w=this.world,b=w.ball,c=w.config,rr=c.physics.radius+.05;
    for(const dir of [-1,1]){
      const gx=dir*c.pitch.length/2;
      for(const y of [-c.pitch.goalWidth/2,c.pitch.goalWidth/2]){
        const hit=segmentPoint(prev,b,{x:gx,y});const z=prev.z+(b.z-prev.z)*hit.t;
        if(distance(hit,{x:gx,y})<rr&&z<c.pitch.goalHeight+.05){const n=unit({x:hit.x-gx||-dir*.001,y:hit.y-y});const dot=b.vx*n.x+b.vy*n.y;if(dot<0){b.vx-=1.7*dot*n.x;b.vy-=1.7*dot*n.y;b.x=gx+n.x*rr;b.y=y+n.y*rr;this.emit('post-contact');}}
      }
      const hit=segmentPoint({x:prev.x,y:prev.z},{x:b.x,y:b.z},{x:gx,y:c.pitch.goalHeight});
      if(distance(hit,{x:gx,y:c.pitch.goalHeight})<rr&&Math.abs(b.y)<c.pitch.goalWidth/2){const n=unit({x:hit.x-gx||-dir*.001,y:hit.y-c.pitch.goalHeight});const dot=b.vx*n.x+b.vz*n.y;if(dot<0){b.vx-=1.7*dot*n.x;b.vz-=1.7*dot*n.y;b.x=gx+n.x*rr;b.z=c.pitch.goalHeight+n.y*rr;this.emit('crossbar-contact');}}
    }
  }
  private boundaries(prev:{x:number;y:number;z:number}){
    const w=this.world,b=w.ball,c=w.config,r=c.physics.radius,hx=c.pitch.length/2+r,hy=c.pitch.width/2+r;
    const candidates: {t:number;axis:'x'|'y';dir:number}[]=[];
    for(const axis of ['x','y']as const){const limit=axis==='x'?hx:hy;for(const dir of [-1,1])if(prev[axis]*dir<=limit&&b[axis]*dir>limit){const t=(dir*limit-prev[axis])/(b[axis]-prev[axis]);candidates.push({t,axis,dir});}}
    candidates.sort((a,b)=>a.t-b.t||(a.axis==='x'?-1:1));const crossing=candidates[0];if(!crossing)return false;
    const point={x:prev.x+(b.x-prev.x)*crossing.t,y:prev.y+(b.y-prev.y)*crossing.t,z:prev.z+(b.z-prev.z)*crossing.t};
    if(crossing.axis==='x'&&Math.abs(point.y)+r<c.pitch.goalWidth/2&&point.z+r<c.pitch.goalHeight){
      const scoring=w.teams.findIndex(t=>t.direction===crossing.dir)as TeamIndex;w.score[scoring]++;w.phase='goal';w.countdown=c.rules.celebrationTicks;
      w.restart={kind:'kickoff',team:other(scoring),point:{x:0,y:0},taker:'',remaining:0};w.offside=null;
      this.emit('goal',this.player(b.lastTouch?.playerId??null),scoring,{ownGoal:b.lastTouch?.team!==scoring,score:[...w.score]});return true;
    }
    const last=b.lastTouch?.team;if(last===undefined){this.emit('unattributed-boundary',undefined,undefined,{point});this.startRestart('free-kick',0,{x:clamp(point.x,-c.pitch.length/2+1,c.pitch.length/2-1),y:clamp(point.y,-c.pitch.width/2+1,c.pitch.width/2-1)});return true;}
    if(crossing.axis==='y')this.startRestart('throw-in',other(last),{x:clamp(point.x,-c.pitch.length/2+.5,c.pitch.length/2-.5),y:crossing.dir*c.pitch.width/2});
    else{const defending=w.teams.findIndex(t=>t.direction===-crossing.dir)as TeamIndex;
      if(last===defending)this.startRestart('corner',other(defending),{x:crossing.dir*c.pitch.length/2,y:(point.y>=0?1:-1)*c.pitch.width/2});
      else this.startRestart('goal-kick',defending,{x:crossing.dir*(c.pitch.length/2-5.5),y:clamp(point.y,-9.16,9.16)});
    }
    return true;
  }
  private ballContacts(prev:{x:number;y:number;z:number}){
    const w=this.world,c=w.config,b=w.ball;
    const candidates=w.players.map(p=>({p,hit:segmentPoint(prev,b,p)})).filter(({p,hit})=>p.touchCooldown===0&&p.recovery===0&&distance(hit,p)<(p.keeper?c.goalkeeper.reach:c.actions.reach));
    candidates.sort((a,b)=>a.hit.t-b.hit.t||distance(a.hit,a.p)-distance(b.hit,b.p)||a.p.id.localeCompare(b.p.id));
    for(const {p,hit}of candidates){
      const z=prev.z+(b.z-prev.z)*hit.t,speed=Math.hypot(b.vx,b.vy);
      if(p.action&&!p.action.resolved)continue;
      if(p.keeper&&z<2.1&&worldGoalDistance(w,p)<=c.goalkeeper.radius&&w.tick-p.keeperReaction>=c.goalkeeper.reactionTicks){
        if(this.checkOffside(p))return;
        // Deceleration at the actual contact position. No parenting or snap to hands.
        const contactDistance=Math.hypot(hit.x-p.x,hit.y-p.y);if(contactDistance>c.goalkeeper.reach)continue;
        const save=b.flight==='shot'&&b.lastTouch?.team!==p.team&&speed>5;
        b.vx*=.06;b.vy*=.06;b.vz=Math.min(0,b.vz)*.1;
        this.touch(p,'hand');this.emit(save?'save':'keeper-claim',p,p.team);if(save)w.stats[p.team].saves++;b.flight='loose';p.touchCooldown=c.actions.touchTicks;p.heldSince=w.tick;
        p.action={kind:'pass',start:w.tick,contact:w.tick+c.goalkeeper.releaseTicks,end:w.tick+c.goalkeeper.releaseTicks+20,aim:bestPass(w,p)?unit(delta(p,bestPass(w,p)!)):{x:w.teams[p.team].direction,y:.25},power:.6,resolved:false};
        return;
      }
      if(z>.8||p.keeper){
        if(!p.keeper&&z<1.65&&distance(hit,p)<c.movement.radius+c.physics.radius){const n=unit(delta(p,hit)),dot=b.vx*n.x+b.vy*n.y;if(dot<0){b.vx-=1.5*dot*n.x;b.vy-=1.5*dot*n.y;this.touch(p,'body');p.touchCooldown=c.actions.touchTicks;this.emit('body-deflection',p,p.team);return;}}
        continue;
      }
      if(this.checkOffside(p))return;
      const controlled=distance(p,b)<c.actions.reach+.1;
      if(!controlled)continue;
      const first=b.lastTouch?.playerId!==p.id;
      const direction=length(p.intent.move)>.1?unit(p.intent.move):{x:Math.cos(p.heading),y:Math.sin(p.heading)};
      const pressure=w.players.some(q=>q.team!==p.team&&distance(p,q)<1.8)?1.4:1;
      const angle=Math.abs(angleDelta(p.heading,Math.atan2(-b.vy,-b.vx)));
      const error=first?(1-p.capabilities.control)*speed*.13*pressure*(1+angle*.2):0;
      const outgoing=Math.hypot(p.vx,p.vy)+(length(p.intent.move)>.1?1.8:0)+error;
      const turn=(this.random()-.5)*error*.1;
      b.vx=direction.x*outgoing-turn;b.vy=direction.y*outgoing+turn;b.vz=first?Math.max(0,b.vz)*.15:0;
      this.touch(p,'foot');b.flight='loose';p.touchCooldown=c.actions.touchTicks;
      this.emit(first?'first-touch':'dribble-touch',p,p.team,{incomingSpeed:speed,outgoingSpeed:Math.hypot(b.vx,b.vy)});return;
    }
  }
  assertInvariants(){
    const w=this.world;
    if(w.players.length!==w.config.teamSize*2||new Set(w.players.map(p=>p.id)).size!==w.players.length)throw new Error('Player cardinality invariant');
    for(const t of [0,1]as const){if(w.players.filter(p=>p.team===t&&p.keeper).length!==1)throw new Error('Keeper cardinality invariant');if(w.selected[t]&&!w.players.some(p=>p.id===w.selected[t]&&p.team===t))throw new Error('Control ownership invariant');}
    for(const p of w.players)if(![p.x,p.y,p.vx,p.vy,p.heading,p.energy,p.stability].every(Number.isFinite)||p.energy<0||p.energy>1)throw new Error('Invalid player state');
    if(![w.ball.x,w.ball.y,w.ball.z,w.ball.vx,w.ball.vy,w.ball.vz].every(Number.isFinite)||w.ball.z<0)throw new Error('Invalid ball state');
    if(w.score.some(n=>!Number.isInteger(n)||n<0))throw new Error('Invalid score');
    if(w.restart&&w.phase==='playing')throw new Error('Restart phase invariant');
  }
}
function worldGoalDistance(w:World,p:PlayerState){return distance(p,{x:-w.teams[p.team].direction*w.config.pitch.length/2,y:0});}

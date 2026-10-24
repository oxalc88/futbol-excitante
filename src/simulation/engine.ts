import type { ActionKind, Config, InputFrame, Intent, MatchEvent, Phase, PlayerState, Presentation, TeamIndex, TeamProfile, Vec2, World } from '../contracts/types';
import { angleDelta, canonical, clamp, clone, delta, distance, hash, length, segmentPoint, unit } from './math';
import { canUseHands, foulCard, inPenaltyArea, offsideInterferer, visibleBall } from './rules';
import { bestPass, decidePlayer, decideTeams, formationAnchors } from './tactics';

const other=(t:TeamIndex):TeamIndex=>t===0?1:0;
const idle=():Intent=>({move:{x:0,y:0},aim:{x:0,y:0},sprint:false,shield:false,power:.5});
const stats=()=>({shots:0,onTarget:0,passes:0,completed:0,saves:0,tackles:0,fouls:0,possessionTicks:0,corners:0,offsides:0,yellows:0,reds:0,penalties:0});
const ACTIONS: ActionKind[]=['pass','through','cross','shoot','tackle','slide','lob','header'];

/** Synchronous, DOM-free match authority. All clocks, random state and queued inputs serialize. */
export class Simulation {
  private world: World;
  private observer?: (events: readonly MatchEvent[])=>void;
  constructor(config:Config, teams:[TeamProfile,TeamProfile], observer?: (events:readonly MatchEvent[])=>void) {
    if(!Number.isFinite(config.halfSeconds)||config.halfSeconds<=0||!Number.isInteger(config.seed)||!Number.isFinite(config.dt)||config.dt<=0||config.dt>.05) throw new Error('Invalid match configuration');
    if(teams.some(t=>t.players.length!==config.teamSize)||config.teamSize<2||config.teamSize>11||new Set(teams.flatMap(t=>t.players.map(p=>p.id))).size!==config.teamSize*2) throw new Error('Invalid roster cardinality or duplicate player IDs');
    if(teams.some(t=>t.players.filter(p=>p.keeper).length!==1)) throw new Error('Exactly one keeper per team is required');
    this.observer=observer;
    this.world={version:'world-v2',advantage:null,pendingCards:[],keeperHold:null,restartRestriction:null,tick:0,rng:config.seed>>>0||1,config:clone(config),
      teams:teams.map((t,i)=>({...clone(t),direction:i===0?1:-1,phase:'defence',phaseTick:0,assignments:{},chaser:null,memory:{touches:{},flank:[0,0],lastContact:null,focal:null}})) as World['teams'],
      players:teams.flatMap((t,team)=>t.players.map(p=>({...clone(p),team:team as TeamIndex,x:0,y:0,vx:0,vy:0,heading:team===0?0:Math.PI,energy:1,stability:1,intent:idle(),action:null,touchCooldown:0,recovery:0,travel:0,keeperReaction:-1000,heldSince:0,sentOff:false,yellows:0,keeperMode:'ready' as const,keeperUntil:0}))),
      ball:{x:0,y:0,z:config.physics.radius,vx:0,vy:0,vz:0,spin:{x:0,y:0,z:0},lastTouch:null,freeTicks:0,flight:'loose'},phase:'kickoff',half:1,played:0,score:[0,0],stats:[stats(),stats()],selected:[null,null],restart:null,countdown:0,possession:null,carrier:null,offside:null,pendingPass:null,inputs:[],events:[],eventSeq:0};
    this.world.players.sort((a,b)=>a.id<b.id?-1:1);
    this.resetFormation(); this.startRestart('kickoff',0,{x:0,y:0}); this.assertInvariants();
  }
  get tick(){return this.world.tick;}
  get phase(){return this.world.phase;}
  snapshot():World{return clone(this.world);}
  restore(snapshot:World){
    if(snapshot.version!=='world-v2'||hash(snapshot.config)!==hash(this.world.config)) throw new Error('Incompatible checkpoint configuration');
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
    this.flushCards();if(w.phase==='fulltime')return;
    w.advantage=null;w.keeperHold=null;w.restartRestriction=null;
    w.phase=kind;w.offside=null;w.pendingPass=null;w.carrier=null;w.possession=null;
    const taker=w.players.filter(p=>p.team===team&&!p.keeper&&!p.sentOff).sort((a,b)=>distance(a,point)-distance(b,point)||a.id.localeCompare(b.id))[0];
    if(!taker)throw new Error('Restart requires an outfield player');
    w.restart={kind,team,point:clone(point),taker:taker.id,remaining:c.human[team]?c.rules.humanRestartTicks:c.rules.restartTicks};
    w.ball={x:point.x,y:point.y,z:c.physics.radius,vx:0,vy:0,vz:0,spin:{x:0,y:0,z:0},lastTouch:null,freeTicks:0,flight:'loose'};
    for(const p of w.players){p.vx=p.vy=0;p.action=null;p.intent=idle();p.touchCooldown=0;p.keeperMode='ready';
      if(p.id!==taker.id&&!p.keeper&&distance(p,point)<5){const u=unit(delta(point,p));p.x=clamp(point.x+(u.x||-w.teams[team].direction)*6,-c.pitch.length/2+1,c.pitch.length/2-1);p.y=clamp(point.y+(u.y||.5)*6,-c.pitch.width/2+1,c.pitch.width/2-1);}
    }
    taker.x=point.x-w.teams[team].direction*.5;taker.y=point.y;taker.heading=w.teams[team].direction===1?0:Math.PI;
    w.selected[team]=taker.id;w.selected[other(team)]=this.closestOutfield(other(team));
    if(kind==='penalty'){
      const dir=w.teams[team].direction;for(const p of w.players){if(p.id===taker.id)continue;if(p.keeper&&p.team!==team){p.x=dir*(c.pitch.length/2-.05);p.y=0;}else if(!p.keeper){p.x=dir*Math.min(p.x*dir,point.x*dir-9.2);if(inPenaltyArea(w,other(team),p))p.x=dir*(c.pitch.length/2-17);}}
      w.stats[team].penalties++;
    }
    this.emit('restart-awarded',taker,team,{kind,point,discontinuity:true});
  }
  private closestOutfield(team:TeamIndex){return this.world.players.filter(p=>p.team===team&&!p.keeper&&!p.sentOff).sort((a,b)=>distance(a,this.world.ball)-distance(b,this.world.ball)||a.id.localeCompare(b.id))[0]?.id??null;}
  private executeRestart(frame?:InputFrame){
    const w=this.world,r=w.restart;if(!r)return;const p=this.player(r.taker)!;const dir=w.teams[r.team].direction;
    const receiver=bestPass(w,p), target=receiver?{x:receiver.x+receiver.vx*.25,y:receiver.y+receiver.vy*.25}:{x:p.x+dir*14,y:p.y>0?p.y-8:p.y+8};
    let aim=unit(delta(p,target)),speed=12,vz=.7;
    if(r.kind==='corner'){aim=unit(delta(p,{x:dir*(w.config.pitch.length/2-8),y:0}));speed=17;vz=8;w.stats[r.team].corners++;}
    if(r.kind==='throw-in'){w.ball.z=1.5;aim=unit({x:target.x-p.x,y:p.y>0?-Math.max(6,Math.abs(target.y-p.y)):Math.max(6,Math.abs(target.y-p.y))});vz=3;}
    if(r.kind==='goal-kick'){speed=17;vz=5;}
    if((r.kind==='penalty'||r.kind==='free-kick')&&distance(p,{x:dir*w.config.pitch.length/2,y:0})<28){aim=unit(delta(p,{x:dir*w.config.pitch.length/2,y:0}));speed=25;vz=3.5;}
    if(frame&&length(frame.aim)>.1){aim=unit(frame.aim);speed=r.kind==='penalty'?p.capabilities.power*(.6+(frame.power??.5)*.5):10+(frame.power??.5)*16;vz=r.kind==='penalty'?1.5+(frame.power??.5)*2:vz;}
    if(r.kind==='penalty'){aim=unit({x:dir*Math.max(.75,Math.abs(aim.x)),y:clamp(aim.y,-.28,.28)});speed=Math.max(20,speed);vz=Math.min(3.5,vz);}
    w.ball.vx=aim.x*speed;w.ball.vy=aim.y*speed;w.ball.vz=vz;this.touch(p,r.kind==='throw-in'?'hand':'foot');w.ball.flight=(r.kind==='penalty'||(r.kind==='free-kick'&&speed>=25))?'shot':'pass';
    p.touchCooldown=w.config.actions.touchTicks+8;
    p.action={kind:r.kind==='corner'?'cross':'pass',start:w.tick-7,contact:w.tick,end:w.tick+20,aim,power:.5,resolved:true};
    w.restartRestriction={taker:p.id,team:p.team,indirect:['throw-in','offside','indirect'].includes(r.kind),kind:r.kind};
    if(!['throw-in','corner','goal-kick'].includes(r.kind))this.offsideSnapshot(p);
    if(w.ball.flight==='shot'){w.stats[p.team].shots++;for(const g of w.players.filter(g=>g.keeper&&g.team!==p.team))g.keeperReaction=w.tick;}
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
    if(w.restart){const f=frames.find(f=>f.slot===w.restart!.team);w.restart.remaining--;if(w.restart.remaining<=0||f?.action)this.executeRestart(f);w.tick++;return this.result();}
    this.derivePossession();this.resolveAdvantage();
    if(w.phase!=='playing'){w.tick++;return this.result();}
    const interferer=offsideInterferer(w);if(interferer&&this.checkOffside(interferer)){w.tick++;return this.result();}
    if(w.tick%c.ai.cadence===0){decideTeams(w);const intents=w.players.map(p=>decidePlayer(w,p));w.players.forEach((p,i)=>{p.intent=intents[i];});}
    for(const slot of [0,1]as const){
      if(!c.human[slot])continue;
      const carrier=this.player(w.carrier);if(carrier&&carrier.team===slot&&!carrier.keeper&&w.selected[slot]!==carrier.id){w.selected[slot]=carrier.id;this.emit('control-switched',carrier,slot);}
      let p=this.player(w.selected[slot]);if(p?.sentOff){w.selected[slot]=this.closestOutfield(slot);p=this.player(w.selected[slot]);}if(!p)continue;
      const f=frames.find(f=>f.slot===slot);if(f&&(length(f.move)>.1||f.action))this.emit('input-intent',p,slot,{inputTick:f.tick,action:f.action??null,move:f.move});p.intent=f?{move:f.move,aim:f.aim,sprint:f.sprint,shield:f.shield,action:f.action,power:f.power??.5}:idle();
    }
    for(const p of w.players){
      if(p.sentOff){p.intent=idle();p.vx=p.vy=0;p.action=null;continue;}
      if(p.keeperMode==='recover'&&w.tick>=p.keeperUntil)p.keeperMode='ready';
      if(p.touchCooldown>0)p.touchCooldown--;if(p.recovery>0)p.recovery--;p.stability=Math.min(1,p.stability+c.dt*.7);
      if(p.action&&w.tick>=p.action.end){this.emit('action-recovered',p,p.team,{kind:p.action.kind});p.action=null;}
      if(!p.action&&p.recovery===0&&p.intent.action)this.requestAction(p,p.intent.action);
    }
    this.movePlayers();this.resolveBodies();
    // scheduler-v1: tackle contact before kick contact, then substepped ball contacts/boundaries.
    for(const p of w.players)if(p.action&&['tackle','slide'].includes(p.action.kind)&&w.tick>=p.action.contact&&!p.action.resolved&&w.phase==='playing'){p.action.resolved=true;this.tackle(p);}
    for(const p of w.players)if(p.action&&!['tackle','slide'].includes(p.action.kind)&&w.tick>=p.action.contact&&!p.action.resolved&&w.phase==='playing'){p.action.resolved=true;this.kick(p);}
    if(w.phase==='playing')this.integrateBall();
    this.derivePossession();this.resolveAdvantage();
    if(w.possession!==null)w.stats[w.possession].possessionTicks++;
    if(w.phase==='playing'){
      w.played+=c.dt;
      if(w.played+1e-7>=c.halfSeconds){w.played=c.halfSeconds;if(w.half===1){w.phase='halftime';w.countdown=c.rules.halftimeTicks;w.restart=null;this.emit('halftime');}else{w.phase='fulltime';this.flushCards();this.emit('fulltime');}}
    }
    w.tick++;return this.result();
  }
  private result(){const result={tick:this.world.tick,events:clone(this.world.events)};this.observer?.(result.events);return result;}
  private derivePossession(){
    const w=this.world;const held=this.player(w.keeperHold?.playerId??null);if(held){w.carrier=held.id;w.possession=held.team;return;}
    const eligible=w.players.filter(p=>!p.sentOff&&p.recovery===0&&w.ball.z<1.1&&distance(p,w.ball)<w.config.actions.reach+.25).sort((a,b)=>distance(a,w.ball)-distance(b,w.ball)||a.id.localeCompare(b.id));
    const p=eligible.find(p=>w.ball.lastTouch?.playerId===p.id)??eligible[0];
    if(p&&w.carrier!==p.id)p.heldSince=w.tick;
    w.carrier=p?.id??null;w.possession=p?.team??(w.ball.freeTicks<120?w.ball.lastTouch?.team??null:null);
  }
  private requestAction(p:PlayerState,kind:ActionKind){
    const w=this.world,c=w.config,d=distance(p,w.ball);
    if(!['tackle','slide'].includes(kind)&&(d>c.actions.reach+1.1||w.ball.z>(kind==='header'?c.actions.headerHeight:1.15)))return;
    if(['tackle','slide'].includes(kind)&&d>c.actions.tackleReach+1.5)return;
    let aim=length(p.intent.aim)>.15?unit(p.intent.aim):length(p.intent.move)>.15?unit(p.intent.move):{x:Math.cos(p.heading),y:Math.sin(p.heading)};
    if(kind==='pass'||kind==='through'||kind==='cross'||kind==='lob'){
      const receiver=bestPass(w,p,aim);if(receiver){const lead=kind==='through'?8:kind==='cross'?3:1;aim=unit(delta(p,{x:receiver.x+receiver.vx*.45+w.teams[p.team].direction*lead,y:receiver.y+receiver.vy*.45}));}
    }
    p.action={kind,start:w.tick,contact:w.tick+(['tackle','slide'].includes(kind)?3:c.actions.preparationTicks+Math.round(Math.abs(angleDelta(p.heading,Math.atan2(aim.y,aim.x)))*2)),end:w.tick+c.actions.preparationTicks+c.actions.recoveryTicks+(kind==='slide'?45:kind==='tackle'?14:6),aim,power:p.intent.power,resolved:false};
    if(kind==='slide'){p.vx+=aim.x*2;p.vy+=aim.y*2;}
    this.emit('action-start',p,p.team,{kind,intentTick:w.tick,contactTick:p.action.contact,recoveryTick:p.action.end,aim});
  }
  private movePlayers(){
    const w=this.world,c=w.config,dt=c.dt;
    for(const p of w.players){
      if(p.sentOff)continue;
      if(w.keeperHold?.playerId===p.id){p.vx=p.vy=0;continue;}
      const a=p.capabilities;let input=p.intent.move; if(p.recovery>0||p.keeperMode==='recover'||p.action?.kind==='slide')input={x:0,y:0};
      const speedLimit=p.keeper?c.goalkeeper.speed*(p.keeperMode==='recover'?.1:1):a.speed*(p.intent.sprint?1:c.movement.jog)*(.65+.35*p.energy)*(p.intent.shield ? .73 : 1);
      const desired={x:input.x*speedLimit,y:input.y*speedLimit};
      if(length(input)>.1){const wanted=Math.atan2(input.y,input.x),turn=angleDelta(p.heading,wanted);p.heading+=clamp(turn,-a.turnRate*dt,a.turnRate*dt);p.heading=Math.atan2(Math.sin(p.heading),Math.cos(p.heading));}
      const speed=Math.hypot(p.vx,p.vy),turn=length(input)>.1&&speed>.1?Math.abs(angleDelta(Math.atan2(p.vy,p.vx),Math.atan2(input.y,input.x))):0;
      const targetScale=1-c.movement.turnLoss*(turn/Math.PI)*(speed/a.speed);
      const change={x:desired.x*targetScale-p.vx,y:desired.y*targetScale-p.vy},amount=length(change);
      const rate=(length(input)<.1?a.braking:a.acceleration)*(p.action&&!p.action.resolved ? .7 : 1)*dt;
      const ratio=amount>rate?rate/amount:1;p.vx+=change.x*ratio;p.vy+=change.y*ratio;
      const dx=p.vx*dt,dy=p.vy*dt;p.x=clamp(p.x+dx,-c.pitch.length/2+.3,c.pitch.length/2-.3);p.y=clamp(p.y+dy,-c.pitch.width/2+.3,c.pitch.width/2-.3);p.travel+=Math.hypot(dx,dy);
      if(w.events.some(e=>e.type==='input-intent'&&e.playerId===p.id)&&(amount>1e-6||Math.abs(turn)>1e-6))this.emit('kinematic-response',p,p.team,{inputTick:w.tick,velocity:{x:p.vx,y:p.vy},heading:p.heading});
      if(p.keeper&&!c.human[p.team]){const goal={x:-w.teams[p.team].direction*c.pitch.length/2,y:0};const d=distance(p,goal);if(d>c.goalkeeper.radius){const u=unit(delta(goal,p));p.x=goal.x+u.x*c.goalkeeper.radius;p.y=u.y*c.goalkeeper.radius;}p.y=clamp(p.y,-c.goalkeeper.lateral,c.goalkeeper.lateral);}
      p.energy=clamp(p.energy+(p.intent.sprint&&speed>3?-c.movement.sprintDrain/(.6+a.stamina):c.movement.recoveryRate)*dt,.1,1);
    }
  }
  private resolveBodies(){
    const w=this.world,r=w.config.movement.radius,corrections=w.players.map(()=>({x:0,y:0}));
    for(let i=0;i<w.players.length;i++)for(let j=i+1;j<w.players.length;j++){
      const a=w.players[i],b=w.players[j];if(a.sentOff||b.sentOff)continue;const d=distance(a,b);if(d>=r*2)continue;
      const n=d<1e-8?{x:1,y:0}:unit(delta(a,b)),overlap=r*2-d,weight=(a.capabilities.physical*(a.intent.shield?1.2:1))/(a.capabilities.physical*(a.intent.shield?1.2:1)+b.capabilities.physical*(b.intent.shield?1.2:1));
      corrections[i].x-=n.x*overlap*(1-weight);corrections[i].y-=n.y*overlap*(1-weight);corrections[j].x+=n.x*overlap*weight;corrections[j].y+=n.y*overlap*weight;
      const closing=(a.vx-b.vx)*n.x+(a.vy-b.vy)*n.y;
      if(closing>0){a.vx-=n.x*closing*.8*(1-weight);a.vy-=n.y*closing*.8*(1-weight);b.vx+=n.x*closing*.8*weight;b.vy+=n.y*closing*.8*weight;
        a.stability=clamp(a.stability-closing*.10*(1-a.capabilities.balance),0,1);b.stability=clamp(b.stability-closing*.10*(1-b.capabilities.balance),0,1);
      }
      for(const p of [a,b])if(p.stability<.65&&p.recovery===0){p.recovery=Math.round((1-p.capabilities.balance)*30);p.heading+=closing*.012*(1-p.capabilities.balance);this.emit('stumble',p,p.team,{cause:'body-contact'});}
      if(overlap>1e-5)this.emit('body-contact',a,a.team,{other:b.id,point:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}});
    }
    w.players.forEach((p,i)=>{if(!p.keeper&&!p.sentOff){p.x=clamp(p.x+corrections[i].x,-w.config.pitch.length/2+.3,w.config.pitch.length/2-.3);p.y=clamp(p.y+corrections[i].y,-w.config.pitch.width/2+.3,w.config.pitch.width/2-.3);}});
  }
  private checkDoubleTouch(p:PlayerState){
    const w=this.world;if(w.restartRestriction?.taker!==p.id)return false;
    this.emit('restart-double-touch',p,p.team);this.startRestart('indirect',other(p.team),{x:p.x,y:p.y});return true;
  }
  private caution(p:PlayerState,card:'yellow'|'red'){
    const w=this.world;if(!w.config.rules.cards||p.sentOff)return;
    if(card==='yellow'){p.yellows++;w.stats[p.team].yellows++;this.emit('yellow-card',p,p.team,{count:p.yellows});}
    if(card==='red'||p.yellows>=2){p.sentOff=true;p.action=null;p.vx=p.vy=0;w.stats[p.team].reds++;this.emit('red-card',p,p.team,{secondYellow:card==='yellow'});w.selected[p.team]=this.closestOutfield(p.team);
      const remaining=w.players.filter(q=>q.team===p.team&&!q.sentOff).length;
      if(remaining<(w.config.teamSize===11?7:2)){w.phase='fulltime';w.restart=null;this.emit('match-abandoned',p,p.team,{reason:'insufficient-players'});}
    }
  }
  private flushCards(){const w=this.world;for(const c of w.pendingCards){const p=this.player(c.playerId);if(p)this.caution(p,c.card);}w.pendingCards=[];}
  private commitAdvantage(){const w=this.world,a=w.advantage;if(!a)return;if(a.card)w.pendingCards.push({playerId:a.offender,card:a.card});w.advantage=null;this.emit('advantage-realized',undefined,a.team);}
  private awardFoul(team:TeamIndex,point:Vec2){
    const w=this.world,penalty=inPenaltyArea(w,other(team),point);
    this.startRestart(penalty?'penalty':'free-kick',team,penalty?{x:w.teams[team].direction*(w.config.pitch.length/2-11),y:0}:point);
  }
  private recallAdvantage(){const w=this.world,a=w.advantage;if(!a)return;this.commitAdvantage();this.emit('advantage-recalled',undefined,a.team);this.awardFoul(a.team,a.point);}
  private resolveAdvantage(){
    const w=this.world,a=w.advantage;if(!a||w.phase!=='playing')return;
    if(w.ball.flight==='shot'&&w.ball.lastTouch?.team===a.team){this.commitAdvantage();return;}
    if(w.possession!==null&&w.possession!==a.team){this.recallAdvantage();return;}
    if(w.tick>=a.until){if(w.possession===a.team&&(w.ball.x-a.point.x)*w.teams[a.team].direction>2)this.commitAdvantage();else this.recallAdvantage();}
  }
  private tackle(p:PlayerState){
    const w=this.world,c=w.config,b=w.ball,a=p.action!,sliding=a.kind==='slide';
    const reach=c.actions.tackleReach+(sliding?.45:0),toBall=unit(delta(p,b));
    const alignment=toBall.x*a.aim.x+toBall.y*a.aim.y;
    const victim=w.players.filter(q=>!q.sentOff&&q.team!==p.team&&distance(p,q)<reach&&((q.x-p.x)*a.aim.x+(q.y-p.y)*a.aim.y)>.1).sort((x,y)=>distance(p,x)-distance(p,y))[0];
    const bodyFirst=victim&&distance(p,victim)+.2<distance(p,b);
    const ballFirst=!bodyFirst&&distance(p,b)<=reach&&b.z<.6&&alignment>.25;
    if(ballFirst){
      if(this.checkOffside(p)||this.checkDoubleTouch(p))return;
      b.vx=a.aim.x*(5+p.capabilities.tackling*4);b.vy=a.aim.y*(5+p.capabilities.tackling*4);b.vz=sliding?1.5:.6;
      this.touch(p,'foot');p.touchCooldown=c.actions.touchTicks;w.stats[p.team].tackles++;
      this.emit('tackle-won',p,p.team,{sliding,reach,order:'ball-first'});w.pendingPass=null;
    }
    const card=victim?foulCard(w,p,victim,sliding):null;
    if(victim&&(!ballFirst||card==='red')){
      victim.recovery=Math.round(c.movement.recoverySeconds/c.dt);victim.action=null;this.emit('stumble',victim,victim.team);
      if(c.rules.fouls){
        if(this.checkOffside(victim))return;
        w.stats[p.team].fouls++;this.emit('foul',p,p.team,{victim:victim.id,card,order:bodyFirst?'body-first':ballFirst?'ball-first-excessive':'missed-ball'});
        const continuation=card!=='red'&&!w.advantage&&w.players.some(q=>!q.sentOff&&q.team===victim.team&&q.id!==victim.id&&distance(q,b)<2.5);
        if(continuation){w.advantage={team:victim.team,point:{x:victim.x,y:victim.y},until:w.tick+c.rules.advantageTicks,offender:p.id,card};this.emit('advantage',victim,victim.team);}
        else {if(card)w.pendingCards.push({playerId:p.id,card});this.awardFoul(victim.team,{x:victim.x,y:victim.y});}
      }
    }
    if(sliding&&w.phase==='playing')p.recovery=Math.max(p.recovery,24);
  }
  private kick(p:PlayerState){
    const w=this.world,c=w.config,b=w.ball,a=p.action!;
    const isHeader=a.kind==='header';
    const handRelease=w.keeperHold?.playerId===p.id;if(handRelease)w.keeperHold=null;
    if(p.keeper)p.keeperMode='ready';
    if(!handRelease&&(distance(p,b)>(isHeader?.65:c.actions.reach+.2)||b.z>(isHeader?Math.min(c.actions.headerHeight,1.7+p.capabilities.jump):1.1)||(isHeader&&b.z<.75))){this.emit('action-missed',p,p.team,{kind:a.kind});return;}
    if(this.checkOffside(p)||this.checkDoubleTouch(p))return;
    const skill=isHeader?p.capabilities.heading:a.kind==='shoot'?p.capabilities.finishing:p.capabilities.passing;
    const bodyAngle=Math.abs(angleDelta(p.heading,Math.atan2(a.aim.y,a.aim.x)));
    const pressure=w.players.some(q=>q.team!==p.team&&distance(p,q)<2)?1.6:1;
    const weak=(a.aim.y*Math.cos(p.heading)-a.aim.x*Math.sin(p.heading))*(p.foot==='left'?1:-1)<0?1+(1-p.capabilities.weakFoot):1;
    const error=(this.random()-.5)*c.actions.error*(1.2-skill)*pressure*weak*(1+bodyAngle);
    const ang=Math.atan2(a.aim.y,a.aim.x)+error;let speed=10+a.power*12,vz=.25;
    if(a.kind==='through')speed=16+a.power*10;
    if(a.kind==='cross'||a.kind==='lob'){speed=(a.kind==='lob'?12:14)+a.power*12;vz=6+a.power*5;}
    if(a.kind==='shoot'){speed=p.capabilities.power*(.6+a.power*.5);vz=1.2+a.power*3.3;}
    if(isHeader){const challenge=w.players.filter(q=>!q.sentOff&&q.team!==p.team&&distance(q,p)<1.2).length;speed=(13+a.power*9)*(.8+.2*p.capabilities.heading)*(1-challenge*.12)*( .8+.2*p.stability);vz=-1.3;}
    b.vx=Math.cos(ang)*speed;b.vy=Math.sin(ang)*speed;b.vz=vz;
    b.spin={x:0,y:0,z:(a.kind==='cross'?7:2)*p.capabilities.curve*(p.foot==='left'?-1:1)};
    this.touch(p,handRelease?'hand':isHeader?'head':'foot');b.flight=['shoot','header'].includes(a.kind)?'shot':'pass';p.touchCooldown=c.actions.touchTicks+8;
    this.emit(a.kind==='through'?'through-pass':a.kind,p,p.team,{velocity:{x:b.vx,y:b.vy,z:b.vz},power:a.power});
    if(['shoot','header'].includes(a.kind)){
      w.stats[p.team].shots++;const goalX=w.teams[p.team].direction*c.pitch.length/2,time=(goalX-b.x)/b.vx;
      const y=b.y+b.vy*time,z=b.z+b.vz*time-.5*c.physics.gravity*time*time;
      if(time>0&&Math.abs(y)<c.pitch.goalWidth/2&&z<c.pitch.goalHeight)w.stats[p.team].onTarget++;
      for(const gk of w.players.filter(q=>q.keeper&&q.team!==p.team)){if(visibleBall(w,gk)){gk.keeperReaction=w.tick;this.emit('keeper-observed-shot',gk,gk.team);}}
      w.pendingPass=null;
    }else{w.stats[p.team].passes++;w.pendingPass={playerId:p.id,team:p.team};}
    this.offsideSnapshot(p);
  }
  private offsideSnapshot(p:PlayerState){
    const w=this.world;if(!w.config.rules.offside){w.offside=null;return;}const dir=w.teams[p.team].direction;
    const defenders=w.players.filter(q=>!q.sentOff&&q.team!==p.team).map(q=>q.x*dir).sort((a,b)=>b-a);
    const line=Math.max(defenders[1]??w.config.pitch.length/2,w.ball.x*dir,0);
    w.offside={team:p.team,candidates:w.players.filter(q=>!q.sentOff&&q.team===p.team&&q.id!==p.id&&q.x*dir>line+.05).map(q=>q.id)};
  }
  private checkOffside(p:PlayerState){
    const w=this.world;if(!w.offside?.candidates.includes(p.id))return false;
    w.stats[p.team].offsides++;this.emit('offside',p,p.team);this.startRestart('offside',other(p.team),{x:p.x,y:p.y});return true;
  }
  private touch(p:PlayerState,surface:'foot'|'head'|'hand'|'body',deliberate=true){
    const w=this.world,b=w.ball;
    const contact=this.emit(surface==='hand'&&p.keeper?'keeper-ball-contact':'ball-contact',p,p.team,{surface,point:{x:b.x,y:b.y,z:b.z}});
    if(w.pendingPass&&p.id!==w.pendingPass.playerId){if(p.team===w.pendingPass.team){w.stats[p.team].completed++;this.emit('pass-completed',p,p.team);}else this.emit('interception',p,p.team);w.pendingPass=null;}
    if(w.offside&&w.offside.team!==p.team&&deliberate)w.offside=null;
    if(w.restartRestriction&&w.restartRestriction.taker!==p.id)w.restartRestriction=null;
    b.lastTouch={id:contact.id,tick:w.tick,playerId:p.id,team:p.team,surface,point:{x:b.x,y:b.y,z:b.z}};b.freeTicks=0;
  }
  private integrateBall(){
    const w=this.world,c=w.config,b=w.ball,dt=c.dt/c.physics.substeps,r=c.physics.radius;
    b.freeTicks++;
    if(w.keeperHold){const p=this.player(w.keeperHold.playerId)!;if(w.tick-w.keeperHold.since>=Math.round(8/c.dt)){this.emit('keeper-time-limit',p,p.team);this.startRestart('corner',other(p.team),{x:-w.teams[p.team].direction*c.pitch.length/2,y:(p.y>=0?1:-1)*c.pitch.width/2});}return;}
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
      const scoring=w.teams.findIndex(t=>t.direction===crossing.dir)as TeamIndex;
      if(w.restartRestriction&&(w.restartRestriction.indirect||w.restartRestriction.team!==scoring)){const r=w.restartRestriction;this.startRestart(r.team===scoring?'goal-kick':'corner',other(r.team),r.team===scoring?{x:crossing.dir*(c.pitch.length/2-5.5),y:0}:{x:crossing.dir*c.pitch.length/2,y:(point.y>=0?1:-1)*c.pitch.width/2});return true;}
      if(w.advantage){if(scoring!==w.advantage.team){this.recallAdvantage();return true;}this.commitAdvantage();}
      w.score[scoring]++;w.phase='goal';w.countdown=c.rules.celebrationTicks;
      w.restart={kind:'kickoff',team:other(scoring),point:{x:0,y:0},taker:'',remaining:0};w.offside=null;
      this.flushCards();
      this.emit('goal',this.player(b.lastTouch?.playerId??null),scoring,{ownGoal:b.lastTouch?.team!==scoring,score:[...w.score]});return true;
    }
    if(w.advantage){this.recallAdvantage();return true;}
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
    const candidates=w.players.map(p=>({p,hit:segmentPoint(prev,b,p)})).filter(({p,hit})=>!p.sentOff&&p.touchCooldown===0&&p.recovery===0&&distance(hit,p)<(p.keeper?c.goalkeeper.reach:c.actions.reach));
    candidates.sort((a,b)=>a.hit.t-b.hit.t||distance(a.hit,a.p)-distance(b.hit,b.p)||a.p.id.localeCompare(b.p.id));
    for(const {p,hit}of candidates){
      const z=prev.z+(b.z-prev.z)*hit.t,speed=Math.hypot(b.vx,b.vy);
      if(p.action&&!p.action.resolved)continue;
      if(p.keeper&&p.keeperMode!=='recover'&&z<c.goalkeeper.highReach&&worldGoalDistance(w,p)<=c.goalkeeper.radius&&w.tick-p.keeperReaction>=c.goalkeeper.reactionTicks){
        const hands=canUseHands(w,p),low=z<.42,reachable=z<(p.keeperMode==='dive'?c.goalkeeper.highReach:2.1);
        if(!reachable||(!hands&&!low))continue;
        if(this.checkOffside(p)||this.checkDoubleTouch(p))return;
        const save=b.flight==='shot'&&b.lastTouch?.team!==p.team&&speed>5;
        const catchable=hands&&speed<14+p.capabilities.keeper*5&&Math.abs(hit.y-p.y)<.6&&z>.4;
        const surface=low?'foot':'hand';
        if(catchable){
          b.vx=b.vy=b.vz=0;this.touch(p,'hand',false);w.keeperHold={playerId:p.id,since:w.tick};p.keeperMode='hold';
          p.action={kind:'pass',start:w.tick,contact:w.tick+c.goalkeeper.releaseTicks,end:w.tick+c.goalkeeper.releaseTicks+20,aim:bestPass(w,p)?unit(delta(p,bestPass(w,p)!)):{x:w.teams[p.team].direction,y:.25},power:.6,resolved:false};
        }else{
          const n=unit(delta(p,hit));const outward=unit({x:n.x||w.teams[p.team].direction,y:n.y+(b.y>=0?.4:-.4)});
          const outgoing=speed*(low?.48:.32);b.vx=outward.x*outgoing;b.vy=outward.y*outgoing;b.vz=low?1.4:2.2;
          this.touch(p,surface,false);p.keeperMode='recover';p.keeperUntil=w.tick+c.goalkeeper.recoveryTicks;p.recovery=c.goalkeeper.recoveryTicks;p.action=null;
          this.emit('keeper-parry',p,p.team,{surface,incomingSpeed:speed,outgoingSpeed:outgoing,recoveryUntil:p.keeperUntil});
        }
        this.emit(save?'save':'keeper-claim',p,p.team,{surface,catch:catchable});if(save)w.stats[p.team].saves++;
        b.flight='loose';p.touchCooldown=c.actions.touchTicks;p.heldSince=w.tick;return;
      }
      if(z>.8||p.keeper){
        if(!p.keeper&&z<1.65&&distance(hit,p)<c.movement.radius+c.physics.radius){const n=unit(delta(p,hit)),dot=b.vx*n.x+b.vy*n.y;if(dot<0){b.vx-=1.5*dot*n.x;b.vy-=1.5*dot*n.y;this.touch(p,'body',false);p.touchCooldown=c.actions.touchTicks;this.emit('body-deflection',p,p.team);return;}}
        continue;
      }
      if(this.checkOffside(p)||this.checkDoubleTouch(p))return;
      const controlled=distance(p,b)<c.actions.reach+.1;
      if(!controlled)continue;
      const first=b.lastTouch?.playerId!==p.id;
      let direction=length(p.intent.move)>.1?unit(p.intent.move):{x:Math.cos(p.heading),y:Math.sin(p.heading)};
      if(p.intent.shield){const nearest=w.players.filter(q=>!q.sentOff&&q.team!==p.team).sort((a,b)=>distance(a,p)-distance(b,p))[0];if(nearest&&distance(nearest,p)<2.5)direction=unit(delta(nearest,p));}
      const pressure=w.players.some(q=>q.team!==p.team&&distance(p,q)<1.8)?1.4:1;
      const angle=Math.abs(angleDelta(p.heading,Math.atan2(-b.vy,-b.vx)));
      const weakSide=(b.y-p.y)*(p.foot==='left'?-1:1)>0;
      const error=first?(1-p.capabilities.control)*speed*.13*pressure*(1+angle*.2)*(weakSide?1.5-.5*p.capabilities.weakFoot:1):0;
      const outgoing=Math.hypot(p.vx,p.vy)+(p.intent.shield?.45:length(p.intent.move)>.1?1.8:0)+error;
      const turn=(this.random()-.5)*error*.1;
      b.vx=direction.x*outgoing-turn;b.vy=direction.y*outgoing+turn;b.vz=first?Math.max(0,b.vz)*.15:0;
      this.touch(p,'foot',!(b.flight==='shot'&&worldGoalDistance(w,p)<16&&b.vx*w.teams[p.team].direction<0));b.flight='loose';p.touchCooldown=c.actions.touchTicks;
      this.emit(first?'first-touch':'dribble-touch',p,p.team,{incomingSpeed:speed,outgoingSpeed:Math.hypot(b.vx,b.vy),foot:weakSide?(p.foot==='left'?'right':'left'):p.foot});return;
    }
  }
  assertInvariants(){
    const w=this.world;
    if(w.players.length!==w.config.teamSize*2||new Set(w.players.map(p=>p.id)).size!==w.players.length)throw new Error('Player cardinality invariant');
    for(const t of [0,1]as const){if(w.players.filter(p=>p.team===t&&p.keeper).length!==1)throw new Error('Keeper cardinality invariant');if(w.selected[t]&&!w.players.some(p=>p.id===w.selected[t]&&p.team===t))throw new Error('Control ownership invariant');}
    for(const p of w.players)if(![p.x,p.y,p.vx,p.vy,p.heading,p.energy,p.stability].every(Number.isFinite)||p.energy<0||p.energy>1)throw new Error('Invalid player state');
    if(![w.ball.x,w.ball.y,w.ball.z,w.ball.vx,w.ball.vy,w.ball.vz].every(Number.isFinite)||w.ball.z<0)throw new Error('Invalid ball state');
    if(w.score.some(n=>!Number.isInteger(n)||n<0))throw new Error('Invalid score');
    if(w.keeperHold&&!w.players.some(p=>p.id===w.keeperHold!.playerId&&p.keeper&&!p.sentOff))throw new Error('Keeper hold invariant');
    if(w.restart&&w.phase==='playing')throw new Error('Restart phase invariant');
  }
}
function worldGoalDistance(w:World,p:PlayerState){return distance(p,{x:-w.teams[p.team].direction*w.config.pitch.length/2,y:0});}

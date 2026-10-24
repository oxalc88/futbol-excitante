import type { Intent, PlayerState, TeamIndex, Vec2, World } from '../contracts/types';
import { visibleBall } from './rules';
import { clamp, delta, distance, length, unit } from './math';

export function formationAnchors(world: World, team: TeamIndex): Record<string, Vec2> {
  const t=world.teams[team], roster=t.players.filter(p=>!world.players.find(q=>q.id===p.id)?.sentOff), size=roster.length, out=size-1;
  const rows = size===11 ? t.tactics.formation.split('-').map(Number) : out<=1 ? [out] : out<=4 ? [2,out-2].filter(Boolean) : [Math.ceil(out*.4),Math.floor(out*.3),out-Math.ceil(out*.4)-Math.floor(out*.3)];
  const result: Record<string,Vec2>={}; let index=0;
  for(const p of roster) if(p.keeper) result[p.id]={x: -t.direction*(world.config.pitch.length/2-1.8),y:0};
  rows.forEach((count,row)=>{ for(let col=0;col<count;col++) {
    const p=roster.filter(p=>!p.keeper)[index++]; if(!p) continue;
    const x=rows.length===1 ? -8 : -world.config.pitch.length*.29 + row/(rows.length-1)*world.config.pitch.length*.34;
    const y=(col-(count-1)/2)*Math.min(16,world.config.pitch.width*.8/Math.max(1,count-1));
    result[p.id]={x:x*t.direction,y};
  }});
  return result;
}
export function reachTime(p: PlayerState, point: Vec2) {
  const d=distance(p,point), a=p.capabilities.acceleration, v=length({x:p.vx,y:p.vy}), max=p.capabilities.speed*(.72+.28*p.energy);
  const accTime=Math.max(0,(max-v)/a), accDistance=v*accTime+.5*a*accTime*accTime;
  return d<=accDistance ? (Math.sqrt(v*v+2*a*d)-v)/a : accTime+(d-accDistance)/max;
}
export function bestPass(world: World, p: PlayerState, aim?: Vec2): PlayerState | undefined {
  const direction=world.teams[p.team].direction, opponents=world.players.filter(q=>q.team!==p.team&&!q.sentOff);
  let best: PlayerState | undefined, score=-Infinity;
  for(const q of world.players) {
    const d=distance(p,q); if(q.sentOff || q.team!==p.team || q.id===p.id || d<3 || d>world.config.ai.passDistance*1.5) continue;
    const u=unit(delta(p,q)); const align=aim&&length(aim)>.15 ? u.x*aim.x+u.y*aim.y : .6;
    if(align < -.3) continue;
    const arrival=d/(12+8*p.capabilities.passing), safety=Math.min(...opponents.map(o=>reachTime(o,q)))-arrival;
    const progress=(q.x-p.x)*direction;
    const value=align*9+clamp(safety,-3,3)*2+progress*.1-Math.abs(d-(15-world.teams[p.team].tactics.shortPossession*6))*(.14+world.teams[p.team].tactics.shortPossession*.2)-(q.keeper?4:0);
    if(value>score) { score=value; best=q; }
  }
  return best;
}
export function decideTeams(world: World) {
  for(const ti of [0,1] as const) {
    const team=world.teams[ti], dir=team.direction, own=world.players.filter(p=>p.team===ti&&!p.sentOff), anchors=formationAnchors(world,ti), c=world.config;
    const attacking=world.possession===ti;
    const contact=world.ball.lastTouch, memory=team.memory;
    if(contact&&contact.team!==ti&&contact.id!==memory.lastContact){memory.lastContact=contact.id;memory.touches[contact.playerId]=(memory.touches[contact.playerId]??0)+1;memory.flank[world.ball.y>0?1:0]++;const total=memory.flank[0]+memory.flank[1];if(total%64===0){for(const id in memory.touches)memory.touches[id]*=.75;memory.flank[0]*=.75;memory.flank[1]*=.75;}memory.focal=Object.keys(memory.touches).sort((a,b)=>memory.touches[b]-memory.touches[a]||a.localeCompare(b))[0]??null;}
    const target=attacking?'attack':'defence';
    if((target==='attack' && ['defence','to-defence'].includes(team.phase)) || (target==='defence' && ['attack','to-attack'].includes(team.phase))) { team.phase=attacking?'to-attack':'to-defence'; team.phaseTick=world.tick; }
    else if(world.tick-team.phaseTick>=c.ai.transitionTicks) team.phase=target;
    const candidates=own.filter(p=>!p.keeper);
    const prediction={x:world.ball.x+world.ball.vx*.25,y:world.ball.y+world.ball.vy*.25};
    candidates.sort((a,b)=>(reachTime(a,prediction)-(a.id===team.chaser?.toString()?c.ai.hysteresis*.1:0))-(reachTime(b,prediction)-(b.id===team.chaser?c.ai.hysteresis*.1:0)) || a.id.localeCompare(b.id));
    team.chaser=candidates[0]?.id??null;
    const assignments: typeof team.assignments={};
    const counterpress=!attacking&&team.phase==='to-defence'&&team.tactics.counterPress>.5&&world.tick-team.phaseTick<c.ai.transitionTicks&&Math.abs(world.ball.x)<40;
    const secondPresser=counterpress?candidates[1]?.id:null;
    const marked=new Set<string>();
    for(const p of own) {
      const anchor=anchors[p.id]; let point={...anchor}, responsibility='shape';
      if(p.keeper) {
        const goal=-dir*c.pitch.length/2;
        const forward=clamp((world.ball.x-goal)*dir*.075,1.2,c.goalkeeper.radius*.65);
        point={x:goal+dir*forward,y:clamp(world.ball.y*.15,-c.goalkeeper.lateral,c.goalkeeper.lateral)};
        const r=distance({x:goal,y:0},point); if(r>c.goalkeeper.radius) {point.x=goal+(point.x-goal)*c.goalkeeper.radius/r;point.y*=c.goalkeeper.radius/r;}
        responsibility='goal-arc';
        if(visibleBall(world,p)&&world.ball.vx*dir<0 && world.ball.lastTouch?.team!==ti && world.tick-p.keeperReaction>=c.goalkeeper.reactionTicks) {
          const time=(point.x-world.ball.x)/world.ball.vx;
          if(time>0 && time<2){point.y=clamp(world.ball.y+world.ball.vy*time,-c.goalkeeper.lateral,c.goalkeeper.lateral);if(time<.8&&p.keeperMode==='ready'){p.keeperMode='dive';p.keeperUntil=world.tick+48;}}
        }
      if(p.keeperMode==='dive'&&world.tick>p.keeperUntil)p.keeperMode='ready';
        if(world.ball.z>1.5&&distance(p,world.ball)<6&&visibleBall(world,p)&&p.keeperMode==='ready'){p.keeperMode='dive';p.keeperUntil=world.tick+48;point={x:world.ball.x+world.ball.vx*.25,y:world.ball.y+world.ball.vy*.25};}
      } else if((p.id===team.chaser||p.id===secondPresser) && (!attacking || world.carrier===null)) {
        point={...prediction};if(p.id===secondPresser)point.y+=p.y>world.ball.y?2:-2; responsibility=counterpress?'counterpress':'press';
      } else {
        const ballProgress=world.ball.x*dir;
        const shift=clamp(ballProgress*.38+(attacking?12:-3)+(team.tactics.defensiveLine-.5)*15,-18,27);
        point.x=(anchor.x*dir*(1.15-team.tactics.compactness*.25)+shift)*dir;
        point.y=anchor.y*(.65+team.tactics.width*.5)*(1.15-team.tactics.compactness*.3)+world.ball.y*.28;
        if(!attacking){const total=memory.flank[0]+memory.flank[1];if(total>=8)point.y+=(memory.flank[1]-memory.flank[0])/total*team.tactics.adaptation*5;}
        responsibility=attacking?'support':'cover';
        if(attacking && anchor.x*dir>0) { point.x+=dir*team.tactics.support*7; responsibility='run'; }
        if(attacking&&team.tactics.shortPossession>.5&&anchor.x*dir>-15){point.x=point.x*.7+(world.ball.x-dir*(4+(1-team.tactics.support)*7))*.3;point.y=point.y*.7+(world.ball.y+(anchor.y>=0?1:-1)*6)*.3;}
        if(responsibility==='run'&&world.config.rules.offside){const line=world.players.filter(q=>!q.sentOff&&q.team!==ti).map(q=>q.x*dir).sort((a,b)=>b-a)[1]??c.pitch.length/2;point.x=dir*Math.min(point.x*dir,Math.max(line,world.ball.x*dir)-.6);}
        if(!attacking) {
          const threat=world.players.filter(q=>q.team!==ti&&!q.keeper&&!q.sentOff&&!marked.has(q.id)).sort((a,b)=>(distance(a,point)-(a.id===memory.focal?team.tactics.adaptation*4:0))-(distance(b,point)-(b.id===memory.focal?team.tactics.adaptation*4:0))||a.id.localeCompare(b.id))[0];
          if(threat && distance(threat,point)<10) {const tight=.5+team.tactics.tightMarking*.35;point.x=point.x*(1-tight)+(threat.x-dir*(2-team.tactics.tightMarking))*tight;point.y=point.y*(1-tight)+threat.y*tight;responsibility='mark';marked.add(threat.id);}
        }
      }
      point={x:clamp(point.x,-c.pitch.length/2+1,c.pitch.length/2-1),y:clamp(point.y,-c.pitch.width/2+1,c.pitch.width/2-1)};
      assignments[p.id]={anchor,target:point,responsibility};
    }
    team.assignments=assignments;
  }
}
export function decidePlayer(world: World, p: PlayerState): Intent {
  if(p.sentOff)return{move:{x:0,y:0},aim:{x:0,y:0},sprint:false,shield:false,power:0};
  const t=world.teams[p.team], dir=t.direction, b=world.ball, c=world.config;
  const assignment=t.assignments[p.id]; let target=assignment?.target??p;
  let action: Intent['action'], power=.55;
  let aim: Vec2={x:dir,y:0};
  const isCarrier=world.carrier===p.id, nearBall=distance(p,b)<c.actions.reach+1;
  if(isCarrier) {
    const goal={x:dir*c.pitch.length/2,y:0};
    const defenders=world.players.filter(q=>q.team!==p.team&&!q.keeper);
    const pressure=Math.min(...defenders.map(q=>distance(p,q)));
    const receiver=bestPass(world,p);
    if(p.keeper) { if(world.tick-p.heldSince>=c.goalkeeper.releaseTicks) {action='pass';aim=receiver?unit(delta(p,receiver)):{x:dir,y:.25};} }
    else if(distance(p,goal)<c.ai.shotDistance && Math.abs(p.y)<c.pitch.goalWidth/2+12) { action=b.z>.9?'header':'shoot'; aim=unit({x:goal.x-p.x,y:-p.y+(p.y>0?-1.5:1.5)});power=clamp(distance(p,goal)/35,.45,.85); }
    else if(receiver && (pressure<5 || world.tick-p.heldSince>90+(1-t.tactics.tempo)*150-t.tactics.shortPossession*70)) { action=receiver.x*dir>p.x*dir+9&&t.tactics.buildUp<.5?'through':'pass';aim=unit(delta(p,receiver)); }
    else if(Math.abs(p.y)>20 && p.x*dir>25) {action='cross'; aim=unit(delta(p,{x:dir*40,y:0}));power=.65;}
    target={x:p.x+dir*10,y:p.y*.83};
    if(pressure<6) { const closest=defenders.sort((a,b)=>distance(a,p)-distance(b,p))[0];if(closest) target.y+=(p.y>=closest.y?1:-1)*3; }
  } else if(nearBall && b.z>.9 && b.z<c.actions.headerHeight && p.x*dir>c.pitch.length*.2 && !p.keeper) { action='header';aim=unit(delta(p,{x:dir*c.pitch.length/2,y:0})); }
  else if(t.chaser===p.id && world.carrier && world.possession!==p.team && nearBall && !p.action && p.recovery===0) {action='tackle';aim=unit(delta(p,b));}
  let move=delta(p,target); const d=length(move);
  move=d<.6?{x:0,y:0}:unit(move);
  // Separation changes intentions, never authoritative positions.
  if(!p.keeper) for(const q of world.players) {const gap=distance(p,q);if(!q.sentOff&&q.id!==p.id && gap>0 && gap<1.5){move.x+=(p.x-q.x)/gap*(1.5-gap)*.6;move.y+=(p.y-q.y)/gap*(1.5-gap)*.6;}}
  if(length(move)>1) move=unit(move);
    return {move,aim,sprint:!p.keeper&&(isCarrier||(['press','counterpress'].includes(assignment?.responsibility??'')&&t.tactics.pressing>.45)||d>14),shield:isCarrier&&p.capabilities.physical>80,action,power};
}

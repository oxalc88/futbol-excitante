import type { InputFrame, World } from '../contracts/types';
import { createConfig } from '../simulation/config';
import { DEFAULT_TACTICS, validateTeam } from './data';

const phases=['kickoff','playing','goal','throw-in','corner','goal-kick','free-kick','offside','penalty','indirect','halftime','fulltime'];
const actions=['pass','through','cross','shoot','tackle','slide','lob','header'];
function invalid(path:string):never {throw new Error(`Checkpoint inválido: ${path}.`);}
function object(v:unknown,path:string):asserts v is Record<string,unknown> {if(!v||typeof v!=='object'||Array.isArray(v))invalid(path);}
function number(v:unknown,path:string,min=-Number.MAX_VALUE,max=Number.MAX_VALUE,integer=false){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isSafeInteger(v)))invalid(path);}
function choice(v:unknown,values:readonly unknown[],path:string){if(!values.includes(v))invalid(path);}
function vector(v:unknown,path:string,limit=Number.MAX_VALUE){object(v,path);number(v.x,`${path}.x`,-limit,limit);number(v.y,`${path}.y`,-limit,limit);}
function array(v:unknown,path:string,size?:number):asserts v is unknown[]{if(!Array.isArray(v)||(size!==undefined&&v.length!==size))invalid(path);}
function intent(v:unknown,path:string){object(v,path);vector(v.move,`${path}.move`);vector(v.aim,`${path}.aim`);choice(v.sprint,[true,false],`${path}.sprint`);choice(v.shield,[true,false],`${path}.shield`);if(v.action!==undefined)choice(v.action,actions,`${path}.action`);}
export function validateReplayInput(v:unknown):asserts v is InputFrame {
  object(v,'entrada');number(v.tick,'entrada.tick',0,250000,true);choice(v.slot,[0,1],'entrada.slot');intent(v,'entrada');
  if(v.power!==undefined)number(v.power,'entrada.power',0,1);
  if(v.switchKeeper!==undefined)choice(v.switchKeeper,[true,false],'entrada.switchKeeper');
  if(v.switchPlayer!==undefined)choice(v.switchPlayer,[true,false],'entrada.switchPlayer');
  if(v.keeperRush!==undefined)choice(v.keeperRush,[true,false],'entrada.keeperRush');
  if(v.keeperDrop!==undefined)choice(v.keeperDrop,[true,false],'entrada.keeperDrop');
  if(v.keeperFeint!==undefined)choice(v.keeperFeint,[true,false],'entrada.keeperFeint');
  if(v.simulateDive!==undefined)choice(v.simulateDive,[true,false],'entrada.simulateDive');
  if(v.keeperKick!==undefined)choice(v.keeperKick,['punt','high'],'entrada.keeperKick');
  if(v.tactics!==undefined){object(v.tactics,'entrada.tactics');
    const defaults=['defensiveLine','compactness','pressing','tempo','width','support','buildUp','counterPress','shortPossession','tightMarking','adaptation'];
    for(const [k,n]of Object.entries(v.tactics)){if(k==='formation')choice(n,['4-3-3','4-4-2','3-5-2'],'entrada.tactics.formation');else {if(!defaults.includes(k))invalid(`entrada.tactics.${k}`);number(n,`entrada.tactics.${k}`,0,1);}}
  }
}

/** Pure validation: never normalizes or mutates the serialized checkpoint. */
export function validateCheckpoint(value:unknown):asserts value is World {
  object(value,'initial');const w=value as unknown as World;
  choice(w.version,['world-v2'],'versión del checkpoint');
  object(w.config,'configuración');const c=w.config;
  // Require every configuration field; retain serialized values rather than applying defaults.
  function configFields(v:unknown,template:unknown,path:string){
    if(typeof template==='number'){number(v,path,path==='configuración.seed'?-Number.MAX_SAFE_INTEGER:0,path==='configuración.seed'?Number.MAX_SAFE_INTEGER:1e9);return;}
    if(typeof template==='boolean'){choice(v,[true,false],path);return;}
    if(typeof template==='string'){choice(v,[template],path);return;}
    if(Array.isArray(template)){array(v,path,template.length);template.forEach((t,i)=>configFields(v[i],t,`${path}[${i}]`));return;}
    object(v,path);for(const [k,t]of Object.entries(template as object))configFields(v[k],t,`${path}.${k}`);
  }
  configFields(c,createConfig(),'configuración');
  number(c.teamSize,'cantidad de jugadores por equipo',2,11,true);number(c.seed,'semilla',-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,true);
  number(c.dt,'configuración.dt',Number.MIN_VALUE,.05);number(c.halfSeconds,'duración',Number.MIN_VALUE,250000);
  for(const [k,n]of Object.entries(c.pitch))number(n,`cancha.${k}`,Number.MIN_VALUE,1000);
  number(c.physics.substeps,'subpasos',1,100,true);
  if(c.pitch.goalWidth>c.pitch.width)invalid('ancho del arco');
  number(w.tick,'tick',0,250000,true);number(w.rng,'rng',0,0xffffffff,true);
  choice(w.phase,phases,'fase');choice(w.half,[1,2],'mitad');number(w.played,'tiempo jugado',0,c.halfSeconds);
  number(w.countdown,'cuenta regresiva',0,250000);number(w.eventSeq,'secuencia de eventos',0,Number.MAX_SAFE_INTEGER,true);
  array(w.score,'marcador',2);w.score.forEach((n,i)=>number(n,`marcador[${i}]`,0,250000,true));
  array(w.teams,'equipos',2);array(w.players,'cantidad de jugadores',c.teamSize*2);
  const ids=new Set<string>();
  for(const [i,t]of w.teams.entries()){
    object(t,`equipo ${i}`);
    try{validateTeam(t);}catch(e){throw new Error(`Checkpoint inválido: equipo ${i}: ${(e as Error).message}`);}
    object(t.tactics,`táctica del equipo ${i}`);choice(t.tactics.formation,['4-3-3','4-4-2','3-5-2'],`formación del equipo ${i}`);
    for(const k of Object.keys(DEFAULT_TACTICS).filter(k=>k!=='formation'))number((t.tactics as unknown as Record<string,unknown>)[k],`táctica del equipo ${i}.${k}`,0,1);
    if(t.players.length!==c.teamSize)invalid(`cantidad de jugadores del equipo ${i}`);
    if(t.players.some(p=>typeof p.keeper!=='boolean'))invalid(`arquero del equipo ${i}`);
    choice(t.direction,[-1,1],`dirección del equipo ${i}`);choice(t.phase,['attack','defence','to-attack','to-defence'],`fase del equipo ${i}`);number(t.phaseTick,`tick del equipo ${i}`,0,250000,true);
    object(t.assignments,`asignaciones del equipo ${i}`);object(t.memory,`memoria del equipo ${i}`);object(t.memory.touches,'memoria.touches');array(t.memory.flank,'memoria.flank',2);
    for(const n of [...Object.values(t.memory.touches),...t.memory.flank])number(n,'memoria de equipo',0);
    for(const a of Object.values(t.assignments)){object(a,'asignación');vector(a.anchor,'asignación.anchor');vector(a.target,'asignación.target');if(typeof a.responsibility!=='string')invalid('asignación.responsibility');}
  }
  // Collisions transfer velocity between players; allow ample headroom over running speed.
  const playerSpeed=4*Math.max(c.goalkeeper.speed,...w.teams.flatMap(t=>t.players.map(p=>p.capabilities.speed)));
  // Shots reach 1.1 * power; crosses launch at up to 11 m/s vertically and 7 rad/s spin.
  const ballSpeed=4*Math.max(26,...w.teams.flatMap(t=>t.players.map(p=>1.1*p.capabilities.power)));
  const ballMargin=Math.max(10,ballSpeed*c.dt*2,c.physics.radius*2);
  const ballHeight=Math.max(50,c.pitch.goalHeight*4,c.goalkeeper.highReach+4*11**2/(2*Math.max(c.physics.gravity,.1)));
  for(const p of w.players){
    object(p,'jugador');choice(p.team,[0,1],'equipo del jugador');
    const profile=w.teams[p.team].players.find(q=>q.id===p.id);
    if(!profile||ids.has(p.id))invalid('ID de jugador duplicado o ajeno al equipo');ids.add(p.id);
    try{validateTeam({...w.teams[p.team],players:[{...p,keeper:true}]});}catch(e){throw new Error(`Checkpoint inválido: jugador ${p.id}: ${(e as Error).message}`);}
    choice(p.keeper,[profile.keeper],`arquero ${p.id}`);choice(p.sentOff,[true,false],`expulsión ${p.id}`);
    vector(p,`posición del jugador ${p.id}`);number(p.x,`jugador ${p.id}.x`,-c.pitch.length/2-1,c.pitch.length/2+1);number(p.y,`jugador ${p.id}.y`,-c.pitch.width/2-1,c.pitch.width/2+1);
    for(const k of ['vx','vy']as const)number(p[k],`jugador ${p.id}.${k}`,-playerSpeed,playerSpeed);
    // Movement normalizes to ±PI, but body-contact stumbles can add an angle afterward.
    // Heading is an angle that can accumulate (stumbles add to it); any finite value is valid.
    number(p.heading,`jugador ${p.id}.heading`);
    for(const k of ['energy','stability']as const)number(p[k],`jugador ${p.id}.${k}`,0,1);
    for(const k of ['touchCooldown','recovery','travel','heldSince','keeperUntil']as const)number(p[k],`jugador ${p.id}.${k}`,0);
    if(p.manualControl!==undefined)choice(p.manualControl,[true,false],`jugador ${p.id}.manualControl`);
    if(p.keeperRushing!==undefined)choice(p.keeperRushing,[true,false],`jugador ${p.id}.keeperRushing`);
    if(p.keeperDropped!==undefined)choice(p.keeperDropped,[true,false],`jugador ${p.id}.keeperDropped`);
    number(p.keeperReaction,`jugador ${p.id}.keeperReaction`);number(p.yellows,`jugador ${p.id}.yellows`,0,2,true);choice(p.keeperMode,['ready','dive','hold','recover'],`jugador ${p.id}.keeperMode`);
    intent(p.intent,`jugador ${p.id}.intent`);number(p.intent.power,`jugador ${p.id}.intent.power`,0,1);
    if(p.action!==null){object(p.action,'acción');choice(p.action.kind,actions,'acción.kind');for(const k of ['start','contact','end']as const)number(p.action[k],`acción.${k}`,k==='start'?-7:0,Number.MAX_SAFE_INTEGER,true);vector(p.action.aim,'acción.aim');number(p.action.power,'acción.power',0,1);choice(p.action.resolved,[true,false],'acción.resolved');if(p.action.keeperKick!==undefined)choice(p.action.keeperKick,['punt','high'],'acción.keeperKick');}
  }
  for(const i of [0,1]as const){if(w.players.filter(p=>p.team===i).length!==c.teamSize)invalid(`cantidad de jugadores del equipo ${i}`);if(w.players.filter(p=>p.team===i&&p.keeper).length!==1)invalid(`cantidad de arqueros del equipo ${i}`);}
  const ref=(id:unknown,path:string,nullable=true)=>{if(!(nullable&&id===null)&&(typeof id!=='string'||!ids.has(id)))invalid(path);};
  const team=(v:unknown,path:string)=>choice(v,[0,1],path);
  object(w.ball,'balón');number(w.ball.x,'balón.x',-c.pitch.length/2-ballMargin,c.pitch.length/2+ballMargin);number(w.ball.y,'balón.y',-c.pitch.width/2-ballMargin,c.pitch.width/2+ballMargin);number(w.ball.z,'balón.z',0,ballHeight);for(const k of ['vx','vy','vz']as const)number(w.ball[k],`balón.${k}`,-ballSpeed,ballSpeed);
  vector(w.ball.spin,'balón.spin',4*7);number(w.ball.spin.z,'balón.spin.z',-4*7,4*7);number(w.ball.freeTicks,'balón.freeTicks',0,Number.MAX_SAFE_INTEGER,true);choice(w.ball.flight,['shot','pass','loose'],'balón.flight');
  if(w.ball.lastTouch!==null){const t=w.ball.lastTouch;object(t,'último contacto');ref(t.playerId,'último contacto.jugador',false);team(t.team,'último contacto.equipo');number(t.tick,'último contacto.tick',0,w.tick,true);choice(t.surface,['foot','head','hand','body'],'último contacto.superficie');vector(t.point,'último contacto.punto');number(t.point.z,'último contacto.z',0);if(typeof t.id!=='string')invalid('último contacto.id');}
  array(w.selected,'selección',2);w.selected.forEach((id,i)=>{ref(id,'selección');if(id!==null&&!w.players.some(p=>p.id===id&&p.team===i))invalid('selección del equipo');});
  ref(w.carrier,'portador');choice(w.possession,[null,0,1],'posesión');
  for(const t of w.teams){ref(t.chaser,'perseguidor');ref(t.memory.focal,'memoria.focal');if(t.memory.lastContact!==null&&typeof t.memory.lastContact!=='string')invalid('memoria.lastContact');}
  if(w.restart!==null){const r=w.restart;object(r,'saque');team(r.team,'saque.equipo');vector(r.point,'saque.punto');if(!(w.phase==='goal'&&r.kind==='kickoff'&&r.taker===''))ref(r.taker,'sacador',false);number(r.remaining,'saque.remaining',0);choice(r.kind,phases,'saque.fase');if(w.phase==='playing')invalid('saque durante juego');}
  if(w.keeperHold!==null){object(w.keeperHold,'posesión del arquero');ref(w.keeperHold.playerId,'posesión del arquero.jugador',false);number(w.keeperHold.since,'posesión del arquero.tick',0,w.tick,true);if(!w.players.some(p=>p.id===w.keeperHold!.playerId&&p.keeper&&!p.sentOff))invalid('posesión del arquero');}
  if(w.offside!==null){object(w.offside,'fuera de juego');team(w.offside.team,'fuera de juego.equipo');array(w.offside.candidates,'fuera de juego.candidatos');w.offside.candidates.forEach(id=>ref(id,'fuera de juego.jugador',false));}
  if(w.pendingPass!==null){object(w.pendingPass,'pase pendiente');team(w.pendingPass.team,'pase pendiente.equipo');ref(w.pendingPass.playerId,'pase pendiente.jugador',false);}
  if(w.advantage!==null){object(w.advantage,'ventaja');team(w.advantage.team,'ventaja.equipo');vector(w.advantage.point,'ventaja.punto');number(w.advantage.until,'ventaja.until',0);ref(w.advantage.offender,'ventaja.infractor',false);choice(w.advantage.card,[null,'yellow','red'],'ventaja.tarjeta');}
  if(w.restartRestriction!==null){const r=w.restartRestriction;object(r,'restricción de saque');ref(r.taker,'restricción.sacador',false);team(r.team,'restricción.equipo');choice(r.indirect,[true,false],'restricción.indirecto');choice(r.kind,phases,'restricción.fase');}
  array(w.pendingCards,'tarjetas pendientes');for(const card of w.pendingCards){object(card,'tarjeta');ref(card.playerId,'tarjeta.jugador',false);choice(card.card,['yellow','red'],'tarjeta.color');}
  array(w.stats,'estadísticas',2);const statKeys=['shots','onTarget','passes','completed','saves','tackles','fouls','possessionTicks','corners','offsides','yellows','reds','penalties'];for(const s of w.stats){object(s,'estadísticas');for(const k of statKeys)number(s[k],`estadísticas.${k}`,0,Number.MAX_SAFE_INTEGER,true);}
  array(w.inputs,'entradas pendientes');w.inputs.forEach(f=>{validateReplayInput(f);if(f.tick<w.tick||f.tick>w.tick+600)invalid('tick de entrada pendiente');});
  // Include numeric event payloads and extra serialized fields in the finite-number check.
  function finite(v:unknown,path:string){if(typeof v==='number')number(v,path);else if(v&&typeof v==='object')for(const [k,n]of Object.entries(v))finite(n,`${path}.${k}`);}
  finite(w,'initial');
  array(w.events,'eventos');for(const e of w.events){object(e,'evento');number(e.tick,'evento.tick',0,w.tick,true);if(typeof e.id!=='string'||typeof e.type!=='string')invalid('evento');}
}

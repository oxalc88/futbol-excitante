import './style.css';
import type { Config, InputFrame, Presentation, Replay, TeamProfile, World } from '../contracts/types';
import { Simulation } from '../simulation/engine';
import { createConfig } from '../simulation/config';
import { BrowserInput } from '../adapters/input';
import { FootballRenderer, type Kit } from '../adapters/renderer';
import { makeTeam, TEAM_CATALOG, validateTeam } from '../adapters/data';
import { Recorder, parseReplay, replaySimulation } from '../adapters/replay';
import { PeerSession } from '../adapters/network';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)as T;
const app=$('app');
app.innerHTML=`
<main class="game">
 <header class="topbar"><a class="wordmark" href="./" aria-label="Fútbol Excitante, inicio"><span class="crest">FE</span><span>FÚTBOL <b>EXCITANTE</b></span></a><span class="edition">EDICIÓN CANCHA · 01</span><button id="menu-btn" class="quiet">Partido <span>☰</span></button></header>
 <section id="viewport" aria-label="Partido de fútbol">
  <div class="scoreboard"><span class="team-tag home" id="home-short">COS</span><strong id="score">0 : 0</strong><span class="team-tag away" id="away-short">SIE</span><span id="clock">00:00</span><span id="half">1T</span></div>
  <div class="live-strip"><span id="match-mode">PARTIDO DE EXHIBICIÓN</span><span id="phase">Saque inicial</span></div>
  <div id="announcement" role="status" aria-live="polite"></div>
  <div class="field-toolbar"><button id="pause-btn" title="Pausar (P)">Ⅱ <span>Pausa</span></button><button id="camera-btn" title="Cambiar cámara (C)">◈ <span>Cámara</span></button><button id="stats-btn">▥ <span>Estadísticas</span></button><button id="sound-btn" aria-pressed="false">♪ <span>Sonido</span></button><button id="fullscreen-btn" title="Pantalla completa">⛶</button></div>
  <div id="pause-overlay" hidden><strong>PAUSA</strong><button id="resume-btn" class="primary">Seguir jugando</button></div>
  <div class="bottom-hud"><div class="player-card"><span class="eyebrow">CONTROLAS A</span><strong id="player-name">—</strong><div class="energy"><span id="energy-bar"></span></div><span id="player-trait">—</span><div class="power" id="power-meter" hidden><span id="power-bar"></span></div></div><canvas id="radar" width="252" height="162" aria-label="Radar con posiciones de jugadores y balón"></canvas><div class="input-hint"><span id="pad-status">TECLADO · JUGADOR 1</span><p><kbd>W A S D</kbd> mover · <kbd>J</kbd> pase<br><kbd>K</kbd> tiro · <kbd>Q</kbd> cambiar</p></div></div>
  <div class="touch-controls"><div id="joystick" aria-label="Joystick táctil"><div id="stick"></div></div><div class="touch-buttons"><button data-action="cross">Centro</button><button data-action="through">Filtrado</button><button id="touch-sprint">Correr</button><button data-action="tackle">Entrada</button><button data-action="pass">Pase</button><button data-action="shoot" class="shoot">Tiro</button><button id="touch-switch">Cambiar</button></div></div>
 </section>
 <footer><span id="footer-match">ATLÉTICO COSTA <i>vs</i> DEPORTIVO SIERRA</span><span>11 contra 11 · Equipos ficticios</span><button id="help-btn">Controles</button></footer>
</main>
<dialog id="setup-dialog" class="setup"><form id="setup-form"><div class="dialog-top"><span class="eyebrow">FÚTBOL EXCITANTE</span><button type="button" id="close-setup" class="close" aria-label="Cerrar">×</button></div><h1>A la cancha.</h1><p class="intro">Elige tus equipos. El partido empieza aquí.</p>
<div class="team-selection"><label>LOCAL<select id="home-team">${TEAM_CATALOG.map((t,i)=>`<option value="${i}">${t.name}</option>`).join('')}</select><span class="team-stripe cream"></span></label><span class="versus">VS</span><label>VISITANTE<select id="away-team">${TEAM_CATALOG.map((t,i)=>`<option value="${i}" ${i===1?'selected':''}>${t.name}</option>`).join('')}</select><span class="team-stripe blue"></span></label></div>
<div class="setup-grid"><label>Modo<select id="mode"><option value="solo">Tú contra la CPU</option><option value="local">Dos jugadores locales</option><option value="watch">CPU contra CPU</option></select></label><label>Duración<select id="duration"><option value="120">2 minutos</option><option value="360" selected>6 minutos</option><option value="600">10 minutos</option></select></label><label>Jugadores<select id="size"><option value="11">11 contra 11</option><option value="5">5 contra 5</option><option value="2">2 contra 2</option></select></label><label>Semilla<input id="seed" type="number" min="1" max="2147483647" value="2017" required /></label></div>
<details class="tactics"><summary>Plan de juego y opciones</summary><div class="setup-grid"><label>Formación local<select id="formation"><option>4-3-3</option><option>4-4-2</option><option>3-5-2</option></select></label><label>Presión<input id="pressing" type="range" min="0" max="1" step="0.05" value="0.6" /></label><label>Amplitud<input id="width" type="range" min="0" max="1" step="0.05" value="0.7" /></label><label>Ritmo<input id="tempo" type="range" min="0" max="1" step="0.05" value="0.65" /></label><label>Gráficos<select id="quality"><option value="high">Normal</option><option value="low">Ligero</option></select></label><label>Equipo JSON<input id="roster-file" type="file" accept="application/json,.json" /></label></div><p id="roster-status">Opcional: importa un equipo ficticio propio para el lado local.</p><button type="button" id="export-roster" class="quiet">Descargar equipo de ejemplo</button></details>
<p id="setup-error" class="error" role="alert"></p><button id="start-btn" class="primary wide" type="submit">Jugar partido <span>→</span></button><div class="secondary-actions"><button type="button" id="online-btn">Online experimental</button><button type="button" id="load-replay">Cargar repetición</button></div><p class="fine-print">Física y reglas experimentales inspiradas en la visión del proyecto.</p></form></dialog>
<dialog id="help-dialog"><div class="dialog-top"><span class="eyebrow">TODO EMPIEZA CON UN PASE</span><button class="close" data-close="help-dialog" aria-label="Cerrar">×</button></div><h2>Controles</h2><div class="table-scroll"><table><thead><tr><th>Acción</th><th>Jugador 1</th><th>Jugador 2</th><th>Xbox / PlayStation</th></tr></thead><tbody><tr><td>Mover / apuntar</td><td>W A S D</td><td>Flechas</td><td>Stick izquierdo</td></tr><tr><td>Pase corto</td><td>J</td><td>Num 1</td><td>A / ✕</td></tr><tr><td>Tiro (mantener y soltar)</td><td>K</td><td>Num 2</td><td>B / ○</td></tr><tr><td>Pase filtrado</td><td>L</td><td>Num 3</td><td>Y / △</td></tr><tr><td>Centro</td><td>I</td><td>Num 5</td><td>X / □</td></tr><tr><td>Entrada</td><td>U</td><td>Num 0</td><td>RB / R1</td></tr><tr><td>Cabecear</td><td>O</td><td>Num 6</td><td>RT / R2</td></tr><tr><td>Correr</td><td>Shift izquierdo</td><td>Shift derecho</td><td>LT / L2</td></tr><tr><td>Cambiar jugador</td><td>Q</td><td>Enter</td><td>LB / L1</td></tr><tr><td>Proteger balón</td><td>Espacio</td><td>Num .</td><td>L3</td></tr></tbody></table></div><p>Apunta con el movimiento antes de pasar o disparar. Los jugadores aceleran y giran con inercia. Los saques se ejecutan automáticamente.</p><p>Conecta hasta dos mandos y pulsa un botón para activarlos. Se admiten mandos que el navegador reconozca con mapeo estándar.</p><p><kbd>P / Esc</kbd> pausa · <kbd>C</kbd> cámara. En pantalla táctil, mueve el stick y toca las acciones.</p><button data-close="help-dialog" class="primary wide">Entendido</button></dialog>
<dialog id="stats-dialog"><div class="dialog-top"><span class="eyebrow" id="stats-label">EL PARTIDO EN NÚMEROS</span><button class="close" data-close="stats-dialog" aria-label="Cerrar">×</button></div><h2 id="result-title">Estadísticas</h2><div id="stats-content"></div><div class="secondary-actions"><button id="save-replay" class="primary">Guardar repetición</button><button id="new-match">Nuevo partido</button></div></dialog>
<dialog id="online-dialog"><div class="dialog-top"><span class="eyebrow">CONEXIÓN ENTRE AMIGOS</span><button class="close" data-close="online-dialog" aria-label="Cerrar">×</button></div><h2>Online experimental</h2><p>El anfitrión simula el partido. Intercambia estos códigos por el medio que prefieras; no se envían automáticamente.</p><label>Servidor STUN (opcional)<input id="stun-url" placeholder="stun:tu-servidor:3478" /></label><p class="fine-print">Sin STUN funciona en redes que permiten una ruta directa. Algunas redes necesitan TURN, que este prototipo no configura.</p><label>Código recibido<textarea id="remote-code" rows="4" placeholder="Pega la invitación o la respuesta de tu amigo"></textarea></label><div class="secondary-actions"><button id="create-offer">1. Crear invitación</button><button id="create-answer">2. Responder invitación</button><button id="accept-answer">3. Aceptar respuesta</button></div><label>Tu código<textarea id="local-code" rows="4" readonly></textarea></label><button id="copy-code">Copiar código</button><p id="network-status" role="status">Esperando conexión.</p><p class="fine-print">Al conectar, el anfitrión inicia un partido de 6 minutos. El invitado controla al visitante. No hay predicción ni compensación de latencia.</p></dialog>
<input id="replay-file" type="file" accept="application/json,.json" hidden />`;

const input=new BrowserInput(),peer=new PeerSession();let importedTeam:TeamProfile|null=null;
let config=createConfig({human:[false,false]}),sim=new Simulation(config,[makeTeam(0),makeTeam(1)]),record=new Recorder(sim);
let previous=sim.presentation(),current=previous,renderer:FootballRenderer|null=null,paused=false,started=false,last=performance.now(),accumulator=0,hudClock=0;
let replay:Replay|null=null,replayIndex=0,guest=false,guestCounter=0,networkTick=0,finalShown=false,cameraIndex=0;
let pendingTactics:InputFrame['tactics']|undefined;let replayResult='';
let audioContext:AudioContext|null=null,sound=false;
const phaseLabels:Record<string,string>={kickoff:'Saque inicial',playing:'En juego',goal:'¡GOL!',halftime:'Entretiempo',fulltime:'Final del partido','throw-in':'Saque de banda',corner:'Tiro de esquina','goal-kick':'Saque de meta','free-kick':'Tiro libre',offside:'Fuera de juego'};
function kits(home:number,away:number):[Kit,Kit]{const a=TEAM_CATALOG[home],b=TEAM_CATALOG[away];return[{shirt:a.color,shorts:a.shorts,accent:a.accent,pattern:'band'},{shirt:home===away?'#2052a5':b.color,shorts:b.shorts,accent:b.accent,pattern:'plain'}];}
function makeRenderer(k:[Kit,Kit]){renderer?.dispose();try{renderer=new FootballRenderer($('viewport'),$<HTMLCanvasElement>('radar'),config,k);renderer.setQuality($<HTMLSelectElement>('quality').value);}catch(e){renderer=null;$('announcement').textContent='No se pudo iniciar WebGL2. Prueba un navegador compatible con aceleración gráfica.';console.error(e);}}
makeRenderer(kits(0,1));
function download(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function closeDialog(id:string){$<HTMLDialogElement>(id).close();if(started&&!guest)pause(false);}
function showDialog(id:string){if(started&&!guest)pause(true);$<HTMLDialogElement>(id).showModal();}
function pause(value:boolean){paused=value;input.enabled=started&&!paused&&!replay;input.clear();$('pause-overlay').hidden=!paused||!!document.querySelector('dialog[open]');$('pause-btn').setAttribute('aria-pressed',String(paused));$('pause-btn').innerHTML=paused?'▶ <span>Seguir</span>':'Ⅱ <span>Pausa</span>';accumulator=0;}
function start(mode?:string){
  const home=Number($<HTMLSelectElement>('home-team').value),away=Number($<HTMLSelectElement>('away-team').value),size=Number($<HTMLSelectElement>('size').value);
  const chosen=mode??$<HTMLSelectElement>('mode').value;
  if(importedTeam&&importedTeam.players.length!==size)throw new Error(`El equipo importado tiene ${importedTeam.players.length} jugadores. Elige esa cantidad.`);
  const t1=importedTeam?structuredClone(importedTeam):makeTeam(home,size),t2=makeTeam(away,size);
  if(t1.id===t2.id){t2.id+='-away';t2.players=t2.players.map(p=>({...p,id:p.id+'-away'}));}
  t1.tactics.formation=$<HTMLSelectElement>('formation').value as TeamProfile['tactics']['formation'];
  for(const k of ['pressing','width','tempo']as const)t1.tactics[k]=Number($<HTMLInputElement>(k).value);
  config=createConfig({human:chosen==='watch'?[false,false]:chosen==='local'?[true,true]:[true,false],seed:Number($<HTMLInputElement>('seed').value),teamSize:size,halfSeconds:Number($<HTMLSelectElement>('duration').value)/2});
  sim=new Simulation(config,[validateTeam(t1),validateTeam(t2)]);previous=current=sim.presentation();record=new Recorder(sim);replay=null;replayIndex=0;replayResult='';guest=false;finalShown=false;started=true;pendingTactics=undefined;
  makeRenderer(kits(home,away));$('match-mode').textContent=chosen==='watch'?'CPU CONTRA CPU':chosen==='local'?'DOS JUGADORES':'TÚ CONTRA LA CPU';
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());pause(false);updateHud();
}
$('setup-form').addEventListener('submit',e=>{e.preventDefault();try{peer.close();start();$('setup-error').textContent='';}catch(e){$('setup-error').textContent=(e as Error).message;}});
$('menu-btn').onclick=()=>showDialog('setup-dialog');$('close-setup').onclick=()=>closeDialog('setup-dialog');
$('pause-btn').onclick=$('resume-btn').onclick=()=>pause(!paused);$('help-btn').onclick=()=>showDialog('help-dialog');
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.dataset.close!));
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(d=>d.addEventListener('cancel',()=>{if(started)pause(false);}));
function changeCamera(){cameraIndex=(cameraIndex+1)%3;renderer?.setCamera((['broadcast','tactical','close']as const)[cameraIndex]);}
$('camera-btn').onclick=changeCamera;
window.addEventListener('keydown',e=>{if((e.target as HTMLElement)?.matches('input,textarea,select')||document.querySelector('dialog[open]'))return;if(e.code==='KeyP'||e.code==='Escape')pause(!paused);if(e.code==='KeyC')changeCamera();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!guest)pause(true);});
$('fullscreen-btn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('app').requestFullscreen();}catch{$('announcement').textContent='Pantalla completa no disponible en este navegador.';}};
$('sound-btn').onclick=()=>{sound=!sound;if(sound){audioContext??=new AudioContext();void audioContext.resume();}$('sound-btn').setAttribute('aria-pressed',String(sound));};
function beep(frequency:number,duration=.1){if(!sound||!audioContext)return;const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.frequency.value=frequency;osc.connect(gain);gain.connect(audioContext.destination);gain.gain.setValueAtTime(.04,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);osc.start();osc.stop(audioContext.currentTime+duration);}
function updateHud(){
  const s=current;const time=(s.half-1)*45*60+s.played/config.halfSeconds*45*60;
  $('score').textContent=`${s.score[0]} : ${s.score[1]}`;$('clock').textContent=`${Math.floor(time/60).toString().padStart(2,'0')}:${Math.floor(time%60).toString().padStart(2,'0')}`;$('half').textContent=`${s.half}T`;
  $('home-short').textContent=s.teams[0].shortName;$('away-short').textContent=s.teams[1].shortName;$('phase').textContent=phaseLabels[s.phase]??s.phase;
  $('footer-match').textContent=`${s.teams[0].name.toUpperCase()} vs ${s.teams[1].name.toUpperCase()}`;
  const p=s.players.find(p=>p.id===s.selected[guest?1:0]);$('player-name').textContent=p?`${p.number} · ${p.name}`:'—';
  $('energy-bar').style.width=`${(p?.energy??1)*100}%`;$('player-trait').textContent=p?`${p.capabilities.speed>8?'Ágil y técnico':'Fuerte en el contacto'} · ${p.foot==='left'?'Zurdo':'Diestro'}`:'';
  $('pad-status').textContent=guest?'JUGADOR 2 · ONLINE':replay?'REPETICIÓN':!config.human.some(Boolean)?'MODO ESPECTADOR':input.gamepads.length?`${input.gamepads.length} MANDO${input.gamepads.length>1?'S':''} CONECTADO${input.gamepads.length>1?'S':''}`:'TECLADO · JUGADOR 1';
  $('power-meter').hidden=input.charging===0;$('power-bar').style.width=`${input.charging*100}%`;
  $('announcement').textContent=replayResult||(s.phase==='goal'?'¡GOOOL!':s.phase==='halftime'?'ENTRETIEMPO':s.phase==='fulltime'?'FINAL DEL PARTIDO':'');
  input.setDirections(guest?[s.teams[1].direction,s.teams[0].direction]:[s.teams[0].direction,s.teams[1].direction]);
}
function showStats(){const s=current;$('result-title').textContent=`${s.teams[0].shortName} ${s.score[0]} — ${s.score[1]} ${s.teams[1].shortName}`;
  const total=s.stats[0].possessionTicks+s.stats[1].possessionTicks||1;
  const rows=[['Posesión',`${Math.round(s.stats[0].possessionTicks/total*100)}%`,`${Math.round(s.stats[1].possessionTicks/total*100)}%`],['Tiros',s.stats[0].shots,s.stats[1].shots],['A puerta',s.stats[0].onTarget,s.stats[1].onTarget],['Pases completados',`${s.stats[0].completed}/${s.stats[0].passes}`,`${s.stats[1].completed}/${s.stats[1].passes}`],['Atajadas',s.stats[0].saves,s.stats[1].saves],['Entradas ganadas',s.stats[0].tackles,s.stats[1].tackles],['Faltas',s.stats[0].fouls,s.stats[1].fouls],['Córners',s.stats[0].corners,s.stats[1].corners],['Fuera de juego',s.stats[0].offsides,s.stats[1].offsides]];
  $('stats-content').replaceChildren();for(const [label,a,b]of rows){const row=document.createElement('div');row.className='stat-row';for(const value of [a,label,b]){const span=document.createElement('span');span.textContent=String(value);row.append(span);}$('stats-content').append(row);}showDialog('stats-dialog');}
$('stats-btn').onclick=showStats;$('new-match').onclick=()=>{closeDialog('stats-dialog');showDialog('setup-dialog');};
$('save-replay').onclick=()=>{if(guest){$('stats-label').textContent='El anfitrión puede guardar la repetición.';return;}download(`futbol-${config.seed}-${sim.tick}.json`,record.finish(sim));};
$('export-roster').onclick=()=>download('equipo-ejemplo.json',makeTeam(Number($<HTMLSelectElement>('home-team').value),Number($<HTMLSelectElement>('size').value)));
$<HTMLInputElement>('roster-file').onchange=async e=>{try{const f=(e.target as HTMLInputElement).files?.[0];if(!f)return;if(f.size>100000)throw new Error('El archivo supera 100 KB.');importedTeam=validateTeam(JSON.parse(await f.text()));$('roster-status').textContent=`${importedTeam.name} · ${importedTeam.players.length} jugadores cargados.`;}catch(e){importedTeam=null;$('roster-status').textContent=(e as Error).message;}};
$('load-replay').onclick=()=>$<HTMLInputElement>('replay-file').click();
$<HTMLInputElement>('replay-file').onchange=async e=>{try{const f=(e.target as HTMLInputElement).files?.[0];if(!f)return;if(f.size>30000000)throw new Error('La repetición supera 30 MB.');const loaded=parseReplay(JSON.parse(await f.text()));loaded.initial.teams.forEach(validateTeam);peer.close();sim=replaySimulation(loaded);config=loaded.initial.config;record=new Recorder(sim);replay=loaded;replayIndex=0;started=true;guest=false;finalShown=false;previous=current=sim.presentation();makeRenderer(kits(0,1));$('setup-dialog').closest('dialog')?.close();pause(false);$('match-mode').textContent='REPETICIÓN';}catch(e){$('setup-error').textContent=(e as Error).message;}};
for(const key of ['formation','pressing','width','tempo'])$(key).addEventListener('change',()=>{if(!started||guest||replay)return;pendingTactics={formation:$<HTMLSelectElement>('formation').value as TeamProfile['tactics']['formation'],pressing:Number($<HTMLInputElement>('pressing').value),width:Number($<HTMLInputElement>('width').value),tempo:Number($<HTMLInputElement>('tempo').value)};});
const joystick=$('joystick'),stick=$('stick');let stickPointer:number|null=null;
function stickMove(e:PointerEvent){const r=joystick.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width*.36),y=(e.clientY-r.top-r.height/2)/(r.height*.36),d=Math.max(1,Math.hypot(x,y));input.setTouchMove({x:x/d,y:y/d});stick.style.transform=`translate(${x/d*34}px,${y/d*34}px)`;}
joystick.onpointerdown=e=>{if(stickPointer!==null)return;stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);stickMove(e);};joystick.onpointermove=e=>{if(stickPointer===e.pointerId)stickMove(e);};
joystick.onpointerup=joystick.onpointercancel=()=>{stickPointer=null;input.setTouchMove({x:0,y:0});stick.style.transform='';};
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b=>b.onpointerdown=e=>{e.preventDefault();input.touchAction(b.dataset.action as InputFrame['action']&string);});
$('touch-sprint').onpointerdown=e=>{(e.target as HTMLElement).setPointerCapture(e.pointerId);input.setTouchSprint(true);};$('touch-sprint').onpointerup=$('touch-sprint').onpointercancel=()=>input.setTouchSprint(false);$('touch-switch').onclick=()=>input.switchTouch();
$('online-btn').onclick=()=>showDialog('online-dialog');
async function networkTask(work:()=>Promise<string|void>){try{$('network-status').textContent='Preparando conexión…';const code=await work();if(code)$<HTMLTextAreaElement>('local-code').value=code;$('network-status').textContent='Código listo. Intercámbialo con tu amigo.';}catch(e){$('network-status').textContent=(e as Error).message;}}
$('create-offer').onclick=()=>networkTask(()=>peer.offer($<HTMLInputElement>('stun-url').value.trim()));
$('create-answer').onclick=()=>networkTask(()=>peer.answer($<HTMLTextAreaElement>('remote-code').value,$<HTMLInputElement>('stun-url').value.trim()));
$('accept-answer').onclick=()=>networkTask(()=>peer.accept($<HTMLTextAreaElement>('remote-code').value));
$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText($<HTMLTextAreaElement>('local-code').value);$('network-status').textContent='Código copiado.';}catch{$<HTMLTextAreaElement>('local-code').select();$('network-status').textContent='Selecciona y copia el código.';}};
peer.onStatus=s=>{$('network-status').textContent=s;if(s.includes('interrumpida')||s.includes('cerrada')){input.clear();pause(true);}};
peer.onConnect=()=>{if(peer.role==='host'){start('local');peer.start(sim.snapshot());$('match-mode').textContent='ONLINE · ANFITRIÓN';}};
peer.onStart=(world:World)=>{try{world.teams.forEach(validateTeam);sim=new Simulation(world.config,world.teams);sim.restore(world);config=world.config;guest=true;started=true;replay=null;previous=current=sim.presentation();makeRenderer(kits(0,1));document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());pause(false);$('match-mode').textContent='ONLINE · VISITANTE';}catch{peer.close();$('network-status').textContent='Estado inicial incompatible.';}};
peer.onSnapshot=s=>{if(!guest||!s||!Number.isInteger(s.tick)||s.tick<=current.tick||!Array.isArray(s.players)||s.players.length!==config.teamSize*2)return;previous=current;current=s;networkTick=performance.now();};
function loop(now:number){
  const elapsed=Math.min(.1,(now-last)/1000);last=now;
  try{
    if(guest){if(peer.connected&&!paused){guestCounter++;const frame=input.sample(guestCounter,0);peer.input({...frame,slot:1});}renderer?.draw(previous,current,Math.min(1,(now-networkTick)/100),elapsed);}
    else{
      if(!paused){accumulator+=elapsed;let steps=0;while(accumulator>=config.dt&&steps<6){
        if(replay&&sim.tick>=replay.endTick){pause(true);$('pause-overlay').hidden=true;replayResult=sim.stateHash()===replay.finalHash?'REPETICIÓN VERIFICADA':'La repetición diverge de su estado original.';$('announcement').textContent=replayResult;break;}
        const frames:InputFrame[]=[];
        if(replay){while(replay.inputs[replayIndex]?.tick===sim.tick)frames.push(replay.inputs[replayIndex++]);}
        else for(const slot of [0,1]as const)if(config.human[slot]){const f=slot===1&&peer.role==='host'?peer.hostFrame(sim.tick):input.sample(sim.tick,slot);if(slot===0&&pendingTactics){f.tactics=pendingTactics;pendingTactics=undefined;}frames.push(f);}
        sim.applyInputs(frames);if(!replay)record.record(frames);previous=current;sim.step();current=sim.presentation();
        if(current.events.some(e=>e.type==='goal'))beep(720,.6);else if(current.events.some(e=>['shoot','pass','cross'].includes(e.type)))beep(130,.045);
        if(peer.role==='host'&&sim.tick%6===0)peer.snapshot(current);
        accumulator-=config.dt;steps++;
        if(current.phase==='fulltime'&&started&&!finalShown&&!replay){finalShown=true;showStats();break;}
      }if(steps===6)accumulator=Math.min(accumulator,config.dt);}
      renderer?.draw(previous,current,paused?1:accumulator/config.dt,elapsed);
    }
    hudClock+=elapsed;if(hudClock>.1){updateHud();hudClock=0;}
  }catch(e){pause(true);$('announcement').textContent=`El partido se detuvo: ${(e as Error).message}`;console.error(e);}
  requestAnimationFrame(loop);
}
updateHud();$<HTMLDialogElement>('setup-dialog').showModal();requestAnimationFrame(loop);

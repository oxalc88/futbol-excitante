import { MatchAudio, soundCues } from './audio';
import { renderHud } from './hud';
import './style.css';
import { cardAlert, CARD_ALERT_TICKS } from './card-alert';
import { loadPitchPalette, savePitchPalette, type PitchPaletteStorage } from './pitch-palette';
import type { PitchPaletteId } from '../adapters/presentation-model';
import { shouldPause } from './pause-state';
import { isFulltime, rematchSetup } from './fulltime-flow';
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
  <div class="field-toolbar"><button id="pause-btn" title="Pausar (P)">Ⅱ <span>Pausa</span></button><button id="camera-btn" title="Cambiar cámara (C)">◈ <span>Cámara</span></button><button id="stats-btn">▥ <span>Estadísticas</span></button><button id="sound-btn" aria-pressed="false">♪ <span>Sonido</span></button><label>Volumen <input id="sound-volume" type="range" min="0" max="1" step="0.05" aria-label="Volumen del partido" /></label><button id="fullscreen-btn" title="Pantalla completa">⛶</button></div>
  <div id="pause-overlay" hidden><strong>PAUSA</strong><button id="resume-btn" class="primary">Seguir jugando</button></div>
  <div class="bottom-hud"><div class="player-card"><span class="eyebrow">CONTROLAS A</span><strong id="player-name">—</strong><div class="energy"><span id="energy-bar"></span></div><span id="player-trait">—</span><div class="power" id="power-meter" hidden><span id="power-bar"></span></div></div><canvas id="radar" width="252" height="162" aria-label="Radar con posiciones de jugadores y balón"></canvas><div class="input-hint"><span id="pad-status">TECLADO · JUGADOR 1</span><p><kbd>W A S D</kbd> mover · <kbd>J</kbd> pase<br><kbd>K</kbd> tiro · <kbd>Q</kbd> cambiar<br><kbd>R</kbd> arquero · <kbd>L</kbd> sale △ · <kbd>I</kbd> volea ○</p></div></div>
  <div class="touch-controls"><div id="joystick" aria-label="Joystick táctil"><div id="stick"></div></div><div class="touch-buttons"><button data-action="cross">Centro</button><button data-action="lob">Elevado</button><button data-action="header">Cabeza</button><button data-action="slide">Barrida</button><button id="touch-shield">Proteger</button><button data-action="through">Filtrado</button><button id="touch-sprint">Correr</button><button data-action="tackle">Entrada</button><button data-action="pass">Pase</button><button id="touch-shoot" class="shoot">Tiro</button><button id="touch-switch">Cambiar</button><button id="touch-keeper">Arquero</button></div></div>
 </section>
 <footer><span id="footer-match">ATLÉTICO COSTA <i>vs</i> DEPORTIVO SIERRA</span><span id="footer-size">11 contra 11 · Equipos ficticios</span><button id="help-btn">Controles</button></footer>
</main>
<dialog id="setup-dialog" class="setup"><form id="setup-form"><div class="dialog-top"><span class="eyebrow">FÚTBOL EXCITANTE</span><button type="button" id="close-setup" class="close" aria-label="Cerrar">×</button></div><h1>A la cancha.</h1><p class="intro">Elige tus equipos. El partido empieza aquí.</p>
<div class="team-selection"><label>LOCAL<select id="home-team">${TEAM_CATALOG.map((t,i)=>`<option value="${i}">${t.name}</option>`).join('')}</select><span class="team-stripe cream"></span></label><span class="versus">VS</span><label>VISITANTE<select id="away-team">${TEAM_CATALOG.map((t,i)=>`<option value="${i}" ${i===1?'selected':''}>${t.name}</option>`).join('')}</select><span class="team-stripe blue"></span></label></div>
<div class="setup-grid"><label>Modo<select id="mode"><option value="solo">Tú contra la CPU</option><option value="local">Dos jugadores locales</option><option value="watch">CPU contra CPU</option></select></label><label>Duración<select id="duration"><option value="120">2 minutos</option><option value="360" selected>6 minutos</option><option value="600">10 minutos</option></select></label><label>Jugadores<select id="size"><option value="11">11 contra 11</option><option value="5">5 contra 5</option><option value="2">2 contra 2</option></select></label><label>Semilla<input id="seed" type="number" min="1" max="2147483647" value="2017" required /></label></div>
<details class="tactics"><summary>Plan de juego y opciones</summary><div class="setup-grid"><label>Formación local<select id="formation"><option>4-3-3</option><option>4-4-2</option><option>3-5-2</option></select></label><label>Presión<input id="pressing" type="range" min="0" max="1" step="0.05" value="0.6" /></label><label>Amplitud<input id="width" type="range" min="0" max="1" step="0.05" value="0.7" /></label><label>Ritmo<input id="tempo" type="range" min="0" max="1" step="0.05" value="0.65" /></label><label>Contra presión<input id="counterPress" type="range" min="0" max="1" step="0.05" value="0.5" /></label><label>Pases cortos<input id="shortPossession" type="range" min="0" max="1" step="0.05" value="0.3" /></label><label>Marcaje estrecho<input id="tightMarking" type="range" min="0" max="1" step="0.05" value="0.3" /></label><label>Adaptación CPU<input id="adaptation" type="range" min="0" max="1" step="0.05" value="0.5" /></label><label>Línea defensiva<input id="defensiveLine" type="range" min="0" max="1" step="0.05" value="0.52" /></label><label>Compactación<input id="compactness" type="range" min="0" max="1" step="0.05" value="0.65" /></label><label>Apoyo<input id="support" type="range" min="0" max="1" step="0.05" value="0.6" /></label><label>Controles táctiles<select id="touch-option"><option value="auto">Automático</option><option value="show">Mostrar</option><option value="hide">Ocultar</option></select></label><label>Gráficos<select id="quality"><option value="high">Normal</option><option value="low">Ligero</option></select></label><label>Paleta de cancha<select id="pitch-palette"><option value="viva">Viva</option><option value="sobria">Sobria</option></select></label><label>Equipo JSON<input id="roster-file" type="file" accept="application/json,.json" /></label></div><p id="roster-status">Opcional: importa un equipo ficticio propio para el lado local.</p><button type="button" id="export-roster" class="quiet">Descargar equipo de ejemplo</button></details>
<p id="setup-error" class="error" role="alert"></p><button id="start-btn" class="primary wide" type="submit">Jugar partido <span>→</span></button><div class="secondary-actions"><button type="button" id="online-btn" hidden disabled>Online — próxima etapa</button><button type="button" id="load-replay">Cargar repetición</button></div><p class="fine-print">Física y reglas experimentales inspiradas en la visión del proyecto.</p></form></dialog>
<dialog id="help-dialog"><div class="dialog-top"><span class="eyebrow">TODO EMPIEZA CON UN PASE</span><button class="close" data-close="help-dialog" aria-label="Cerrar">×</button></div><h2>Controles</h2><div class="table-scroll"><table><thead><tr><th>Acción</th><th>Jugador 1</th><th>Jugador 2</th><th>Mando (PS4)</th></tr></thead><tbody><tr><td>Mover / apuntar</td><td>W A S D</td><td>Flechas</td><td>Stick izquierdo · derecho para apuntar</td></tr><tr><td>Pase corto</td><td>J</td><td>Num 1</td><td>✕</td></tr><tr><td>Pase alto / centro</td><td>I</td><td>Num 5</td><td>○</td></tr><tr><td>Tiro (mantener y soltar)</td><td>K</td><td>Num 2</td><td>□</td></tr><tr><td>Pase filtrado</td><td>L</td><td>Num 3</td><td>△</td></tr><tr><td>Pase elevado</td><td>Q + I</td><td>Enter + Num 5</td><td>L1 + ○</td></tr><tr><td>Cambio de frente</td><td>WASD hacia la otra banda + I</td><td>Flechas hacia la otra banda + Num 5</td><td>Stick izq. a la otra banda + ○</td></tr><tr><td>Correr</td><td>Shift izquierdo</td><td>Shift derecho</td><td>R1</td></tr><tr><td>Cambiar jugador</td><td>Q</td><td>Enter</td><td>L1</td></tr><tr><td>Entrada de pie</td><td>U ×2</td><td>Num 0 ×2</td><td>✕ ✕ (doble toque)</td></tr><tr><td>Presión (mantener) · próximamente</td><td>U (mantener)</td><td>Num 0 (mantener)</td><td>✕ mantener</td></tr><tr><td>Entrada deslizante (sin balón)</td><td>B</td><td>Num 7</td><td>○</td></tr><tr><td>Despeje (sin balón)</td><td>K (mantener y soltar)</td><td>Num 2</td><td>□</td></tr><tr><td>Cabezazo (balón a la altura de la cabeza)</td><td>K o J</td><td>Num 2 o Num 1</td><td>□ o pase</td></tr><tr><td>Proteger balón</td><td>Automático</td><td>Automático</td><td>Automático (sin botón)</td></tr><tr><td>Controlar portero / volver</td><td>R</td><td>Num 8</td><td>R3</td></tr><tr><td>Portero: lanzarse</td><td>U</td><td>Num 0</td><td>✕</td></tr><tr><td>Portero: salir (mantener)</td><td>L (mantener)</td><td>Num 3 (mantener)</td><td>△ (mantener)</td></tr><tr><td>Portero: salir en sprint</td><td>Shift izq. + L</td><td>Shift der. + Num 3</td><td>R1 + △</td></tr><tr><td>Portero: pase / saque con la mano</td><td>J</td><td>Num 1</td><td>✕</td></tr><tr><td>Portero: saque con la mano al espacio</td><td>L</td><td>Num 3</td><td>△</td></tr><tr><td>Portero: saque de volea</td><td>I (mantener y soltar)</td><td>Num 5 (mantener y soltar)</td><td>○</td></tr><tr><td>Portero: volea alta</td><td>G + I</td><td>Num 6 + Num 5</td><td>R2 + ○</td></tr><tr><td>Portero: soltar / recoger el balón</td><td>Shift (stick centrado)</td><td>Shift der. (stick centrado)</td><td>R1 + stick centrado</td></tr><tr><td>Portero: correr con el balón</td><td>W A S D (Shift = sprint)</td><td>Flechas (Shift der.)</td><td>Stick izq. (R1)</td></tr><tr><td>Portero: amago de pase</td><td>J antes de soltar</td><td>Num 1 antes de soltar</td><td>✕ antes de soltar</td></tr><tr><td>Simular falta (caer)</td><td>F</td><td>Num 4</td><td>L1 + L2 + L3 + R3 (sin R2)</td></tr><tr><td>Portero: saque con el pie</td><td>K (mantener y soltar)</td><td>Num 2</td><td>□</td></tr><tr><td>Cámara</td><td>C</td><td>C</td><td>Touchpad (clic)</td></tr><tr><td>Pausa</td><td>P / Esc</td><td>P / Esc</td><td>OPTIONS</td></tr></tbody></table></div><p>Con el balón: <kbd>✕</kbd> pase, <kbd>○</kbd> centro, <kbd>□</kbd> tiro, <kbd>△</kbd> filtrado. Sin balón: <kbd>✕</kbd> entrada, <kbd>○</kbd> barrida, <kbd>□</kbd> despeje. Mantener <kbd>✕</kbd> será la presión, todavía sin acción en FE (próximamente). Apunta con el movimiento antes de pasar o disparar. Los jugadores aceleran y giran con inercia. Los saques se ejecutan automáticamente.</p><p>Conecta hasta dos mandos y pulsa un botón para activarlos. Se admiten mandos que el navegador reconozca con mapeo estándar.</p><p><kbd>P / Esc</kbd> pausa · <kbd>C</kbd> o clic en el touchpad: cámara. En pantalla táctil, mueve el stick y toca las acciones.</p><button data-close="help-dialog" class="primary wide">Entendido</button></dialog>
<dialog id="stats-dialog"><div class="dialog-top"><span class="eyebrow" id="stats-label">EL PARTIDO EN NÚMEROS</span><button class="close" data-close="stats-dialog" aria-label="Cerrar">×</button></div><h2 id="result-title">Estadísticas</h2><div id="stats-content"></div><div class="secondary-actions"><button id="save-replay" class="primary">Guardar repetición</button><button id="rematch" hidden>Revancha</button><button id="new-match">Nuevo partido</button></div></dialog>
<dialog id="online-dialog"><div class="dialog-top"><span class="eyebrow">CONEXIÓN ENTRE AMIGOS</span><button class="close" data-close="online-dialog" aria-label="Cerrar">×</button></div><h2>Online experimental</h2><p>El anfitrión simula el partido. Intercambia estos códigos por el medio que prefieras; no se envían automáticamente.</p><label>Servidor STUN (opcional)<input id="stun-url" placeholder="stun:tu-servidor:3478" /></label><p class="fine-print">Sin STUN funciona en redes que permiten una ruta directa. Algunas redes necesitan TURN, que este prototipo no configura.</p><label>Código recibido<textarea id="remote-code" rows="4" placeholder="Pega la invitación o la respuesta de tu amigo"></textarea></label><div class="secondary-actions"><button id="create-offer">1. Crear invitación</button><button id="create-answer">2. Responder invitación</button><button id="accept-answer">3. Aceptar respuesta</button></div><label>Tu código<textarea id="local-code" rows="4" readonly></textarea></label><button id="copy-code">Copiar código</button><p id="network-status" role="status">Esperando conexión.</p><p class="fine-print">Al conectar, el anfitrión inicia un partido de 6 minutos. El invitado controla al visitante. No hay predicción ni compensación de latencia.</p></dialog>
<input id="replay-file" type="file" accept="application/json,.json" hidden />`;

let paletteStorage:PitchPaletteStorage|undefined;try{paletteStorage=window.localStorage;}catch{}
let pitchPalette=loadPitchPalette(paletteStorage);$<HTMLSelectElement>('pitch-palette').value=pitchPalette;
const input=new BrowserInput(),peer=new PeerSession();let importedTeam:TeamProfile|null=null;
let config=createConfig({human:[false,false]}),sim=new Simulation(config,[makeTeam(0),makeTeam(1)]),record=new Recorder(sim);
let previous=sim.presentation(),current=previous,renderer:FootballRenderer|null=null,paused=false,started=false,last=performance.now(),accumulator=0,hudClock=0;
let replay:Replay|null=null,replayIndex=0,guest=false,guestCounter=0,networkTick=0,finalShown=false,cameraIndex=0;
let manualPaused=false;
let kickoffSetup:ReturnType<typeof rematchSetup>|null=null;
let kickoffKits=kits(0,1);
let kickoffMode='';
let pendingTactics:InputFrame['tactics']|undefined;let replayResult='';
const audio=new MatchAudio(undefined,paletteStorage);
window.addEventListener('pointerdown',()=>audio.gesture());
window.addEventListener('keydown',()=>audio.gesture());
let renderError='';let notice='',noticeUntil=0;
const tacticalKeys=['pressing','width','tempo','counterPress','shortPossession','tightMarking','adaptation','defensiveLine','compactness','support']as const;
function kits(home:number,away:number):[Kit,Kit]{const a=TEAM_CATALOG[home],b=TEAM_CATALOG[away];return[{shirt:a.color,shorts:a.shorts,accent:a.accent,pattern:'band'},{shirt:home===away?'#2052a5':b.color,shorts:b.shorts,accent:b.accent,pattern:'plain'}];}
function makeRenderer(k:[Kit,Kit]){renderer?.dispose();renderError='';try{renderer=new FootballRenderer($('viewport'),$<HTMLCanvasElement>('radar'),config,k);renderer.setQuality($<HTMLSelectElement>('quality').value);renderer.setPitchPalette(pitchPalette);}catch(e){renderer=null;renderError='No se pudo iniciar WebGL2. Prueba un navegador compatible con aceleración gráfica.';$('announcement').textContent=renderError;console.error(e);}}
makeRenderer(kits(0,1));
function download(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function closeDialog(id:string){$<HTMLDialogElement>(id).close();refreshPause();}
function showDialog(id:string){$<HTMLDialogElement>(id).showModal();refreshPause();}
function pause(value:boolean){manualPaused=value;refreshPause();}
function refreshPause(){paused=shouldPause(manualPaused,started&&!guest&&!!document.querySelector('dialog[open]'),isFulltime(current.phase)||!!replayResult);input.enabled=started&&!paused&&!replay;input.clear();$('pause-overlay').hidden=!paused||!!document.querySelector('dialog[open]');$('pause-btn').setAttribute('aria-pressed',String(paused));$('pause-btn').innerHTML=paused?'▶ <span>Seguir</span>':'Ⅱ <span>Pausa</span>';accumulator=0;}
function rematch(){
  if(!kickoffSetup||!isFulltime(current.phase)||peer.role==='host')return;
  peer.close();
  const setup=rematchSetup(kickoffSetup.config,kickoffSetup.teams);
  config=setup.config;sim=new Simulation(config,setup.teams);previous=current=sim.presentation();record=new Recorder(sim);
  replay=null;replayIndex=0;replayResult='';guest=false;finalShown=false;started=true;pendingTactics=undefined;notice='';noticeUntil=0;
  makeRenderer(kickoffKits);$('match-mode').textContent=kickoffMode;
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());pause(false);updateHud();
}
function start(mode?:string){
  const home=Number($<HTMLSelectElement>('home-team').value),away=Number($<HTMLSelectElement>('away-team').value),size=Number($<HTMLSelectElement>('size').value);
  const chosen=mode??$<HTMLSelectElement>('mode').value;
  if(importedTeam&&importedTeam.players.length!==size)throw new Error(`El equipo importado tiene ${importedTeam.players.length} jugadores. Elige esa cantidad.`);
  const t1=importedTeam?structuredClone(importedTeam):makeTeam(home,size),t2=makeTeam(away,size);
  if(t1.id===t2.id){t2.id+='-away';t2.players=t2.players.map(p=>({...p,id:p.id+'-away'}));}
  t1.tactics.formation=$<HTMLSelectElement>('formation').value as TeamProfile['tactics']['formation'];
  for(const k of tacticalKeys)t1.tactics[k]=Number($<HTMLInputElement>(k).value);
  config=createConfig({human:chosen==='watch'?[false,false]:chosen==='local'?[true,true]:[true,false],seed:Number($<HTMLInputElement>('seed').value),teamSize:size,halfSeconds:Number($<HTMLSelectElement>('duration').value)/2});
  kickoffSetup=rematchSetup(config,[validateTeam(t1),validateTeam(t2)]);kickoffKits=kits(home,away);
  sim=new Simulation(config,[validateTeam(t1),validateTeam(t2)]);previous=current=sim.presentation();record=new Recorder(sim);replay=null;replayIndex=0;replayResult='';guest=false;finalShown=false;started=true;pendingTactics=undefined;notice='';noticeUntil=0;
  makeRenderer(kits(home,away));$('match-mode').textContent=chosen==='watch'?'CPU CONTRA CPU':chosen==='local'?'DOS JUGADORES':'TÚ CONTRA LA CPU';
  kickoffMode=$('match-mode').textContent??'';
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());pause(false);updateHud();
}
$('setup-form').addEventListener('submit',e=>{e.preventDefault();try{peer.close();start();$('setup-error').textContent='';}catch(e){$('setup-error').textContent=(e as Error).message;}});
$('menu-btn').onclick=()=>showDialog('setup-dialog');$('close-setup').onclick=()=>closeDialog('setup-dialog');
$('pause-btn').onclick=$('resume-btn').onclick=()=>pause(!paused);$('help-btn').onclick=()=>showDialog('help-dialog');
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.dataset.close!));
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(d=>{
  d.addEventListener('cancel',e=>{e.preventDefault();closeDialog(d.id);});
  d.addEventListener('close',refreshPause);
});
function changeCamera(){cameraIndex=(cameraIndex+1)%3;renderer?.setCamera((['broadcast','tactical','close']as const)[cameraIndex]);}
$('camera-btn').onclick=changeCamera;
window.addEventListener('keydown',e=>{if((e.target as HTMLElement)?.matches('input,textarea,select')||document.querySelector('dialog[open]'))return;if(e.repeat)return;if(e.code==='KeyP'||e.code==='Escape')pause(!paused);if(e.code==='KeyC')changeCamera();if(e.code==='KeyM')toggleSound();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!guest)pause(true);});
$('fullscreen-btn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('app').requestFullscreen();}catch{$('announcement').textContent='Pantalla completa no disponible en este navegador.';}};
function updateSoundButton(){$('sound-btn').setAttribute('aria-pressed',String(!audio.muted));$('sound-btn').title='Activar o silenciar sonido (M)';}
function toggleSound(){audio.setMuted(!audio.muted);updateSoundButton();}
$('sound-btn').onclick=toggleSound;updateSoundButton();
$<HTMLInputElement>('sound-volume').value=String(audio.volume);
$('sound-volume').oninput=()=>audio.setVolume(Number($<HTMLInputElement>('sound-volume').value));
function updateHud(){
  renderHud(current,config,{guest,replay:!!replay,gamepadCount:input.gamepads.length,charging:input.charging,renderError,replayResult,notice,noticeUntil},$);
  const s=current;
  input.setDirections(guest?[s.teams[1].direction,s.teams[0].direction]:[s.teams[0].direction,s.teams[1].direction]);
}
// A team defends while the ball has no touch of that team. A restart resets the
// last touch, so the taker uses the attack keys. With no touch yet both teams attack.
function defendingFlags(s:Presentation):[boolean,boolean]{const owner=s.ball.lastTouch?s.ball.lastTouch.team:null;return [owner!==null&&owner!==0,owner!==null&&owner!==1];}
// Header context of each team, next to defending. Engine limits
// (simulation/engine.ts requestAction): a kick needs distance <= actions.reach + 1.1
// and, above 1.15 m, only a header can kick, up to actions.headerHeight. The 1.15 m
// floor is an engine literal, so it is copied here with the comment.
const HEADER_MIN_Z=1.15;
function aerialFlags(s:Presentation,c:Config):[boolean,boolean]{
  if(s.ball.z<=HEADER_MIN_Z||s.ball.z>c.actions.headerHeight)return[false,false];
  const reach=c.actions.reach+1.1;
  const near=(team:0|1)=>{const p=s.players.find(p=>p.id===s.selected[team]);return !!p&&Math.hypot(p.x-s.ball.x,p.y-s.ball.y)<=reach;};
  return[near(0),near(1)];
}
// Cursor of each team: the shell reports the goalkeeper cursor, so the dive key
// fires one press instead of the tackle double tap.
function keeperFlags(s:Presentation):[boolean,boolean]{
  const flag=(slot:0|1)=>{const id=s.selected[slot];return !!s.players.find(p=>p.id===id)?.keeper;};
  return [flag(0),flag(1)];
}
// Hold of each team: the selected keeper holds the ball in the hands, so the
// keeper row uses throws and kicks instead of the dive.
function keeperHoldFlags(s:Presentation):[boolean,boolean]{
  const flag=(slot:0|1)=>!!s.keeperHold&&s.selected[slot]===s.keeperHold.playerId;
  return [flag(0),flag(1)];
}
function showStats(){const s=current;
  $('rematch').hidden=!isFulltime(s.phase)||!kickoffSetup||!!replay||guest||peer.role==='host';
  $('new-match').textContent=isFulltime(s.phase)?'Volver al menú':'Nuevo partido';$('result-title').textContent=`${s.teams[0].shortName} ${s.score[0]} — ${s.score[1]} ${s.teams[1].shortName}`;
  const total=s.stats[0].possessionTicks+s.stats[1].possessionTicks||1;
  const rows=[['Posesión',`${Math.round(s.stats[0].possessionTicks/total*100)}%`,`${Math.round(s.stats[1].possessionTicks/total*100)}%`],['Tiros',s.stats[0].shots,s.stats[1].shots],['A puerta',s.stats[0].onTarget,s.stats[1].onTarget],['Pases completados',`${s.stats[0].completed}/${s.stats[0].passes}`,`${s.stats[1].completed}/${s.stats[1].passes}`],['Atajadas',s.stats[0].saves,s.stats[1].saves],['Entradas ganadas',s.stats[0].tackles,s.stats[1].tackles],['Faltas',s.stats[0].fouls,s.stats[1].fouls],['Amarillas',s.stats[0].yellows,s.stats[1].yellows],['Expulsiones',s.stats[0].reds,s.stats[1].reds],['Penaltis',s.stats[0].penalties,s.stats[1].penalties],['Córners',s.stats[0].corners,s.stats[1].corners],['Fuera de juego',s.stats[0].offsides,s.stats[1].offsides]];
  $('stats-content').replaceChildren();for(const [label,a,b]of rows){const row=document.createElement('div');row.className='stat-row';for(const value of [a,label,b]){const span=document.createElement('span');span.textContent=String(value);row.append(span);}$('stats-content').append(row);}showDialog('stats-dialog');}
$('rematch').onclick=rematch;
$('stats-btn').onclick=showStats;$('new-match').onclick=()=>{closeDialog('stats-dialog');showDialog('setup-dialog');};
$('save-replay').onclick=()=>{if(guest){$('stats-label').textContent='El anfitrión puede guardar la repetición.';return;}download(`futbol-${config.seed}-${sim.tick}.json`,record.finish(sim));};
$('export-roster').onclick=()=>download('equipo-ejemplo.json',makeTeam(Number($<HTMLSelectElement>('home-team').value),Number($<HTMLSelectElement>('size').value)));
$<HTMLInputElement>('roster-file').onchange=async e=>{try{const f=(e.target as HTMLInputElement).files?.[0];if(!f)return;if(f.size>100000)throw new Error('El archivo supera 100 KB.');importedTeam=validateTeam(JSON.parse(await f.text()));$('roster-status').textContent=`${importedTeam.name} · ${importedTeam.players.length} jugadores cargados.`;}catch(e){importedTeam=null;$('roster-status').textContent=(e as Error).message;}};
$('load-replay').onclick=()=>$<HTMLInputElement>('replay-file').click();
$<HTMLInputElement>('replay-file').onchange=async e=>{try{
  const f=(e.target as HTMLInputElement).files?.[0];if(!f)return;
  if(f.size>30000000)throw new Error('La repetición supera 30 MB.');
  const loaded=parseReplay(JSON.parse(await f.text()));
  const loadedSim=replaySimulation(loaded),loadedRecord=new Recorder(loadedSim),loadedPresentation=loadedSim.presentation();
  // Validate and prepare the replacement completely before touching the current match.
  peer.close();kickoffSetup=null;sim=loadedSim;config=loaded.initial.config;record=loadedRecord;
  replay=loaded;replayIndex=0;replayResult='';notice='';noticeUntil=0;started=true;guest=false;finalShown=false;
  previous=current=loadedPresentation;makeRenderer(kits(0,1));$('setup-dialog').closest('dialog')?.close();pause(false);$('match-mode').textContent='REPETICIÓN';
}catch(e){$('setup-error').textContent=(e as Error).message;}};
for(const key of ['formation',...tacticalKeys])$(key).addEventListener('change',()=>{if(!started||guest||replay)return;pendingTactics={formation:$<HTMLSelectElement>('formation').value as TeamProfile['tactics']['formation'],pressing:Number($<HTMLInputElement>('pressing').value),...Object.fromEntries(tacticalKeys.map(k=>[k,Number($<HTMLInputElement>(k).value)]))};});
const joystick=$('joystick'),stick=$('stick');let stickPointer:number|null=null;
function stickMove(e:PointerEvent){const r=joystick.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width*.36),y=(e.clientY-r.top-r.height/2)/(r.height*.36),d=Math.max(1,Math.hypot(x,y));input.setTouchMove({x:x/d,y:y/d});stick.style.transform=`translate(${x/d*34}px,${y/d*34}px)`;}
joystick.onpointerdown=e=>{if(stickPointer!==null)return;stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);stickMove(e);};joystick.onpointermove=e=>{if(stickPointer===e.pointerId)stickMove(e);};
joystick.onlostpointercapture=joystick.onpointerup=joystick.onpointercancel=()=>{stickPointer=null;input.setTouchMove({x:0,y:0});stick.style.transform='';};
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b=>b.onpointerdown=e=>{e.preventDefault();input.touchAction(b.dataset.action as InputFrame['action']&string);});
$('touch-sprint').onpointerdown=e=>{(e.target as HTMLElement).setPointerCapture(e.pointerId);input.setTouchSprint(true);};$('touch-sprint').onlostpointercapture=$('touch-sprint').onpointerup=$('touch-sprint').onpointercancel=()=>input.setTouchSprint(false);$('touch-switch').onclick=()=>input.switchTouch();$('touch-keeper').onclick=()=>input.switchKeeperTouch();
$('touch-shoot').onpointerdown=e=>{e.preventDefault();$('touch-shoot').setPointerCapture(e.pointerId);input.startTouchShot();};
$('touch-shoot').onpointerup=()=>input.endTouchShot();$('touch-shoot').onpointercancel=$('touch-shoot').onlostpointercapture=()=>input.endTouchShot(true);
$('touch-shield').onpointerdown=e=>{e.preventDefault();$('touch-shield').setPointerCapture(e.pointerId);input.setTouchShield(true);};$('touch-shield').onpointerup=$('touch-shield').onpointercancel=$('touch-shield').onlostpointercapture=()=>input.setTouchShield(false);
$('touch-option').onchange=()=>{document.body.dataset.touch=$<HTMLSelectElement>('touch-option').value;};
$('pitch-palette').onchange=()=>{pitchPalette=$<HTMLSelectElement>('pitch-palette').value as PitchPaletteId;savePitchPalette(paletteStorage,pitchPalette);renderer?.setPitchPalette(pitchPalette);};
$('quality').onchange=()=>renderer?.setQuality($<HTMLSelectElement>('quality').value);
$('online-btn').onclick=()=>showDialog('online-dialog');
async function networkTask(work:()=>Promise<string|void>){try{$('network-status').textContent='Preparando conexión…';const code=await work();if(code)$<HTMLTextAreaElement>('local-code').value=code;$('network-status').textContent='Código listo. Intercámbialo con tu amigo.';}catch(e){$('network-status').textContent=(e as Error).message;}}
$('create-offer').onclick=()=>networkTask(()=>peer.offer($<HTMLInputElement>('stun-url').value.trim()));
$('create-answer').onclick=()=>networkTask(()=>peer.answer($<HTMLTextAreaElement>('remote-code').value,$<HTMLInputElement>('stun-url').value.trim()));
$('accept-answer').onclick=()=>networkTask(()=>peer.accept($<HTMLTextAreaElement>('remote-code').value));
$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText($<HTMLTextAreaElement>('local-code').value);$('network-status').textContent='Código copiado.';}catch{$<HTMLTextAreaElement>('local-code').select();$('network-status').textContent='Selecciona y copia el código.';}};
peer.onStatus=s=>{$('network-status').textContent=s;if(s.includes('interrumpida')||s.includes('cerrada')){input.clear();pause(true);}};
peer.onConnect=()=>{if(peer.role==='host'){start('local');peer.start(sim.snapshot());$('match-mode').textContent='ONLINE · ANFITRIÓN';}};
peer.onStart=(world:World)=>{try{world.teams.forEach(validateTeam);sim=new Simulation(world.config,world.teams);sim.restore(world);config=world.config;kickoffSetup=null;guest=true;started=true;replay=null;previous=current=sim.presentation();makeRenderer(kits(0,1));document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());pause(false);$('match-mode').textContent='ONLINE · VISITANTE';}catch{peer.close();$('network-status').textContent='Estado inicial incompatible.';}};
peer.onSnapshot=s=>{if(!guest||!s||!Number.isInteger(s.tick)||s.tick<=current.tick||!Array.isArray(s.players)||s.players.length!==config.teamSize*2)return;audio.play(soundCues(current,s));previous=current;current=s;networkTick=performance.now();};
// Detached read-only evidence at the browser boundary. No engine access is exposed.
let inputEvidence:InputFrame[]=[];
const shotEvidence={actions:[0,0],events:[0,0],power:[0,0]};
const keeperEvidence={punts:[0,0],highPunts:[0,0],throws:[0,0]};
let browserFrames=0;
Object.defineProperty(window,'__fe',{configurable:false,enumerable:false,get:()=>({tick:current.tick,phase:current.phase,paused,browserFrames,frames:inputEvidence.map(f=>({slot:f.slot,move:{...f.move},action:f.action,power:f.power})),shots:{actions:[...shotEvidence.actions],events:[...shotEvidence.events],power:[...shotEvidence.power]},keeper:{punts:[...keeperEvidence.punts],highPunts:[...keeperEvidence.highPunts],throws:[...keeperEvidence.throws]},ball:structuredClone(current.ball),selected:[...current.selected],players:current.players.map(p=>({id:p.id,keeper:p.keeper,x:p.x,y:p.y,vx:p.vx,vy:p.vy,action:p.action,recovery:p.recovery}))})});
// Smoke only: exists only when navigator.webdriver is true. It is not a game feature. The recorder replay is not valid after this call.
if(navigator.webdriver)Object.defineProperty(window,'__feSmoke',{configurable:false,enumerable:false,value:{ballAtFeet(slot:0|1){
  if(!started||guest||replay||current.phase!=='playing')return false;
  const w=sim.snapshot();
  const p=w.players.find(p=>p.id===w.selected[slot]);
  if(!p)return false;
  p.vx=p.vy=0;p.action=null;p.recovery=0;
  const rest=config.physics.radius;
  w.ball.x=p.x+Math.cos(p.heading)*.5;w.ball.y=p.y+Math.sin(p.heading)*.5;w.ball.z=rest;
  w.ball.vx=0;w.ball.vy=0;w.ball.vz=0;w.ball.spin={x:0,y:0,z:0};
  const limitX=config.pitch.length/2,limitY=config.pitch.width/2;
  for(const q of w.players){
    if(q.team===p.team)continue;
    const dx=q.x-w.ball.x,dy=q.y-w.ball.y,d=Math.hypot(dx,dy);
    if(d>=12)continue;
    const ux=d>0?dx/d:(q.team===0?1:-1),uy=d>0?dy/d:0;
    q.x=Math.max(-limitX,Math.min(limitX,w.ball.x+ux*12));
    q.y=Math.max(-limitY,Math.min(limitY,w.ball.y+uy*12));
    q.vx=0;q.vy=0;q.action=null;
  }
  w.pendingPass=null;
  w.restartRestriction=null;
  sim.restore(w);
  previous=current=sim.presentation();
  return true;
},
// Smoke only: puts the slot keeper in control with the ball in the hands.
keeperHold(slot:0|1){
  if(!started||guest||replay||current.phase!=='playing')return false;
  const w=sim.snapshot();
  const keeper=w.players.find(p=>p.keeper&&p.team===slot);
  if(!keeper)return false;
  w.selected[slot]=keeper.id;keeper.manualControl=true;
  keeper.action=null;keeper.recovery=0;keeper.keeperMode='hold';
  w.keeperHold={playerId:keeper.id,since:w.tick};
  w.ball.x=keeper.x;w.ball.y=keeper.y;w.ball.z=.8;
  w.ball.vx=0;w.ball.vy=0;w.ball.vz=0;w.ball.spin={x:0,y:0,z:0};
  const limitX=config.pitch.length/2,limitY=config.pitch.width/2;
  for(const q of w.players){
    if(q.team===slot)continue;
    const dx=q.x-w.ball.x,dy=q.y-w.ball.y,d=Math.hypot(dx,dy);
    if(d>=12)continue;
    const ux=d>0?dx/d:(q.team===0?1:-1),uy=d>0?dy/d:0;
    q.x=Math.max(-limitX,Math.min(limitX,w.ball.x+ux*12));
    q.y=Math.max(-limitY,Math.min(limitY,w.ball.y+uy*12));
    q.vx=0;q.vy=0;q.action=null;
  }
  w.pendingPass=null;
  w.restartRestriction=null;
  sim.restore(w);
  previous=current=sim.presentation();
  return true;
}}});
function loop(now:number){
  browserFrames++;
  if(input.gamepads.some(p=>p.buttons.some(b=>b.pressed)))audio.gesture();
  audio.setActive(started&&!paused&&!document.hidden&&current.phase!=='fulltime');
  const elapsed=Math.min(.1,(now-last)/1000);last=now;
  const defending=defendingFlags(current);
  input.setDefending(guest?[defending[1],defending[0]]:defending);
  const aerial=aerialFlags(current,config);
  input.setAerial(guest?[aerial[1],aerial[0]]:aerial);
  const keeper=keeperFlags(current);
  input.setKeeper(guest?[keeper[1],keeper[0]]:keeper);
  const keeperHolding=keeperHoldFlags(current);
  input.setKeeperHold(guest?[keeperHolding[1],keeperHolding[0]]:keeperHolding);
  if(started&&!document.querySelector('dialog[open]')){
    if(input.pauseRequested())pause(!paused);
    if(input.cameraRequested())changeCamera();
  }
  try{
    if(guest){if(peer.connected&&!paused){guestCounter++;const frame=input.sample(guestCounter,0);peer.input({...frame,slot:1});}renderer?.draw(previous,current,Math.min(1,(now-networkTick)/100),elapsed);}
    else{
      if(!paused){accumulator+=elapsed;let steps=0;while(accumulator>=config.dt&&steps<6){
        if(replay&&sim.tick>=replay.endTick){pause(true);$('pause-overlay').hidden=true;replayResult=sim.stateHash()===replay.finalHash?'REPETICIÓN VERIFICADA':'La repetición diverge de su estado original.';$('announcement').textContent=replayResult;break;}
        const frames:InputFrame[]=[];
        if(replay){while(replay.inputs[replayIndex]?.tick===sim.tick)frames.push(replay.inputs[replayIndex++]);}
        else for(const slot of [0,1]as const)if(config.human[slot]){const f=slot===1&&peer.role==='host'?peer.hostFrame(sim.tick):input.sample(sim.tick,slot);if(slot===0&&pendingTactics){f.tactics=pendingTactics;pendingTactics=undefined;}frames.push(f);}
        inputEvidence=structuredClone(frames);
        for(const f of frames)if(f.action==='shoot'){shotEvidence.actions[f.slot]++;shotEvidence.power[f.slot]=f.power??0;}
        sim.applyInputs(frames);if(!replay)record.record(frames);previous=current;sim.step();current=sim.presentation();renderer?.advanceCamera(current);
        for(const e of current.events){
          if(e.type==='shoot'&&e.team!==undefined)shotEvidence.events[e.team]++;
          if(e.type==='keeper-punt'&&e.team!==undefined){keeperEvidence.punts[e.team]++;if(e.data?.high===true)keeperEvidence.highPunts[e.team]++;}
          if(e.type==='keeper-throw'&&e.team!==undefined)keeperEvidence.throws[e.team]++;
        }
        const card=cardAlert(current.events,current);
        const alert=current.events.find(e=>['advantage','advantage-recalled','keeper-time-limit'].includes(e.type));
        if(card){notice=card;noticeUntil=current.tick+CARD_ALERT_TICKS;}
        else if(alert&&current.tick>=noticeUntil){const labels:Record<string,string>={advantage:'LEY DE VENTAJA','advantage-recalled':'SE COBRA LA FALTA','keeper-time-limit':'OCHO SEGUNDOS · CÓRNER'};notice=labels[alert.type];noticeUntil=current.tick+100;}
        $('announcement').dataset.tick=String(current.tick);
        audio.play(soundCues(previous,current));
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

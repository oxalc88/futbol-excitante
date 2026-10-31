import { MatchAudio, soundCues } from './audio';
import { renderHud } from './hud';
import './style.css';
import { cardAlert, CARD_ALERT_TICKS } from './card-alert';
import { loadPitchPalette, savePitchPalette, type PitchPaletteStorage } from './pitch-palette';
import { quickPlaySetup, menuReducer, initialMenuState, loadCpuDifficulty, saveCpuDifficulty, matchCpuDifficulty, type QuickPlaySetup, type StartMenuStorage } from './start-menu';
import type { PitchPaletteId } from '../adapters/presentation-model';
import { shouldPause, showPauseMenu, pausedStateChanged } from './pause-state';
import { isFulltime, rematchSetup } from './fulltime-flow';
import type { Config, InputFrame, Presentation, Replay, TeamProfile, World } from '../contracts/types';
import { Simulation } from '../simulation/engine';
import { createConfig } from '../simulation/config';
import { BrowserInput, defendingFlags } from '../adapters/input';
import { mountTouchPad } from './touch-view';
import { FootballRenderer, type Kit } from '../adapters/renderer';
import { makeTeam, TEAM_CATALOG, validateTeam } from '../adapters/data';
import { Recorder, parseReplay, replaySimulation } from '../adapters/replay';
import { PeerSession } from '../adapters/network';
import { attachScrollCue } from './scroll-cue';
import { defaultControlsTab, SOUND_KEY } from './controls-model';
import { renderControls } from './controls-view';
import { dodgeHud } from './hud-dodge';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)as T;
const app=$('app');
app.innerHTML=`
<main class="game">
 <header class="topbar"><a class="wordmark" href="./" aria-label="Fútbol Excitante, inicio"><span class="crest">FE</span><span>FÚTBOL <b>EXCITANTE</b></span></a><button id="menu-btn" class="quiet">Partido <span>☰</span></button></header>
 <section id="viewport" aria-label="Partido de fútbol">
  <div class="scoreboard"><span class="team-tag home" id="home-short">COS</span><strong id="score">0 : 0</strong><span class="team-tag away" id="away-short">SIE</span><span id="clock">00:00</span><span id="half">1T</span></div>
  <div class="live-strip sr-only"><span id="match-mode">PARTIDO DE EXHIBICIÓN</span><span id="phase">Saque inicial</span></div>
  <div id="announcement" role="status" aria-live="polite"></div>
  <div class="field-toolbar"><button id="pause-btn" aria-label="Pausa"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3"/></svg></button><button id="fullscreen-btn" aria-label="Pantalla completa"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2"/></svg></button></div>
  <div id="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden><strong id="pause-title">PAUSA</strong><div id="pause-main" class="pause-menu"><button id="resume-btn" class="primary">Seguir jugando</button><button id="pause-controls">Controles</button><button id="pause-camera">Cámara: <span id="pause-camera-value">Transmisión</span></button><button id="pause-stats">Estadísticas</button><div class="pause-sound"><button id="sound-btn" aria-pressed="true">Sonido: <span id="sound-value">Sí</span></button><input id="sound-volume" type="range" min="0" max="1" step="0.05" aria-label="Volumen" /></div><button id="pause-quit">Salir al menú</button></div><div id="pause-confirm" class="pause-menu" hidden><strong>¿Salir del partido?</strong><button id="quit-no" class="primary">Seguir jugando</button><button id="quit-yes">Salir</button></div></div>
  <div class="bottom-hud"><div class="player-card"><strong id="player-name">—</strong><div class="energy"><span id="energy-bar"></span></div><div class="power" id="power-meter" hidden><span id="power-bar"></span></div></div><canvas id="radar" width="252" height="162" aria-label="Radar con posiciones de jugadores y balón"></canvas><span id="pad-status" class="sr-only" role="status">TECLADO · JUGADOR 1</span></div>
 </section>
 <footer><button id="help-btn">Controles</button></footer>
</main>
<dialog id="setup-dialog" class="setup"><form id="setup-form"><div class="dialog-top"><button type="button" id="close-setup" class="close" aria-label="Cerrar">×</button></div>
<button type="button" id="quick-play-btn" class="primary wide" autofocus>Jugar rápido <span>→</span></button>
<div class="difficulty-row"><label for="difficulty">Dificultad de la CPU</label><select id="difficulty" aria-label="Dificultad de la CPU"><option value="easy">Fácil</option><option value="normal" selected>Normal</option><option value="hard">Difícil</option></select></div>
<div class="team-selection"><label>LOCAL<select id="home-team">${TEAM_CATALOG.map((t,i)=>`<option value="${i}">${t.name}</option>`).join('')}</select><span class="team-stripe cream"></span></label><span class="versus">VS</span><label>VISITANTE<select id="away-team">${TEAM_CATALOG.map((t,i)=>`<option value="${i}" ${i===1?'selected':''}>${t.name}</option>`).join('')}</select><span class="team-stripe blue"></span></label></div>
<div class="setup-grid"><label>Modo<select id="mode"><option value="solo">Tú contra la CPU</option><option value="local">Dos jugadores locales</option><option value="watch">CPU contra CPU</option></select></label><label>Duración<select id="duration"><option value="120">2 minutos</option><option value="360" selected>6 minutos</option><option value="600">10 minutos</option></select></label><label>Jugadores<select id="size"><option value="11">11 contra 11</option><option value="5">5 contra 5</option><option value="2">2 contra 2</option></select></label></div>
<details class="tactics"><summary>Plan de juego</summary><div class="setup-grid"><label>Formación local<select id="formation"><option>4-3-3</option><option>4-4-2</option><option>3-5-2</option></select></label><label>Presión<input id="pressing" type="range" min="0" max="1" step="0.05" value="0.6" /></label><label>Amplitud<input id="width" type="range" min="0" max="1" step="0.05" value="0.7" /></label><label>Ritmo<input id="tempo" type="range" min="0" max="1" step="0.05" value="0.65" /></label><label>Contra presión<input id="counterPress" type="range" min="0" max="1" step="0.05" value="0.5" /></label><label>Pases cortos<input id="shortPossession" type="range" min="0" max="1" step="0.05" value="0.3" /></label><label>Marcaje estrecho<input id="tightMarking" type="range" min="0" max="1" step="0.05" value="0.3" /></label><label>Adaptación<input id="adaptation" type="range" min="0" max="1" step="0.05" value="0.5" /></label><label>Línea defensiva<input id="defensiveLine" type="range" min="0" max="1" step="0.05" value="0.52" /></label><label>Compactación<input id="compactness" type="range" min="0" max="1" step="0.05" value="0.65" /></label><label>Apoyo<input id="support" type="range" min="0" max="1" step="0.05" value="0.6" /></label></div><input id="roster-file" type="file" hidden /><p id="roster-status"></p><div class="secondary-actions"><button type="button" id="roster-btn" class="quiet">Cargar equipo</button><button type="button" id="export-roster" class="quiet">Equipo de ejemplo</button></div></details><details class="options"><summary>Opciones</summary><div class="setup-grid"><label>Gráficos<select id="quality"><option value="high">Normal</option><option value="low">Ligero</option></select></label><label>Paleta de cancha<select id="pitch-palette"><option value="viva">Viva</option><option value="sobria">Sobria</option></select></label></div></details>
<p id="setup-error" class="error" role="alert"></p><button id="start-btn" class="primary wide" type="submit">Jugar partido <span>→</span></button><div class="secondary-actions"><button type="button" id="menu-help-btn">Controles</button><button type="button" id="load-replay">Cargar repetición</button></div></form></dialog>
<dialog id="help-dialog"><div class="dialog-top"><button class="close" data-close="help-dialog" aria-label="Cerrar">×</button></div><h2>Controles</h2><div id="controls-root"></div></dialog>
<dialog id="stats-dialog"><div class="dialog-top"><button class="close" data-close="stats-dialog" aria-label="Cerrar">×</button></div><h2 id="result-title">Estadísticas</h2><div id="stats-content"></div><div class="secondary-actions"><button id="save-replay" class="primary">Guardar repetición</button></div></dialog>
<dialog id="fulltime-dialog" aria-labelledby="fulltime-title"><h2 id="fulltime-title">Final</h2><p class="fulltime-score"><span id="ft-home">COS</span><strong id="ft-score">0 — 0</strong><span id="ft-away">SIE</span></p><div class="fulltime-actions"><button id="ft-rematch" class="primary">Revancha</button><button id="ft-menu">Volver al menú</button><button id="ft-stats">Estadísticas</button><button id="ft-save">Guardar repetición</button></div></dialog>

<input id="replay-file" type="file" accept="application/json,.json" hidden />`;
// Every dialog gets the bottom cue: a fade and a chevron for hidden content.
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(d=>attachScrollCue(d));

let paletteStorage:PitchPaletteStorage|undefined;try{paletteStorage=window.localStorage;}catch{}
let difficultyStorage:StartMenuStorage|undefined;try{difficultyStorage=window.localStorage;}catch{}
let menu=initialMenuState;
let pitchPalette=loadPitchPalette(paletteStorage);$<HTMLSelectElement>('pitch-palette').value=pitchPalette;
$<HTMLSelectElement>('difficulty').value=loadCpuDifficulty(difficultyStorage);
const input=new BrowserInput(),peer=new PeerSession();let importedTeam:TeamProfile|null=null;
// The on-screen touch pad is mounted once and refreshed with every HUD update.
const touchPad=mountTouchPad($('viewport'),input,()=>refreshPause());
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
const controls=renderControls($('controls-root'),defaultControlsTab(false,0));
function download(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function closeDialog(id:string){$<HTMLDialogElement>(id).close();refreshPause();}
function showDialog(id:string){const d=$<HTMLDialogElement>(id);if(id==='help-dialog'){const tab=defaultControlsTab(document.body.classList.contains('touch-on'),input.gamepads.length);controls.select(tab);controlsTabIndex=['keyboard','pad','touch'].indexOf(tab);}if(!d.open)d.showModal();if(id==='setup-dialog')$<HTMLButtonElement>('quick-play-btn').focus();refreshPause();}
function pause(value:boolean){if(value&&(isFulltime(current.phase)||!!replayResult))return;manualPaused=value;refreshPause();}
function refreshPause(){const terminal=isFulltime(current.phase)||!!replayResult,dialogOpen=started&&!guest&&!!document.querySelector('dialog[open]'),blocked=started&&touchPad.portraitBlocked(),wasPaused=paused;paused=shouldPause(manualPaused,dialogOpen,terminal,blocked);input.enabled=started&&!paused&&!replay;if(pausedStateChanged(wasPaused,paused))input.clear();const overlay=$('pause-overlay'),show=showPauseMenu(manualPaused,dialogOpen,terminal,blocked);if(!show)overlay.hidden=true;else{const opening=overlay.hidden;overlay.hidden=false;if(opening){$('pause-main').hidden=false;$('pause-confirm').hidden=true;$('resume-btn').focus();}}touchPad.setSuspended(paused||!started);$('pause-btn').setAttribute('aria-pressed',String(paused));$('pause-btn').innerHTML=paused?'<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m8 5 12 7-12 7z" fill="currentColor"/></svg>':'<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3"/></svg>';$('pause-btn').setAttribute('aria-label',paused?'Seguir':'Pausa');accumulator=0;}
window.addEventListener('resize',refreshPause);screen.orientation?.addEventListener?.('change',refreshPause);
function rematch(){
  if(!kickoffSetup||!isFulltime(current.phase)||peer.role==='host')return;
  peer.close();
  const setup=rematchSetup(kickoffSetup.config,kickoffSetup.teams);
  config=setup.config;sim=new Simulation(config,setup.teams);previous=current=sim.presentation();record=new Recorder(sim);
  replay=null;replayIndex=0;replayResult='';guest=false;finalShown=false;started=true;pendingTactics=undefined;notice='';noticeUntil=0;
  makeRenderer(kickoffKits);$('match-mode').textContent=kickoffMode;
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());pause(false);updateHud();
}
function quitToMenu(){
  peer.close();config=createConfig({human:[false,false]});sim=new Simulation(config,[makeTeam(0),makeTeam(1)]);record=new Recorder(sim);
  previous=current=sim.presentation();started=false;replay=null;replayIndex=0;replayResult='';finalShown=false;manualPaused=false;kickoffSetup=null;guest=false;pendingTactics=undefined;
  makeRenderer(kits(0,1));document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());menu=menuReducer(menu,{type:'open-setup'});showDialog('setup-dialog');updateHud();
}
// `forced` is the quick-play path: it ignores the match form and uses the defaults.
// The menu difficulty applies to quick play and to custom match; online play always runs Normal.
function start(mode?:string,forced?:QuickPlaySetup,online=false){
  const home=forced?.home??Number($<HTMLSelectElement>('home-team').value),away=forced?.away??Number($<HTMLSelectElement>('away-team').value),size=forced?.teamSize??Number($<HTMLSelectElement>('size').value);
  const chosen=mode??forced?.mode??$<HTMLSelectElement>('mode').value;
  if(!forced&&importedTeam&&importedTeam.players.length!==size)throw new Error(`El equipo importado tiene ${importedTeam.players.length} jugadores. Elige esa cantidad.`);
  const t1=forced?makeTeam(home,size):importedTeam?structuredClone(importedTeam):makeTeam(home,size),t2=makeTeam(away,size);
  if(t1.id===t2.id){t2.id+='-away';t2.players=t2.players.map(p=>({...p,id:p.id+'-away'}));}
  if(!forced){
    t1.tactics.formation=$<HTMLSelectElement>('formation').value as TeamProfile['tactics']['formation'];
    for(const k of tacticalKeys)t1.tactics[k]=Number($<HTMLInputElement>(k).value);
  }
  config=createConfig({human:chosen==='watch'?[false,false]:chosen==='local'?[true,true]:[true,false],seed:forced?.seed??quickPlaySetup().seed,teamSize:size,halfSeconds:(forced?.duration??Number($<HTMLSelectElement>('duration').value))/2,difficulty:matchCpuDifficulty(online,$<HTMLSelectElement>('difficulty').value)});
  kickoffSetup=rematchSetup(config,[validateTeam(t1),validateTeam(t2)]);kickoffKits=kits(home,away);
  sim=new Simulation(config,[validateTeam(t1),validateTeam(t2)]);previous=current=sim.presentation();record=new Recorder(sim);replay=null;replayIndex=0;replayResult='';guest=false;finalShown=false;started=true;pendingTactics=undefined;notice='';noticeUntil=0;
  makeRenderer(kits(home,away));$('match-mode').textContent=chosen==='watch'?'CPU CONTRA CPU':chosen==='local'?'DOS JUGADORES':'TÚ CONTRA LA CPU';
  kickoffMode=$('match-mode').textContent??'';
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());pause(false);updateHud();
  menu=menuReducer(menu,{type:'start-match'});
}
$('setup-form').addEventListener('submit',e=>{e.preventDefault();try{peer.close();start();$('setup-error').textContent='';}catch(e){$('setup-error').textContent=(e as Error).message;}});
// Quick play ignores the form: one click (or a pad A press) starts the default match.
function quickPlay(){try{peer.close();start(undefined,quickPlaySetup());$('setup-error').textContent='';}catch(e){$('setup-error').textContent=(e as Error).message;}}
function matchInProgress(){return started&&!replay&&!replayResult&&!isFulltime(current.phase);}
$('quick-play-btn').onclick=quickPlay;
$('menu-help-btn').onclick=()=>showDialog('help-dialog');
$('menu-btn').onclick=()=>{if(matchInProgress()){pause(true);return;}menu=menuReducer(menu,{type:'open-setup'});showDialog('setup-dialog');};$('close-setup').onclick=()=>closeDialog('setup-dialog');
$('pause-btn').onclick=$('resume-btn').onclick=()=>pause(!paused);$('help-btn').onclick=()=>showDialog('help-dialog');
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.dataset.close!));
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(d=>{
  d.addEventListener('cancel',e=>{e.preventDefault();if(d.id==='fulltime-dialog')return;closeDialog(d.id);});
  d.addEventListener('close',()=>{
    if(d.id==='setup-dialog')menu=menuReducer(menu,{type:started?'start-match':'close-setup'});
    refreshPause();
    if(d.id==='stats-dialog'&&started&&!replay&&isFulltime(current.phase))showFulltime();
  });
});
function changeCamera(){cameraIndex=(cameraIndex+1)%3;renderer?.setCamera((['broadcast','tactical','close']as const)[cameraIndex]);const value=document.getElementById('pause-camera-value');if(value)value.textContent=(['Transmisión','Táctica','Cerca']as const)[cameraIndex];}
function focusPauseButton(delta:number){const buttons=[...$('pause-overlay').querySelectorAll<HTMLButtonElement>('button')].filter(b=>!b.hidden&&b.getClientRects().length);if(!buttons.length)return;const i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(i+delta+buttons.length)%buttons.length].focus();}
window.addEventListener('keydown',e=>{
  if((e.target as HTMLElement)?.matches('input,textarea,select')||document.querySelector('dialog[open]'))return;if(e.repeat)return;
  if(!$('pause-overlay').hidden&&(e.code==='ArrowUp'||e.code==='ArrowDown')){e.preventDefault();focusPauseButton(e.code==='ArrowDown'?1:-1);return;}
  if(e.code==='Escape'&&!$('pause-overlay').hidden&&!$('pause-confirm').hidden){$('pause-confirm').hidden=true;$('pause-main').hidden=false;$('pause-quit').focus();return;}
  if(e.code==='KeyP'||e.code==='Escape')pause(!paused);if(e.code==='KeyC')changeCamera();if(e.code===SOUND_KEY)toggleSound();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!guest)pause(true);});
$('fullscreen-btn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('app').requestFullscreen();}catch{$('announcement').textContent='Pantalla completa no disponible en este navegador.';}};
function updateSoundButton(){$('sound-btn').setAttribute('aria-pressed',String(!audio.muted));$('sound-value').textContent=audio.muted?'No':'Sí';}
function toggleSound(){audio.setMuted(!audio.muted);updateSoundButton();}
$('sound-btn').onclick=toggleSound;updateSoundButton();
$<HTMLInputElement>('sound-volume').value=String(audio.volume);
$('sound-volume').oninput=()=>audio.setVolume(Number($<HTMLInputElement>('sound-volume').value));
$('pause-controls').onclick=()=>showDialog('help-dialog');
$('pause-stats').onclick=showStats;
$('pause-camera').onclick=changeCamera;
$('pause-quit').onclick=()=>{$('pause-main').hidden=true;$('pause-confirm').hidden=false;$('quit-no').focus();};
$('quit-no').onclick=()=>{$('pause-confirm').hidden=true;$('pause-main').hidden=false;$('pause-quit').focus();};
$('quit-yes').onclick=quitToMenu;
function updateHud(){
  renderHud(current,config,{guest,replay:!!replay,gamepadCount:input.gamepads.length,charging:input.charging,renderError,replayResult,notice,noticeUntil},$);
  touchPad.update({started});
  const radar=$('radar'),card=document.querySelector<HTMLElement>('.player-card');
  const restart=current.restart;
  let points:{x:number;y:number}[]=[];
  if(restart&&renderer){
    const taker=current.players.filter(p=>p.team===restart.team).sort((a,b)=>Math.hypot(a.x-current.ball.x,a.y-current.ball.y)-Math.hypot(b.x-current.ball.x,b.y-current.ball.y))[0];
    const ballPoint=renderer.screenPoint({x:current.ball.x,y:current.ball.y,z:current.ball.z});
    const takerPoint=taker?renderer.screenPoint({x:taker.x,y:taker.y,z:0}):null;
    if(ballPoint)points.push(ballPoint);if(takerPoint)points.push(takerPoint);
  }
  const dodge=dodgeHud(points,{radar:radar.getBoundingClientRect(),card:card?.getBoundingClientRect()});
  radar.classList.toggle('dodge',!!restart&&dodge.radar);card?.classList.toggle('dodge',!!restart&&dodge.card);
  const s=current;
  input.setDirections(guest?[s.teams[1].direction,s.teams[0].direction]:[s.teams[0].direction,s.teams[1].direction]);
}
// A team defends while the ball has no touch of that team. The classification
// lives with the input layer: defendingFlags in adapters/input.ts. The selected
// carrier of a team, the keeper with the ball at his feet after a put-down, never
// defends with his own team.
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
  $('result-title').textContent=`${s.teams[0].shortName} ${s.score[0]} — ${s.score[1]} ${s.teams[1].shortName}`;
  const total=s.stats[0].possessionTicks+s.stats[1].possessionTicks||1;
  const rows=[['Posesión',`${Math.round(s.stats[0].possessionTicks/total*100)}%`,`${Math.round(s.stats[1].possessionTicks/total*100)}%`],['Tiros',s.stats[0].shots,s.stats[1].shots],['A puerta',s.stats[0].onTarget,s.stats[1].onTarget],['Pases completados',`${s.stats[0].completed}/${s.stats[0].passes}`,`${s.stats[1].completed}/${s.stats[1].passes}`],['Atajadas',s.stats[0].saves,s.stats[1].saves],['Entradas ganadas',s.stats[0].tackles,s.stats[1].tackles],['Faltas',s.stats[0].fouls,s.stats[1].fouls],['Amarillas',s.stats[0].yellows,s.stats[1].yellows],['Expulsiones',s.stats[0].reds,s.stats[1].reds],['Penal',s.stats[0].penalties,s.stats[1].penalties],['Córners',s.stats[0].corners,s.stats[1].corners],['Fuera de juego',s.stats[0].offsides,s.stats[1].offsides]];
  $('save-replay').hidden=guest;
  $('stats-content').replaceChildren();for(const [label,a,b]of rows){const row=document.createElement('div');row.className='stat-row';for(const value of [a,label,b]){const span=document.createElement('span');span.textContent=String(value);row.append(span);}$('stats-content').append(row);}showDialog('stats-dialog');}
function showFulltime(){const s=current;$('ft-home').textContent=s.teams[0].shortName;$('ft-away').textContent=s.teams[1].shortName;$('ft-score').textContent=`${s.score[0]} — ${s.score[1]}`;manualPaused=false;const unavailable=!kickoffSetup||!!replay||guest||peer.role==='host';$('ft-rematch').hidden=unavailable;$('ft-menu').classList.toggle('primary',unavailable);showDialog('fulltime-dialog');($<HTMLButtonElement>(unavailable?'ft-menu':'ft-rematch')).focus();}
function saveReplay(){if(!guest)download(`futbol-${config.seed}-${sim.tick}.json`,record.finish(sim));}
$('ft-rematch').onclick=rematch;$('ft-stats').onclick=showStats;$('ft-save').onclick=saveReplay;$('save-replay').onclick=saveReplay;$('ft-menu').onclick=quitToMenu;
$('roster-btn').onclick=()=>$<HTMLInputElement>('roster-file').click();
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
$('pitch-palette').onchange=()=>{pitchPalette=$<HTMLSelectElement>('pitch-palette').value as PitchPaletteId;savePitchPalette(paletteStorage,pitchPalette);renderer?.setPitchPalette(pitchPalette);};
// The choice is saved at once and read back on the next page load.
$('difficulty').onchange=()=>{$<HTMLSelectElement>('difficulty').value=saveCpuDifficulty(difficultyStorage,$<HTMLSelectElement>('difficulty').value);};
$('quality').onchange=()=>renderer?.setQuality($<HTMLSelectElement>('quality').value);
peer.onStatus=s=>{if(s.includes('interrumpida')||s.includes('cerrada')){input.clear();pause(true);}};
peer.onConnect=()=>{if(peer.role==='host'){start('local',undefined,true);peer.start(sim.snapshot());$('match-mode').textContent='ONLINE · ANFITRIÓN';}};
peer.onStart=(world:World)=>{try{world.teams.forEach(validateTeam);sim=new Simulation(world.config,world.teams);sim.restore(world);config=world.config;kickoffSetup=null;guest=true;started=true;replay=null;previous=current=sim.presentation();makeRenderer(kits(0,1));document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());pause(false);$('match-mode').textContent='ONLINE · VISITANTE';}catch(e){peer.close();console.warn('Estado inicial incompatible.',e);}};
peer.onSnapshot=s=>{if(!guest||!s||!Number.isInteger(s.tick)||s.tick<=current.tick||!Array.isArray(s.players)||s.players.length!==config.teamSize*2)return;audio.play(soundCues(current,s));previous=current;current=s;networkTick=performance.now();};
// Detached read-only evidence at the browser boundary. No engine access is exposed.
let inputEvidence:InputFrame[]=[];
const shotEvidence={actions:[0,0],events:[0,0],power:[0,0]};
const passEvidence={actions:[0,0],events:[0,0]};
const keeperEvidence={punts:[0,0],highPunts:[0,0],throws:[0,0]};
let browserFrames=0;
Object.defineProperty(window,'__fe',{configurable:false,enumerable:false,get:()=>({tick:current.tick,phase:current.phase,paused,started,dialogs:[...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].map(d=>d.id),browserFrames,frames:inputEvidence.map(f=>({slot:f.slot,move:{...f.move},sprint:f.sprint,action:f.action,power:f.power})),shots:{actions:[...shotEvidence.actions],events:[...shotEvidence.events],power:[...shotEvidence.power]},passes:{actions:[...passEvidence.actions],events:[...passEvidence.events]},keeper:{punts:[...keeperEvidence.punts],highPunts:[...keeperEvidence.highPunts],throws:[...keeperEvidence.throws]},keeperHold:current.keeperHold?{playerId:current.keeperHold.playerId}:null,ball:structuredClone(current.ball),selected:[...current.selected],players:current.players.map(p=>({id:p.id,keeper:p.keeper,keeperRushing:p.keeperRushing===true,keeperDropped:p.keeperDropped===true,keeperMode:p.keeperMode,x:p.x,y:p.y,vx:p.vx,vy:p.vy,action:p.action,recovery:p.recovery}))})});
// Smoke only: exists only when navigator.webdriver is true. It is not a game feature. The recorder replay is not valid after this call.
if(navigator.webdriver)Object.defineProperty(window,'__feSmoke',{configurable:false,enumerable:false,value:{toFulltime(){
  if(!started||guest||replay)return false;const w=sim.snapshot();
  if(w.half===1){w.half=2;for(const t of w.teams)t.direction=t.direction===1?-1:1;}
  w.phase='playing';w.restart=null;w.countdown=0;w.played=config.halfSeconds-config.dt*3;
  sim.restore(w);previous=current=sim.presentation();return true;
},ballAtFeet(slot:0|1){
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
},
// Smoke only: a one-on-one drill: the slot keeper faces the nearest attacker.
oneOnOne(slot:0|1){
  if(!started||guest||replay||current.phase!=='playing')return false;
  const w=sim.snapshot();
  const keeper=w.players.find(p=>p.keeper&&p.team===slot);
  if(!keeper)return false;
  w.selected[slot]=keeper.id;keeper.manualControl=true;
  keeper.action=null;keeper.recovery=0;keeper.keeperMode='ready';
  keeper.vx=0;keeper.vy=0;
  w.keeperHold=null;
  const rest=config.physics.radius;
  w.ball.x=keeper.x-Math.sign(keeper.x)*16;w.ball.y=keeper.y;w.ball.z=rest;
  w.ball.vx=0;w.ball.vy=0;w.ball.vz=0;w.ball.spin={x:0,y:0,z:0};
  const awayX=w.ball.x-keeper.x,awayY=w.ball.y-keeper.y,away=Math.hypot(awayX,awayY);
  const ax=away>0?awayX/away:(slot===0?1:-1),ay=away>0?awayY/away:0;
  let attacker:typeof keeper|null=null,best=Infinity;
  for(const q of w.players){
    if(q.keeper||q.team===slot)continue;
    const d=Math.hypot(q.x-w.ball.x,q.y-w.ball.y);
    if(d<best){best=d;attacker=q;}
  }
  if(!attacker)return false;
  attacker.x=w.ball.x+ax;attacker.y=w.ball.y+ay;
  attacker.vx=0;attacker.vy=0;attacker.action=null;
  const limitX=config.pitch.length/2,limitY=config.pitch.width/2;
  for(const q of w.players){
    if(q===keeper||q===attacker)continue;
    const dx=q.x-w.ball.x,dy=q.y-w.ball.y,d=Math.hypot(dx,dy);
    if(d>=20)continue;
    const ux=d>0?dx/d:(q.team===0?1:-1),uy=d>0?dy/d:0;
    q.x=Math.max(-limitX,Math.min(limitX,w.ball.x+ux*20));
    q.y=Math.max(-limitY,Math.min(limitY,w.ball.y+uy*20));
    q.vx=0;q.vy=0;q.action=null;
  }
  w.pendingPass=null;
  w.restartRestriction=null;
  sim.restore(w);
  previous=current=sim.presentation();
  return true;
},
// Smoke only: gives the ball to the nearest opponent of the slot, at his feet.
// With minDistance > 0, pick the nearest opponent at that distance or more;
// if none, fall back to the nearest one.
cpuBall(slot:0|1, minDistance=0){
  if(!started||guest||replay||current.phase!=='playing')return false;
  const w=sim.snapshot();
  const self=w.players.find(p=>p.id===w.selected[slot]);
  if(!self)return false;
  let foe:typeof self|null=null,best=Infinity;
  for(const q of w.players){
    if(q.team===slot||q.keeper||q.sentOff)continue;
    const d=Math.hypot(q.x-self.x,q.y-self.y);
    if(d<best){best=d;foe=q;}
  }
  if(minDistance>0){
    let far:typeof self|null=null,farBest=Infinity;
    for(const q of w.players){
      if(q.team===slot||q.keeper||q.sentOff)continue;
      const d=Math.hypot(q.x-self.x,q.y-self.y);
      if(d>=minDistance&&d<farBest){farBest=d;far=q;}
    }
    if(far)foe=far;
  }
  if(!foe)return false;
  foe.vx=0;foe.vy=0;foe.action=null;foe.recovery=0;
  const rest=config.physics.radius;
  w.ball.x=foe.x+Math.cos(foe.heading)*.3;w.ball.y=foe.y+Math.sin(foe.heading)*.3;w.ball.z=rest;
  w.ball.vx=0;w.ball.vy=0;w.ball.vz=0;w.ball.spin={x:0,y:0,z:0};w.ball.freeTicks=0;
  const point={x:w.ball.x,y:w.ball.y,z:rest};
  w.ball.lastTouch={id:`smoke-${w.tick}`,tick:w.tick,playerId:foe.id,team:foe.team,surface:'foot',point};
  w.carrier=foe.id;w.possession=foe.team;
  w.pendingPass=null;w.restartRestriction=null;
  sim.restore(w);
  previous=current=sim.presentation();
  return true;
},
// Smoke only, read only: defence flags of one slot, his tick and position, and his distance to the carrier.
// carrierSince is the heldSince of the carrier. The engine sets heldSince each time a player gains the
// ball, also after a dribble touch pushed the ball out of reach. lastTouchTeam and lastTouchTick are the
// team and tick of the last ball touch: the controller sets the press flags only while the last touch is
// not a teammate touch, so a teammate poke ends the press. That is a contested possession, not a defect.
// baseSpeed is the engine speed limit of the field player before the jog, sprint and contain factors
// (simulation/engine.ts movePlayers), so two players compare by their share of their own base speed.
defenseState(slot:0|1=0){
  const w=sim.snapshot();
  const p=w.players.find(q=>q.id===w.selected[slot])??null;
  const carrier=w.players.find(q=>q.id===w.carrier)??null;
  const pressing=w.players.filter(q=>q.team===slot&&q.teamPressing===true).map(q=>q.id);
  return {selected:w.selected[slot]??null,tick:w.tick,keeper:p?.keeper===true,pressing:p?.pressing===true,jockeying:p?.jockeying===true,
    teamPressing:pressing,teamPressCount:pressing.length,carrier:w.carrier??null,carrierTeam:carrier?.team??null,carrierSince:carrier?.heldSince??null,
    distance:p&&carrier?Math.hypot(p.x-carrier.x,p.y-carrier.y):null,speed:p?Math.hypot(p.vx,p.vy):null,
    baseSpeed:p&&!p.keeper?p.capabilities.speed*(.65+.35*p.energy):null,
    x:p?.x??null,y:p?.y??null,lastTouchTeam:w.ball.lastTouch?.team??null,lastTouchTick:w.ball.lastTouch?.tick??null};
},
// Smoke only: starts the restart of `kind` for `team`, with a four-man wall on the free kick.
setPiece(kind:'free-kick'|'corner'|'penalty'|'throw-in'|'goal-kick',team:0|1,side:1|-1=1){
  // A ball out of play from the last step may leave a waiting restart: replace it.
  if(!started||guest||replay||!(current.phase==='playing'||(current.restart&&current.phase!=='kickoff')))return false;
  const L=config.pitch.length/2,W=config.pitch.width/2;
  const dir=sim.snapshot().teams[team].direction;
  const point=kind==='free-kick'?{x:dir*(L-24),y:0}:kind==='corner'?{x:dir*(L-.3),y:side*(W-.3)}:kind==='penalty'?{x:dir*(L-11),y:0}:kind==='throw-in'?{x:dir*10,y:W-.1}:{x:-dir*(L-5.5),y:6};
  (sim as any).startRestart(kind,team,point);
  if(kind==='free-kick'){
    const w=sim.snapshot();
    const wall=w.players.filter(p=>p.team===1-team&&!p.keeper&&!p.sentOff).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y)||a.id.localeCompare(b.id)).slice(0,4);
    const row=[-1.5,-.5,.5,1.5];
    wall.forEach((p,i)=>{p.x=point.x+dir*9.15;p.y=row[i];p.vx=0;p.vy=0;});
    w.pendingPass=null;
    sim.restore(w);
  }
  previous=current=sim.presentation();
  return true;
},
// Smoke only: reads back the waiting restart, the wall jumps, the keepers and the cursors.
setPieceState(){const w=sim.snapshot();return {phase:w.phase,tick:w.tick,restart:w.restart?structuredClone(w.restart):null,wallJump:w.players.filter(p=>p.wallJump!==undefined&&p.wallJump>w.tick).map(p=>p.id),keepers:w.players.filter(p=>p.keeper).map(p=>({id:p.id,team:p.team,x:p.x,y:p.y})),selected:[...w.selected],restriction:w.restartRestriction?{...w.restartRestriction}:null};}
,cornerView(){const w=sim.snapshot(),r=w.restart;if(!r)return null;const taker=w.players.find(p=>p.id===r.taker),project=(x:number,y:number)=>renderer?.screenPoint({x,y,z:0})??null;const end=Math.sign(r.point.x),goalX=end*(config.pitch.length/2),boxX=end*(config.pitch.length/2-16.5),corners=[project(goalX,-20.16),project(boxX,-20.16),project(goalX,20.16),project(boxX,20.16)];const targetZone=corners.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y))?{x:Math.min(...corners.map(p=>p!.x)),y:Math.min(...corners.map(p=>p!.y)),w:Math.max(...corners.map(p=>p!.x))-Math.min(...corners.map(p=>p!.x)),h:Math.max(...corners.map(p=>p!.y))-Math.min(...corners.map(p=>p!.y))}:null;return{ball:renderer?.screenPoint({x:w.ball.x,y:w.ball.y,z:w.ball.z})??null,taker:taker?renderer?.screenPoint({x:taker.x,y:taker.y,z:0})??null:null,targetZone,kind:r.kind,team:r.team};}
,refreshHud(){updateHud();return{radar:$('radar').classList.contains('dodge'),card:document.querySelector('.player-card')?.classList.contains('dodge'),ball:renderer?.screenPoint({x:current.ball.x,y:current.ball.y,z:current.ball.z})??null,radarRect:(()=>{const r=$('radar').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})()};}
}});
// A / Cross (button 0) on any pad starts quick play from the menu.
// Nothing acts while another dialog sits on the setup.
interface PadMenuState{a:boolean;x:boolean;o:boolean;up:boolean;down:boolean;left:boolean;right:boolean}
let padMenuDown:PadMenuState[]=[];
let controlsRepeatAt:number[]=[];
let controlsTabIndex=0;
function pollMenuPad(){
  let pads:(Gamepad|null)[]=[];
  try{pads=Array.from(navigator.getGamepads?.()??[]);}catch{return;}
  const setup=$<HTMLDialogElement>('setup-dialog');
  const onlySetupOpen=setup.open&&document.querySelectorAll('dialog[open]').length===1;
  for(let i=0;i<pads.length||i<padMenuDown.length;i++){
    const buttons=pads[i]?.buttons;
    const prev=padMenuDown[i]??{a:false,x:false,o:false,up:false,down:false,left:false,right:false};
    const state={a:!!buttons?.[0]?.pressed,x:!!buttons?.[0]?.pressed,o:!!buttons?.[1]?.pressed,up:!!buttons?.[12]?.pressed,down:!!buttons?.[13]?.pressed,left:!!buttons?.[14]?.pressed,right:!!buttons?.[15]?.pressed};
    padMenuDown[i]=state;
    const aEdge=state.a&&!prev.a,xEdge=state.x&&!prev.x,oEdge=state.o&&!prev.o,upEdge=state.up&&!prev.up,downEdge=state.down&&!prev.down,leftEdge=state.left&&!prev.left,rightEdge=state.right&&!prev.right;
    const overlay=$('pause-overlay');
    const openDialogs=[...document.querySelectorAll<HTMLDialogElement>('dialog[open]')],activeDialog=openDialogs.at(-1);
    if(activeDialog?.id==='help-dialog'){
      const stickY=pads[i]?.axes?.[1]??0,scrollDir=Math.abs(stickY)>.35?(stickY<0?-1:1):upEdge?-1:downEdge?1:0,now=Date.now();
      const verticalHeld=Math.abs(stickY)>.35||state.up||state.down;
      if(scrollDir&&(upEdge||downEdge||now>=(controlsRepeatAt[i]??0))){activeDialog.scrollTop+=scrollDir*48;controlsRepeatAt[i]=now+(upEdge||downEdge?300:85);}
      if(!verticalHeld)controlsRepeatAt[i]=0;
      const tabs=[...activeDialog.querySelectorAll<HTMLButtonElement>('[id^="controls-tab-"]')];
      if(leftEdge||rightEdge){const selected=tabs.findIndex(tab=>tab.getAttribute('aria-selected')==='true');controlsTabIndex=(Math.max(0,selected)+(rightEdge?1:-1)+tabs.length)%tabs.length;tabs[controlsTabIndex]?.focus({preventScroll:true});}
      if(aEdge)tabs[controlsTabIndex]?.click();
      if(xEdge&&activeDialog.contains(document.activeElement))(document.activeElement as HTMLElement).click();
      if(oEdge)activeDialog.querySelector<HTMLElement>('[data-close]')?.click();
      continue;
    }
    if(activeDialog&&started){
      const focusable=[...activeDialog.querySelectorAll<HTMLButtonElement>('button:not([hidden])')].filter(b=>b.getClientRects().length);
      if(upEdge||downEdge){const fi=focusable.indexOf(document.activeElement as HTMLButtonElement);focusable[(fi+(downEdge?1:-1)+focusable.length)%focusable.length]?.focus({preventScroll:true});}
      if(xEdge&&activeDialog.contains(document.activeElement))(document.activeElement as HTMLElement).click();
      if(oEdge){const close=activeDialog.querySelector<HTMLElement>('[data-close]');if(close)close.click();else if(activeDialog.id==='stats-dialog')activeDialog.close();}
      continue;
    }
    if(!overlay.hidden){
      if(upEdge)focusPauseButton(-1);if(downEdge)focusPauseButton(1);
      if(xEdge&&overlay.contains(document.activeElement))(document.activeElement as HTMLElement).click();
      if(oEdge){if(!$('pause-confirm').hidden)$('quit-no').click();else $('resume-btn').click();}
      continue;
    }
    if(aEdge&&onlySetupOpen&&menu.view==='setup'&&!matchInProgress()){quickPlay();break;}
  }
}
// Sampling on a timer catches short presses even when frames run slowly.
setInterval(pollMenuPad,50);
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
  // Set-piece keys: the waiting restart, with the team that takes it.
  const rs=current.restart;const restart=([0,1] as const).map(t=>rs?{kind:rs.kind,attacking:rs.team===t}:null) as [{kind:string,attacking:boolean}|null,{kind:string,attacking:boolean}|null];
  input.setRestart(guest?[restart[1],restart[0]]:restart);
  if(started&&!document.querySelector('dialog[open]')){
    if(input.pauseRequested())pause(!paused);
    if(input.cameraRequested())changeCamera();
  }
  try{
    if(guest){if(peer.connected&&!paused){guestCounter++;const frame=input.sample(guestCounter,0);peer.input({...frame,slot:1});}renderer?.draw(previous,current,Math.min(1,(now-networkTick)/100),elapsed);}
    else{
      if(!paused){accumulator+=elapsed;let steps=0;while(accumulator>=config.dt&&steps<6){
        if(replay&&sim.tick>=replay.endTick){pause(true);replayResult=sim.stateHash()===replay.finalHash?'REPETICIÓN VERIFICADA':'La repetición diverge de su estado original.';$('announcement').textContent=replayResult;refreshPause();break;}
        const frames:InputFrame[]=[];
        if(replay){while(replay.inputs[replayIndex]?.tick===sim.tick)frames.push(replay.inputs[replayIndex++]);}
        else for(const slot of [0,1]as const)if(config.human[slot]){const f=slot===1&&peer.role==='host'?peer.hostFrame(sim.tick):input.sample(sim.tick,slot);if(slot===0&&pendingTactics){f.tactics=pendingTactics;pendingTactics=undefined;}frames.push(f);}
        inputEvidence=structuredClone(frames);
        for(const f of frames)if(f.action==='shoot'){shotEvidence.actions[f.slot]++;shotEvidence.power[f.slot]=f.power??0;}else if(f.action==='pass')passEvidence.actions[f.slot]++;
        sim.applyInputs(frames);if(!replay)record.record(frames);previous=current;sim.step();current=sim.presentation();renderer?.advanceCamera(current);
        for(const e of current.events){
          if(e.type==='shoot'&&e.team!==undefined)shotEvidence.events[e.team]++;
          if(e.type==='action-start'&&e.data?.kind==='pass'&&e.team!==undefined)passEvidence.events[e.team]++;
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
        if(current.phase==='fulltime'&&started&&!finalShown&&!replay){finalShown=true;showFulltime();break;}
      }if(steps===6)accumulator=Math.min(accumulator,config.dt);}
      renderer?.draw(previous,current,paused?1:accumulator/config.dt,elapsed);
    }
    hudClock+=elapsed;if(hudClock>.1){updateHud();hudClock=0;}
  }catch(e){pause(true);$('announcement').textContent=`El partido se detuvo: ${(e as Error).message}`;console.error(e);}
  requestAnimationFrame(loop);
}
updateHud();showDialog('setup-dialog');requestAnimationFrame(loop);

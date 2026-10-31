import type { Config, DeepReadonly, ReadonlyPresentation } from '../contracts/types';

interface HudView {
  guest: boolean; replay: boolean; gamepadCount: number; charging: number;
  renderError: string; replayResult: string; notice: string; noticeUntil: number;
}
const phaseLabels:Record<string,string>={kickoff:'Saque inicial',playing:'En juego',goal:'¡GOL!',halftime:'Entretiempo',fulltime:'Final del partido','throw-in':'Saque de banda',corner:'Tiro de esquina','goal-kick':'Saque de meta','free-kick':'Tiro libre',offside:'Fuera de juego',penalty:'Penal',indirect:'Tiro libre indirecto'};

/** Only writes display elements; match and input coordination stay with the caller. */
export function renderHud(s:ReadonlyPresentation,config:DeepReadonly<Config>,view:Readonly<HudView>,$:(id:string)=>HTMLElement){
  const {guest,replay,gamepadCount,charging,renderError,replayResult,notice,noticeUntil}=view;
  const time=(s.half-1)*45*60+s.played/config.halfSeconds*45*60;
  $('score').textContent=`${s.score[0]} : ${s.score[1]}`;$('clock').textContent=`${Math.floor(time/60).toString().padStart(2,'0')}:${Math.floor(time%60).toString().padStart(2,'0')}`;$('half').textContent=`${s.half}T`;
  $('home-short').textContent=s.teams[0].shortName;$('away-short').textContent=s.teams[1].shortName;$('phase').textContent=phaseLabels[s.phase]??s.phase;
  const p=s.players.find(p=>p.id===s.selected[guest?1:0]);$('player-name').textContent=p?`${p.number} · ${p.name}`:'—';
  $('energy-bar').style.width=`${(p?.energy??1)*100}%`;
  $('pad-status').textContent=guest?'JUGADOR 2 · ONLINE':replay?'REPETICIÓN':!config.human.some(Boolean)?'MODO ESPECTADOR':gamepadCount?`${gamepadCount} MANDO${gamepadCount>1?'S':''} CONECTADO${gamepadCount>1?'S':''}`:'TECLADO · JUGADOR 1';
  $('power-meter').hidden=charging===0;$('power-bar').style.width=`${charging*100}%`;
  const announcement=renderError||replayResult||(s.phase==='fulltime'?'FINAL DEL PARTIDO':s.tick<noticeUntil?notice:s.phase==='goal'?'¡GOOOL!':s.phase==='halftime'?'ENTRETIEMPO':'');
  $('announcement').textContent=announcement;
}

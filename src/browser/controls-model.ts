import { KEEPER_SWITCH, PES_2017_PS4_ROWS, PS_GLYPH_BY_BUTTON, pesRow, type PadPresetRow } from './pad-presets';
import { TOUCH_GLYPHS, TOUCH_KEEPER_COMBO } from '../adapters/touch-pad';
import { CORNER_ATTACK, CORNER_DEFENCE } from '../simulation/rules';

export type ControlsTab='keyboard'|'pad'|'touch';
export type ControlsGroup='attack'|'defense'|'keeper'|'set-piece'|'system';
export const GROUP_TITLES:Record<ControlsGroup,string>={attack:'Ataque',defense:'Defensa',keeper:'Arquero','set-piece':'Balón parado',system:'Sistema'};
export const TAB_TITLES:Record<ControlsTab,string>={keyboard:'Teclado',pad:'Mando',touch:'Táctil'};
export interface ControlsEntry{id:string;label:string;cells:string[]}
export interface ControlsSection{group:ControlsGroup;title:string;entries:ControlsEntry[]}
interface RowText{label:string;group?:ControlsGroup;gesture?:'hold'|'double'|'release'|'before';pad?:string;keys?:{p1:string;p2:string};touch?:string;keysFrom?:string;hidden?:string}
export const SOUND_KEY='KeyM';

/** Player-facing labels and intentional differences from the preset literals. */
export const ROW_TEXT:Record<string,RowText>={
  move:{label:'Mover'},pass:{label:'Pase corto'},through:{label:'Pase filtrado'},switchPlayer:{label:'Cambiar jugador',group:'defense'},pause:{label:'Pausa'},
  cross:{label:'Pase alto / centro'},switchPlay:{label:'Cambio de frente',pad:'Stick izq. a la otra banda + ○',keys:{p1:'W A S D a la otra banda + I',p2:'↑ ↓ ← → a la otra banda + Num 5'}},
  crossHigh:{label:'',hidden:'same control as cross'},shot:{label:'Tiro',gesture:'release'},header:{label:'Cabezazo',pad:'□ ✕ ○ △',keys:{p1:'K J I L',p2:'Num 2 Num 1 Num 5 Num 3'}},
  sprint:{label:'Correr'},shield:{label:'Proteger balón'},standingTackle:{label:'Entrada',gesture:'double'},slide:{label:'Entrada deslizante'},clearance:{label:'Despeje',gesture:'release'},shoulderCharge:{label:'Carga'},camera:{label:'Cámara'},
  pressure:{label:'Presión',group:'defense',gesture:'hold'},chasePressure:{label:'Presión en carrera',group:'defense',pad:'R1 + ✕ (mantener)'},teamPress:{label:'Presión de un compañero',group:'defense',gesture:'hold'},
  multiPressure:{label:'Presión de dos compañeros',group:'defense',pad:'□ ×2 (mantener)'},jockey:{label:'Contener',group:'defense',gesture:'hold'},manualSwitch:{label:'Cambio manual',group:'defense',pad:'Stick der.'},
  keeperRush:{label:'Salir',group:'keeper',gesture:'hold'},keeperRushSprint:{label:'Salir en carrera',group:'keeper',pad:'R1 + △ (mantener)',keys:{p1:'Shift izq. + L (mantener)',p2:'Shift der. + Num 3 (mantener)'}},keeperHandThrow:{label:'Saque con la mano',group:'keeper'},keeperThrowSpace:{label:'Saque al espacio',group:'keeper'},
  keeperPunt:{label:'Volea',group:'keeper',gesture:'release'},keeperHighPunt:{label:'Volea alta',group:'keeper',pad:'R2 + ○ (mantener y soltar)',keys:{p1:'G + I',p2:'Num 6 + Num 5'}},
  keeperDropPick:{label:'Soltar / recoger balón',group:'keeper',pad:'R1 con el stick suelto',keys:{p1:'Shift izq. sin mover',p2:'Shift der. sin mover'}},keeperRun:{label:'Correr con el balón',group:'keeper'},keeperFeint:{label:'Amago de pase',group:'keeper',gesture:'before'},
  simulateDive:{label:'Simular falta',group:'keeper',pad:'L1 + L2 + L3 + R3 (sin R2)'},setPower:{label:'Potencia y altura',group:'set-piece',pad:'□ / ○ / ✕ (mantener y soltar)',keys:{p1:'K / I / J (mantener y soltar)',p2:'Num 2 / Num 5 / Num 1 (mantener y soltar)'}},
  setTrajectory:{label:'Dirección y efecto',group:'set-piece',keysFrom:'move'},setFix:{label:'Fijar dirección',group:'set-piece',gesture:'hold'},secondTaker:{label:'2.º lanzador',group:'set-piece',pad:'L1 + ↑ / ↓',keys:{p1:'Q + W / S',p2:'Enter + ↑ / ↓'}},
  secondTakerKick:{label:'Tira el 2.º lanzador',group:'set-piece',gesture:'hold'},setFeint:{label:'Amago',group:'set-piece',pad:'○ + ✕'},shortRoll:{label:'Pase corto',group:'set-piece',pad:'L1 + ✕',keys:{p1:'Q + J',p2:'Enter + Num 1'}},
  panenka:{label:'Penal: picada',group:'set-piece',pad:'L1 + □',keys:{p1:'Q + K',p2:'Enter + Num 2'}},wallJump:{label:'Barrera: saltar',group:'set-piece'},wallHold:{label:'Barrera: quieta',group:'set-piece',gesture:'hold'},
  wallCharge:{label:'Barrera: sale un jugador',group:'set-piece',gesture:'hold'},setKeeperMove:{label:'Arquero: moverse',group:'set-piece',pad:'△ (mantener) + stick izq.'},cornerStrategy:{label:'Córner',group:'set-piece'}
};

const GROUP_ORDER:ControlsGroup[]=['attack','defense','keeper','set-piece','system'];
const suffix=(g:RowText['gesture'])=>g==='hold'?' (mantener)':g==='double'?' ×2':g==='release'?' (mantener y soltar)':g==='before'?' antes de soltar':'';
const row=(id:string)=>pesRow(id);
export function keyLabel(code:string):string{
  if(/^Key[A-Z]$/.test(code))return code.slice(3);
  if(/^Digit[0-9]$/.test(code))return code.slice(5);
  if(/^Numpad[0-9]$/.test(code))return`Num ${code.slice(6)}`;
  const fixed:Record<string,string>={NumpadDivide:'Num /',NumpadMultiply:'Num *',NumpadSubtract:'Num -',NumpadAdd:'Num +',ShiftLeft:'Shift izq.',ShiftRight:'Shift der.',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Enter:'Enter',Escape:'Esc'};
  const label=fixed[code];if(!label)throw new Error(`unknown key code: ${code}`);return label;
}
export function glyphLabel(g:string):string{return g==='TOUCHPAD'?'Panel táctil':g;}
export function defaultControlsTab(touch:boolean,pads:number):ControlsTab{return touch?'touch':pads>0?'pad':'keyboard';}

function groupOf(id:string,r:PadPresetRow,t:RowText):ControlsGroup{return t.group??r.context;}
function keysText(r:PadPresetRow,t:RowText,p:'p1'|'p2'):string{
  if(t.keys)return t.keys[p];
  const source=t.keysFrom?row(t.keysFrom):r;
  const codes=source.keys[p];if(!codes.length)return'Automático';
  return codes.map(keyLabel).join(' ') + suffix(t.gesture);
}
function padText(r:PadPresetRow,t:RowText):string{
  if(t.pad)return t.pad;
  if(!r.glyphs.length){if(r.axis)return r.axis==='left'?'Stick izq.':'Stick der.';return'Automático';}
  return r.glyphs.map(glyphLabel).join(' + ')+suffix(t.gesture);
}
function standard(id:string,tab:ControlsTab):ControlsEntry|null{
  const r=row(id),t=ROW_TEXT[id];if(t.hidden)return null;
  if(id==='cornerStrategy'||(tab==='keyboard'&&id==='manualSwitch'))return null;
  if(tab==='pad'&&id==='crossHigh')return null;
  if(tab==='touch'&&(r.axis==='right'||r.glyphs.some(g=>!(TOUCH_GLYPHS as readonly string[]).includes(g))))return null;
  const cells=tab==='keyboard'?[keysText(r,t,'p1'),keysText(r,t,'p2')]:[tab==='pad'?padText(r,t):(t.touch??padText(r,t))];
  return{id,label:t.label,cells};
}

const EXTRA_IDS=['keeperSwitch','keeperDive','sound','touchSecondTaker','touchPause'] as const;
function extras(tab:ControlsTab):ControlsEntry[]{
  const common:Record<string,ControlsEntry>={
    keeperSwitch:{id:'keeperSwitch',label:'Tomar al arquero',cells:tab==='keyboard'?[keyLabel(KEEPER_SWITCH.keys.p1[0]),keyLabel(KEEPER_SWITCH.keys.p2[0])]:[tab==='pad'?glyphLabel(PS_GLYPH_BY_BUTTON[KEEPER_SWITCH.button]):TOUCH_KEEPER_COMBO.join(' + ')]},
    keeperDive:{id:'keeperDive',label:'Lanzarse',cells:tab==='keyboard'?[keyLabel(row('standingTackle').keys.p1[0]),keyLabel(row('standingTackle').keys.p2[0])]:[glyphLabel(row('standingTackle').glyphs[0])]},
    sound:{id:'sound',label:'Sonido',cells:[keyLabel(SOUND_KEY)]},
    touchSecondTaker:{id:'touchSecondTaker',label:'2.º lanzador al lado',cells:['L2']},
    touchPause:{id:'touchPause',label:'Pausa',cells:['Ⅱ']}
  };
  if(tab==='keyboard')return[common.keeperSwitch,common.keeperDive,common.sound];
  if(tab==='pad')return[common.keeperSwitch,common.keeperDive];
  return[common.keeperSwitch,common.keeperDive,common.touchSecondTaker,common.touchPause];
}
function corners(tab:ControlsTab):ControlsEntry[]{
  const r=row('cornerStrategy');const directions=['up','down','left','right'] as const;
  const make=(id:string,label:string,values:Record<string,string|undefined>,pad:string)=>{
    if(tab==='pad')return{id,label,cells:[pad]};
    const selected=directions.filter(d=>values[d]!==undefined);
    return{id,label,cells:[selected.map(d=>keyLabel(r.keys.p1[directions.indexOf(d)])).join(' / '),selected.map(d=>keyLabel(r.keys.p2[directions.indexOf(d)])).join(' / ')]};
  };
  const attack=CORNER_ATTACK as Record<string,string|undefined>,defence=CORNER_DEFENCE as Record<string,string|undefined>;
  return[make('cornerAttack','Córner a favor',attack,'↑ rápido · ↓ 1.er palo · ← en línea · → 2.º palo'),make('cornerDefence','Córner en contra',defence,'↑ mixta · ← al hombre · → zonal')];
}
export function controlsTab(tab:ControlsTab):ControlsSection[]{
  const entries:ControlsEntry[]=[];
  for(const r of PES_2017_PS4_ROWS){const e=standard(r.id,tab);if(e)entries.push(e);}
  if(tab!=='touch')entries.push(...corners(tab));
  entries.push(...extras(tab));
  return GROUP_ORDER.map(group=>({group,title:GROUP_TITLES[group],entries:entries.filter(e=>groupOfEntry(e.id,group))})).filter(section=>section.entries.length>0);
}
function groupOfEntry(id:string,group:ControlsGroup):boolean{
  if(id==='keeperSwitch'||id==='keeperDive')return group==='keeper';
  if(id==='sound'||id==='touchPause')return group==='system';
  if(id==='touchSecondTaker'||id==='cornerAttack'||id==='cornerDefence')return group==='set-piece';
  if(id==='cornerStrategy')return group==='set-piece';
  const r=PES_2017_PS4_ROWS.find(x=>x.id===id),t=ROW_TEXT[id];return !!r&&groupOf(id,r,t)===group;
}


/** Markdown source for the README: all device tabs share the same controls rows. */
export function controlsMarkdown():string{
  const tabs=['keyboard','pad','touch'] as const,all=new Map<string,{label:string;group:ControlsGroup;entries:Partial<Record<ControlsTab,string[]>>}>();
  for(const tab of tabs)for(const section of controlsTab(tab))for(const entry of section.entries){
    const current=all.get(entry.id)??{label:entry.label,group:section.group,entries:{}};current.entries[tab]=entry.cells;all.set(entry.id,current);
  }
  const cell=(value:string|undefined)=>value?value.replaceAll('|','\\|'):'—';
  return GROUP_ORDER.flatMap(group=>{const rows=[...all.values()].filter(row=>row.group===group);if(!rows.length)return[];
    return[`### ${GROUP_TITLES[group]}`,'','| Acción | Jugador 1 | Jugador 2 | Mando PS4 | Táctil |','|---|---|---|---|---|',...rows.map(row=>{const k=row.entries.keyboard??[],p=row.entries.pad??[],t=row.entries.touch??[];return`| ${cell(row.label)} | ${cell(k[0])} | ${cell(k[1])} | ${cell(p[0])} | ${cell(t[0])} |`;}),''];
  }).join('\n').trimEnd();
}

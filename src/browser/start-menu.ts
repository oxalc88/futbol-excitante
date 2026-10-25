// Pure start-menu logic: quick play defaults, first-time tips, CPU difficulty and menu state.

import type { CpuDifficulty } from '../contracts/types';

export interface StartMenuStorage { getItem(key:string):string|null; setItem(key:string,value:string):void }

export interface QuickPlaySetup { home:number; away:number; mode:'solo'; duration:number; teamSize:number; seed:number }

/** One-click match: first two teams, 6 minutes, 11 v 11, seed 2017. */
export function quickPlaySetup():QuickPlaySetup {
  return { home:0, away:1, mode:'solo', duration:360, teamSize:11, seed:2017 };
}

const tipsKey='fe.tipsSeen';
const difficultyKey='fe.cpuDifficulty';

// Session flag: one write failure must not bring the tips back on every match.
let tipsSeenThisSession=false;

/** Tips show only while the flag is missing; without storage never show them (they cannot be remembered). */
export function shouldShowTips(storage?:StartMenuStorage):boolean {
  if(tipsSeenThisSession)return false;
  if(!storage)return false;
  try{return storage.getItem(tipsKey)!=='1';}catch{return false;}
}

export function markTipsSeen(storage?:StartMenuStorage):void {
  tipsSeenThisSession=true;
  try{storage?.setItem(tipsKey,'1');}catch{}
}

/** Test hook: forget the session flag so each test starts from storage only. */
export function resetTipsSession():void {tipsSeenThisSession=false;}

/** Menu value to level. A missing or invalid value gives Normal. */
export function parseCpuDifficulty(value:string|null|undefined):CpuDifficulty {
  return value==='easy'||value==='hard'?value:'normal';
}

/** Saved level. Missing, invalid or blocked storage gives Normal. */
export function loadCpuDifficulty(storage?:StartMenuStorage):CpuDifficulty {
  if(!storage)return 'normal';
  try{return parseCpuDifficulty(storage.getItem(difficultyKey));}catch{return 'normal';}
}

/** Save the level and return it, so the menu shows what is stored. */
export function saveCpuDifficulty(storage:StartMenuStorage|undefined,value:string|null|undefined):CpuDifficulty {
  const level=parseCpuDifficulty(value);
  try{storage?.setItem(difficultyKey,level);}catch{}
  return level;
}

/** Online play ignores the menu level and always runs Normal. */
export function matchCpuDifficulty(online:boolean,value:string|null|undefined):CpuDifficulty {
  return online?'normal':parseCpuDifficulty(value);
}

/** Which start-menu screen is active; tips always return to the screen that opened them. */
export type MenuView='setup'|'tips'|'match'|'closed';
export interface MenuState { view:MenuView; returnTo:MenuView }
export type MenuAction={type:'open-setup'}|{type:'start-match'}|{type:'show-tips'}|{type:'close-tips'}|{type:'close-setup'};

export const initialMenuState:MenuState={view:'setup',returnTo:'closed'};

export function menuReducer(state:MenuState,action:MenuAction):MenuState {
  switch(action.type){
    case 'open-setup':return{view:'setup',returnTo:state.view};
    case 'start-match':return{view:'match',returnTo:state.view};
    case 'show-tips':return{view:'tips',returnTo:state.view==='tips'?state.returnTo:state.view};
    case 'close-tips':return{view:state.returnTo,returnTo:'closed'};
    case 'close-setup':return{view:'closed',returnTo:'closed'};
    default:return state;
  }
}

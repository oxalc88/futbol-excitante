import type { PitchPaletteId } from '../adapters/presentation-model';
export interface PitchPaletteStorage { getItem(key:string):string|null; setItem(key:string,value:string):void }
const key='fe.pitchPalette';
export function loadPitchPalette(storage?:PitchPaletteStorage):PitchPaletteId {
  try{return storage?.getItem(key)==='sobria'?'sobria':'viva';}catch{return 'viva';}
}
export function savePitchPalette(storage:PitchPaletteStorage|undefined,id:PitchPaletteId){
  try{storage?.setItem(key,id);}catch{}
}

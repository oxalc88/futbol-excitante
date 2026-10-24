import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPitchPalette, savePitchPalette } from '../src/browser/pitch-palette';
const memory=()=>{const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};};
test('pitch palette defaults to viva',()=>{assert.equal(loadPitchPalette(),'viva');assert.equal(loadPitchPalette(memory()),'viva');});
test('pitch palette round trip uses fe.pitchPalette',()=>{
  const storage=memory();for(const id of ['sobria','viva'] as const){savePitchPalette(storage,id);assert.equal(storage.getItem('fe.pitchPalette'),id);assert.equal(loadPitchPalette(storage),id);}
});
test('invalid pitch palette falls back to viva',()=>{const storage=memory();for(const value of ['invalid','','Viva','toString']){storage.setItem('fe.pitchPalette',value);assert.equal(loadPitchPalette(storage),'viva');}});
test('throwing storage falls back to viva',()=>{const storage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};assert.equal(loadPitchPalette(storage),'viva');assert.doesNotThrow(()=>savePitchPalette(storage,'sobria'));});

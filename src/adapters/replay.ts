import type { InputFrame, Replay } from '../contracts/types';
import { Simulation } from '../simulation/engine';
export class Recorder {
  private initial: Replay['initial'];
  private inputs: InputFrame[]=[];
  constructor(sim:Simulation){this.initial=sim.snapshot();}
  record(frames:InputFrame[]){this.inputs.push(...structuredClone(frames));}
  finish(sim:Simulation):Replay{return {version:'replay-v2',initial:this.initial,inputs:this.inputs,endTick:sim.tick,finalHash:sim.stateHash()};}
}
export function parseReplay(value:unknown):Replay {
  const r=value as Replay;
  if(!r||r.version!=='replay-v2'||!r.initial||!Array.isArray(r.inputs)||r.inputs.length>250000||!Number.isInteger(r.endTick)||r.endTick<r.initial.tick||r.endTick>250000||!/^\w{8}$/.test(r.finalHash))throw new Error('Repetición inválida o demasiado larga.');
  if(r.inputs.some((f,i)=>!Number.isInteger(f.tick)||f.tick<r.initial.tick||f.tick>=r.endTick||(i>0&&(f.tick<r.inputs[i-1].tick||(f.tick===r.inputs[i-1].tick&&f.slot<=r.inputs[i-1].slot)))))throw new Error('Entradas fuera de orden.');
  return r;
}
export function replaySimulation(r:Replay){const s=new Simulation(r.initial.config,r.initial.teams);s.restore(r.initial);return s;}
export function runReplay(r:Replay){const sim=replaySimulation(r);let index=0;while(sim.tick<r.endTick){const frames:InputFrame[]=[];while(r.inputs[index]?.tick===sim.tick)frames.push(r.inputs[index++]);sim.applyInputs(frames);sim.step();}return{sim,verified:sim.stateHash()===r.finalHash};}

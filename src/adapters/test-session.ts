import type { Presentation, World } from '../contracts/types';
import { Simulation } from '../simulation/engine';
import { createScenario, type Scenario } from '../../eval/scenarios';
import { CameraRig } from './presentation-model';

/** Same scenario factory, scheduler and immutable captures as the headless runner. */
export class BrowserTestSession {
  readonly version='browser-test-session-v1';
  private sim!:Simulation;private scenario!:Scenario;private camera=new CameraRig();
  private submissions:{tick:number;submittedAt:number;camera:ReturnType<CameraRig['pose']>}[]=[];
  previous!:Presentation;current!:Presentation;
  constructor(id='LOC-ACC-001',seed=2017,variant:0|1=0){this.reset(id,seed,variant);}
  reset(id:string,seed=2017,variant:0|1=0){this.scenario=createScenario(id,seed,variant);this.sim=new Simulation(this.scenario.initial.config,this.scenario.initial.teams);this.sim.restore(this.scenario.initial);this.camera.reset();this.submissions=[];this.previous=this.current=this.sim.presentation();this.camera.advance(this.current);}
  step(count=1){if(!Number.isInteger(count)||count<1||count>600)throw new Error('Step count must be 1–600');for(let i=0;i<count;i++){this.sim.applyInputs(this.scenario.input(this.sim.tick));this.previous=this.current;this.sim.step();this.current=this.sim.presentation();this.camera.advance(this.current);}return this.capture();}
  renderSubmitted(submittedAt:number){if(!Number.isFinite(submittedAt))throw new Error('Invalid presentation timestamp');this.submissions.push({tick:this.sim.tick,submittedAt,camera:this.camera.pose()});}
  state():World{return this.sim.snapshot();}
  capture(){return{version:this.version,testId:this.scenario.id,seed:this.scenario.seed,variant:this.scenario.variant,tick:this.sim.tick,worldHash:this.sim.stateHash(),state:this.sim.snapshot(),camera:this.camera.pose(),renderSubmissions:structuredClone(this.submissions),visualVerdict:'NEEDS_PERCEPTUAL_REVIEW' as const};}
}

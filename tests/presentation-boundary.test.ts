import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { FootballRenderer } from '../src/adapters/renderer';
import { CameraRig } from '../src/adapters/presentation-model';
import { renderHud } from '../src/browser/hud';
import { cardAlert } from '../src/browser/card-alert';
import type { ReadonlyPresentation } from '../src/contracts/types';

function freeze<T>(value:T):T {
  if(value && typeof value==='object') { Object.freeze(value);for(const child of Object.values(value))freeze(child); }
  return value;
}

// Real Three scene/actors/camera and radar/HUD code; only the GPU and DOM are faked.
function presentationHarness(t:TestContext,config:ReturnType<typeof createConfig>) {
  let renders=0,radarDraws=0;
  const context={canvas:{width:252,height:162},clearRect(){radarDraws++;},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},ellipse(){},arc(){},fill(){},fillText(){}};
  const canvas={width:128,height:64,getContext:()=>context,setAttribute(){},remove(){}};
  const globals={document:{createElement:()=>({...canvas})},devicePixelRatio:1,ResizeObserver:class{observe(){}disconnect(){}}};
  for(const [name,value] of Object.entries(globals)){
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
    t.after(()=>{if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);});
  }
  const container={append(){},getBoundingClientRect:()=>({width:960,height:540})};
  const backend={domElement:canvas,shadowMap:{},setPixelRatio(){},setSize(){},render(){renders++;},dispose(){}};
  const kit={shirt:'#ffffff',shorts:'#111111',accent:'#ff0000',pattern:'plain' as const};
  const renderer=new FootballRenderer(container as unknown as HTMLElement,canvas as unknown as HTMLCanvasElement,config,[kit,kit],()=>backend as unknown as THREE.WebGLRenderer);
  t.after(()=>renderer.dispose());
  const elements=new Map<string,HTMLElement>();
  const $=(id:string)=>{if(!elements.has(id))elements.set(id,{style:{},textContent:'',hidden:false} as unknown as HTMLElement);return elements.get(id)!;};
  return {renderer,$,counts:()=>({renders,radarDraws})};
}

test('presentation attached matches headless authority every tick and at fulltime',t=>{
  const config=createConfig({seed:46,human:[false,false],halfSeconds:30});
  const make=()=>new Simulation(config,[makeTeam(0),makeTeam(1)]);
  const headless=make(),hashes:string[]=[];
  while(headless.phase!=='fulltime'){
    assert(headless.tick<20000,'match must finish');headless.step();hashes.push(headless.stateHash());
    if(headless.tick===59)assert.equal(headless.phase,'kickoff');
    if(headless.tick===60)assert.equal(headless.phase,'playing');
  }
  assert(hashes.length>3000);
  const attached=make(),{renderer,$,counts}=presentationHarness(t,config),camera=new CameraRig();
  let previous:ReadonlyPresentation=freeze(attached.presentation());
  for(let i=0;i<hashes.length;i++){
    attached.step();const current=freeze(attached.presentation());
    const mode=(['broadcast','tactical','close'] as const)[i%3];
    renderer.setCamera(mode);camera.mode=mode;camera.advance(current);camera.pose(i%2?.6:16/9,(i%7)/6);
    renderer.setAnimations(i%2===0);
    if(i%300===0)renderer.setQuality(i%600===0?'low':'high');
    renderer.advanceCamera(current);
    for(const alpha of [0,.5,1])renderer.draw(previous,current,alpha,1/60);
    for(const state of [0,1,2])renderHud(current,config,{guest:state===1,replay:state===2,gamepadCount:state,charging:state/2,renderError:'',replayResult:state===2?'REPETICIÓN VERIFICADA':'',notice:'Aviso',noticeUntil:i+100},$);
    cardAlert(current.events,current);
    assert.equal(attached.stateHash(),hashes[i],`authority diverged at tick ${attached.tick}`);
    previous=current;
  }
  assert.equal(attached.phase,'fulltime');assert.deepEqual(attached.snapshot(),headless.snapshot());
  assert.equal(counts().renders,hashes.length*3);assert.equal(counts().radarDraws,hashes.length*3);
  assert.equal($('score').textContent,headless.snapshot().score.join(' : '));
});

const presentationFiles=['src/adapters/presentation-model.ts','src/adapters/renderer.ts','src/browser/hud.ts','src/browser/card-alert.ts'];
function forbiddenImports(source:string){
  const file=ts.createSourceFile('presentation.ts',source,ts.ScriptTarget.Latest,true);
  const violations:string[]=[];
  // Closed allowlist: helpers may depend on each other, contracts and pure math only.
  const allowed=new Set(['three','../contracts/types','../simulation/math','./presentation-model']);
  function visit(node:ts.Node){
    let specifier:ts.Expression|undefined;
    if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))specifier=node.moduleSpecifier;
    else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||node.expression.getText(file)==='require'))specifier=node.arguments[0];
    if(specifier && (!ts.isStringLiteral(specifier)||!allowed.has(specifier.text)))violations.push(specifier.getText(file));
    ts.forEachChild(node,visit);
  }
  visit(file);return violations;
}
test('presentation imports cannot reach simulation mutators or orchestration',()=>{
  for(const file of presentationFiles)assert.deepEqual(forbiddenImports(readFileSync(file,'utf8')),[],file);
  for(const source of ["import { Simulation } from '../simulation/engine'", "export * from '../simulation/rules'", "import('../simulation/tactics')", "require('../adapters/replay')", "import(path)"])
    assert.equal(forbiddenImports(source).length,1,source);
});

// These assertions run in typecheck: nested presentation writes must stay illegal.
function readonlyContract(s:ReadonlyPresentation){
  // @ts-expect-error readonly nested player
  s.players[0].intent.move.x=1;
  // @ts-expect-error readonly score tuple
  s.score[0]=2;
  // @ts-expect-error readonly teams and tactics
  s.teams[0].tactics.pressing=1;
  // @ts-expect-error readonly player array
  s.players.push(s.players[0]);
}
void readonlyContract;

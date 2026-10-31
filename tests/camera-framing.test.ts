import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {CameraRig,cameraWanted,projectPoint} from '../src/adapters/presentation-model';import type {ReadonlyPresentation} from '../src/contracts/types';
const state=(x:number,y:number,restart=false)=>({tick:1,ball:{x,y,z:0,vx:0,vy:0},events:restart?[{type:'restart-awarded'}]:[],restart:restart?{kind:'corner',team:0}:null} as unknown as ReadonlyPresentation);
test('camera frames ball and taker at all corners, aspects and modes',()=>{
 for(const [x,y] of [[52.2,33.7],[52.2,-33.7],[-52.2,33.7],[-52.2,-33.7]])for(const aspect of [2.17,2.8])for(const mode of ['broadcast','close'] as const){
  const s=state(x,y,true),rig=new CameraRig();rig.mode=mode;rig.advance(s);const pose=rig.pose(aspect);const ps=[projectPoint(pose,aspect,{x,y,z:0}),projectPoint(pose,aspect,{x,y:y-Math.sign(y)*.5,z:0})];
  for(const p of ps){assert.ok(p.front);assert.ok(p.x>=-.45&&p.x<=.30,`${x},${y},${aspect},${mode} x=${p.x}`);assert.ok(p.y>=-.55&&p.y<=.55,`${x},${y},${aspect},${mode} y=${p.y}`);}
 }
});
test('open-play camera target stays on the old formula',()=>{let seed=7411;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/0x100000000};for(let i=0;i<20;i++){const x=(rand()-.5)*104,y=(rand()-.5)*68,w=cameraWanted(state(x,y));assert.deepEqual(w,{x:Math.max(-33,Math.min(33,x*.7)),y:Math.max(-13,Math.min(13,y*.5))});}});
test('projectPoint matches Three.js PerspectiveCamera',()=>{
 const pose={position:{x:13,y:42,z:37},target:{x:5,y:-3,z:0},fov:42},aspect=2.17,camera=new THREE.PerspectiveCamera(pose.fov,aspect,.1,350);camera.position.set(pose.position.x,pose.position.z,pose.position.y);camera.lookAt(pose.target.x,0,pose.target.y);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
 for(let i=0;i<10;i++){const p={x:i*4-20,y:i*2-8,z:i*.3},got=projectPoint(pose,aspect,p),v=new THREE.Vector3(p.x,p.z,p.y).project(camera);assert.ok(Math.abs(got.x-v.x)<1e-6);assert.ok(Math.abs(got.y-v.y)<1e-6);assert.equal(got.front,v.z<1);}
});

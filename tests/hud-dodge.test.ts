import test from 'node:test';import assert from 'node:assert/strict';import {dodgeHud} from '../src/browser/hud-dodge';
const rect={left:10,right:30,top:10,bottom:30};
test('HUD hides only when a projected point enters the box or its margin',()=>{
 assert.deepEqual(dodgeHud([{x:20,y:20}],{radar:rect}),{radar:true,card:false});
 assert.deepEqual(dodgeHud([{x:35,y:20}],{radar:rect},6),{radar:true,card:false});
 assert.deepEqual(dodgeHud([{x:40,y:20}],{radar:rect},6),{radar:false,card:false});
 assert.deepEqual(dodgeHud([{x:20,y:20}],{}),{radar:false,card:false});
});

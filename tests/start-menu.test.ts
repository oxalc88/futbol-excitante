import test from 'node:test';
import assert from 'node:assert/strict';
import { quickPlaySetup, shouldShowTips, markTipsSeen, resetTipsSession, menuReducer, initialMenuState } from '../src/browser/start-menu';
const memory=()=>{const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};};
test('quick play uses the documented defaults',()=>{
  assert.deepEqual(quickPlaySetup(),{home:0,away:1,mode:'solo',duration:360,teamSize:11,seed:2017});
  assert.deepEqual(quickPlaySetup(),quickPlaySetup());
});
test('tips show once and hide after they are marked as seen',()=>{
  resetTipsSession();
  const storage=memory();
  assert.equal(shouldShowTips(storage),true);
  markTipsSeen(storage);
  assert.equal(storage.getItem('fe.tipsSeen'),'1');
  assert.equal(shouldShowTips(storage),false);
  resetTipsSession();
  assert.equal(shouldShowTips(memory()),true);
});
test('only the exact flag hides the tips',()=>{
  resetTipsSession();
  for(const value of ['0','','2','seen','1x','toString']){
    const storage=memory();
    storage.setItem('fe.tipsSeen',value);
    assert.equal(shouldShowTips(storage),true);
  }
});
test('throwing or missing storage never breaks and never shows tips',()=>{
  resetTipsSession();
  const storage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  assert.equal(shouldShowTips(storage),false);
  assert.doesNotThrow(()=>markTipsSeen(storage));
  assert.equal(shouldShowTips(),false);
  assert.doesNotThrow(()=>markTipsSeen(undefined));
});
test('a successful read with a failing write hides the tips for the session',()=>{
  resetTipsSession();
  // getItem works and returns null: the flag is missing. setItem throws: the flag is not stored.
  const storage={getItem:memory().getItem,setItem(){throw new Error('quota');}};
  assert.equal(shouldShowTips(storage),true);
  markTipsSeen(storage);
  assert.equal(storage.getItem('fe.tipsSeen'),null);
  // The session flag stops the tips from repeating on the next match.
  assert.equal(shouldShowTips(storage),false);
  assert.equal(shouldShowTips(storage),false);
  resetTipsSession();
  assert.equal(shouldShowTips(storage),true);
});
test('menu reducer walks setup, match and tips',()=>{
  let state=initialMenuState;
  assert.equal(state.view,'setup');
  state=menuReducer(state,{type:'start-match'});
  assert.equal(state.view,'match');
  state=menuReducer(state,{type:'show-tips'});
  assert.equal(state.view,'tips');
  state=menuReducer(state,{type:'close-tips'});
  assert.equal(state.view,'match');
  state=menuReducer(state,{type:'open-setup'});
  assert.equal(state.view,'setup');
  state=menuReducer(state,{type:'show-tips'});
  assert.equal(state.view,'tips');
  state=menuReducer(state,{type:'close-tips'});
  assert.equal(state.view,'setup');
  state=menuReducer(state,{type:'close-setup'});
  assert.equal(state.view,'closed');
});
test('repeating show-tips keeps the original return screen',()=>{
  let state=menuReducer(initialMenuState,{type:'start-match'});
  state=menuReducer(state,{type:'show-tips'});
  state=menuReducer(state,{type:'show-tips'});
  assert.equal(state.view,'tips');
  assert.equal(menuReducer(state,{type:'close-tips'}).view,'match');
  assert.equal(menuReducer(state,{type:'close-setup'}).view,'closed');
});

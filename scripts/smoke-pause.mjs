import { startServer,stop,launch,newPage,check,shot,writeEvidence,errors,startMatch,rectOf,finish } from './e2e-lib.mjs';
const port=Number(process.env.PAUSE_SMOKE_PORT??4324),results=[];
let browser;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  await startServer(port);browser=await launch();
  for(const spec of [{w:1280,h:720,touch:false},{w:844,h:390,touch:true},{w:390,h:844,touch:false}]){
    const vp=`${spec.w}x${spec.h}`,{context,page}=await newPage(browser,spec);const checks=[];
    await startMatch(page,{mode:'solo',touch:spec.touch});await shot(page,'pause',vp,1,'play');
    check(await page.locator('#app [title], #app [placeholder]').count()===0,`${vp}: title or placeholder attribute remains`);
    await page.locator('#menu-btn').click();check(await page.locator('#pause-overlay').isVisible(),`${vp}: menu button did not open pause`);check(!await page.locator('#setup-dialog').evaluate(el=>el.open),`${vp}: setup opened from a live match`);check(await page.evaluate(()=>window.__fe.paused),`${vp}: game is not paused`);
    if(spec.touch)check(await page.locator('#touch-pad').evaluate(el=>el.hidden),`${vp}: touch pad remains visible while paused`);
    await shot(page,'pause',vp,2,'pause');
    const vpRect=await rectOf(page,'#viewport'),windowRect={left:0,top:0,right:spec.w,bottom:spec.h};
    for(const b of await page.locator('#pause-main button').all()){const r=await b.boundingBox();check(r&&r.x>=vpRect.left&&r.y>=vpRect.top&&r.x+r.width<=vpRect.right&&r.y+r.height<=vpRect.bottom&&r.x>=windowRect.left&&r.y>=windowRect.top&&r.x+r.width<=windowRect.right&&r.y+r.height<=windowRect.bottom,`${vp}: pause control is outside the viewport`);}
    const frozen=await page.evaluate(()=>window.__fe.tick);await wait(1000);check(await page.evaluate(()=>window.__fe.tick)===frozen,`${vp}: paused clock advanced`);
    await page.locator('#pause-camera').click();check(await page.locator('#pause-camera-value').textContent()==='Táctica',`${vp}: camera state did not advance`);
    const sound=await page.locator('#sound-btn').getAttribute('aria-pressed');await page.locator('#sound-btn').click();check(await page.locator('#sound-btn').getAttribute('aria-pressed')!==sound,`${vp}: sound state did not toggle`);
    await page.locator('#pause-controls').click();check(await page.locator('#help-dialog').evaluate(el=>el.open),`${vp}: controls did not open`);check(await page.locator('#pause-overlay').evaluate(el=>el.hidden),`${vp}: pause remained over controls`);
    await page.locator('#help-dialog .close[data-close="help-dialog"]').click();await page.waitForFunction(()=>!document.querySelector('#pause-overlay').hidden);await shot(page,'pause',vp,3,'controls-back');
    await page.locator('#pause-stats').click();check(await page.locator('#stats-dialog').evaluate(el=>el.open),`${vp}: stats did not open`);await page.locator('[data-close="stats-dialog"]').click();await page.waitForFunction(()=>!document.querySelector('#pause-overlay').hidden);
    await page.locator('#pause-quit').click();check(!await page.locator('#pause-confirm').evaluate(el=>el.hidden)&&await page.locator('#pause-main').evaluate(el=>el.hidden),`${vp}: confirmation did not replace the pause menu`);
    const confirmation=await page.evaluate(()=>{const root=document.querySelector('#viewport').getBoundingClientRect(),panel=document.querySelector('#pause-confirm').getBoundingClientRect(),prompt=document.querySelector('#pause-confirm>strong').getBoundingClientRect(),buttons=[...document.querySelectorAll('#pause-confirm button')].map(e=>e.getBoundingClientRect());return{root:{left:root.left,top:root.top,right:root.right,bottom:root.bottom},panel:{left:panel.left,top:panel.top,right:panel.right,bottom:panel.bottom,width:panel.width},prompt:{left:prompt.left,top:prompt.top,right:prompt.right,bottom:prompt.bottom,width:prompt.width,height:prompt.height},buttons:buttons.map(r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}))}});
    check(confirmation.prompt.left>=confirmation.panel.left&&confirmation.prompt.right<=confirmation.panel.right&&confirmation.prompt.top>=confirmation.root.top&&confirmation.prompt.bottom<=confirmation.root.bottom&&confirmation.prompt.width>=confirmation.panel.width-20&&confirmation.prompt.height<80,`${vp}: quit prompt does not span compactly across confirmation`);
    check(confirmation.buttons.length===2&&confirmation.buttons.every(r=>r.height<100&&r.left>=confirmation.root.left&&r.right<=confirmation.root.right&&r.top>=confirmation.root.top&&r.bottom<=confirmation.root.bottom),`${vp}: confirmation actions do not fit at normal height`);
    await shot(page,'pause',vp,4,'confirm');
    await page.locator('#quit-no').click();check(!await page.locator('#pause-main').evaluate(el=>el.hidden)&&await page.evaluate(()=>window.__fe.started),`${vp}: cancel quit did not return to pause`);
    const before=await page.evaluate(()=>window.__fe.tick);await page.locator('#resume-btn').click();check(await page.locator('#pause-overlay').evaluate(el=>el.hidden),`${vp}: resume left pause open`);await page.waitForFunction(t=>window.__fe.tick>t,before,{timeout:2000});if(spec.touch)await page.waitForFunction(()=>!document.querySelector('#touch-pad').hidden);
    await page.keyboard.press('KeyP');await page.locator('#pause-quit').click();await page.locator('#quit-yes').click();await page.waitForFunction(()=>document.querySelector('#setup-dialog').open&&window.__fe.started===false);check(true,`${vp}: quit to menu`);await context.close();results.push({viewport:vp,checks:checks.length});
  }
  // Physical pad navigation on desktop.
  const {context,page}=await newPage(browser,{w:1280,h:720,touch:false});await startMatch(page,{mode:'solo'});
  const pad=(button,pressed)=>page.evaluate(([b,p])=>window.__pad.button(0,b,p),[button,pressed]);await page.evaluate(()=>window.__pad.connect(0,true));await wait(200);
  const tap=async button=>{await pad(button,true);await wait(100);await pad(button,false);await wait(100);};
  await tap(9);await page.waitForFunction(()=>!document.querySelector('#pause-overlay').hidden);
  await tap(13);await tap(13);check(await page.evaluate(()=>document.activeElement?.id)==='pause-camera','pad down did not focus camera');
  await tap(0);check(await page.locator('#pause-camera-value').textContent()==='Táctica','pad cross did not click camera');await tap(1);await page.waitForFunction(()=>document.querySelector('#pause-overlay').hidden);
  await context.close();results.push({viewport:'pad',checks:3});
  check(errors.length===0,`browser errors: ${errors.join('; ')}`);writeEvidence('pause',{results,errors});await browser.close();browser=null;stop();finish(0);
}catch(e){errors.push(e.stack||String(e));writeEvidence('pause',{results,errors});await browser?.close();browser=null;stop();finish(1);}
finally{await browser?.close();stop();}

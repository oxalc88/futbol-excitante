import { startServer,stop,launch,newPage,check,shot,writeEvidence,errors,startMatch,visibleTexts,rectOf,finish } from './e2e-lib.mjs';
const port=Number(process.env.FULLTIME_SMOKE_PORT??4323),results=[];
let browser;
try{
  await startServer(port);browser=await launch();
  for(const spec of [{w:1280,h:720,touch:false},{w:844,h:390,touch:true},{w:390,h:844,touch:false}]){
    const vp=`${spec.w}x${spec.h}`;const {context,page}=await newPage(browser,spec);const record={viewport:vp,checks:[]};
    await startMatch(page,{mode:'solo',touch:spec.touch});
    if(spec.touch)check(await page.locator('#touch-pad').isVisible(),`${vp}: touch pad did not appear`);
    check(await page.evaluate(()=>window.__feSmoke.toFulltime()),`${vp}: fulltime hook failed`);
    await page.waitForFunction(()=>window.__fe?.phase==='fulltime'&&document.querySelector('#fulltime-dialog').open,{timeout:5000});
    await shot(page,'fulltime',vp,1,'fulltime');
    const assertNoPause=async()=>{
      check(await page.locator('#pause-overlay').evaluate(el=>el.hidden),`${vp}: pause overlay visible after fulltime`);
      const texts=await visibleTexts(page);check(!texts.some(t=>/PAUSA|Seguir jugando/.test(t)),`${vp}: pause text remains: ${texts.join(' | ')}`);
      if(spec.touch)check(await page.locator('#touch-pad').evaluate(el=>el.hidden),`${vp}: touch pad visible after fulltime`);
    };
    await assertNoPause();
    const rematch=await rectOf(page,'#ft-rematch'),dlg=await rectOf(page,'#fulltime-dialog'),hit=await page.evaluate(()=>{const r=document.querySelector('#ft-rematch').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.id==='ft-rematch';});
    check(rematch.bottom<=spec.h&&rematch.top>=0&&rematch.left>=dlg.left&&rematch.right<=dlg.right,`${vp}: rematch button outside the window or dialog`);
    check(await page.locator('#fulltime-dialog').evaluate(el=>el.scrollTop===0),`${vp}: fulltime dialog scrolls`);check(hit,`${vp}: rematch button is covered`);
    await page.keyboard.press('Escape');check(await page.locator('#fulltime-dialog').evaluate(el=>el.open),`${vp}: Escape closed final dialog`);await assertNoPause();
    await page.keyboard.press('KeyP');await assertNoPause();
    await page.locator('#ft-stats').click();check(await page.locator('#stats-dialog').evaluate(el=>el.open),`${vp}: stats did not open`);await shot(page,'fulltime',vp,2,'stats');
    await page.locator('[data-close="stats-dialog"]').click();await page.waitForFunction(()=>document.querySelector('#fulltime-dialog').open);await assertNoPause();await shot(page,'fulltime',vp,3,'back');
    await page.locator('#ft-rematch').click();await page.waitForFunction(()=>['kickoff','playing'].includes(window.__fe?.phase)&&window.__fe.tick<300&&document.querySelector('#fulltime-dialog').open===false&&window.__fe.paused===false&&document.querySelector('#score').textContent.trim()==='0 : 0',{timeout:3000});await shot(page,'fulltime',vp,4,'rematch');
    check(await page.evaluate(()=>window.__feSmoke.toFulltime()),`${vp}: second fulltime hook failed`);await page.waitForFunction(()=>window.__fe?.phase==='fulltime'&&document.querySelector('#fulltime-dialog').open);
    await page.locator('#ft-menu').click();await page.waitForFunction(()=>document.querySelector('#setup-dialog').open&&window.__fe.started===false);await assertNoPause();await shot(page,'fulltime',vp,5,'menu');
    results.push(record);await context.close();
  }
  check(errors.length===0,`browser errors: ${errors.join('; ')}`);writeEvidence('fulltime',{results,errors});await browser?.close();browser=null;stop();finish(0);
}catch(e){errors.push(e.stack||String(e));writeEvidence('fulltime',{results,errors});await browser?.close();browser=null;stop();finish(1);}
finally{await browser?.close();stop();}

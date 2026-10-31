import { startServer,stop,launch,newPage,check,shot,writeEvidence,errors,startMatch,finish } from './e2e-lib.mjs';
const port=Number(process.env.CONTROLS_SMOKE_PORT??4325),results=[];
let browser;
try{
  await startServer(port);browser=await launch();
  for(const spec of [{w:1280,h:720,touch:false},{w:844,h:390,touch:true},{w:390,h:844,touch:true}]){
    const vp=`${spec.w}x${spec.h}`,{context,page}=await newPage(browser,spec);await page.locator('#menu-help-btn').click();
    check(await page.locator('#help-dialog').evaluate(el=>el.open),`${vp}: controls dialog did not open`);
    const initial=spec.touch?'touch':'keyboard';check(await page.locator(`#controls-tab-${initial}`).getAttribute('aria-selected')==='true',`${vp}: wrong default tab`);
    for(const tab of ['keyboard','pad','touch']){
      await page.locator(`#controls-tab-${tab}`).click();check(await page.locator(`#controls-tab-${tab}`).getAttribute('aria-selected')==='true',`${vp}: ${tab} tab is not selected`);
      const headings=await page.locator(`#controls-panel-${tab} h3`).allTextContents();check(JSON.stringify(headings)===JSON.stringify(['Ataque','Defensa','Arquero','Balón parado','Sistema']),`${vp}: ${tab} groups ${headings.join(', ')}`);
      const widths=await page.evaluate(()=>{const d=document.querySelector('#help-dialog');return{dialog:d.scrollWidth<=d.clientWidth+1,tables:[...d.querySelectorAll('table')].every(t=>t.scrollWidth<=t.clientWidth+1),page:document.documentElement.scrollWidth<=innerWidth};});
      check(widths.dialog&&widths.tables&&widths.page,`${vp}: ${tab} has horizontal overflow ${JSON.stringify(widths)}`);
      if(vp==='390x844'){const wrapping=await page.locator(`#controls-panel-${tab} td`).evaluateAll(cells=>cells.every(cell=>{const s=getComputedStyle(cell);return s.wordBreak==='normal'&&s.overflowWrap==='normal'&&s.hyphens==='none';}));check(wrapping,`${vp}: ${tab} permits mid-word breaks`);}
      await page.locator('#help-dialog').evaluate(el=>el.scrollTop=0);await shot(page,'controls',vp,['keyboard','pad','touch'].indexOf(tab)*2+1,`${tab}-top`);
      await page.locator('#help-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);await page.waitForTimeout(50);await shot(page,'controls',vp,['keyboard','pad','touch'].indexOf(tab)*2+2,`${tab}-bottom`);
    }
    const touchText=await page.locator('#controls-panel-touch').innerText();check(touchText.includes('L1 + R2'),`${vp}: touch tab omits keeper combo`);check(touchText.includes('L2'),`${vp}: touch tab omits second taker`);check(!/L3|R3|Cruceta|OPTIONS/.test(touchText),`${vp}: touch tab lists unavailable controls`);
    if(vp==='1280x720'){
      await page.locator('#help-dialog .close').click();await startMatch(page,{mode:'solo'});await page.locator('#menu-btn').click();await page.locator('#pause-controls').click();
      check(await page.locator('#help-dialog').evaluate(el=>el.open),`${vp}: pause controls did not open help`);await page.locator('#help-dialog .close').click();
    }else await page.locator('#help-dialog .close').click();
    await context.close();results.push({viewport:vp,result:'PASS'});
  }
  check(errors.length===0,`browser errors: ${errors.join('; ')}`);writeEvidence('controls',{results,errors});await browser.close();browser=null;stop();finish(0);
}catch(e){errors.push(e.stack||String(e));writeEvidence('controls',{results,errors});await browser?.close();browser=null;stop();finish(1);}
finally{await browser?.close();stop();}

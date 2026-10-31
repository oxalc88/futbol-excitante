import { startServer,stop,launch,newPage,check,shot,writeEvidence,errors,startMatch,finish } from './e2e-lib.mjs';
const port=Number(process.env.CONTROLS_SMOKE_PORT??4325),results=[];
let browser;
const scrollWithPad=async(page,kind,button,axis,dir)=>{const d=page.locator('#help-dialog');await d.evaluate((el,direction)=>el.scrollTop=direction>0?0:el.scrollHeight,dir);const before=await d.evaluate(el=>el.scrollTop);let n=0;while(n<100){if(kind==='dpad')await page.evaluate(([b,p])=>window.__pad.button(0,b,p),[button,true]);else await page.evaluate(([a,v])=>{const axes=[0,0,0,0];axes[a]=v;window.__pad.axes(0,axes);},[axis,dir]);await page.waitForTimeout(120);if(kind==='dpad')await page.evaluate(b=>window.__pad.button(0,b,false),button);else await page.evaluate(()=>window.__pad.axes(0,[0,0,0,0]));await page.waitForTimeout(110);n++;const state=await d.evaluate(el=>({top:el.scrollTop,max:el.scrollHeight-el.clientHeight}));if(dir>0?state.top>=state.max-2:state.top<=2)break;}const state=await d.evaluate(el=>({top:el.scrollTop,max:el.scrollHeight-el.clientHeight}));const rows=await page.locator('#help-dialog [role="tabpanel"]:not([hidden]) tbody tr').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),d=document.querySelector('#help-dialog').getBoundingClientRect();return{top:r.top,bottom:r.bottom,dialogTop:d.top,dialogBottom:d.bottom};}));const visible=dir>0?rows.at(-1)?.bottom<=rows.at(-1)?.dialogBottom:rows[0]?.top>=rows[0]?.dialogTop;check(n<100&&state.max>0&&(dir>0?state.top>=state.max-2:state.top<=2)&&visible,`${kind} ${dir>0?'down':'up'} failed at measured boundary: ${JSON.stringify({before,state,rows:rows.slice(dir>0?-1:0,dir>0?undefined:1),n})}`);return{before,state,visible,presses:n};};
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
      if(vp==='390x844'&&tab==='keyboard'){const corner=await page.locator('#controls-panel-keyboard tr[data-entry-id="cornerAttack"],#controls-panel-keyboard tr[data-entry-id="cornerDefence"]').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('td')].map(td=>({entries:[...td.querySelectorAll('span')].map(span=>span.textContent),cell:td.getBoundingClientRect().toJSON(),lines:[...td.querySelectorAll('span')].map(span=>span.getBoundingClientRect().toJSON())}))));const expected=[[['1 rápido','2 1.er palo','3 en línea','4 2.º palo'],['Num / rápido','Num * 1.er palo','Num - en línea','Num + 2.º palo']],[['1 mixta','3 al hombre','4 zonal'],['Num / mixta','Num - al hombre','Num + zonal']]];check(JSON.stringify(corner.map(row=>row.map(cell=>cell.entries)))===JSON.stringify(expected),`${vp}: corner key entries changed ${JSON.stringify(corner)}`);check(corner.every(row=>row.every(cell=>cell.entries.length===cell.lines.length&&cell.lines.every(line=>Math.abs(line.height)>0&&line.x>=cell.cell.x-1&&line.x+line.width<=cell.cell.x+cell.cell.width+1)&&!cell.entries.some(text=>/[·|]/.test(text)))),`${vp}: corner entries wrap, overflow their cells or contain separators ${JSON.stringify(corner)}`);}
      await page.locator('#help-dialog').evaluate(el=>el.scrollTop=0);await shot(page,'controls',vp,['keyboard','pad','touch'].indexOf(tab)*2+1,`${tab}-top`);
      await page.locator('#help-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);await page.waitForTimeout(50);await shot(page,'controls',vp,['keyboard','pad','touch'].indexOf(tab)*2+2,`${tab}-bottom`);
    }
    const touchText=await page.locator('#controls-panel-touch').innerText();check(touchText.includes('L1 + R2'),`${vp}: touch tab omits keeper combo`);check(touchText.includes('L2'),`${vp}: touch tab omits second taker`);check(!/L3|R3|Cruceta|OPTIONS/.test(touchText),`${vp}: touch tab lists unavailable controls`);
    if(vp==='1280x720'){
      await page.locator('#help-dialog .close').click();await startMatch(page,{mode:'solo'});await page.locator('#menu-btn').click();await page.locator('#pause-controls').click();
      check(await page.locator('#help-dialog').evaluate(el=>el.open),`${vp}: pause controls did not open help`);await page.locator('#help-dialog .close').click();
    }else await page.locator('#help-dialog .close').click();
    if(spec.touch&&['390x844','844x390'].includes(vp)){
      await page.evaluate(()=>window.__pad.connect(0,true));
      for(const origin of ['menu','pause']){
        if(origin==='menu')await page.locator('#menu-help-btn').click();
        if(origin==='pause'){await startMatch(page,{mode:'solo',touch:false});await page.keyboard.press('KeyP');await page.locator('#pause-controls').click();}
        for(const tab of ['keyboard','pad','touch']){
          await page.locator(`#controls-tab-${tab}`).click();
          const records=[];records.push(await scrollWithPad(page,'dpad',13,1,1));records.push(await scrollWithPad(page,'dpad',12,1,-1));records.push(await scrollWithPad(page,'stick',0,1,1));records.push(await scrollWithPad(page,'stick',0,1,-1));
          await page.evaluate(()=>window.__pad.button(0,15,true));await page.waitForTimeout(120);await page.evaluate(()=>window.__pad.button(0,15,false));await page.waitForTimeout(110);const focused=await page.evaluate(()=>document.activeElement?.id);await page.evaluate(()=>window.__pad.button(0,0,true));await page.waitForTimeout(120);await page.evaluate(()=>window.__pad.button(0,0,false));await page.waitForTimeout(110);
          check(await page.locator('#help-dialog').evaluate(el=>el.open),`${vp} ${origin}: A/tab navigation unexpectedly closed Controls`);check(focused?.startsWith('controls-tab-')&&await page.locator(`#${focused}`).getAttribute('aria-selected')==='true',`${vp} ${origin}: virtual left/right + A did not activate focused tab ${focused}`);results.push({viewport:vp,origin,tab,records,activated:focused});
        }
        await page.evaluate(()=>window.__pad.button(0,1,true));await page.waitForTimeout(120);await page.evaluate(()=>window.__pad.button(0,1,false));await page.waitForTimeout(110);check(!(await page.locator('#help-dialog').evaluate(el=>el.open)),`${vp} ${origin}: virtual B did not close Controls`);
      }
    }
    await context.close();results.push({viewport:vp,result:'PASS'});
  }
  check(errors.length===0,`browser errors: ${errors.join('; ')}`);writeEvidence('controls',{results,errors});await browser.close();browser=null;stop();finish(0);
}catch(e){errors.push(e.stack||String(e));writeEvidence('controls',{results,errors});await browser?.close();browser=null;stop();finish(1);}
finally{await browser?.close();stop();}

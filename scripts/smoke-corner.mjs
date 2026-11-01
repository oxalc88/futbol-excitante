import { startServer,stop,launch,newPage,check,shot,writeEvidence,startMatch,errors } from './e2e-lib.mjs';
const port=Number(process.env.CORNER_SMOKE_PORT??4327),results=[];let browser;
const overlap=(p,r,m=0)=>p.x>=r.x-m&&p.x<=r.x+r.w+m&&p.y>=r.y-m&&p.y<=r.y+r.h+m;
const rectOverlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
try{
 await startServer(port);browser=await launch();
 for(const spec of [{w:1280,h:720,touch:false},{w:844,h:390,touch:true},{w:932,h:430,touch:true}]){
  const vp=`${spec.w}x${spec.h}`,{context,page}=await newPage(browser,spec);await startMatch(page,{mode:'solo',touch:spec.touch});
  for(let team=0;team<2;team++)for(const side of [1,-1]){
   const key=`${vp}-t${team}-s${side}`;let state=null,forced=null;
   for(let i=0;i<80;i++){
    const accepted=await page.evaluate(([t,s])=>window.__feSmoke?.setPiece('corner',t,s)??false,[team,side]);
    if(accepted){await page.waitForTimeout(300);state=await page.evaluate(()=>window.__feSmoke?.cornerView?.()??null);forced=await page.evaluate(()=>window.__feSmoke?.setPieceState?.());if(state?.kind==='corner'&&state.team===team&&forced?.restart?.kind==='corner'&&forced.restart.team===team&&Math.sign(forced.restart.point?.y??0)===side)break;}
    await page.waitForTimeout(100);
   }
   if(!state||state.kind!=='corner'||state.team!==team||forced?.restart?.kind!=='corner'||forced.restart.team!==team||Math.sign(forced.restart.point?.y??0)!==side)throw Error(`${key}: forced restart mismatch ${JSON.stringify({state,restart:forced?.restart})}`);
   const inView=p=>p&&p.x>=16&&p.y>=16&&p.x<=spec.w-16&&p.y<=spec.h-16;
   for(let i=0;i<40&&(!inView(state?.ball)||!inView(state?.taker));i++){await page.waitForTimeout(100);state=await page.evaluate(()=>window.__feSmoke?.cornerView?.()??null);}
   const layout=await page.evaluate(()=>{const box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};const visible=el=>!!el&&!el.hidden&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';const pitch=window.__fe?.config?.pitch;return{viewport:box(document.querySelector('#viewport')),blocked:['.scoreboard','.field-toolbar','.topbar','.tp-btn','#radar','.player-card'].flatMap(sel=>[...document.querySelectorAll(sel)].filter(visible).map(el=>({sel,rect:box(el),dodge:el.classList.contains('dodge')})))};});
   const failures=[];for(const part of ['ball','taker']){const p=state?.[part];if(!p){failures.push(`${part} is not projected`);continue;}const v=layout.viewport;if(p.x<v.x+16||p.y<v.y+16||p.x>v.x+v.w-16||p.y>v.y+v.h-16)failures.push(`${part} outside viewport: ${JSON.stringify(p)}`);for(const b of layout.blocked){if((b.sel==='#radar'||b.sel==='.player-card')&&b.dodge)continue;if(overlap(p,b.rect,6))failures.push(`${part} under ${b.sel}: ${JSON.stringify(p)}`);}}
   if(spec.touch){const zone=state.targetZone;if(!zone||![zone.x,zone.y,zone.w,zone.h].every(Number.isFinite)||zone.w<=0||zone.h<=0)failures.push(`penalty-area target zone is missing or invalid: ${JSON.stringify(zone)}`);for(const b of layout.blocked.filter(x=>x.sel==='.tp-btn'))if(zone&&rectOverlap(b.rect,zone))failures.push(`touch button overlaps penalty-area target zone: ${JSON.stringify({button:b.rect,zone})}`);}
   await shot(page,'corner',vp,results.length+1,`t${team}-s${side}`);results.push({viewport:vp,team,side,state,buttonRects:layout.blocked.filter(x=>x.sel==='.tp-btn').map(x=>x.rect),zone:state.targetZone,failures});
   if(team===0&&side===1){
    const radar=page.locator('#radar'),prior=await radar.getAttribute('style');
    const currentPoint=(await page.evaluate(()=>window.__feSmoke?.refreshHud?.()))?.ball??state.ball;
    await radar.evaluate((el,p)=>{el.style.position='fixed';el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;},currentPoint);
    const refresh=await page.evaluate(()=>window.__feSmoke?.refreshHud?.());
    const radarDodged=await page.locator('#radar').evaluate(el=>el.classList.contains('dodge'));
    if(!radarDodged)throw Error(`${key}: controlled overlap did not activate HUD dodge: ${JSON.stringify(refresh)}`);
    if(spec.touch){const r=await page.locator('.tp-square').boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}else await page.keyboard.press('KeyK');
    const transition=await page.waitForFunction(()=>{const phase=window.__fe?.phase,restart=window.__feSmoke?.setPieceState()?.restart;if(phase==='playing'&&(!restart||restart.kind!=='corner'))return{phase,restart};if(restart&&restart.kind!=='corner')return{phase,restart};return false;},null,{timeout:7000});
    const postKick=await transition.jsonValue();
    if(prior===null)await radar.evaluate(el=>el.removeAttribute('style'));else await radar.evaluate((el,s)=>el.setAttribute('style',s),prior);
    await page.waitForFunction(()=>!document.querySelector('#radar').classList.contains('dodge')&&!document.querySelector('.player-card').classList.contains('dodge'),null,{timeout:1000});
    if(!postKick||postKick.restart?.kind==='corner')throw Error(`${key}: kick did not end forced corner: ${JSON.stringify(postKick)}`);
    results.at(-1).postKick=postKick;
   }
   if(failures.length)throw Error(`${key}: ${failures.join('; ')}`);
  }
  await context.close();
 }
 if(errors.length)throw Error(`browser errors: ${errors.join('; ')}`);
}catch(e){results.push({fatal:e.message});console.error(e.stack||e)}finally{await browser?.close();stop();writeEvidence('corner',{results,errors});}
console.log(`corner-e2e: cases=${results.filter(x=>!x.fatal).length} failures=${results.reduce((n,x)=>n+(x.failures?.length??0),0)} errors=${errors.length}`);process.exit(results.some(x=>x.fatal)||errors.length?1:0);

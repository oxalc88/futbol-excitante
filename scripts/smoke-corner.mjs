import { startServer,stop,launch,newPage,check,shot,writeEvidence,startMatch,errors } from './e2e-lib.mjs';
const port=Number(process.env.CORNER_SMOKE_PORT??4327),results=[];let browser;
const overlap=(p,r,m=0)=>p.x>=r.x-m&&p.x<=r.x+r.w+m&&p.y>=r.y-m&&p.y<=r.y+r.h+m;
try{
 await startServer(port);browser=await launch();
 for(const spec of [{w:1280,h:720,touch:false},{w:844,h:390,touch:true},{w:932,h:430,touch:true}]){
  const vp=`${spec.w}x${spec.h}`,{context,page}=await newPage(browser,spec);await startMatch(page,{mode:'solo',touch:spec.touch});
  for(let team=0;team<2;team++)for(const side of [1,-1]){
   const key=`${vp}-t${team}-s${side}`;let state=null;
   for(let i=0;i<80;i++){const accepted=await page.evaluate(([t,s])=>window.__feSmoke?.setPiece('corner',t,s)??false,[team,side]);if(accepted){state=await page.evaluate(()=>window.__feSmoke?.cornerView?.()??null);if(state?.ball&&state?.taker)break;}await page.waitForTimeout(100);}
   await page.waitForTimeout(300);state=await page.evaluate(()=>window.__feSmoke?.cornerView?.()??null);
   const forced=await page.evaluate(()=>window.__feSmoke?.setPieceState?.());
   if(!state||state.kind!=='corner'||state.team!==team||forced?.restart?.kind!=='corner'||forced.restart.team!==team||Math.sign(forced.restart.point?.y??0)!==side)throw Error(`${key}: forced restart mismatch ${JSON.stringify({state,restart:forced?.restart})}`);
   const layout=await page.evaluate(()=>{const box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};const visible=el=>!!el&&!el.hidden&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';return{viewport:box(document.querySelector('#viewport')),blocked:['.scoreboard','.field-toolbar','.topbar','.tp-btn','#radar','.player-card'].flatMap(sel=>[...document.querySelectorAll(sel)].filter(visible).map(el=>({sel,rect:box(el),dodge:el.classList.contains('dodge')})))};});
   const failures=[];for(const part of ['ball','taker']){const p=state?.[part];if(!p){failures.push(`${part} is not projected`);continue;}const v=layout.viewport;if(p.x<v.x+16||p.y<v.y+16||p.x>v.x+v.w-16||p.y>v.y+v.h-16)failures.push(`${part} outside viewport: ${JSON.stringify(p)}`);for(const b of layout.blocked){if((b.sel==='#radar'||b.sel==='.player-card')&&b.dodge)continue;if(overlap(p,b.rect,6))failures.push(`${part} under ${b.sel}: ${JSON.stringify(p)}`);}}
   await shot(page,'corner',vp,results.length+1,`t${team}-s${side}`);results.push({viewport:vp,team,side,state,failures});
   if(team===0&&side===1){
    const card=page.locator('.player-card'),prior=await card.getAttribute('style');
    const pt=state.ball;await card.evaluate((el,p)=>{const v=document.querySelector('#viewport').getBoundingClientRect();el.style.position='absolute';el.style.left=`${p.x-v.x}px`;el.style.top=`${p.y-v.y}px`;},pt);
    await page.waitForFunction(()=>document.querySelector('.player-card').classList.contains('dodge'),{timeout:1000});
    if(spec.touch){const r=await page.locator('.tp-square').boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}else await page.keyboard.press('KeyK');
    await page.waitForFunction(()=>window.__fe?.phase==='playing'&&window.__feSmoke?.setPieceState()?.restart===null,{timeout:7000});
    await page.waitForFunction(()=>!document.querySelector('#radar').classList.contains('dodge')&&!document.querySelector('.player-card').classList.contains('dodge'),{timeout:1000});
    const after=await page.evaluate(()=>({phase:window.__fe?.phase,restart:window.__feSmoke?.setPieceState()?.restart}));if(after.phase!=='playing'||after.restart)throw Error(`${key}: kick did not end forced corner: ${JSON.stringify(after)}`);
    if(prior===null)await card.evaluate(el=>el.removeAttribute('style'));else await card.evaluate((el,s)=>el.setAttribute('style',s),prior);
   }
   if(failures.length)throw Error(`${key}: ${failures.join('; ')}`);
  }
  await context.close();
 }
 if(errors.length)throw Error(`browser errors: ${errors.join('; ')}`);
}catch(e){results.push({fatal:e.message});console.error(e.stack||e)}finally{await browser?.close();stop();writeEvidence('corner',{results,errors});}
console.log(`corner-e2e: cases=${results.filter(x=>!x.fatal).length} failures=${results.reduce((n,x)=>n+(x.failures?.length??0),0)} errors=${errors.length}`);process.exit(results.some(x=>x.fatal)||errors.length?1:0);

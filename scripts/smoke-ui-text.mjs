import { chromium, startServer, stop, newPage, shot, startMatch, errors as browserErrors } from './e2e-lib.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const port=Number(process.env.UI_TEXT_SMOKE_PORT??4326),base=await startServer(port),lists=JSON.parse(readFileSync(new URL('./ui-text-allowlist.json',import.meta.url),'utf8'));
const errors=browserErrors;let browser;const results=[];const norm=s=>s.replace(/\s+/g,' ').trim();
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 for(const [w,h,touch] of [[1280,720,false],[844,390,true]]){
  const {context,page}=await newPage(browser,{w,h,touch});await page.goto(base,{waitUntil:'networkidle'});
  const teams=await page.locator('#home-team option').allTextContents();
  const collect=async(root,name)=>page.locator(root).evaluate((el,name)=>{const visible=x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};const out=[];const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);while(walk.nextNode()){const n=walk.currentNode,p=n.parentElement;if(!p||!visible(p)||!n.textContent.trim())continue;const closed=p.closest('details:not([open])');if(closed&&!p.closest('summary'))continue;if(name.startsWith('controls')&&p.closest('table'))continue;out.push(n.textContent)}return out},name);
  const capture=async(name,root)=>{const values=await collect(root,name);const inherited=name==='menu-plan'?lists.menu:name==='menu-options'?[...lists.menu,...lists['menu-plan']]:name==='pause-confirm'?lists.pause:[];const statTitle=name==='stats'?await page.locator('#result-title').innerText():'';const dynamic=name==='match'?await page.locator('#viewport').evaluate(el=>['#home-short','#away-short','#score','#clock','#half','#player-name','#announcement','#phase','#match-mode','#pad-status'].map(s=>document.querySelector(s)?.textContent??'')):name==='fulltime'?[await page.locator('#ft-home').innerText(),await page.locator('#ft-away').innerText(),await page.locator('#ft-score').innerText()]:name==='stats'?['×',statTitle,...await page.locator('#stats-content').locator('span').allTextContents()].filter(x=>/^[\d%/]+$/.test(norm(x))||x==='×'||x===statTitle) :[];const allowed=new Set([...(lists[name]??[]),...inherited,...teams,...dynamic].map(norm));const bad=values.map(norm).filter(x=>x&&!allowed.has(x));if(bad.length)throw Error(`${name} ${w}x${h}: unlisted text ${JSON.stringify(bad)}`);const all=values.join(' ');if(/A la cancha|Semilla|JSON|Choose File|No file chosen|prototipo|STUN/.test(all))throw Error(`${name}: forbidden text`);results.push({name,w,h});await shot(page,'ui-text',`${w}x${h}`,results.length,name);};
  // Verify visible summaries and non-table Controls text are scanned.
  await page.evaluate(()=>{const s=document.querySelector('.tactics summary'),span=document.createElement('span'),p=document.createElement('p');span.textContent='AYUDA NO PERMITIDA';s.append(span);p.id='ui-text-probe';p.textContent='AYUDA NO PERMITIDA';document.querySelector('#help-dialog').append(p);document.querySelector('#help-dialog').showModal();});
  const summaryProbe=await collect('#setup-dialog','menu');if(!summaryProbe.some(x=>x.includes('AYUDA NO PERMITIDA')))throw Error('visible summary mutation escaped text scanner');
  const paragraphProbe=await collect('#help-dialog','controls-chrome');if(!paragraphProbe.some(x=>x.includes('AYUDA NO PERMITIDA')))throw Error('non-table Controls mutation escaped text scanner');
  if((lists.menu??[]).includes('AYUDA NO PERMITIDA')||(lists['controls-chrome']??[]).includes('AYUDA NO PERMITIDA'))throw Error('mutation probe unexpectedly allowed');
  await page.evaluate(()=>{document.querySelector('.tactics summary span')?.remove();document.querySelector('#ui-text-probe')?.remove();document.querySelector('#help-dialog').close();});
  const common=await page.evaluate(()=>({title:document.title,online:document.querySelectorAll('#online-dialog').length,h1:document.querySelectorAll('#setup-dialog h1').length}));if(common.title!=='Fútbol Excitante'||common.online||common.h1)throw Error(`setup chrome invalid: ${JSON.stringify(common)}`);
  await capture('menu','#setup-dialog');
  await page.locator('.tactics summary').click();await capture('menu-plan','#setup-dialog');await page.locator('.options summary').click();await capture('menu-options','#setup-dialog');
  await page.locator('#menu-help-btn').click();await capture('controls-chrome','#help-dialog');await page.locator('[data-close="help-dialog"]').click();
  await page.locator('.options').evaluate(el=>el.open=false);await page.locator('.tactics').evaluate(el=>el.open=false);
  await startMatch(page,{mode:'solo',touch});await capture('match','#viewport');
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(100);await capture('pause','#pause-overlay');await page.locator('#pause-quit').click();await capture('pause-confirm','#pause-overlay');await page.keyboard.press('Escape');await page.keyboard.press('KeyP');await page.waitForFunction(()=>window.__fe?.paused===false,{timeout:3000});
  const ft=await page.evaluate(()=>window.__feSmoke?.toFulltime());if(!ft)throw Error('Fulltime hook failed');await page.waitForFunction(()=>window.__fe?.phase==='fulltime'&&document.querySelector('#fulltime-dialog').open,{timeout:5000});await capture('fulltime','#fulltime-dialog');await page.locator('#ft-stats').click();await capture('stats','#stats-dialog');
  await context.close();
 }
}catch(e){errors.push(e.message)}finally{await browser?.close();stop();mkdirSync('artifacts/local/smoke',{recursive:true});writeFileSync('artifacts/local/smoke/ui-text.json',JSON.stringify({results,errors},null,2)+'\n');}
for(const e of errors)console.error(e);console.log(`ui-text-e2e: screens=${results.length} errors=${errors.length}`);process.exit(errors.length?1:0);

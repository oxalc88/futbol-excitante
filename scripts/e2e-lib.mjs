import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname } from 'node:path';

const require=createRequire(process.env.PLAYWRIGHT_CORE_DIR?`${process.env.PLAYWRIGHT_CORE_DIR}/`:import.meta.url);
export const {chromium}=require('playwright-core');
export const errors=[];
let server=null,checks=0,base='http://127.0.0.1:4323';
export async function startServer(port){
  const busy=await new Promise(resolve=>{const s=connect({host:'127.0.0.1',port,timeout:1000});s.once('connect',()=>{s.destroy();resolve(true);});s.once('timeout',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));});
  if(busy)throw new Error(`Port ${port} is already in use`);
  base=`http://127.0.0.1:${port}`;server=spawn('npx',['vite','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',detached:true});
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('Vite preview stopped before it was ready');try{const r=await fetch(base);if(r.ok)return base;}catch{}await new Promise(r=>setTimeout(r,100));}
  throw new Error('Vite preview did not start');
}
export function stop(){if(server&&!server.killed){try{process.kill(-server.pid,'SIGTERM');}catch{}server=null;}}
export async function launch(){return chromium.launch({executablePath:process.env.CHROME_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});}
export async function newPage(browser,{w,h,touch}){
  const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:touch,isMobile:touch});
  await context.addInitScript(()=>{
    try{localStorage.setItem('fe.tipsSeen','1');}catch{}
    window.__fakePads=Array.from({length:4},(_,index)=>({id:`Fake standard ${index}`,index,connected:false,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0,touched:false})),timestamp:0}));
    Object.defineProperty(navigator,'getGamepads',{value:()=>window.__fakePads.map(p=>p.connected?p:null)});
    window.__pad={connect(slot,connected){const p=window.__fakePads[slot];p.connected=connected;p.timestamp=performance.now();const event=new Event(connected?'gamepadconnected':'gamepaddisconnected');Object.defineProperty(event,'gamepad',{value:p});window.dispatchEvent(event);},button(slot,button,pressed){const p=window.__fakePads[slot];p.buttons[button]={pressed,value:Number(pressed),touched:pressed};p.timestamp=performance.now();},axes(slot,axes){const p=window.__fakePads[slot];p.axes=[...axes];p.timestamp=performance.now();}};
  });
  const page=await context.newPage();page.setDefaultTimeout(5000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource'))errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`HTTP ${r.status()} ${r.url()}`);});
  page.on('requestfailed',r=>{if(!r.url().endsWith('/favicon.ico'))errors.push(`Request failed: ${r.url()}`);});
  await page.goto(base);
  return {context,page};
}
export function check(cond,msg){checks++;if(!cond)throw new Error(msg);}
export async function shot(page,suite,vp,nn,name){
  const {mkdirSync}=await import('node:fs');const {join}=await import('node:path');
  const file=`${vp}-${String(nn).padStart(2,'0')}-${name}.png`;const local=`artifacts/local/${suite}`;mkdirSync(local,{recursive:true});await page.screenshot({path:join(local,file)});
  if(process.env.FE_SHOTS_DIR){mkdirSync(process.env.FE_SHOTS_DIR,{recursive:true});copyFileSync(join(local,file),join(process.env.FE_SHOTS_DIR,`${suite}-${file}`));}
}
export function writeEvidence(suite,data){mkdirSync('artifacts/local/smoke',{recursive:true});writeFileSync(`artifacts/local/smoke/${suite}.json`,`${JSON.stringify(data,null,2)}\n`);}
export async function startMatch(page,{mode='solo',touch=false}){
  await page.evaluate(()=>{try{localStorage.setItem('fe.tipsSeen','1');}catch{}});
  await page.locator('.tactics summary').click();await page.locator('#mode').selectOption(mode);await page.locator('#quality').selectOption('low');await page.locator('#start-btn').click();
  if(touch){const r=await page.locator('#viewport').boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);for(let i=0;i<100;i++){if(await page.evaluate(()=>window.__fe?.phase==='playing'))break;const b=await page.locator('.tp-cross').boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(100);}}
  else for(let i=0;i<100;i++){if(await page.evaluate(()=>window.__fe?.phase==='playing'))break;await page.keyboard.press('KeyJ');await page.waitForTimeout(100);}
  await page.waitForFunction(()=>window.__fe?.phase==='playing',{timeout:10000});
}
export async function visibleTexts(page,rootSelector='body',allowSelector=''){return page.evaluate(({rootSelector,allowSelector})=>{const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};const root=document.querySelector(rootSelector);if(!root)return[];const out=[];const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode,el=n.parentElement;if(!el||!visible(el)||!n.textContent.trim()||(allowSelector&&el.closest(allowSelector)))continue;out.push(n.textContent.trim());}return out;},{rootSelector,allowSelector});}
export async function rectOf(page,sel){return page.locator(sel).evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};});}
export function inside(a,b){return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;}
export function overlap(a,b){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}
export function finish(code){console.log(`checks=${checks} errors=${errors.length}`);process.exit(code);}

import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
export function fixture(legacy=false){
  const dir=mkdtempSync(join(tmpdir(),'gauntlet012-')),root=join(dir,'repo'),bin=join(dir,'bin'),repo=process.cwd();mkdirSync(root);mkdirSync(bin);
  const write=(p:string,text:string)=>{mkdirSync(join(root,p,'..'),{recursive:true});writeFileSync(join(root,p),text);};
  let published=false;
  const git=(...args:string[])=>{const result=execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:'pipe'}).trim();if(published&&args[0]==='commit')execFileSync('git',['push','origin','main'],{cwd:root,stdio:'pipe'});return result;};
  git('init','-b','main');git('config','user.name','test');git('config','user.email','test@example.com');
  write('.gitignore','node_modules/\n.delivery-local/\nartifacts/\n');
  if(!legacy)write('gauntlet/incidents/legacy-import.json',JSON.stringify({schema_version:1,recorded_at:new Date().toISOString(),imports:[]}));
  write('gauntlet/VERSION.json','{"version":"0.13.0"}');write('mise.toml',`[tools]\nnode = "${process.versions.node}"\npnpm = "11.10.0"\n`);write('package.json','{"type":"module","packageManager":"pnpm@11.10.0","scripts":{"build":"vite build","test":"node scripts/ci/transport.mjs && vitest run --project node"}}');
  write('pnpm-lock.yaml','importers:\n\n  .:\n    devDependencies:\n      vite:\n        specifier: ^6.3.5\n        version: 6.4.3\n\npackages:\n');write('node_modules/vite/package.json','{"version":"6.4.3"}');
  write('src/apps/browser/styles.css','before');write('src/main.ts','');write('index.html','<script src="/src/main.ts"></script>');write('vite.config.ts','');write('vitest.config.ts',"import './scripts/ci/transport.mjs';\n");
  write('tests/unit/gauntlet-fixture.test.ts','');write('tests/browser/game.browser.test.ts','');
  write('scripts/ci/transport.mjs','process.exit(1);\n');
  write('scripts/ci/test-gauntlet-telemetry.mjs','console.log("PASS");');
  write('gauntlet/state/HORIZON.md','horizon_version: 39\nobjectives:\n  - id: PLAYER-A\n    status: pending\n  - id: PLAYER-B\n    status: pending\n');
  writeFileSync(join(bin,'pnpm'),`#!/usr/bin/env node
const fs=require('fs'),path=require('path'),a=process.argv.slice(2);if(a[0]==='--version'){console.log('11.10.0');process.exit(0);}
fs.mkdirSync('.delivery-local',{recursive:true});fs.appendFileSync('.delivery-local/calls',a.join(' ')+'\\n');
const test=a.includes('vitest')||a.join(' ').startsWith('run test'),mode=fs.existsSync('.delivery-local/mode')?fs.readFileSync('.delivery-local/mode','utf8'):'pass';
if(test){const browser=a.includes('browser')||a.includes('test-browser');const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);let files=walk('tests').filter(p=>p.endsWith('.test.ts')&&(browser?p.startsWith('tests/browser/'):!p.startsWith('tests/browser/')));const filters=a.filter(p=>p.startsWith('tests/'));if(filters.length)files=files.filter(p=>filters.some(f=>p.includes(f)));const fail=mode==='product'&&!browser,worker=(a.includes('test')||mode==='scoped-worker')&&(mode==='unknown'||['worker','scoped-worker'].includes(mode)&&require('child_process').spawnSync(process.execPath,['scripts/ci/transport.mjs']).status!==0);const report={success:!fail&&!worker,numFailedTests:fail?1:0,numRuntimeErrorTestSuites:worker?1:0,testResults:files.map(p=>({name:path.resolve(p),status:fail?'failed':'passed',assertionResults:[{status:fail?'failed':'passed'}]}))};const out=a.find(p=>p.startsWith('--outputFile.json='));if(out)fs.writeFileSync(out.split('=').slice(1).join('='),JSON.stringify(report));if(fail){console.error('AssertionError: regression');process.exit(1);}if(worker){console.error(mode==='unknown'?'Error: process timeout; no attribution':'[vitest-worker] Timeout calling "onTaskUpdate"');process.exit(1);}}
console.log('PASS');
`,{mode:0o755});
  git('add','.');git('commit','-m','base');
  const remote=join(dir,'remote.git');execFileSync('git',['init','--bare',remote],{stdio:'pipe'});git('remote','add','origin',remote);git('push','--set-upstream','origin','main');published=true;
  const cli=(...args:string[])=>spawnSync(process.execPath,['--import',join(repo,'node_modules/tsx/dist/loader.mjs'),join(repo,'scripts/gauntlet/product-quality.ts'),...args],{cwd:root,encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`}});
  const control=(...args:string[])=>spawnSync(process.execPath,['--import',join(repo,'node_modules/tsx/dist/loader.mjs'),join(repo,'scripts/gauntlet/control.ts'),...args],{cwd:root,encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`}});
  const json=(p:string)=>JSON.parse(readFileSync(join(root,p),'utf8'));
  return {dir,root,write,git,cli,control,json,calls:()=>readFileSync(join(root,'.delivery-local/calls'),'utf8').trim().split('\n')};
}

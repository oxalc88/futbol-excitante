import { mappedLoopGameplay, mappedInputGameplay, mappedGameplayModule } from './simulation-impact.js';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, relative, posix } from 'node:path';
import { createRequire } from 'node:module';
let compiler: typeof import('typescript') | undefined;
const typescript = () => compiler ??= createRequire(import.meta.url)('typescript') as typeof import('typescript');
import { qualityPlan, DOMAIN_TESTS, type QualityPlan, type QualityCheck } from './product-quality.js';

export const QUALITY_PROTOCOL = 'gauntlet-quality-0.12.0';
export const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export const digest = (value: unknown) => hash(JSON.stringify(value));
export interface Snapshot { files: string[]; read(path: string): Buffer | null }
export function snapshot(root: string, commit?: string): Snapshot {
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const files = [...new Set((commit ? git('ls-tree', '-r', '--name-only', commit) : git('ls-files', '--cached', '--others', '--exclude-standard')).trim().split('\n').filter(Boolean))].sort();
  const cache = new Map<string, Buffer | null>();
  if (commit && files.length) {
    const rows = git('ls-tree', '-r', commit).trim().split('\n').map(row => { const [meta, path] = row.split('\t'); return { path: path!, sha: meta!.split(' ')[2]! }; });
    const bytes = execFileSync('git', ['-C', root, 'cat-file', '--batch'], { input: rows.map(r => r.sha).join('\n')+'\n', maxBuffer: 256 * 1024 * 1024 });
    let offset = 0;
    for (const row of rows) { const end = bytes.indexOf(10, offset); const size = Number(bytes.subarray(offset, end).toString().split(' ')[2]); if (!Number.isSafeInteger(size)) throw new Error('invalid git snapshot'); offset = end+1; cache.set(row.path, bytes.subarray(offset, offset+size)); offset += size+1; }
  }
  const read = (path: string) => {
    if (!files.includes(path) || path.includes('..') || path.startsWith('/')) return null;
    if (!cache.has(path)) {
      try { const actual = realpathSync(resolve(root, path)); if (relative(realpathSync(root), actual).startsWith('..')) throw new Error('snapshot symlink escapes repository'); cache.set(path, readFileSync(actual)); }
      catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') cache.set(path, null); else throw e; }
    }
    return cache.get(path)!;
  };
  return { files: files.filter(p => read(p) !== null), read };
}
export const nodeTest = (p: string) => /^tests\/.*\.test\.ts$/.test(p) && !p.startsWith('tests/browser/') && !p.endsWith('.browser.test.ts');
export const browserTest = (p: string) => /^tests\/browser\/.*\.test\.ts$/.test(p);
export const verificationArtifact = (p: string) => /^docs\/evidence\/[A-Za-z0-9._-]+\/verification\/[A-Za-z0-9._-]+\.(?:json|log\.gz|report\.json\.gz)$/.test(p);
export const bookkeeping = (p: string) => /^gauntlet\/(?:state\/|certification\/|incidents\/|execution\/|trajectory\/horizons\/|evals\/results\/)/.test(p);
const baseline = ['tests/architecture/', 'tests/candidate-scope.node.test.ts', 'tests/unit/gauntlet-'];
const maintenance = /^(?:gauntlet\/|scripts\/gauntlet\/|\.grok\/|\.omp\/|\.opencode\/|tests\/unit\/gauntlet-[^/]+\.test\.ts$)/;
export const unitArtifact=(p:string)=>/^docs\/evidence\/[A-Za-z0-9._-]+\/units\/[A-Za-z0-9._-]+\/(?:handoff\.(?:md|json)|local-quality\.json)$/.test(p);
const artifact = /^docs\/(?:evidence|screenshots)\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.(?:json|png|jpg|jpeg|webp|md)$/;
const leaf = /^(?:src\/apps\/browser\/(?:styles\.css|controls-legend-ui\.ts)|docs\/(?:player-controls|how-to-play)\.md)$/;

function affectedTests(source: Snapshot, changed: Set<string>): { files: string[]; ambiguous: boolean } {
  const inventory = new Set(source.files), edges = new Map<string, string[]>(); let ambiguous = false;
  const aliases: Record<string,string> = { '@pes/contracts':'src/contracts/index.ts', '@pes/simulation':'src/simulation/index.ts', '@pes/adapters/':'src/adapters/', '@pes/apps/':'src/apps/', '@pes/eval/':'eval/' };
  const deps = (file: string): string[] => {
    if (edges.has(file)) return edges.get(file)!;
    const result: string[] = []; edges.set(file,result);
    if (!/\.[cm]?[jt]sx?$/.test(file)) return result;
    const code = source.read(file)!.toString();
    if (/\b(?:import|require)\s*\(\s*[^'"\s]/.test(code)) ambiguous = true;
    for (const imported of typescript().preProcessFile(code,true,true).importedFiles) {
      let path: string | undefined; const name = imported.fileName;
      if (name.startsWith('.')) path = posix.normalize(posix.join(posix.dirname(file),name));
      else if (name.startsWith('@pes/')) { const alias = Object.keys(aliases).find(a=>a.endsWith('/')?name.startsWith(a):a===name); if (alias) path=aliases[alias]!+name.slice(alias.length); else ambiguous=true; }
      else continue;
      if (path) { const stem=path.replace(/\.[cm]?js$/,''); const found=[path,stem+'.ts',stem+'.tsx',stem+'/index.ts',stem+'.json'].find(p=>inventory.has(p)); if(found)result.push(found); else ambiguous=true; }
    }
    return result;
  };
  const touches=(file:string, seen=new Set<string>()):boolean=>{ if(changed.has(file))return true; if(seen.has(file))return false; seen.add(file); return deps(file).some(p=>touches(p,seen)); };
  const appChanged=[...changed].some(p=>p.startsWith('src/'));
  const files=source.files.filter(nodeTest).filter(file=>{
    if(baseline.some(prefix=>file.startsWith(prefix)))return true;
    const hit=touches(file); const opaque=appChanged && /node:fs|node:child_process|readFile|import\.meta\.glob/.test(source.read(file)!.toString());
    return hit || opaque || baseline.some(prefix=>file.startsWith(prefix));
  });
  return { files, ambiguous };
}
export interface ScopedPlan extends Omit<QualityPlan,'schema_version'> {
  schema_version: 2;
  proof_scope: 'objective' | 'certification';
  full_required: boolean;
  expected_tests: Record<string,string[]>;
}
export function scopedPlan(paths:string[], before:Snapshot, after:Snapshot, elevated=false, architecture=false, certification=false,integrated=false):ScopedPlan {
  const productFirst = [before, after].some(s => { try { return Number(JSON.parse(s.read('gauntlet/VERSION.json')!.toString()).version.split('.')[1]) >= 13; } catch { return false; } });
  const impactPaths=paths.filter(p=>(!nodeTest(p)||p.startsWith('tests/architecture/')||p.startsWith('tests/unit/gauntlet-'))&&!(productFirst&&unitArtifact(p)));
  const inputMapped=productFirst&&paths.includes('src/simulation/input/input-system.ts')&&mappedInputGameplay(before,after);
  const loopMapped=productFirst&&paths.includes('src/simulation/loop/simulation.ts')&&mappedLoopGameplay(before,after);
  const mappedPaths=loopMapped?impactPaths.map(p=>p==='src/simulation/loop/simulation.ts'?'src/simulation/input/input-system.ts':p):impactPaths;
  const moduleRisk=productFirst&&paths.some(p=>/^src\/simulation\/(?:(?:ball|locomotion|contacts|player-contact)\/|(?:foul-predicate|card-policy|advantage-policy)\.ts$)/.test(p)&&!mappedGameplayModule(p,before,after));
  const legacy=qualityPlan(mappedPaths.length?mappedPaths:paths.length?paths:['gauntlet/runtime/product-quality.ts'],elevated,architecture,loopMapped||inputMapped);
  if(moduleRisk)legacy.reasons.push('mapped simulation module public/import/global surface or protected/dynamic behavior changed; full verification required');
  if(loopMapped)legacy.reasons.push('simulation loop: only allowlisted gameplay helper bodies changed; stepping/clock/public declarations unchanged');
  if(inputMapped)legacy.reasons.push('input system: gameplay selection helper bodies only; scheduler, duplicate policy and public contracts unchanged');
  if(integrated)legacy.reviews_required=true;
  legacy.changed_paths=[...new Set(paths)].sort();
  const substantive=paths.filter(p=>!artifact.test(p)&&!verificationArtifact(p)&&!(productFirst&&unitArtifact(p)));
  const integrity=productFirst&&substantive.some(p=>/^gauntlet\/(?:runtime\/|evals\/(?:src|contracts)\/)|^scripts\/gauntlet\/(?:product-quality|control)\.ts$/.test(p));
  const gauntletOnly=!integrity&&substantive.length>0&&substantive.every(p=>maintenance.test(p))&&!elevated&&!architecture;
  const trivial=substantive.length>0&&substantive.every(p=>leaf.test(p))&&!elevated&&!architecture;
  const known=legacy.protected_properties.every(p=>!['ambiguous','determinism','architecture','assurance','replay','persistence','elevated_regression_risk'].includes(p));
  let full=certification || moduleRisk || (!gauntletOnly && !trivial && !known), selected:string[]=[];
  if(!full) {
    if(gauntletOnly||trivial)selected=after.files.filter(nodeTest).filter(p=>baseline.some(prefix=>p.startsWith(prefix)));
    else { const a=affectedTests(before,new Set(paths)),b=affectedTests(after,new Set(paths)); full=a.ambiguous||b.ambiguous; selected=[...new Set([...a.files,...b.files])].filter(p=>after.files.includes(p)).sort(); }
  }
  if(!selected.length)full=true;
  const regression:QualityCheck={id:'regression-tests',command:full?['pnpm','run','test']:['pnpm','exec','vitest','run',...selected,'--project','node','--passWithNoTests=false','--no-file-parallelism']};
  const checks=legacy.checks.map(c=>c.id===regression.id?regression:c).filter(c=>!c.id.startsWith('domain:') && !(gauntletOnly&&!certification&&(c.id==='browser-tests'||c.id==='sim-smoke')));
  if(certification&&!checks.some(c=>c.id==='sim-smoke'))checks.push({id:'sim-smoke',command:['pnpm','run','sim-smoke']});
  // A complete Node run covers exact domain membership. Scoped objectives retain
  // deeper domain checks and their expected file inventories explicitly.
  if(!full&&!gauntletOnly)for(const suite of legacy.suite_ids)checks.push({id:`domain:${suite}`,command:['pnpm','exec','vitest','run',...(DOMAIN_TESTS[suite]??['tests/unit/eval']),'--project','node','--passWithNoTests=false']});
  if(gauntletOnly||certification)checks.push({id:'parallel-policy',command:['pnpm','run','gauntlet:parallel:test']},{id:'runtime-telemetry',command:['node','scripts/ci/test-gauntlet-telemetry.mjs']});
  const expected_tests:Record<string,string[]>={};
  for(const c of checks){ if(c.id==='regression-tests')expected_tests[c.id]=full?after.files.filter(nodeTest):selected; else if(c.id==='browser-tests')expected_tests[c.id]=after.files.filter(browserTest); else if(c.id.startsWith('domain:'))expected_tests[c.id]=after.files.filter(nodeTest).filter(p=>(DOMAIN_TESTS[c.id.slice(7)]??['tests/unit/eval']).some(prefix=>p.includes(prefix))); }
  return {...legacy,schema_version:2,proof_scope:certification?'certification':'objective',full_required:full,checks,expected_tests,reasons:[...legacy.reasons,full?'complete repository regression coverage required':'mapped affected coverage plus contract/architecture baseline']};
}
function dependencyInputs(source:Snapshot,roots:string[]):Set<string>|null {
  const inventory=new Set(source.files),seen=new Set<string>();
  const aliases:Record<string,string>={'@pes/contracts':'src/contracts/index.ts','@pes/simulation':'src/simulation/index.ts','@pes/adapters/':'src/adapters/','@pes/apps/':'src/apps/','@pes/eval/':'eval/'};
  let ambiguous=false;
  const visit=(file:string)=>{
    if(seen.has(file))return;seen.add(file);
    if(!inventory.has(file)){ambiguous=true;return;}
    if(!/\.[cm]?[jt]sx?$/.test(file))return;
    const text=source.read(file)!.toString();
    if(/(?:node:fs|readFile|import\.meta\.glob|\b(?:import|require)\s*\(\s*[^'"\s])/.test(text)){ambiguous=true;return;}
    for(const imported of typescript().preProcessFile(text,true,true).importedFiles){
      const name=imported.fileName;let path:string|undefined;
      if(name.startsWith('.'))path=posix.normalize(posix.join(posix.dirname(file),name));
      else if(name.startsWith('@pes/')){const alias=Object.keys(aliases).find(a=>a.endsWith('/')?name.startsWith(a):name===a);if(alias)path=aliases[alias]!+name.slice(alias.length);else ambiguous=true;}
      else continue;
      if(path){const stem=path.replace(/\.[cm]?js$/,'');const p=[path,stem+'.ts',stem+'.tsx',stem+'/index.ts',stem+'.json'].find(p=>inventory.has(p));if(p)visit(p);else ambiguous=true;}
    }
  };
  roots.forEach(visit);return ambiguous?null:seen;
}
export function inputKey(check:QualityCheck,source:Snapshot,profile:unknown,receiptPath:string,expected:string[]):string {
  const shared=source.files.filter(p=>/^(?:package\.json|pnpm-lock\.yaml|mise\.toml|(?:tsconfig|vite|vitest)[^/]*|gauntlet\/runtime(?:\/|\-policy\.json)|scripts\/gauntlet\/product-quality\.ts)/.test(p));
  let selected:Set<string>|null=null;
  if(check.id==='typecheck') {
    // Compiler configuration excludes tests. Bind every compilation root and
    // conservatively include tests if any source imports them.
    const roots=source.files.filter(p=>/^(?:src\/|eval\/|gauntlet\/runtime\/|scripts\/gauntlet\/|\.omp\/extensions\/)/.test(p));
    selected=new Set([...roots,...shared]);
    if(roots.some(p=>/from\s*['"][^'"]*tests\//.test(source.read(p)!.toString())))selected=null;
  } else if(check.id==='build') {
    const pkg=JSON.parse(source.read('package.json')?.toString()??'{}');
    if(pkg.scripts?.build==='vite build') {
      const html=source.read('index.html')?.toString()??'';
      const roots=[...html.matchAll(/<script[^>]+src=["']\/?([^"']+)["']/g)].map(m=>m[1]!);
      const closure=dependencyInputs(source,[...roots,...source.files.filter(p=>/^vite\.config\.[cm]?[jt]s$/.test(p))]);
      if(roots.length&&closure)selected=new Set([...closure,...shared,...source.files.filter(p=>p.startsWith('public/')||p==='index.html')]);
    }
  } else if(check.id==='browser-tests') {
    const closure=dependencyInputs(source,source.files.filter(browserTest));
    if(closure)selected=new Set([...closure,...shared,...source.files.filter(p=>/^(?:src\/|eval\/|public\/|index\.html$)/.test(p))]);
  }
  // Unknown file/data/dynamic dependencies retain a whole-tree key. Never infer
  // equivalence from changed-file lists or an LLM-provided impact label.
  const productFirst=Number(JSON.parse(source.read('gauntlet/VERSION.json')?.toString()??'{}').version?.split('.')[1])>=13;
  const inputs=source.files.filter(p=>(!selected||selected.has(p))&&p!==receiptPath&&!(productFirst&&p.startsWith('gauntlet/execution/'))&&!verificationArtifact(p)&&!p.startsWith('gauntlet/certification/')&&!p.startsWith('gauntlet/incidents/')&&!/^docs\/evidence\/CERT-[A-Za-z0-9._-]+\/quality\.json$/.test(p)).map(p=>[p,hash(source.read(p)!)]);
  return digest({protocol:QUALITY_PROTOCOL,command:check.command,expected,profile,inputs});
}

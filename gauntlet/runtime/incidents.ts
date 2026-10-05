import { createRequire } from 'node:module';
import { validateCheckProof, validateScopedProofs, type ProvenResult } from './check-proof.js';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, posix } from 'node:path';
import { snapshot, scopedPlan, hash, digest, nodeTest, browserTest, type Snapshot } from './scoped-quality.js';
import { initializeRecoveryBudget, recoveryTimeRemaining, repairCheck, type QualityRecovery } from './quality-execution.js';
import type { FailureClass } from './check-proof.js';

export type IncidentState = 'ACTIVE' | 'EXHAUSTED' | 'REPAIR_CONFIRMED' | 'RESUME_ONCE' | 'CLOSED' | 'BLOCKED';
export interface EvidenceRef { path: string; sha256: string }
export interface MaterialRepair {
  original_failure: string;
  component: string;
  repair_commit: string;
  previous_identity: string;
  repaired_identity: string;
  reproducer: string[];
  result: EvidenceRef;
  diagnosis: EvidenceRef;
}
export interface IncidentEvent {
  schema_version: 1; incident_id: string; sequence: number; previous: string | null;
  recorded_at: string; kind: 'OPEN' | 'FAILURE' | 'EXHAUST' | 'DIAGNOSE' | 'REPAIR' | 'RESERVE' | 'CLOSE' | 'BLOCK' | 'REPAIR_FAILED' | 'ESCALATE';
  boundary: string; state: IncidentState; failure_class: FailureClass;
  recovery: QualityRecovery; evidence: EvidenceRef[]; repair?: MaterialRepair; execution_id?: string;
}
export const incidentBoundary = (certification: boolean, full: boolean, objective: string) => certification || full ? 'repository/full' : `objective/${objective}`;
export function auditAppendOnly(root: string, prefix = 'gauntlet/incidents/', ref = 'HEAD'): void {
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  const history = git('log', '--format=', '--name-status', ref, '--', prefix);
  const dirty = ref === 'HEAD' ? git('diff', '--name-status', 'HEAD', '--', prefix) : '';
  if ([...history.split('\n'), ...dirty.split('\n')].some(r => r.trim() && !r.startsWith('A\t'))) throw new Error(`${prefix} history is append-only`);
}
export function evidence(source: Snapshot, ref: EvidenceRef): Buffer {
  if (!ref || !/^(?:docs\/evidence\/|gauntlet\/incidents\/)[A-Za-z0-9._/-]+$/.test(ref.path) || ref.path.split('/').includes('..')) throw new Error('unsafe incident evidence');
  const bytes = source.read(ref.path);
  if (!bytes || hash(bytes) !== ref.sha256) throw new Error('incident evidence missing or changed');
  return bytes;
}
export function incidentEvents(root: string, source = snapshot(root)): IncidentEvent[] {
  auditAppendOnly(root);
  const paths = source.files.filter(p => /^gauntlet\/incidents\/[a-f0-9]{64}\/\d{6}\.json$/.test(p)).sort();
  const result: IncidentEvent[] = [], last = new Map<string, { event: IncidentEvent; sha: string }>();
  for (const path of paths) {
    const bytes = source.read(path)!, e = JSON.parse(bytes.toString()) as IncidentEvent, prior = last.get(e.incident_id);
    if (e.schema_version !== 1 || path !== `gauntlet/incidents/${e.incident_id}/${String(e.sequence).padStart(6,'0')}.json` || e.sequence !== (prior?.event.sequence ?? -1) + 1 || e.previous !== (prior?.sha ?? null) || !Number.isFinite(Date.parse(e.recorded_at)) || !['PRODUCT_FAILURE','HARNESS_ENVIRONMENT','UNKNOWN'].includes(e.failure_class)) throw new Error('invalid incident chain');
    const allowed: Record<IncidentEvent['kind'], IncidentState[]> = { OPEN: [], FAILURE: ['ACTIVE'], EXHAUST: ['ACTIVE'], DIAGNOSE: ['ACTIVE','EXHAUSTED'], REPAIR: ['ACTIVE','EXHAUSTED'], RESERVE: ['REPAIR_CONFIRMED'], CLOSE: ['RESUME_ONCE','BLOCKED'], BLOCK: ['RESUME_ONCE','REPAIR_CONFIRMED','BLOCKED'], REPAIR_FAILED: ['ACTIVE','EXHAUSTED'], ESCALATE:['ACTIVE','EXHAUSTED','BLOCKED'] };
    const states: Record<IncidentEvent['kind'], IncidentState> = { OPEN:'ACTIVE', FAILURE:'ACTIVE', EXHAUST:'EXHAUSTED', DIAGNOSE:prior?.event.state ?? 'ACTIVE', REPAIR:'REPAIR_CONFIRMED', RESERVE:'RESUME_ONCE', CLOSE:'CLOSED', BLOCK:'BLOCKED', REPAIR_FAILED:'BLOCKED', ESCALATE:prior?.event.state??'ACTIVE' };
    if (!allowed[e.kind] || (e.kind === 'OPEN' ? Boolean(prior) : !prior || !allowed[e.kind].includes(prior.event.state)) || e.state !== states[e.kind]) throw new Error('invalid incident transition');
    initializeRecoveryBudget(e.recovery);
    const budget=e.recovery.budget!;if(!Number.isSafeInteger(budget.started_at_ms)||budget.started_at_ms<=0||!Number.isSafeInteger(budget.repair_attempts)||budget.repair_attempts<0||!['MEASURED','UNAVAILABLE'].includes(budget.history_before_budget))throw new Error('invalid recovery budget');
    if (!/^[a-f0-9]{64}$/.test(e.recovery.failure.signature) || !e.boundary || !Array.isArray(e.evidence) || e.evidence.length === 0) throw new Error('incident provenance required');
    e.evidence.forEach(r => evidence(source,r));
    if (prior && (e.boundary !== prior.event.boundary || e.recovery.budget!.started_at_ms !== prior.event.recovery.budget!.started_at_ms || e.recovery.budget!.repair_attempts < prior.event.recovery.budget!.repair_attempts)) throw new Error('incident history cannot reset');
    if (e.kind === 'DIAGNOSE' && result.some(r=>r.incident_id===e.incident_id && r.kind==='DIAGNOSE')) throw new Error('one causal diagnosis per incident');
    if(e.kind==='CLOSE'){
      const receipt=JSON.parse(evidence(source,e.evidence.at(-1)!).toString());
      if(!result.some(r=>r.incident_id===e.incident_id&&r.kind==='RESERVE')||receipt.incident_id!==e.incident_id||receipt.status!=='PASS'||receipt.execution_mode!=='full'||receipt.schema_version!==2||!receipt.target_commit&&!receipt.completed_commit)throw new Error('incident closure requires complete verification PASS');
      const target=snapshot(root,receipt.target_commit??receipt.completed_commit??'HEAD'),before=snapshot(root,receipt.base_commit);
      const plan=scopedPlan(receipt.plan.changed_paths,before,target,receipt.elevated_risk,receipt.architecture_changed,receipt.proof_scope==='certification',receipt.proof_scope==='objective'&&!!target.read(`gauntlet/execution/${receipt.output_path?.split('/')[2]}.json`));
      if(JSON.stringify(plan)!==JSON.stringify(receipt.plan))throw new Error('closure scope differs');
      validateScopedProofs(plan,receipt,{files:target.files,read:p=>target.read(p)??source.read(p)},receipt.output_path);
    }
    if (e.kind === 'REPAIR'){if(!result.some(r=>r.incident_id===e.incident_id&&r.kind==='DIAGNOSE'))throw new Error('repair requires the original bounded diagnosis');validateMaterialRepair(root, prior!.event, e.repair!, source);}
    if(e.kind==='ESCALATE'&&result.some(r=>r.incident_id===e.incident_id&&r.kind==='ESCALATE'))throw new Error('engineering escalation already recorded');
    if (e.kind === 'RESERVE' && (!e.execution_id || result.some(r=>r.incident_id===e.incident_id && r.kind==='RESERVE'))) throw new Error('one audited execution per incident');
    last.set(e.incident_id,{event:e,sha:hash(bytes)}); result.push(e);
  }
  const migration=source.read('gauntlet/incidents/legacy-import.json');
  if(migration){
    const manifest=JSON.parse(migration.toString()),history=[...new Map(result.flatMap(e=>e.evidence).filter(r=>r.path.startsWith('gauntlet/incidents/legacy-')).map(r=>[r.path,r])).values()].sort((a,b)=>a.path.localeCompare(b.path));
    if(manifest.schema_version!==1||!Number.isFinite(Date.parse(manifest.recorded_at))||!Array.isArray(manifest.imports)||JSON.stringify([...manifest.imports].sort((a:EvidenceRef,b:EvidenceRef)=>a.path.localeCompare(b.path)))!==JSON.stringify(history))throw new Error('invalid legacy import manifest');
    manifest.imports.forEach((r:EvidenceRef)=>evidence(source,r));
  }
  return result;
}
export function activeIncident(root: string, boundary: string): IncidentEvent | null {
  const latest = new Map<string,IncidentEvent>(); incidentEvents(root).forEach(e=>latest.set(e.incident_id,e));
  const active = [...latest.values()].filter(e=>e.boundary===boundary && e.state!=='CLOSED');
  if (active.length>1) throw new Error('multiple unresolved incidents at one verification boundary');
  return active[0] ?? null;
}
export function appendIncident(root: string, event: Omit<IncidentEvent,'schema_version'|'sequence'|'previous'|'recorded_at'>): IncidentEvent {
  const all = incidentEvents(root), previous = all.filter(e=>e.incident_id===event.incident_id).at(-1);
  const sequence = (previous?.sequence ?? -1) + 1;
  const e:IncidentEvent={...event,schema_version:1,sequence,previous:previous?hash(readFileSync(`${root}/gauntlet/incidents/${event.incident_id}/${String(previous.sequence).padStart(6,'0')}.json`)):null,recorded_at:new Date().toISOString()};
  // Validate the prospective chain before publication, never modify old files.
  const path=`gauntlet/incidents/${e.incident_id}/${String(sequence).padStart(6,'0')}.json`, bytes=Buffer.from(JSON.stringify(e,null,2)+'\n'), source=snapshot(root);
  incidentEvents(root,{files:[...source.files,path].sort(),read:p=>p===path?bytes:source.read(p)});
  mkdirSync(dirname(`${root}/${path}`),{recursive:true});writeFileSync(`${root}/${path}`,bytes,{flag:'wx'});return e;
}
export function openIncident(root:string,boundary:string,recovery:QualityRecovery,failure_class:FailureClass,refs:EvidenceRef[]):IncidentEvent {
  initializeRecoveryBudget(recovery);
  const incident_id=digest({boundary,signature:recovery.failure.signature,budget:recovery.budget,evidence:refs});
  return appendIncident(root,{incident_id,boundary,recovery,state:'ACTIVE',kind:'OPEN',failure_class,evidence:refs});
}
export function exhaustIncident(root:string,e:IncidentEvent):IncidentEvent {
  if(e.state!=='ACTIVE')return e;
  try { recoveryTimeRemaining(e.recovery); if(e.recovery.budget!.repair_attempts < 1)return e; } catch { /* Preserve expired original budget. */ }
  return appendIncident(root,{...e,kind:'EXHAUST',state:'EXHAUSTED'});
}
export function requirePublishedIncident(root:string,e:IncidentEvent):void {
  const path=`gauntlet/incidents/${e.incident_id}/${String(e.sequence).padStart(6,'0')}.json`;
  const committed=execFileSync('git',['-C',root,'show',`HEAD:${path}`],{stdio:'pipe'});
  if(hash(committed)!==hash(readFileSync(`${root}/${path}`)))throw new Error('publish canonical incident transition before execution');
  let remote:string;try{remote=execFileSync('git',['-C',root,'rev-parse','--abbrev-ref','--symbolic-full-name','@{upstream}'],{encoding:'utf8',stdio:'pipe'}).trim();}catch{throw new Error('incident execution requires a configured upstream and remote durability');}
  const bytes=execFileSync('git',['-C',root,'show',`${remote}:${path}`],{stdio:'pipe'});if(hash(bytes)!==hash(committed))throw new Error('incident transition must be remotely durable before execution');
}
export function validateRepairCommit(root:string,commit:string):void {
  if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('repair commit required');
  const changed=execFileSync('git',['-C',root,'diff-tree','--no-commit-id','--name-only','-r',commit],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  if(!changed.length || changed.some(p=>! /^(?:gauntlet\/(?:runtime|evals\/src)\/|scripts\/(?:gauntlet|ci)\/|\.omp\/(?:extensions|hooks)\/|\.grok\/|\.opencode\/|tests\/(?:unit\/gauntlet-|architecture\/)|(?:package\.json|pnpm-lock\.yaml|mise\.(?:toml|lock))$)/.test(p)))throw new Error('repair must change only verification machinery');
  execFileSync('git',['-C',root,'merge-base','--is-ancestor',commit,'HEAD']);
  // A repair cannot rewrite the assurance used to authorize that same repair.
  const protectedPolicy=/^gauntlet\/runtime\/(?:incidents|incident-recovery|continuation|certification|candidate-quality|check-proof|scoped-quality|simulation-impact|product-quality|integrated-execution|execution-dag|policy)\./;
  const before=snapshot(root,`${commit}^`),after=snapshot(root,commit);
  for(const path of changed){
    if(protectedPolicy.test(path)||path==='gauntlet/runtime/scoped-quality-command.ts')throw new Error('assurance-policy changes require ordinary full verification, not incident recovery');
    if(path.startsWith('tests/')&&before.read(path))throw new Error('repair cannot modify or delete existing assertions');
    if(path==='package.json'){const a=JSON.parse(before.read(path)!.toString()),b=JSON.parse(after.read(path)!.toString());for(const key of ['scripts','packageManager'])if(JSON.stringify(a[key])!==JSON.stringify(b[key]))throw new Error('repair cannot waive checks or change execution policy');}
    if(path==='gauntlet/runtime/quality-execution.ts'){
      const old=before.read(path)?.toString()??'',next=after.read(path)?.toString()??'';
      // Only transport implementation may change; all surrounding timeout,
      // recovery and failure/coverage machinery remains byte-identical.
      const prefix='export function spawnQualityCheck(';
      if(!old.includes(prefix)||!next.includes(prefix)||old.split(prefix)[0]!==next.split(prefix)[0])throw new Error('repair cannot alter budgets/retries or recovery policy');
      const ts=createRequire(import.meta.url)('typescript') as typeof import('typescript'),printer=ts.createPrinter({removeComments:true});
      // Only native spawn transport options may vary. The command, timers,
      // cancellation, error classification and result construction stay identical.
      const envelope=(text:string)=>{const file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);const transformed=ts.transform(file,[context=>root=>{const visit:import('typescript').Visitor=n=>{if(ts.isCallExpression(n)&&n.expression.getText(file)==='spawn'&&n.arguments.length===3)return context.factory.updateCallExpression(n,n.expression,n.typeArguments,[n.arguments[0]!,n.arguments[1]!,context.factory.createObjectLiteralExpression()]);return ts.visitEachChild(n,visit,context);};return ts.visitNode(root,visit) as import('typescript').SourceFile;}]);const result=printer.printFile(transformed.transformed[0] as import('typescript').SourceFile);transformed.dispose();return result;};
      if(envelope(old)!==envelope(next))throw new Error('repair cannot alter execution policy; only spawn transport options may change');
    }
  }
}
/** Material source repair must participate in the original command/transport.
 * An unrelated semantic edit or a new session/model is not repair evidence. */
export function requireRelevantRepair(root:string,original:IncidentEvent,component:string,commit:string):void {
  const originPath=`gauntlet/incidents/${original.incident_id}/000000.json`;
  const anchor=execFileSync('git',['-C',root,'log','--reverse','--diff-filter=A','--format=%H','--',originPath],{encoding:'utf8'}).trim().split('\n')[0];
  if(!anchor)throw new Error('repair requires published original incident provenance');
  execFileSync('git',['-C',root,'merge-base','--is-ancestor',anchor,commit]);
  const sourceCommits=execFileSync('git',['-C',root,'rev-list',`${anchor}..${commit}`],{encoding:'utf8'}).trim().split('\n').filter(Boolean).filter(ref=>execFileSync('git',['-C',root,'diff-tree','--no-commit-id','--name-only','-r',ref],{encoding:'utf8'}).trim().split('\n').filter(Boolean).some(p=>!/^gauntlet\/(?:incidents|state|certification|execution|trajectory\/horizons|evals\/results)\/|^docs\/evidence\//.test(p)));
  if(sourceCommits.length!==1||sourceCommits[0]!==commit)throw new Error('one machinery repair commit on the published incident baseline; intervening source changes require ordinary verification');
  const source=snapshot(root,`${commit}^`),check=original.recovery.failure.check;
  const pkg=JSON.parse(source.read('package.json')?.toString()??'{}');
  const command=check.command[0]==='pnpm'&&check.command[1]==='run'?String(pkg.scripts?.[check.command[2]!]??''):check.command.join(' ');
  const roots=[...command.matchAll(/(?:^|[\s;&])((?:scripts|gauntlet|tests)\/[A-Za-z0-9._/-]+\.[cm]?[jt]sx?)/g)].map(m=>m[1]!);
  if(/\bvitest\b/.test(command))roots.push(...source.files.filter(p=>/^vitest[^/]*\.[cm]?[jt]s$/.test(p)));
  // The canonical runner always uses this transport, plus pinned toolchain.
  roots.push('gauntlet/runtime/quality-execution.ts','mise.toml','pnpm-lock.yaml','package.json');
  const ts=createRequire(import.meta.url)('typescript') as typeof import('typescript'),relevant=new Set<string>();
  const visit=(path:string)=>{if(relevant.has(path)||!source.read(path))return;relevant.add(path);if(!/\.[cm]?[jt]sx?$/.test(path))return;
    const file=ts.createSourceFile(path,source.read(path)!.toString(),ts.ScriptTarget.Latest,true);
    for(const node of file.statements){
      const valueImport=ts.isImportDeclaration(node)&&!node.importClause?.isTypeOnly&&(!node.importClause?.namedBindings||!ts.isNamedImports(node.importClause.namedBindings)||!!node.importClause.name||node.importClause.namedBindings.elements.some(e=>!e.isTypeOnly));
      const valueExport=ts.isExportDeclaration(node)&&!node.isTypeOnly;
      if((valueImport||valueExport)&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)&&node.moduleSpecifier.text.startsWith('.')){const target=posix.normalize(posix.join(posix.dirname(path),node.moduleSpecifier.text)),stem=target.replace(/\.[cm]?js$/,'');const resolved=[target,stem+'.ts',stem+'.tsx',stem+'/index.ts'].find(p=>source.read(p));if(resolved)visit(resolved);}
    }
  };roots.forEach(visit);
  if(!relevant.has(component)||!source.read(component))throw new Error('material repair component must be an existing original-check dependency or canonical transport');
}
export function validateMaterialRepair(root:string,original:IncidentEvent,repair:MaterialRepair,source=snapshot(root)):void {
  if(!repair || repair.original_failure!==original.recovery.failure.signature || !repair.component?.trim() || !/^[a-f0-9]{40}$/.test(repair.repair_commit) || repair.previous_identity!==digest(original.recovery.failure) || !/^[a-f0-9]{64}$/.test(repair.repaired_identity) || repair.repaired_identity===repair.previous_identity || !Array.isArray(repair.reproducer) || !repair.reproducer.length)throw new Error('material repair identity required');
  const derived=repairCheck(original.recovery).check;
  if(JSON.stringify(derived.command)!==JSON.stringify(repair.reproducer))throw new Error('repair reproducer must be derived from the original failure');
  validateRepairCommit(root,repair.repair_commit);requireRelevantRepair(root,original,repair.component,repair.repair_commit);
  const changed=execFileSync('git',['-C',root,'diff-tree','--no-commit-id','--name-only','-r',repair.repair_commit],{encoding:'utf8'}).trim().split('\n');
  if(!changed.includes(repair.component))throw new Error('repaired component must name a changed machinery path');
  const previous=snapshot(root,`${repair.repair_commit}^`),current=snapshot(root,repair.repair_commit);
  const ts=createRequire(import.meta.url)('typescript') as typeof import('typescript'),printer=ts.createPrinter({removeComments:true});
  const semantic=(bytes:Buffer|null)=>printer.printFile(ts.createSourceFile(repair.component,bytes?.toString()??'',ts.ScriptTarget.Latest,true));
  if(semantic(previous.read(repair.component))===semantic(current.read(repair.component)))throw new Error('comment-only change is not a material repair');
  const diagnosis=JSON.parse(evidence(source,repair.diagnosis).toString());
  const reproducer=JSON.parse(evidence(source,repair.result).toString());
  if(!diagnosis.diagnosis?.trim() || reproducer.execution_mode!=='repair' || reproducer.status!=='REPAIR_PASS' || reproducer.incident_id!==original.incident_id || reproducer.original_failure!==repair.original_failure || JSON.stringify(reproducer.command)!==JSON.stringify(repair.reproducer) || reproducer.repaired_identity!==repair.repaired_identity || !reproducer.proof || reproducer.exit_code!==0)throw new Error('deterministic reproducer proof required');
  const proof=JSON.parse(evidence(source,reproducer.proof).toString());
  if(proof.result?.status!=='PASS'||proof.result.exit_code!==0||JSON.stringify(proof.check?.command)!==JSON.stringify(repair.reproducer))throw new Error('reproducer did not pass');
  if(repair.repaired_identity!==digest({profile:proof.profile,repair_commit:repair.repair_commit}))throw new Error('repair environment identity differs from proven execution');
  const repaired=snapshot(root,repair.repair_commit),filters=derived.command.filter(p=>p.startsWith('tests/'));
  const expected=derived.command.join(' ')==='pnpm run test'?repaired.files.filter(nodeTest):derived.command.join(' ')==='pnpm run test-browser'?repaired.files.filter(browserTest):derived.command.includes('vitest')?repaired.files.filter(derived.command.includes('browser')?browserTest:nodeTest).filter(p=>!filters.length||filters.some(f=>p.includes(f))):[];
  validateCheckProof(proof.check,{...proof.result,proof:reproducer.proof} as ProvenResult,{files:repaired.files,read:p=>repaired.read(p)??source.read(p)},undefined,reproducer.receipt_path??'',expected);
  evidence(source,proof.log);
}
/** Import once before reading policy. Originals stay untouched; their bytes become canonical evidence. */
export function importLegacyIncidents(root:string,paths:string[]):void {
  if(existsSync(`${root}/gauntlet/incidents/legacy-import.json`)){incidentEvents(root);return;}
  mkdirSync(`${root}/gauntlet/incidents`,{recursive:true});
  const existing=incidentEvents(root).flatMap(e=>e.evidence.map(r=>r.sha256));
  for(const path of paths.filter(p=>existsSync(`${root}/${p}`))) {
    const bytes=readFileSync(`${root}/${path}`),sha=hash(bytes);if(existing.includes(sha))continue;
    const old=JSON.parse(bytes.toString()) as QualityRecovery;initializeRecoveryBudget(old);
    if(old.schema_version!==1||!old.failure?.check?.command?.length||!/^[a-f0-9]{64}$/.test(old.failure.signature))throw new Error('invalid legacy incident');
    const boundary='repository/full'; // Legacy scope authority was local/unattested; unknown impact remains full.
    const reference={path:`gauntlet/incidents/legacy-${sha}.json`,sha256:sha};
    if(existsSync(`${root}/${reference.path}`)){if(hash(readFileSync(`${root}/${reference.path}`))!==sha)throw new Error('legacy evidence changed');}else writeFileSync(`${root}/${reference.path}`,bytes,{flag:'wx'});
    const active=activeIncident(root,boundary);
    if(active){
      if(active.state!=='ACTIVE')throw new Error('publish legacy history before resolving canonical incident');
      const merged={...active.recovery,budget:{...active.recovery.budget!,started_at_ms:Math.min(active.recovery.budget!.started_at_ms,old.budget!.started_at_ms),repair_attempts:Math.max(active.recovery.budget!.repair_attempts,old.budget!.repair_attempts)}};
      // Distinct legacy incidents retain separate original records; no aggregation may rewrite deadlines.
      if(merged.budget.started_at_ms!==active.recovery.budget!.started_at_ms)throw new Error('import legacy incidents in earliest-deadline order');
      appendIncident(root,{...active,recovery:merged,kind:'FAILURE',state:'ACTIVE',evidence:[...active.evidence,reference]});
    } else openIncident(root,boundary,old,'UNKNOWN',[reference]);
    existing.push(sha);
  }
  writeFileSync(`${root}/gauntlet/incidents/legacy-import.json`,JSON.stringify({schema_version:1,recorded_at:new Date().toISOString(),imports:[...new Map(incidentEvents(root).flatMap(e=>e.evidence).filter(r=>r.path.startsWith('gauntlet/incidents/legacy-')).map(r=>[r.path,r])).values()]},null,2)+'\n',{flag:'wx'});
}

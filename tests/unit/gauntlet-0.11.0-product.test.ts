import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { qualityPlan, validateReviews, validateQualityReceipt } from '../../gauntlet/runtime/product-quality.js';
import { verifyCandidateQuality } from '../../gauntlet/runtime/candidate-quality.js';
import { auditHorizonProduct } from '../../gauntlet/runtime/horizon-product-audit.js';
import { METRICS, outcomeDecision, validateMetrics, deriveMetrics, type ProductOutcome, type Measurement, type MetricName } from '../../gauntlet/runtime/product-trajectory.js';

const ref = { path: 'docs/playtest.json', commit: 'a'.repeat(40), sha256: 'b'.repeat(64) };
function outcome(): ProductOutcome {
  return { problem: 'Controls are hard to read', smallest_playable_slice: 'Make the controls legible', changed_for_player: ['Legible controls'], playtest: { mode: 'normal_shipped_play', method: 'Started a normal 5v5 human match, used movement and tackle keys', before: [ref], after: [ref], materially_better: true, improved: ['Could identify the tackle key'], still_wrong: ['Keeper role remains unclear'], issues_opened: ['keeper-role'], issues_closed: ['controls-readability'], regressions: [] }, quality: { baseline_pass: true, affected_domains_pass: true, no_known_accepted_regression: true, sources: [ref] } };
}
function metrics(): Record<MetricName, Measurement> {
  return Object.fromEntries(METRICS.map(k=>[k, {value:null,status:'UNAVAILABLE',sources:[],note:'No coverage'}])) as unknown as Record<MetricName, Measurement>;
}
const measured = (value: number): Measurement => ({value,status:'MEASURED',sources:[ref],note:'Complete local observation'});

describe('0.11 product outcome gate',()=>{
  it('accepts a useful normal-play improvement with quality evidence',()=>expect(outcomeDecision(outcome())).toBe('ACCEPT'));
  it('accepted objectives cannot compensate for an unchanged product',()=>{const o=outcome();o.playtest.materially_better=false;expect(outcomeDecision(o)).toBe('ITERATE');});
  it.each(['baseline_pass','affected_domains_pass','no_known_accepted_regression'] as const)('rejects failed quality %s',key=>{const o=outcome();o.quality[key]=false;expect(outcomeDecision(o)).toBe('ITERATE');});
  it('requires repair of regressions',()=>{const o=outcome();o.playtest.regressions=['ball teleport'];expect(outcomeDecision(o)).toBe('ITERATE');});
  it('fixture-only play cannot succeed',()=>{const o=outcome();o.playtest.mode='test_bridge' as any;expect(()=>outcomeDecision(o)).toThrow();});
  it('missing before-play evidence cannot succeed',()=>{const o=outcome();o.playtest.before=[];expect(()=>outcomeDecision(o)).toThrow();});
  it('empty improvements cannot succeed',()=>{const o=outcome();o.changed_for_player=[];expect(outcomeDecision(o)).toBe('ITERATE');});
  it('does not count duplicate improvements',()=>{const o=outcome();o.changed_for_player.push(o.changed_for_player[0]!);expect(()=>outcomeDecision(o)).toThrow();});
  it('rejects string truth values from JSON',()=>{const o=outcome();o.playtest.materially_better='false' as any;expect(()=>outcomeDecision(o)).toThrow();});
});

describe('0.11 explicit protected-property impact',()=>{
  it('presentation leaves keep baseline/browser checks without physics assurance',()=>{const p=qualityPlan(['src/apps/browser/styles.css']);expect(p.reviews_required).toBe(false);expect(p.suite_ids).toEqual([]);expect(p.checks.map(c=>c.id)).toEqual(expect.arrayContaining(['typecheck','build','regression-tests','browser-tests','state-audit']));});
  it('fresh screenshot and audit evidence do not defeat a presentation waiver',()=>expect(qualityPlan(['src/apps/browser/styles.css','docs/screenshots/CSS/after.png','docs/evidence/CSS/audit.json']).reviews_required).toBe(false));
  it('evidence-only work keeps both reviews',()=>expect(qualityPlan(['docs/evidence/EVAL/RESULT.md']).reviews_required).toBe(true));
  it('ball impact includes its downstream protected properties',()=>{const p=qualityPlan(['src/simulation/ball/ball-system.ts']);expect(p.reviews_required).toBe(true);expect(p.suite_ids).toEqual(expect.arrayContaining(['ball','touch_and_actions','duels','goalkeepers','rules','fouls','team']));});
  it.each(['src/simulation/advantage-policy.ts','src/simulation/foul-predicate.ts'])('rules/fouls impact: %s',p=>{const q=qualityPlan([p]);expect(q.suite_ids).toEqual(expect.arrayContaining(['rules','fouls']));expect(q.reviews_required).toBe(true);});
  it.each(['src/simulation/loop/simulation.ts','src/adapters/replay/replay-codec.ts','unknown-file.ts','gauntlet/evals/src/evaluate-state.ts'])('ambiguous/core impact defaults safe: %s',p=>{const q=qualityPlan([p]);expect(q.reviews_required).toBe(true);expect(q.suite_ids).toContain('ball');expect(q.suite_ids).toContain('rules');});
  it('browser composition cannot bypass protected reviews',()=>expect(qualityPlan(['src/apps/browser/main.ts']).reviews_required).toBe(true));
  it('elevated risk overrides trivial leaf waiver',()=>expect(qualityPlan(['src/apps/browser/styles.css'],true).reviews_required).toBe(true));
  it('architecture changes override leaf waiver',()=>expect(qualityPlan(['src/apps/browser/styles.css'],false,true).reviews_required).toBe(true));
  it('review waiver is refused for protected code',()=>expect(()=>validateReviews(qualityPlan(['src/simulation/ball/ball-system.ts']),'builder',{verdict:'NOT_REQUIRED'},{verdict:'NOT_REQUIRED'})).toThrow());
  it('only deterministic leaves can persist NOT_REQUIRED',()=>expect(()=>validateReviews(qualityPlan(['src/apps/browser/styles.css']),'builder',{verdict:'NOT_REQUIRED'},{verdict:'NOT_REQUIRED'})).not.toThrow());
  it('integration independence is enforced as well as critic independence',()=>expect(()=>validateReviews(qualityPlan(['src/simulation/ball/ball-system.ts']),'builder',{verdict:'ACCEPT',model:'critic'},{verdict:'ACCEPT',model:'builder'})).toThrow());
  it('missing and crashed baseline checks cannot pass',()=>{const p=qualityPlan(['src/apps/browser/styles.css']);expect(()=>validateQualityReceipt(p,{checks:[]})).toThrow();expect(()=>validateQualityReceipt(p,{checks:p.checks.map(c=>({id:c.id,exit_code:null}))})).toThrow();});
});

describe('0.11 measurement provenance',()=>{
  it('unknown is null and never zero',()=>{const m=metrics();validateMetrics(m);m.retries.value=0;expect(()=>validateMetrics(m)).toThrow();});
  it('known zero needs sources',()=>{const m=metrics();m.retries=measured(0);validateMetrics(m);m.retries.sources=[];expect(()=>validateMetrics(m)).toThrow();});
  it('no positive denominator means unavailable ratios',()=>{const m=metrics();m.processed_input_tokens=measured(123);m.player_visible_changes=measured(0);deriveMetrics(m,measured(2));expect(m.tokens_per_player_visible_change.value).toBeNull();});
  it('derives ratios only from the same Horizon inputs',()=>{const m=metrics();m.processed_input_tokens=measured(120);m.player_visible_changes=measured(2);deriveMetrics(m,measured(0.5));expect(m.tokens_per_player_visible_change.value).toBe(60);expect(m.player_visible_changes_per_active_hour.value).toBe(4);expect(m.active_agent_time_per_player_visible_change.value).toBe(900);});
  it('estimates propagate rather than becoming measured',()=>{const m=metrics();m.player_visible_changes={...measured(2),status:'RECONSTRUCTED_ESTIMATE'};deriveMetrics(m,measured(1));expect(m.player_visible_changes_per_active_hour.status).toBe('RECONSTRUCTED_ESTIMATE');});
  it('frozen before-state seal remains intact',()=>{const bytes=readFileSync('gauntlet/trajectory/baseline-0.10.0/baseline.json');expect(createHash('sha256').update(bytes).digest('hex')).toBe(readFileSync('gauntlet/trajectory/baseline-0.10.0/baseline.sha256','utf8').split(' ')[0]);const b=JSON.parse(bytes.toString());expect(b.cutoff_commit).toBe('d3dccf77c565102de531bc5aa981bea9aca009c3');expect(b.horizons).toHaveLength(38);for(const h of b.horizons)for(const m of Object.values(h.metrics) as Measurement[])if(m.status==='UNAVAILABLE')expect(m.value).toBeNull();});
});

describe('candidate quality is checked against git, not LLM labels',()=>{
  it('allows a tested presentation waiver, rejects stale hashes and missing receipts',()=>{
    const dir=mkdtempSync(join(tmpdir(),'gauntlet-quality-'));
    const git=(...args:string[])=>execFileSync('git',['-C',dir,...args],{encoding:'utf8'}).trim();
    try {
      git('init','-b','main');git('config','user.name','test');git('config','user.email','test@example.com');
      mkdirSync(join(dir,'src/apps/browser'),{recursive:true});writeFileSync(join(dir,'src/apps/browser/styles.css'),'before');git('add','.');git('commit','-m','base');const base=git('rev-parse','HEAD');
      writeFileSync(join(dir,'src/apps/browser/styles.css'),'after');
      const plan=qualityPlan(['src/apps/browser/styles.css']);const receipt={base_commit:base,plan,source_hashes:{'src/apps/browser/styles.css':createHash('sha256').update('after').digest('hex')},checks:plan.checks.map(c=>({id:c.id,exit_code:0}))};
      mkdirSync(join(dir,'docs/evidence/CSS'),{recursive:true});writeFileSync(join(dir,'docs/evidence/CSS/quality.json'),JSON.stringify(receipt));git('add','.');git('commit','-m','candidate');
      expect(()=>verifyCandidateQuality(dir,'HEAD','CSS','builder',{verdict:'NOT_REQUIRED'},{verdict:'NOT_REQUIRED'})).not.toThrow();
      writeFileSync(join(dir,'src/apps/browser/styles.css'),'stale');git('add','.');git('commit','--amend','--no-edit');
      expect(()=>verifyCandidateQuality(dir,'HEAD','CSS','builder',{verdict:'NOT_REQUIRED'},{verdict:'NOT_REQUIRED'})).toThrow('stale');
      expect(()=>verifyCandidateQuality(dir,'HEAD','MISSING','builder',{verdict:'NOT_REQUIRED'},{verdict:'NOT_REQUIRED'})).toThrow();
    } finally {rmSync(dir,{recursive:true,force:true});rmSync(dir+'-origin.git',{recursive:true,force:true});}
  });
});

describe('canonical Horizon recording command',()=>{
  it('records selection, first play and append-only outcomes with remote snapshot validation',async()=>{
    const dir=mkdtempSync(join(tmpdir(),'gauntlet-trajectory-'));
    const repo=process.cwd();
    const git=(...args:string[])=>execFileSync('git',['-C',dir,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    const write=(p:string,v:unknown)=>{mkdirSync(join(dir,p,'..'),{recursive:true});writeFileSync(join(dir,p),typeof v==='string'?v:JSON.stringify(v));};
    const commit=(message:string)=>{git('add','.');git('commit','-m',message);return git('rev-parse','HEAD');};
    const source=(p:string,c=git('rev-parse','HEAD'))=>({path:p,commit:c,sha256:createHash('sha256').update(execFileSync('git',['-C',dir,'show',`${c}:${p}`])).digest('hex')});
    const cli=(...args:string[])=>execFileSync(process.execPath,['--import',join(repo,'node_modules/tsx/dist/loader.mjs'),join(repo,'scripts/gauntlet/trajectory.ts'),...args],{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']});
    try {
      git('init','-b','main');git('config','user.name','test');git('config','user.email','test@example.com');
      write('src/apps/browser/styles.css','before');write('docs/before.json',{observation:'fixture before'});write('docs/after.json',{observation:'fixture after'});commit('base');
      const selected={problem:'Controls are hard to read',smallest_playable_slice:'Make the controls legible',sources:[source('docs/before.json')]};
      write('selection-input.json',selected);cli('start','v39','selection-input.json');
      expect(()=>cli('start','v39','selection-input.json')).toThrow();commit('selection');
      const failed=outcome();failed.playtest.before=[source('docs/before.json')];failed.playtest.after=[source('docs/after.json')];failed.quality.sources=[source('docs/after.json')];failed.playtest.materially_better=false;failed.changed_for_player=[];failed.playtest.improved=[];
      write('failed-input.json',{outcome:failed,acceptances:[],objectives:[{id:'CSS',direct_player_result:true,enables_or_protects:'Legible shipped controls'}]});commit('failed first observation');
      expect(cli('record','v39','failed-input.json')).toContain('ITERATE');
      const failedRecord=JSON.parse(readFileSync(join(dir,'gauntlet/trajectory/horizons/v39/attempt-1.json'),'utf8'));expect(failedRecord.metrics.time_to_playable).toMatchObject({value:null,status:'UNAVAILABLE'});expect(await auditHorizonProduct(dir,39,'COMPLETE')).toMatchObject({pass:false});
      write('play-input.json',{mode:'normal_shipped_play',method:'fixture normal-play observation',sources:[source('docs/after.json')]});cli('playable','v39','play-input.json');commit('first play');
      const base=git('rev-parse','HEAD');const plan=qualityPlan(['src/apps/browser/styles.css']);
      write('src/apps/browser/styles.css','after');write('docs/evidence/CSS/quality.json',{base_commit:base,plan,source_hashes:{'src/apps/browser/styles.css':createHash('sha256').update('after').digest('hex')},checks:plan.checks.map(c=>({id:c.id,exit_code:0}))});
      const candidate=commit('candidate');
      const ap='gauntlet/evals/results/2026-10-04/fixture-CSS-acceptance.json';
      write(ap,{record_type:'candidate_acceptance',objective_id:'CSS',candidate_commit:candidate,builder:{model:'builder'},critic:{verdict:'NOT_REQUIRED'},integration:{verdict:'NOT_REQUIRED'},deterministic_audit:{status:'PASS'}});
      write('docs/evidence/CSS/manifest.json',{objective_id:'CSS',candidate_commit:candidate,acceptance_record:ap});
      write('gauntlet/state/CURRENT.md','accepted:\n  - CSS\nblocked:\n');write('gauntlet/state/HORIZON.md','horizon_version: 39\nstatus: ACTIVE\nobjectives:\n  - id: CSS\n    status: accepted\n');write('gauntlet/state/HISTORY.md','objective_id: CSS\nresult: accepted\n');write('gauntlet/state/TIMING.md','last_tracked_objective: CSS\n');
      const acceptance=commit('acceptance');
      const origin=dir+'-origin.git';execFileSync('git',['init','--bare',origin],{stdio:'pipe'});git('remote','add','origin',origin);git('push','origin','main');
      const o=outcome();o.playtest.before=[source('docs/before.json')];o.playtest.after=[source('docs/after.json')];o.quality.sources=[source('docs/evidence/CSS/quality.json')];
      write('outcome-input.json',{outcome:o,acceptances:[source(ap,acceptance)],objectives:[{id:'CSS',direct_player_result:true,enables_or_protects:'Legible shipped controls'}]});commit('observed outcome');
      expect(cli('record','v39','outcome-input.json')).toContain('ACCEPT');
      const first=readFileSync(join(dir,'gauntlet/trajectory/horizons/v39/attempt-2.json'),'utf8');
      const r=JSON.parse(first);expect(r.metrics.processed_input_tokens).toMatchObject({value:null,status:'UNAVAILABLE'});expect(r.metrics.player_visible_changes.value).toBe(1);expect(r.metrics.time_to_playable.value).toBeGreaterThanOrEqual(0);
      expect(await auditHorizonProduct(dir,39,'COMPLETE')).toMatchObject({pass:true});
      write('outcome-input.json',{outcome:o,acceptances:[source(ap,acceptance)],objectives:[{id:'UNRELATED',direct_player_result:true,enables_or_protects:'Unrelated work'}]});commit('invalid objective attribution');
      expect(()=>cli('record','v39','outcome-input.json')).toThrow();
      o.playtest.materially_better=false;write('outcome-input.json',{outcome:o,acceptances:[source(ap,acceptance)],objectives:[{id:'CSS',direct_player_result:true,enables_or_protects:'Legible shipped controls'}]});commit('follow-up observation');
      expect(cli('record','v39','outcome-input.json')).toContain('ITERATE');expect(readFileSync(join(dir,'gauntlet/trajectory/horizons/v39/attempt-2.json'),'utf8')).toBe(first);
      expect(await auditHorizonProduct(dir,39,'COMPLETE')).toMatchObject({pass:false});expect(await auditHorizonProduct(dir,38,'COMPLETE')).toMatchObject({pass:true});
      expect(await auditHorizonProduct(dir,40,'ACTIVE')).toMatchObject({pass:false});
    } finally {rmSync(dir,{recursive:true,force:true});rmSync(dir+'-origin.git',{recursive:true,force:true});}
  });
});

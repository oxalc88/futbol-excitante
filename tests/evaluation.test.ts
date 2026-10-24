import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario, runScenario, TEST_IDS } from '../eval/scenarios';
import { continuity, mutationProof, reachContacts, designOracle } from '../eval/oracles';
import { implementationBindings, impactClosure, reduceOutcomes } from '../eval/registry';
import { validateReference, type ReferenceTarget } from '../eval/reference';
import { BrowserTestSession } from '../src/adapters/test-session';

test('catalog IDs, criterion bindings, dependency closure and precedence resolve without a vacuous PASS',()=>{
  const bindings=implementationBindings();assert.equal(TEST_IDS.length,69);assert.equal(new Set(TEST_IDS).size,69);assert.equal(bindings.length,69);assert(bindings.every(b=>Object.keys(b.criterion_bindings).length>=2));assert(impactClosure(['BALL-IND-001']).includes('GK-PARRY-001'));assert.throws(()=>impactClosure(['FAKE']));assert.equal(reduceOutcomes([]),'INVALID_RUN');assert.equal(reduceOutcomes(['PASS','BLOCKED_MISSING_REFERENCE']),'BLOCKED_MISSING_REFERENCE');assert.equal(reduceOutcomes(['FAIL','NEEDS_PERCEPTUAL_REVIEW']),'FAIL');assert.equal(reduceOutcomes(['INVALID_RUN','FAIL']),'INVALID_RUN');
});
test('protected ball oracle catches a teleport and an unlogged impulse in a negative-control trace',()=>{
  const r=runScenario(createScenario('BALL-GND-001'));assert(continuity(r.trace).passed);assert.deepEqual(mutationProof(r.trace),{observed:true,teleportDetected:true,impulseDetected:true});
});
test('protected contact oracle rejects a fabricated remote header contact',()=>{
  const r=runScenario(createScenario('HEAD-FREE-001'));assert(reachContacts(r.trace,'head').passed);const w=r.trace.find(w=>w.events.some(e=>e.data?.surface==='head'))!;const e=w.events.find(e=>e.data?.surface==='head')!;(e.data!.point as {x:number}).x+=10;assert(!reachContacts(r.trace,'head').passed);
});
test('body resistance and balance design targets are isolated and do not collapse into one capability',()=>{
  for(const id of ['PHY-PC-001','PHY-BC-001']){const a=runScenario(createScenario(id)),b=runScenario(createScenario(id,2017,1));assert(designOracle(id+'-DESIGN',a,b).passed);const ca=a.scenario.initial.players.find(p=>p.id===a.scenario.focal)!.capabilities,cb=b.scenario.initial.players.find(p=>p.id===b.scenario.focal)!.capabilities;assert.deepEqual(Object.keys(ca).filter(k=>ca[k as keyof typeof ca]!==cb[k as keyof typeof cb]),[id==='PHY-PC-001'?'physical':'balance']);}
});
test('browser test session reset and stepping reproduce headless state and capture cannot mutate it',()=>{
  const session=new BrowserTestSession('PASS-LOFT-001',37),r=runScenario(createScenario('PASS-LOFT-001',37));session.step(r.scenario.duration);assert.equal(session.capture().worldHash,r.finalHash);const hash=session.capture().worldHash,s=session.capture();s.state.ball.x=999;session.renderSubmitted(1234);assert.equal(session.capture().worldHash,hash);session.reset('PASS-LOFT-001',37);session.step(r.scenario.duration);assert.equal(session.capture().worldHash,hash);
});
test('reference import fails closed on missing input provenance, PTS, observability or units',()=>{
  const r:ReferenceTarget={version:'reference-target-v1',id:'unit-fixture',testId:'LOC-ACC-002',measurementClass:'C',source:{game:'PES 2017',platform:'fixture',build:'fixture',mode:'fixture',difficulty:'fixture',gameSpeed:'fixture',controller:'fixture',camera:'fixture'},capture:{uri:'fixture://not-real-evidence',sha256:'a'.repeat(64),provenance:'DIRECT_CAPTURE',timebase:'PTS',pts:[0,1],controlledInputs:true,inputLogSha256:'b'.repeat(64),operator:'unit-test'},strata:{scenario_id:'LOC-ACC-002:0'},measurements:[{metric:'earlyDistance',units:'m',estimate:1,uncertainty:.1,sampleSize:3,observable:true,method:'test fixture',startPTS:0,endPTS:1}]};
  assert.doesNotThrow(()=>validateReference(r));for(const mutate of [(r:ReferenceTarget)=>r.capture.controlledInputs=false,(r:ReferenceTarget)=>r.capture.pts=[1,0],(r:ReferenceTarget)=>r.measurements[0].observable=false,(r:ReferenceTarget)=>r.measurements[0].units='pixels']){const copy=structuredClone(r);mutate(copy);assert.throws(()=>validateReference(copy));}
});

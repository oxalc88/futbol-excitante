import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { checkPrBody, SECTIONS, verifySteps } from '../scripts/check-pr-body.mjs';

const verify = readFileSync('scripts/verify.sh', 'utf8');
const steps = verifySteps(verify);
function validBody(names = steps): string {
  return `## Capacidad\nNo issue: test\n\n## Resultado de verify\n\`\`\`text\nmode: full\n${names.map((s) => `${s}: PASS`).join('\n')}\n\`\`\`\nTest count: 380\n\n## Evidencia\nTest output.\n\n## Revisión\nPlan: claude-opus-5-5\nImplement: gpt-6.1-luna\nTest: gpt-6.1-luna\nVerify: gpt-6.1-sol\nReview: claude-opus-5-5\nFindings: none.\n\n## Checklist\n- [x] One\n- [x] Two\n- [x] Three\n- [x] Four\n`;
}

test('verifySteps reads all 16 full verify steps', () => {
  assert.equal(steps.length, 16);
  assert.equal(steps[0], 'no-legacy');
  assert.equal(steps.at(-1), 'scroll-cue-e2e');
  assert.ok(steps.includes('test'));
  assert.ok(steps.includes('defense-e2e'));
});

test('valid body passes with CRLF and a fenced verify summary', () => {
  assert.equal(checkPrBody(validBody(), steps).ok, true);
  assert.equal(checkPrBody(validBody().replace(/\n/g, '\r\n'), steps).ok, true);
  assert.deepEqual(SECTIONS, ['Capacidad', 'Resultado de verify', 'Evidencia', 'Revisión', 'Checklist']);
});

test('raw template fails because it is a template', () => {
  const result = checkPrBody(readFileSync('.github/pull_request_template.md', 'utf8'), steps);
  assert.equal(result.ok, false);
  for (const section of SECTIONS) assert.ok(result.errors.some((e) => e.includes(section)), section);
});

test('missing section and invalid verify mode fail', () => {
  assert.ok(checkPrBody(validBody().replace(/## Evidencia[\s\S]*?(?=## Revisión)/, ''), steps).errors.some((e) => e.includes('## Evidencia')));
  assert.ok(checkPrBody(validBody().replace('mode: full', 'mode: ci'), steps).errors.some((e) => e.includes('mode: full')));
});

test('failed and missing verify steps fail', () => {
  assert.ok(checkPrBody(validBody().replace('test: PASS', 'test: FAIL'), steps).errors.some((e) => e.includes('test is FAIL')));
  assert.ok(checkPrBody(validBody().replace('defense-e2e: PASS\n', ''), steps).errors.some((e) => e.includes('defense-e2e: PASS')));
});

test('capability issue line accepts references or an explicit no-issue reason', () => {
  assert.ok(checkPrBody(validBody().replace('No issue: test', 'No issue: audit'), steps).ok);
  assert.ok(checkPrBody(validBody().replace('No issue: test', 'Refs #44'), steps).ok);
  assert.ok(checkPrBody(validBody().replace('No issue: test', 'Capability: docs'), steps).errors.some((e) => e.includes('No issue')));
});

test('implementer and reviewer must differ', () => {
  assert.ok(checkPrBody(validBody().replace('Review: claude-opus-5-5', 'Review: gpt-6.1-luna'), steps).errors.some((e) => e.includes('same model')));
});

test('unchecked checklist item fails', () => {
  assert.ok(checkPrBody(validBody().replace('- [x] One', '- [ ] One'), steps).errors.some((e) => e.includes('not checked')));
});

test('no PR body workflow exists and CI does not reference pr-body', () => {
  assert.equal(existsSync('.github/workflows/pr-body.yml'), false);
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.doesNotMatch(ci, /pr-body/);
});

test('CI keeps the existing build job, scope step and CI verify command', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /\n  build:\n/);
  assert.match(ci, /run: scripts\/verify\.sh --ci/);
  assert.match(ci, /id: scope/);
});

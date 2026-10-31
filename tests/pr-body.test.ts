import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { checkPrBody, SECTIONS, verifySteps } from '../scripts/check-pr-body.mjs';

const verify = readFileSync('scripts/verify.sh', 'utf8');
const steps = verifySteps(verify);
function validBody(names = steps): string {
  return `## Capacidad\nNo issue: test\n\n## Resultado de verify\n\`\`\`text\nmode: full\n${names.map((s) => `${s}: PASS`).join('\n')}\n\`\`\`\nTest count: 380\n\n## Evidencia\nTest output.\n\n## Revisión\nPlan: claude-opus-5-5\nImplement: gpt-6.1-luna\nTest: gpt-6.1-luna\nVerify: gpt-6.1-sol\nReview: claude-opus-5-5\nFindings: none.\n\n## Checklist\n- [x] One\n- [x] Two\n- [x] Three\n- [x] Four\n`;
}

test('verifySteps includes the mandatory CI steps and the required e2e steps', () => {
  const ciMatch = verify.match(/^CI_STEPS=\(([^)]*)\)/m);
  assert.ok(ciMatch, 'CI_STEPS array exists in scripts/verify.sh');
  const ciSteps = ciMatch[1].trim().split(/\s+/);
  for (const step of ['no-legacy', 'install', 'typecheck', 'test', 'evaluate', 'build', 'dist-check', 'build-lab']) {
    assert.ok(ciSteps.includes(step), `${step} is in CI_STEPS`);
  }
  for (const step of ciSteps) {
    assert.ok(steps.includes(step), `${step} is included in verify steps`);
  }

  const skill = readFileSync('.agents/skills/verify-futbol-excitante/SKILL.md', 'utf8');
  const e2eSteps = skill.split('\n').flatMap((line) => {
    const match = line.match(/^\|\s*([^|]+?)\s*\|/);
    if (!match) return [];
    const name = match[1].trim();
    return /^[a-z0-9-]+$/.test(name) && (name.includes('e2e') || name === 'smoke' || name === 'pad-smoke') ? [name] : [];
  });
  assert.ok(e2eSteps.length > 0, 'verify skill lists required e2e steps');
  assert.ok(e2eSteps.includes('keeper-e2e-touch'), 'verify skill includes keeper-e2e-touch');
  for (const step of e2eSteps) assert.ok(steps.includes(step), `${step} is included in verify steps`);
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

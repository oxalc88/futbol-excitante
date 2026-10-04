import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { qualityPlan } from '../../gauntlet/runtime/product-quality.js';

const args = process.argv.slice(2);
const option = (key: string) => args[args.indexOf(key) + 1];
if (!args.includes('--base')) throw new Error('usage: product-quality --base COMMIT [--head COMMIT] [--execute --out docs/evidence/OBJECTIVE/quality.json] [--elevated-risk] [--architecture-changed]');
if (args.includes('--expected-paths')) {
  if (args.includes('--execute') || args.includes('--out')) throw new Error('expected paths are advisory only; execution requires actual git scope');
  const expected = JSON.parse(readFileSync(option('--expected-paths'), 'utf8'));
  console.log(JSON.stringify({ advisory: true, plan: qualityPlan(expected, args.includes('--elevated-risk'), args.includes('--architecture-changed')) }, null, 2));
  process.exit(0);
}
const base = execFileSync('git', ['rev-parse', `${option('--base')}^{commit}`], { encoding: 'utf8' }).trim();
const head = args.includes('--head') ? option('--head') : undefined;
const output = args.includes('--out') ? option('--out') : undefined;
if (args.includes('--execute') && !output) throw new Error('--out required for execution receipt');
const paths = execFileSync('git', ['diff', '--name-only', base, ...(head ? [head] : [])], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
if (!head) paths.push(...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean));
const scope = [...new Set(paths)].filter(p => p !== output && !/^gauntlet\/(?:state\/|trajectory\/horizons\/|evals\/results\/)/.test(p)).sort();
// Editing accepted evidence is elevated risk; fresh candidate evidence has no authority yet.
const existingEvidenceChanged = scope.some(p => /^(?:docs\/evidence|docs\/screenshots)\//.test(p) && spawnSync('git', ['cat-file', '-e', `${base}:${p}`]).status === 0);
const elevated_risk = args.includes('--elevated-risk') || existingEvidenceChanged;
const architecture_changed = args.includes('--architecture-changed');
const plan = qualityPlan(scope, elevated_risk, architecture_changed);
const hashes = Object.fromEntries(scope.map(p => {
  let bytes: Buffer;
  try { bytes = head ? execFileSync('git', ['show', `${head}:${p}`]) : readFileSync(p); } catch { bytes = Buffer.from('<deleted>'); }
  return [p, createHash('sha256').update(bytes).digest('hex')];
}));
const report = { schema_version: 1, base_commit: base, elevated_risk, architecture_changed, plan, source_hashes: hashes, checks: [] as Array<{ id: string; exit_code: number | null; log: string }> };
if (args.includes('--execute')) {
  if (head) throw new Error('execute operates on the current working tree; --head is read-only');
  const logDir = 'artifacts/gauntlet/quality';
  mkdirSync(logDir, { recursive: true });
  for (const check of plan.checks) {
    const result = spawnSync(check.command[0]!, check.command.slice(1), { encoding: 'utf8', env: { ...process.env, GAUNTLET_EVAL_DURABLE: '0', GAUNTLET_EVIDENCE_CAPTURE: '0' }, maxBuffer: 64 * 1024 * 1024 });
    const log = `${logDir}/${check.id.replace(':', '-')}.log`;
    writeFileSync(log, `${result.stdout ?? ''}${result.stderr ?? ''}${result.error?.message ?? ''}`);
    report.checks.push({ id: check.id, exit_code: result.status, log });
    process.stderr.write(`${check.id}: ${result.status === 0 ? 'PASS' : 'FAIL'}\n`);
  }
  mkdirSync(dirname(output!), { recursive: true });
  writeFileSync(output!, JSON.stringify(report, null, 2) + '\n');
  if (report.checks.some(c => c.exit_code !== 0)) process.exitCode = 1;
}
process.stdout.write(JSON.stringify(report, null, 2) + '\n');

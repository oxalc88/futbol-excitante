import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, renameSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { qualityPlan } from '../../gauntlet/runtime/product-quality.js';
import { RUNTIME_POLICY } from '../../gauntlet/runtime/policy.js';
import { qualityPreflight, repairCheck, requireRepairProof, rememberFailure, runQualityChecks, spawnQualityCheck, initializeRecoveryBudget, recoveryTimeRemaining, reserveRepairAttempt, qualityTimeout, RecoveryBlockedError, type QualityRecovery, type QualityResult } from '../../gauntlet/runtime/quality-execution.js';

import { executeScopedQuality } from '../../gauntlet/runtime/scoped-quality-command.js';
const args = process.argv.slice(2);
const installedVersion = existsSync('gauntlet/VERSION.json') ? JSON.parse(readFileSync('gauntlet/VERSION.json','utf8')).version : '0.11.3';
if (args.includes('--stage') || Number(installedVersion.split('.')[1]) >= 12) {
  await executeScopedQuality(args);
} else {
const option = (key: string) => args[args.indexOf(key) + 1];
if (!args.includes('--base')) throw new Error('usage: product-quality --base COMMIT [--head COMMIT] [--execute [--repair diagnosis.json] --out docs/evidence/OBJECTIVE/quality.json] [--elevated-risk] [--architecture-changed]');
if (args.includes('--repair') && !args.includes('--execute')) throw new Error('--repair requires --execute');
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
if (args.includes('--execute') && realpathSync(process.cwd()) !== realpathSync(execFileSync('git', ['rev-parse', '--show-toplevel'], {encoding:'utf8'}).trim())) throw new Error('Run quality checks from the repository root');
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
const report = { schema_version: 1, base_commit: base, elevated_risk, architecture_changed, plan, source_hashes: hashes,
  execution_mode: args.includes('--repair') ? 'repair' : 'full', status: 'NOT_RUN', checks: [] as QualityResult[],
  recovery_budget: null as QualityRecovery['budget'] | null, blocked_reason: null as string | null };
if (args.includes('--execute')) {
  if (head) throw new Error('execute operates on the current working tree; --head is read-only');
  const objective = output?.match(/^docs\/evidence\/([A-Za-z0-9._-]+)\/quality\.json$/)?.[1];
  if (!objective || objective === '.' || objective === '..') throw new Error('--out must be docs/evidence/OBJECTIVE/quality.json');
  const root = process.cwd();
  const localDir = `.delivery-local/quality/${objective}`;
  mkdirSync(localDir, { recursive: true });
  const recoveryPath = `${localDir}/recovery.json`;
  let recovery: QualityRecovery | null = null;
  const saveRecovery = () => { writeFileSync(`${recoveryPath}.tmp`, JSON.stringify(recovery, null, 2)+'\n'); renameSync(`${recoveryPath}.tmp`, recoveryPath); };
  const saveReport = () => { mkdirSync(dirname(output!), { recursive: true }); writeFileSync(output!, JSON.stringify(report, null, 2)+'\n'); };
  // Invalidate a prior receipt before preflight/recovery can refuse this run.
  report.checks = plan.checks.map(c => ({ id: c.id, status: 'NOT_RUN', exit_code: null, log: null, duration_ms: null }));
  saveReport();
  try {
  if (existsSync(recoveryPath)) {
    recovery = JSON.parse(readFileSync(recoveryPath, 'utf8'));
    const allowed = qualityPlan(['gauntlet/runtime/quality-execution.ts']).checks.find(c => c.id === recovery?.failure?.check?.id);
    if (!recovery || recovery.schema_version !== 1 || !/^[a-f0-9]{64}$/.test(recovery.failure?.signature) || !Array.isArray(recovery.failure.failed_test_files) || !Number.isInteger(recovery.identical_failures) || recovery.identical_failures < 1 || !allowed || JSON.stringify(allowed.command) !== JSON.stringify(recovery.failure.check.command)) throw new Error('invalid quality recovery record');
    initializeRecoveryBudget(recovery); saveRecovery();
    report.recovery_budget = recovery.budget;
    recoveryTimeRemaining(recovery);
  }
  const toolchain = qualityPreflight(root);
  const context = createHash('sha256').update(JSON.stringify({ base, head: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), plan, hashes, toolchain })).digest('hex');
  const requestedRepair = args.includes('--repair');
  let checks = plan.checks, diagnosis = '', wholeCheck = false;
  if (requestedRepair) {
    if (!recovery) throw new Error('No prior failure to repair');
    const input = JSON.parse(readFileSync(option('--repair'), 'utf8'));
    if (typeof input.diagnosis !== 'string' || !input.diagnosis.trim()) throw new Error('Repair requires a written diagnosis');
    diagnosis = input.diagnosis.trim();
    const focused = repairCheck(recovery);
    reserveRepairAttempt(recovery); saveRecovery();
    checks = [focused.check]; wholeCheck = focused.whole_check;
  } else {
    requireRepairProof(recovery, context);
    // A proof unlocks only one fresh full run, including after interruption.
    if (recovery) { delete recovery.repair; saveRecovery(); }
  }
  const runId = `${Date.now()}-${process.pid}`;
  const logDir = `artifacts/gauntlet/quality/${objective}/${runId}`;
  mkdirSync(logDir, { recursive: true });
  report.status = 'RUNNING'; saveReport();
  const results = await runQualityChecks(checks, async check => {
    const log = `${logDir}/${check.id.replace(':', '-')}.log`;
    const result = await spawnQualityCheck(root, check, resolve(log), qualityTimeout(check, recovery)); result.log = log;
    process.stderr.write(`${check.id}: ${result.status}\n`);
    if (!requestedRepair) { report.checks = report.checks.map(r => r.id === result.id ? result : r); saveReport(); }
    return result;
  });
  // The deadline covers repair and the subsequent full gate, including checks
  // that finish as the deadline expires. Such a run cannot create repair/PASS proof.
  let deadlineError: RecoveryBlockedError | null = null;
  if (recovery) {
    try { recoveryTimeRemaining(recovery); }
    catch (error) { if (!(error instanceof RecoveryBlockedError)) throw error; deadlineError = error; }
  }
  const failure = results.find(r => r.status === 'FAIL');
  if (failure) {
    const original = requestedRepair ? recovery!.failure.check : checks.find(c => c.id === failure.id)!;
    recovery = rememberFailure(recovery, checks.find(c => c.id === failure.id)!, failure);
    // Keep the original full command after a narrowed repair fails.
    recovery.failure.check = original;
    saveRecovery(); report.status = 'FAIL'; process.exitCode = 1;
    if (recovery.budget!.repair_attempts >= RUNTIME_POLICY.verification.recovery.maximum_repair_attempts) {
      deadlineError ??= new RecoveryBlockedError('RECOVERY_BLOCKED: repair attempts exhausted without passing verification; preserve logs and report the blocked objective');
    }
  } else if (deadlineError) { delete recovery!.repair; saveRecovery(); report.status = 'RECOVERY_BLOCKED'; }
  else if (requestedRepair) {
    recovery!.repair = { context_hash: context, signature: recovery!.failure.signature, diagnosis, whole_check: wholeCheck };
    saveRecovery(); report.status = 'REPAIR_PASS';
  } else { rmSync(recoveryPath, { force: true }); report.status = 'PASS'; }
  if (requestedRepair) {
    // Diagnostic passes never populate the acceptance receipt's required checks.
    writeFileSync(`${localDir}/repair-${runId}.json`, JSON.stringify({ execution_mode: 'repair', status: report.status, diagnosis, checks: results }, null, 2)+'\n');
  } else report.checks = results;
  report.recovery_budget = recovery?.budget ?? null;
  saveReport();
  if (deadlineError) throw deadlineError;
  } catch (error) {
    if (!(error instanceof RecoveryBlockedError)) throw error;
    report.status = 'RECOVERY_BLOCKED'; report.blocked_reason = error.message;
    report.recovery_budget = recovery?.budget ?? null;
    if (recovery) { delete recovery.repair; saveRecovery(); }
    saveReport();
    writeFileSync(`${localDir}/blocked.json`, JSON.stringify({ status: report.status, reason: report.blocked_reason,
      recovery, receipt: output, logs: `artifacts/gauntlet/quality/${objective}` }, null, 2)+'\n');
    process.stderr.write(`${error.message}\n`); process.exitCode = 1;
  }
}
process.stdout.write(JSON.stringify(report, null, 2) + '\n');

}

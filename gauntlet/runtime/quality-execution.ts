import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, readFileSync, realpathSync } from 'node:fs';
import { RUNTIME_POLICY } from './policy.js';
import type { QualityCheck } from './product-quality.js';

export interface QualityResult {
  id: string;
  status: 'PASS' | 'FAIL' | 'NOT_RUN';
  exit_code: number | null;
  log: string | null;
  duration_ms: number | null;
  timeout_ms?: number;
  failure_signature?: string;
  failed_test_files?: string[];
  failure_excerpt?: string[];
}
export interface QualityFailure {
  check: QualityCheck;
  signature: string;
  failed_test_files: string[];
}
export interface QualityRecovery {
  schema_version: 1;
  failure: QualityFailure;
  identical_failures: number;
  budget?: { started_at_ms: number; repair_attempts: number; history_before_budget: 'MEASURED' | 'UNAVAILABLE' };
  repair?: { context_hash: string; signature: string; diagnosis: string; whole_check: boolean };
}

export class RecoveryBlockedError extends Error {}
export function initializeRecoveryBudget(recovery: QualityRecovery, now = Date.now()): void {
  // Older records have no attempt/time history. Start a prospective budget;
  // never claim their earlier experiments were measured as zero.
  recovery.budget ??= { started_at_ms: now, repair_attempts: 0, history_before_budget: 'UNAVAILABLE' };
}
export function recoveryTimeRemaining(recovery: QualityRecovery, now = Date.now()): number {
  const budget = recovery.budget;
  if (!budget || !Number.isSafeInteger(budget.started_at_ms) || budget.started_at_ms <= 0 ||
      !Number.isSafeInteger(budget.repair_attempts) || budget.repair_attempts < 0 ||
      !['MEASURED', 'UNAVAILABLE'].includes(budget.history_before_budget)) throw new Error('invalid recovery budget');
  if (now < budget.started_at_ms) throw new RecoveryBlockedError('RECOVERY_BLOCKED: clock moved backwards; preserve the record and review the execution environment');
  const remaining = RUNTIME_POLICY.verification.recovery.maximum_elapsed_ms - (now - budget.started_at_ms);
  if (remaining <= 0) throw new RecoveryBlockedError('RECOVERY_BLOCKED: recovery deadline reached; preserve logs and report the blocked objective');
  return remaining;
}
export function reserveRepairAttempt(recovery: QualityRecovery, now = Date.now()): void {
  recoveryTimeRemaining(recovery, now);
  if (recovery.budget!.repair_attempts >= RUNTIME_POLICY.verification.recovery.maximum_repair_attempts) {
    throw new RecoveryBlockedError('RECOVERY_BLOCKED: repair attempt limit reached; preserve logs and report the blocked objective');
  }
  // Persist this reservation before launching a repair, so interruption counts.
  recovery.budget!.repair_attempts++;
  delete recovery.repair;
}
export function qualityTimeout(check: QualityCheck, recovery: QualityRecovery | null = null, now = Date.now()): number {
  // Only the canonical whole Node battery earns the measured larger budget.
  const configured = check.id === 'regression-tests' && check.command.join(' ') === 'pnpm run test'
    ? RUNTIME_POLICY.verification.check_timeout_ms['regression-tests'] : RUNTIME_POLICY.verification.timeout_ms;
  return recovery ? Math.min(configured, recoveryTimeRemaining(recovery, now)) : configured;
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function failureDetails(check: QualityCheck, exit: number | null, output: string) {
  const clean = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
  const files = [...new Set([...clean.matchAll(/^\s*FAIL\s+(?:\|[^|]+\|\s+)?(tests\/[^\s]+\.(?:test|spec)\.[cm]?[jt]sx?)(?:\s|$)/gm)].map(m => m[1]!))].sort();
  const failedCount = clean.match(/Test Files\s+(\d+) failed/);
  // Unknown/partial reporter output falls back to the whole failed check.
  const failed_test_files = failedCount && Number(failedCount[1]) === files.length ? files : [];
  const failure_excerpt = clean.split(/\r?\n/).filter(l => /\bFAIL\b|Error:|AssertionError|TimeoutError|timed out|timeout/i.test(l))
    .slice(0, RUNTIME_POLICY.verification.failure_excerpt_lines).map(l => l.trim().slice(0, 300));
  const stable = failure_excerpt.map(l => l.replace(/\b\d+(?:\.\d+)?\s*(?:ms|seconds?|minutes?)\b/g, '<duration>').replace(/\b\d{4}-\d\d-\d\dT[\d:.]+Z\b/g, '<time>'));
  return { failure_signature: hash({ id: check.id, exit, files: failed_test_files, reasons: stable }), failed_test_files, failure_excerpt };
}

export async function runQualityChecks(checks: QualityCheck[], run: (check: QualityCheck) => Promise<QualityResult>): Promise<QualityResult[]> {
  if (!checks.length || new Set(checks.map(c => c.id)).size !== checks.length) throw new Error('invalid quality check batch');
  const results: QualityResult[] = [];
  let stopped = false;
  for (const check of checks) {
    if (stopped) { results.push({ id: check.id, status: 'NOT_RUN', exit_code: null, log: null, duration_ms: null }); continue; }
    let result: QualityResult;
    try { result = await run(check); }
    catch (error) { result = { id: check.id, status: 'FAIL', exit_code: null, log: null, duration_ms: null, ...failureDetails(check, null, String(error)) }; }
    if (result.id !== check.id || (result.exit_code !== null && !Number.isInteger(result.exit_code)) || result.status === 'NOT_RUN' || (result.status === 'PASS') !== (result.exit_code === 0)) {
      result = { ...result, id: check.id, status: 'FAIL', exit_code: null, ...failureDetails(check, null, 'Error: invalid or interrupted quality result') };
    }
    results.push(result);
    stopped = result.status !== 'PASS';
  }
  return results;
}

export function rememberFailure(previous: QualityRecovery | null, check: QualityCheck, result: QualityResult): QualityRecovery {
  if (result.status !== 'FAIL' || !result.failure_signature) throw new Error('failure signature required');
  return { schema_version: 1, failure: { check, signature: result.failure_signature, failed_test_files: result.failed_test_files ?? [] },
    identical_failures: previous?.failure.signature === result.failure_signature ? previous.identical_failures + 1 : 1,
    budget: previous?.budget ?? { started_at_ms: Date.now(), repair_attempts: 0, history_before_budget: previous ? 'UNAVAILABLE' : 'MEASURED' } };
}
export function repairCheck(recovery: QualityRecovery): { check: QualityCheck; whole_check: boolean } {
  const original = recovery.failure.check;
  const node = original.command.join(' ') === 'pnpm run test' || (original.command[0] === 'pnpm' && original.command.includes('vitest') && original.command.includes('node'));
  const browser = original.command.join(' ') === 'pnpm run test-browser';
  const files = recovery.failure.failed_test_files;
  if (recovery.identical_failures < 2 && (node || browser) && files.length && files.every(f => /^tests\/(?!.*\.\.)[^\s]+\.(?:test|spec)\.[cm]?[jt]sx?$/.test(f))) {
    return { whole_check: false, check: { id: original.id, command: ['pnpm', 'exec', 'vitest', 'run', ...files, '--project', browser ? 'browser' : 'node', '--passWithNoTests=false'] } };
  }
  return { check: original, whole_check: true };
}
export function requireRepairProof(recovery: QualityRecovery | null, context: string): void {
  if (!recovery) return;
  if (recovery.schema_version !== 1 || !Number.isInteger(recovery.identical_failures) || recovery.identical_failures < 1) throw new Error('invalid quality recovery record');
  const proof = recovery.repair;
  if (!proof || proof.context_hash !== context || proof.signature !== recovery.failure.signature || !proof.diagnosis?.trim() || (recovery.identical_failures >= 2 && !proof.whole_check)) {
    if ((recovery.budget?.repair_attempts ?? 0) >= RUNTIME_POLICY.verification.recovery.maximum_repair_attempts) {
      throw new RecoveryBlockedError('RECOVERY_BLOCKED: repair attempts exhausted without current verified proof; preserve logs and report the blocked objective');
    }
    throw new Error('REPAIR_REQUIRED: diagnose and run --repair before another full gate; repair proof must match the current sources/toolchain');
  }
}

// Always on, independent of harness and opt-in runtime optimizations.
export function qualityPreflight(root: string) {
  const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim();
  if (realpathSync(root) !== realpathSync(gitRoot)) throw new Error('Run quality checks from the repository root');
  const tools = readFileSync(`${root}/mise.toml`, 'utf8').split('[tools]')[1]?.split(/\n\[/)[0] ?? '';
  const node = tools.match(/^node\s*=\s*"([^"]+)"/m)?.[1];
  const pnpm = tools.match(/^pnpm\s*=\s*"([^"]+)"/m)?.[1];
  if (!node || !pnpm || process.versions.node !== node) throw new Error('Pinned Node mismatch: use mise exec');
  const actualPnpm = execFileSync('pnpm', ['--version'], { cwd: root, encoding: 'utf8', timeout: 10000 }).trim();
  if (actualPnpm !== pnpm || JSON.parse(readFileSync(`${root}/package.json`, 'utf8')).packageManager !== `pnpm@${pnpm}`) throw new Error('Pinned pnpm mismatch: use mise exec');
  const vite = JSON.parse(readFileSync(`${root}/node_modules/vite/package.json`, 'utf8')).version;
  const importer = readFileSync(`${root}/pnpm-lock.yaml`, 'utf8').split(/\n  \.:\r?\n/)[1]?.split(/\n(?:  \S|packages:)/)[0];
  const lockedVite = importer?.match(/^ {6}vite:\r?\n {8}specifier:[^\n]+\r?\n {8}version:\s*(\d+\.\d+\.\d+)/m)?.[1];
  if (!lockedVite || vite !== lockedVite) throw new Error('Local Vite differs from lockfile: install frozen project dependencies');
  return { node, pnpm, vite };
}

export function spawnQualityCheck(root: string, check: QualityCheck, logPath: string, timeout = qualityTimeout(check)): Promise<QualityResult> {
  return new Promise(resolve => {
    const started = Date.now();
    const log = createWriteStream(logPath);
    let tail = '', error = '', timedOut = false, cancelled = false;
    const child = spawn(check.command[0]!, check.command.slice(1), { cwd: root, shell: false, detached: process.platform !== 'win32',
      env: { ...process.env, CI: '1', NO_COLOR: '1', FORCE_COLOR: '0', GAUNTLET_EVAL_DURABLE: '0', GAUNTLET_EVIDENCE_CAPTURE: '0' } });
    const kill = () => { try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { /* Already exited. */ } };
    const cancel = () => { cancelled = true; kill(); };
    process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
    const timer = setTimeout(() => { timedOut = true; kill(); }, timeout);
    const capture = (chunk: Buffer) => { tail = (tail + chunk.toString()).slice(-128000); };
    child.stdout?.on('data', capture); child.stderr?.on('data', capture);
    child.stdout?.pipe(log, { end: false }); child.stderr?.pipe(log, { end: false });
    log.on('error', e => { error = e.message; kill(); });
    child.on('error', e => { error = e.message; });
    // Descendants may keep inherited stdout open after the main command exits.
    child.once('exit', kill);
    child.on('close', (code, signal) => {
      clearTimeout(timer); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
      // Clean descendants, including test servers, even after their parent exits.
      kill();
      const note = error || (timedOut ? 'Error: quality check timeout' : cancelled ? 'Error: quality check cancelled' : signal ? `Error: terminated by ${signal}` : '');
      const exit = note ? null : code;
      const finish = () => resolve({ id: check.id, status: exit === 0 ? 'PASS' as const : 'FAIL' as const, exit_code: exit,
        log: logPath, duration_ms: Date.now() - started, timeout_ms: timeout, ...(exit !== 0 ? failureDetails(check, exit, `${tail}\n${note}`) : {}) });
      if (log.destroyed) finish(); else { log.once('close', finish); log.end(note ? `\n${note}\n` : '', finish); }
    });
  });
}

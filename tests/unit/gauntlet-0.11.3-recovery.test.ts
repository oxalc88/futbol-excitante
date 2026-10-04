import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializeRecoveryBudget, qualityTimeout, recoveryTimeRemaining, rememberFailure, requireRepairProof, reserveRepairAttempt, type QualityRecovery } from '../../gauntlet/runtime/quality-execution.js';
import { qualityPlan, validateQualityReceipt } from '../../gauntlet/runtime/product-quality.js';
import { verificationTimeout } from '../../gauntlet/runtime/verification-batch.js';

const nodeCheck = { id: 'regression-tests', command: ['pnpm', 'run', 'test'] };
const recovery = (): QualityRecovery => ({ schema_version: 1, identical_failures: 1,
  failure: { check: nodeCheck, signature: 'a'.repeat(64), failed_test_files: [] } });

describe('0.11.3 shared quality recovery budgets', () => {
  it('does not let optional batching prematurely terminate canonical quality execution', () => {
    const command = ['pnpm', 'run', 'gauntlet:quality', '--', '--base', 'HEAD', '--execute', '--out', 'docs/evidence/A/quality.json'];
    expect(verificationTimeout({ id: 'quality', command: [...command, '--repair', 'diagnosis.json'] })).toBe(2430000);
    const full = verificationTimeout({ id: 'quality', command });
    const protectedChecks = qualityPlan(['gauntlet/runtime/quality-execution.ts']).checks;
    expect(full).toBeGreaterThan(protectedChecks.length * 1200000);
    for (const argv of [nodeCheck.command, ['pnpm', 'run', 'gauntlet:quality'], ['sh', '-c', command.join(' ')]]) {
      expect(verificationTimeout({ id: 'quality', command: argv })).toBe(1200000);
    }
  });
  it('grants 40 minutes only to the canonical whole Node suite', () => {
    expect(qualityTimeout(nodeCheck)).toBe(2400000);
    for (const check of [
      { ...nodeCheck, command: ['pnpm', 'exec', 'vitest', 'run', 'tests/one.test.ts', '--project', 'node'] },
      { id: 'browser-tests', command: ['pnpm', 'run', 'test-browser'] },
      { id: 'build', command: ['pnpm', 'run', 'build'] },
      { id: 'domain:ball', command: ['pnpm', 'exec', 'vitest', 'run', 'tests/unit/ball', '--project', 'node'] },
    ]) expect(qualityTimeout(check)).toBe(1200000);
  });
  it('caps each command by the remaining recovery deadline and rejects clock rollback', () => {
    const state = recovery(); initializeRecoveryBudget(state, 1000);
    expect(qualityTimeout(nodeCheck, state, 1000 + 5300000)).toBe(100000);
    expect(() => recoveryTimeRemaining(state, 1000 + 5400000)).toThrow('RECOVERY_BLOCKED');
    expect(() => recoveryTimeRemaining(state, 999)).toThrow('clock moved backwards');
  });
  it('preserves the budget across changed failures and source-bound proofs', () => {
    const state = recovery(); initializeRecoveryBudget(state);
    reserveRepairAttempt(state); reserveRepairAttempt(state);
    const next = rememberFailure(state, nodeCheck, { id: nodeCheck.id, status: 'FAIL', exit_code: 1, log: 'worker.log', duration_ms: 5, failure_signature: 'b'.repeat(64) });
    expect(next.identical_failures).toBe(1); expect(next.budget).toEqual(state.budget);
    expect(() => reserveRepairAttempt(next)).toThrow('repair attempt limit');
    // A successful final allowed repair can still unlock its one full gate.
    next.repair = { signature: next.failure.signature, context_hash: 'verified', diagnosis: 'verified repair', whole_check: true };
    expect(() => requireRepairProof(next, 'verified')).not.toThrow();
    expect(() => requireRepairProof(next, 'changed')).toThrow('RECOVERY_BLOCKED');
  });
  it('does not invent earlier history when upgrading a 0.11.2 record', () => {
    const state = recovery(); initializeRecoveryBudget(state, 1000);
    expect(state.budget).toEqual({ started_at_ms: 1000, repair_attempts: 0, history_before_budget: 'UNAVAILABLE' });
    initializeRecoveryBudget(state, 2000); expect(state.budget!.started_at_ms).toBe(1000);
    for (const budget of [ { ...state.budget!, repair_attempts: -1 }, { ...state.budget!, started_at_ms: NaN } ]) {
      expect(() => recoveryTimeRemaining({ ...state, budget }, 2000)).toThrow('invalid recovery budget');
    }
  });
  it('never accepts a blocked receipt with zero test exits', () => {
    const plan = qualityPlan(['src/apps/browser/styles.css']);
    expect(() => validateQualityReceipt(plan, { status: 'RECOVERY_BLOCKED', checks: plan.checks.map(c => ({ id: c.id, exit_code: 0 })) })).toThrow('complete full');
  });
  it('persists reservations across sessions and blocks changed-signature experiments before launch', () => {
    const dir = mkdtempSync(join(tmpdir(), 'quality-budget-')), root = join(dir, 'repo'), bin = join(dir, 'bin');
    mkdirSync(root); mkdirSync(bin);
    const write = (p: string, content: string) => { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), content); };
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    const repo = process.cwd();
    const cli = (...args: string[]) => spawnSync(process.execPath, ['--import', join(repo, 'node_modules/tsx/dist/loader.mjs'), join(repo, 'scripts/gauntlet/product-quality.ts'), ...args],
      { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
    try {
      git('init', '-b', 'main'); git('config', 'user.name', 'test'); git('config', 'user.email', 'test@example.com');
      write('.gitignore', 'node_modules/\n.delivery-local/\nartifacts/\n');
      write('mise.toml', `[tools]\nnode = "${process.versions.node}"\npnpm = "11.10.0"\n`);
      write('package.json', '{"packageManager":"pnpm@11.10.0"}');
      write('pnpm-lock.yaml', 'importers:\n\n  .:\n    devDependencies:\n      vite:\n        specifier: ^6.3.5\n        version: 6.4.3\n\npackages:\n');
      write('node_modules/vite/package.json', '{"version":"6.4.3"}');
      write('src/apps/browser/styles.css', 'before'); git('add', '.'); git('commit', '-m', 'base');
      const base = git('rev-parse', 'HEAD'); write('src/apps/browser/styles.css', 'after');
      writeFileSync(join(bin, 'pnpm'), `#!/usr/bin/env node\nconst fs=require('fs'),a=process.argv.slice(2);if(a[0]==='--version'){console.log('11.10.0');process.exit(0);}fs.appendFileSync('.delivery-local/calls',a.join(' ')+'\\n');if(a.join(' ')==='run test'){console.error('Error: '+fs.readFileSync('.delivery-local/reason','utf8'));process.exit(1);}console.log('PASS');\n`, { mode: 0o755 });
      const args = ['--base', base, '--execute', '--out', 'docs/evidence/TEST/quality.json'];
      const path = '.delivery-local/quality/TEST/recovery.json';
      const state = () => JSON.parse(readFileSync(join(root, path), 'utf8')) as QualityRecovery;
      write('.delivery-local/reason', 'worker error A'); expect(cli(...args).status).toBe(1);
      const started = state().budget!.started_at_ms;
      write('.delivery-local/diagnosis.json', '{"diagnosis":"Investigated worker blocking; verifying repair"}');
      for (const reason of ['worker error B', 'worker error C']) {
        write('.delivery-local/reason', reason); write('src/apps/browser/styles.css', reason);
        expect(cli(...args, '--repair', '.delivery-local/diagnosis.json').status).toBe(1);
      }
      expect(state().budget!.repair_attempts).toBe(2); expect(state().budget!.started_at_ms).toBe(started);
      expect(state().identical_failures).toBe(1);
      expect(JSON.parse(readFileSync(join(root, 'docs/evidence/TEST/quality.json'), 'utf8')).status).toBe('RECOVERY_BLOCKED');
      expect(JSON.parse(readFileSync(join(root, '.delivery-local/quality/TEST/blocked.json'), 'utf8')).recovery.budget.repair_attempts).toBe(2);
      const calls = () => readFileSync(join(root, '.delivery-local/calls'), 'utf8');
      const before = calls(); const blocked = cli(...args, '--repair', '.delivery-local/diagnosis.json');
      expect(blocked.status).toBe(1); expect(blocked.stderr).toContain('RECOVERY_BLOCKED'); expect(calls()).toBe(before);
      const receipt = () => JSON.parse(readFileSync(join(root, 'docs/evidence/TEST/quality.json'), 'utf8'));
      expect(receipt().status).toBe('RECOVERY_BLOCKED'); expect(receipt().checks.every((c: any) => c.status === 'NOT_RUN' && c.exit_code === null)).toBe(true);
      expect(JSON.parse(readFileSync(join(root, '.delivery-local/quality/TEST/blocked.json'), 'utf8')).logs).toBe('artifacts/gauntlet/quality/TEST');
      expect(cli(...args).stderr).toContain('RECOVERY_BLOCKED'); expect(calls()).toBe(before);
      // Deadline refusal applies before proof validation, even for a full gate.
      const expired = state(); expired.budget!.started_at_ms = Date.now() - 5400001;
      write(path, JSON.stringify(expired)); expect(cli(...args).stderr).toContain('deadline reached'); expect(calls()).toBe(before);
      // Corrupted persisted budgets fail closed before test execution.
      expired.budget!.repair_attempts = -1; write(path, JSON.stringify(expired));
      expect(cli(...args).stderr).toContain('invalid recovery budget'); expect(calls()).toBe(before);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 10000);
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../../', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'oxalc88-hook-'));
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^GIT_(AUTHOR|COMMITTER)_/.test(key) || key === 'EMAIL') delete env[key];
const run = (command, args, overrides = {}) => spawnSync(command, args, { cwd: root, env: { ...env, ...overrides }, encoding: 'utf8' });
const git = (...args) => run('git', args);
const passes = result => assert.equal(result.status, 0, result.stderr);
const blocks = result => {
  assert.notEqual(result.status, 0, 'Wrong identity unexpectedly committed');
  assert.match(result.stderr, /Commit blocked:/);
};
try {
  passes(git('init', '-b', 'main'));
  passes(git('config', 'user.name', 'Rolando Oxalc'));
  passes(git('config', 'user.email', 'qj.oxalc@gmail.com'));
  mkdirSync(join(root, 'scripts/git'), { recursive: true });
  for (const name of ['install-personal-hooks.sh', 'oxalc88-prepare-commit-msg.sh']) copyFileSync(join(project, 'scripts/git', name), join(root, 'scripts/git', name));
  passes(git('add', 'scripts/git'));
  passes(git('commit', '-m', 'fixture seed'));
  passes(run('sh', ['scripts/git/install-personal-hooks.sh']));
  passes(run('sh', ['scripts/git/install-personal-hooks.sh'])); // Safe reinstall.
  passes(git('commit', '--allow-empty', '-m', 'personal identity accepted'));
  blocks(git('-c', 'user.email=work@example.test', 'commit', '--allow-empty', '-m', 'work config rejected'));
  blocks(git('commit', '--allow-empty', '--no-verify', '--author=Work Account <work@example.test>', '-m', 'author override rejected'));
  blocks(run('git', ['commit', '--allow-empty', '--no-verify', '-m', 'committer override rejected'], { GIT_COMMITTER_NAME: 'Work Account', GIT_COMMITTER_EMAIL: 'work@example.test' }));
  blocks(run('git', ['commit', '--allow-empty', '-m', 'author environment rejected'], { GIT_AUTHOR_NAME: 'Work Account', GIT_AUTHOR_EMAIL: 'work@example.test' }));
  passes(git('checkout', '--orphan', 'branch-without-hook-source'));
  passes(git('rm', '-rf', 'scripts/git'));
  blocks(git('-c', 'user.email=work@example.test', 'commit', '--allow-empty', '--no-verify', '-m', 'branch-independent guard'));
  passes(git('commit', '--allow-empty', '-m', 'personal commit on other branch'));
  passes(git('checkout', 'main'));
  // Existing active default hooks cannot be silently disabled by the installer.
  const hook = join(root, '.git/hooks/pre-commit');
  writeFileSync(hook, '#!/bin/sh\nexit 0\n'); chmodSync(hook, 0o755);
  const conflict = run('sh', ['scripts/git/install-personal-hooks.sh']);
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /Existing active hook/);
  console.log('PASS: personal identity accepted; work config, author/committer overrides and --no-verify rejected; branch changes preserve guard; conflicting hooks preserved.');
} finally {
  rmSync(root, { recursive: true, force: true });
}

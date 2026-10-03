import { execFileSync } from 'node:child_process';
import { readTelemetry, summarizeTelemetry, appendTelemetry } from '../../gauntlet/runtime/telemetry.mjs';
import { verifyAcceptanceDurability } from '../ci/verify-acceptance-durability.mjs';

const [action, objectiveId, acceptanceCommit] = process.argv.slice(2);
const root = process.cwd();
if (action === 'accepted') {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(objectiveId ?? '') || !/^[a-f0-9]{40}$/.test(acceptanceCommit ?? '')) {
    throw new Error('Usage: telemetry.mjs accepted OBJECTIVE_ID FULL_ACCEPTANCE_COMMIT');
  }
  // Inspect the exact acceptance snapshot, so later horizons cannot change the denominator.
  const state = verifyAcceptanceDurability({ objective: objectiveId, acceptanceCommit, ref: acceptanceCommit, mode: 'remote' });
  if (state.status !== 'PASS') throw new Error(`Acceptance bookkeeping is not durable: ${JSON.stringify(state)}`);
  execFileSync('git', ['fetch', 'origin', 'main'], { stdio: 'pipe' });
  execFileSync('git', ['merge-base', '--is-ancestor', acceptanceCommit, 'origin/main'], { stdio: 'pipe' });
  const events = readTelemetry(root);
  const starts = events.filter(e => e.objectiveId === objectiveId && e.type === 'objective_start');
  if (!starts.length) throw new Error('No instrumented objective start; cannot manufacture a measured acceptance');
  const profiles = [...new Set(starts.map(e => e.profile))];
  if (profiles.length !== 1) throw new Error('Objective crosses profiles; exclude from efficiency comparison');
  if (!events.some(e => e.objectiveId === objectiveId && e.type === 'acceptance_remote_verified')) {
    appendTelemetry(root, {sessionId:'acceptance',role:'runtime',model:'none',objectiveId,profile:profiles[0]},
      'acceptance_remote_verified', { acceptanceCommit });
  }
} else if (action !== 'report') throw new Error('Usage: telemetry.mjs report | accepted OBJECTIVE_ID FULL_ACCEPTANCE_COMMIT');
console.log(JSON.stringify(summarizeTelemetry(readTelemetry(root)), null, 2));

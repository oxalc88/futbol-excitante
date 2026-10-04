import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { outcomeDecision, validateMetrics } from './product-trajectory.js';

/** Historical Horizons stay untouched. Future planning must persist selection/outcome. */
export async function auditHorizonProduct(repoRoot: string, version: number, status: string): Promise<{ pass: boolean; detail: string }> {
  if (version <= 38) return { pass: true, detail: 'Frozen legacy Horizon; replan at first strategic reassessment.' };
  try {
    const dir = path.join(repoRoot, 'gauntlet/trajectory/horizons', `v${version}`);
    const selected = JSON.parse(await readFile(path.join(dir, 'selection.json'), 'utf8'));
    if (!selected.problem?.trim() || !selected.smallest_playable_slice?.trim() || !selected.selected_at) throw new Error('missing product selection');
    if (!['COMPLETE', 'EXHAUSTED', 'SUCCESS'].includes(status)) return { pass: true, detail: 'Active product selection recorded.' };
    const attempts = (await readdir(dir)).filter(n=>/^attempt-\d+\.json$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)![0])-Number(b.match(/\d+/)![0]));
    if (!attempts.length) throw new Error('accepted objectives alone cannot complete a Horizon');
    const result = JSON.parse(await readFile(path.join(dir, attempts.at(-1)!), 'utf8'));
    validateMetrics(result.metrics);
    if (result.horizon !== `v${version}` || result.decision !== 'ACCEPT' || outcomeDecision(result.outcome) !== 'ACCEPT' || result.outcome.problem !== selected.problem || result.outcome.smallest_playable_slice !== selected.smallest_playable_slice || !result.acceptances?.length) throw new Error('Horizon lacks a better normal-play outcome');
    return { pass: true, detail: 'Normal-play product outcome ACCEPT with trajectory.' };
  } catch (error) { return { pass: false, detail: error instanceof Error ? error.message : String(error) }; }
}

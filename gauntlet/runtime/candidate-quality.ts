import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { qualityPlan, validateQualityReceipt, validateReviews } from './product-quality.js';

export function verifyCandidateQuality(repoRoot: string, candidate: string, objective: string, builderModel: string, critic: Record<string, unknown>, integration: Record<string, unknown>) {
  const git = (...args: string[]) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
  if (!/^[A-Za-z0-9._-]+$/.test(objective)) throw new Error('invalid objective id');
  const receiptPath = `docs/evidence/${objective}/quality.json`;
  const receipt = JSON.parse(git('show', `${candidate}:${receiptPath}`));
  const base = git('rev-parse', `${candidate}^`).trim();
  if (receipt.base_commit !== base) throw new Error('quality receipt must cover the candidate parent');
  const paths = git('diff', '--name-only', base, candidate).trim().split('\n').filter(p => p && p !== receiptPath).sort();
  if (paths.some(p => /^gauntlet\/(?:state\/|trajectory\/horizons\/|evals\/results\/)/.test(p) || p.endsWith('/manifest.json'))) throw new Error('candidate contains acceptance bookkeeping');
  const elevated = paths.some(p => /^(?:docs\/evidence|docs\/screenshots)\//.test(p) && (() => { try { git('cat-file', '-e', `${base}:${p}`); return true; } catch { return false; } })());
  const plan = qualityPlan(paths, elevated || receipt.elevated_risk === true, receipt.architecture_changed === true);
  if (JSON.stringify(plan) !== JSON.stringify(receipt.plan)) throw new Error('quality plan differs from candidate impact');
  for (const p of paths) {
    let bytes: Buffer;
    try { bytes = execFileSync('git', ['-C', repoRoot, 'show', `${candidate}:${p}`]); } catch { bytes = Buffer.from('<deleted>'); }
    if (createHash('sha256').update(bytes).digest('hex') !== receipt.source_hashes?.[p]) throw new Error(`quality evidence stale: ${p}`);
  }
  validateQualityReceipt(plan, receipt);
  validateReviews(plan, builderModel, critic, integration);
  return { plan, receiptPath };
}

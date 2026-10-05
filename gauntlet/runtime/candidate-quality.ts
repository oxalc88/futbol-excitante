import { validateIntegratedExecution } from './integrated-execution.js';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { snapshot, scopedPlan, verificationArtifact } from './scoped-quality.js';
import { validateScopedProofs } from './check-proof.js';
import { verifyObjectiveAdmission } from './certification.js';
import { qualityPlan, validateQualityReceipt, validateReviews } from './product-quality.js';

export function verifyCandidateQuality(repoRoot: string, candidate: string, objective: string, builderModel: string, critic: Record<string, unknown>, integration: Record<string, unknown>) {
  const git = (...args: string[]) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
  if (!/^[A-Za-z0-9._-]+$/.test(objective)) throw new Error('invalid objective id');
  const integrated=validateIntegratedExecution(repoRoot, objective, candidate);
  const receiptPath = `docs/evidence/${objective}/quality.json`;
  const receipt = JSON.parse(git('show', `${candidate}:${receiptPath}`));
  const base = git('rev-parse', `${candidate}^`).trim();
  if (receipt.base_commit !== base) throw new Error('quality receipt must cover the candidate parent');
  const allPaths = git('diff', '--name-only', base, candidate).trim().split('\n').filter(Boolean);
  for (const p of allPaths.filter(verificationArtifact)) { try { git('cat-file','-e',`${base}:${p}`); } catch { continue; } throw new Error('accepted verification evidence is immutable'); }
  const paths = allPaths.filter(p => p !== receiptPath && !verificationArtifact(p)).sort();
  if (paths.some(p => /^gauntlet\/(?:state\/|certification\/|incidents\/|execution\/|trajectory\/horizons\/|evals\/results\/)/.test(p) || p.endsWith('/manifest.json'))) throw new Error('candidate contains acceptance bookkeeping');
  const elevated = paths.some(p => /^(?:docs\/evidence|docs\/screenshots)\//.test(p) && (() => { try { git('cat-file', '-e', `${base}:${p}`); return true; } catch { return false; } })());
  const before = snapshot(repoRoot, base), after = snapshot(repoRoot, candidate);
  const modern = [before,after].some(source => { try { return Number(JSON.parse(source.read('gauntlet/VERSION.json')!.toString()).version.split('.')[1]) >= 12; } catch { return false; } });
  if (modern && receipt.schema_version !== 2) throw new Error('new candidate cannot downgrade quality schema');
  const plan = receipt.schema_version === 2 ? scopedPlan(paths,before,after,elevated || receipt.elevated_risk === true,receipt.architecture_changed === true,false,!!integrated) : qualityPlan(paths, elevated || receipt.elevated_risk === true, receipt.architecture_changed === true);
  if (JSON.stringify(plan) !== JSON.stringify(receipt.plan)) throw new Error('quality plan differs from candidate impact');
  for (const p of paths) {
    let bytes: Buffer;
    try { bytes = execFileSync('git', ['-C', repoRoot, 'show', `${candidate}:${p}`]); } catch { bytes = Buffer.from('<deleted>'); }
    if (createHash('sha256').update(bytes).digest('hex') !== receipt.source_hashes?.[p]) throw new Error(`quality evidence stale: ${p}`);
  }
  validateQualityReceipt(plan, receipt);
  validateReviews(plan, builderModel, critic, integration);
  if (receipt.schema_version === 2) {
    if (receipt.proof_scope !== 'objective' || plan.schema_version !== 2) throw new Error('objective proof required');
    validateScopedProofs(plan as ReturnType<typeof scopedPlan>,receipt,after,receiptPath);
    verifyObjectiveAdmission(repoRoot,base,plan as ReturnType<typeof scopedPlan>,objective);
  }
  return { plan, receiptPath };
}

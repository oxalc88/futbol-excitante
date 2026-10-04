import { SUITES } from '../../eval/contracts/suites.js';

/** Explicit, conservative impact rules. Unmapped files never earn a review waiver. */
export const DOMAIN_TESTS: Record<string, string[]> = {
  fast: ['tests/unit/eval/foundation-evaluator', 'tests/unit/eval/foundation-promotion'],
  ball: ['tests/unit/ball', 'tests/unit/eval/foundation-evaluator'],
  locomotion: ['tests/unit/locomotion', 'tests/unit/eval/foundation-evaluator'],
  touch_and_actions: ['tests/unit/contacts', 'tests/unit/eval/capability-design-runner'],
  duels: ['tests/unit/eval/duels'],
  goalkeepers: ['tests/unit/eval/goalkeeper'],
  rules: ['tests/unit/eval/rules'],
  fouls: ['tests/unit/eval/fouls', 'tests/unit/loop/advantage'],
  team: ['tests/unit/eval/team', 'tests/unit/gauntlet-0.9-team-declaration.test.ts'],
};
export interface QualityCheck { id: string; command: string[] }
export interface QualityPlan {
  schema_version: 1;
  changed_paths: string[];
  protected_properties: string[];
  suite_ids: string[];
  reviews_required: boolean;
  reasons: string[];
  checks: QualityCheck[];
}
const rules: Array<[RegExp, string[]]> = [
  [/^src\/simulation\/ball\//, ['ball', 'touch_and_actions', 'duels', 'goalkeepers', 'rules', 'fouls', 'team']],
  [/^src\/simulation\/locomotion\//, ['locomotion', 'touch_and_actions', 'duels', 'goalkeepers', 'team']],
  [/^src\/simulation\/(?:contacts|player-contact)\//, ['ball', 'touch_and_actions', 'duels', 'goalkeepers', 'fouls']],
  [/^src\/simulation\/(?:foul-predicate|card-policy|advantage-policy)\.ts$/, ['rules', 'fouls']],
  [/^src\/adapters\/replay\//, ['determinism', 'replay', 'persistence']],
  [/^src\/adapters\/input-browser\/goalkeeper-role\.ts$/, ['goalkeepers', 'team', 'rules']],
  [/^src\/adapters\/input-browser\//, ['touch_and_actions', 'duels', 'goalkeepers', 'rules', 'fouls', 'team']],
  [/^src\/(?:simulation|contracts)\//, ['determinism', 'architecture']],
  [/^(?:eval\/|specs\/|tests\/|gauntlet\/|scripts\/|\.grok\/|\.omp\/|\.opencode\/|AGENTS\.md|package|pnpm|mise|tsconfig|vite|opencode)/, ['assurance', 'architecture']],
];
// Only closed presentation leaves can waive reviews. Composition roots, keyboard,
// browser test bridges and arbitrary renderer changes cannot qualify by a label.
const trivial = /^(?:src\/apps\/browser\/styles\.css|src\/apps\/browser\/controls-legend-ui\.ts|docs\/(?:player-controls|how-to-play)\.md)$/;

export function qualityPlan(paths: string[], elevatedRisk = false, architectureChanged = false): QualityPlan {
  if (!paths.length || paths.some(p => p.includes('..') || p.startsWith('/') || p.includes('\\'))) throw new Error('invalid or empty change scope');
  const evidenceArtifact = /^docs\/(?:evidence|screenshots)\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.(?:json|png|jpg|jpeg|webp|md)$/;
  const changed_paths = [...new Set(paths)].sort();
  const properties = new Set<string>();
  const reasons: string[] = [];
  for (const file of changed_paths) {
    if (trivial.test(file) || evidenceArtifact.test(file)) continue;
    const match = rules.find(([pattern]) => pattern.test(file));
    for (const domain of match?.[1] ?? ['ambiguous']) properties.add(domain);
    reasons.push(`${file}: ${match ? match[1].join(', ') : 'ambiguous impact; full assurance'}`);
  }
  if (!changed_paths.some(p => trivial.test(p)) && properties.size === 0) { properties.add('assurance'); reasons.push('Evidence-only work retains qualitative assurance'); }
  if (elevatedRisk) { properties.add('elevated_regression_risk'); reasons.push('elevated regression evidence'); }
  if (architectureChanged) { properties.add('architecture'); reasons.push('architecture boundary changed'); }
  const broad = ['ambiguous', 'determinism', 'architecture', 'assurance', 'replay', 'persistence', 'elevated_regression_risk'].some(p => properties.has(p));
  const suite_ids = broad ? Object.values(SUITES).map(s => s.suite_id) : Object.values(SUITES).filter(s => s.suite_id === 'fast' ? properties.size > 0 : properties.has(s.suite_id)).map(s => s.suite_id);
  if (broad || properties.has('team')) suite_ids.push('team'); // Declared team suite remains deferred; test its current status, never manufacture PASS.
  const checks: QualityCheck[] = [
    { id: 'typecheck', command: ['pnpm', 'run', 'typecheck'] },
    { id: 'build', command: ['pnpm', 'run', 'build'] },
    { id: 'regression-tests', command: ['pnpm', 'run', 'test'] },
    { id: 'gauntlet-eval', command: ['pnpm', 'run', 'gauntlet:eval'] },
    { id: 'state-audit', command: ['pnpm', 'run', 'gauntlet:eval:state'] },
    { id: 'browser-tests', command: ['pnpm', 'run', 'test-browser'] },
  ];
  if (properties.size) checks.push({ id: 'sim-smoke', command: ['pnpm', 'run', 'sim-smoke'] });
  for (const suite of suite_ids) checks.push({ id: `domain:${suite}`, command: ['pnpm', 'exec', 'vitest', 'run', ...(DOMAIN_TESTS[suite] ?? ['tests/unit/eval']), '--project', 'node', '--passWithNoTests=false'] });
  return { schema_version: 1, changed_paths, protected_properties: [...properties].sort(), suite_ids: [...new Set(suite_ids)].sort(), reviews_required: properties.size > 0, reasons, checks };
}

export function validateReviews(plan: QualityPlan, builderModel: string, critic: Record<string, unknown>, integration: Record<string, unknown>): void {
  for (const [name, review] of [['critic', critic], ['integration', integration]] as const) {
    if (review.verdict === 'NOT_REQUIRED' && !plan.reviews_required) continue;
    if (review.verdict !== 'ACCEPT') throw new Error(`${name} ACCEPT required by deterministic impact policy`);
    if (!review.model || review.model === builderModel) throw new Error(`${name} must use an independent model`);
  }
}

export function validateQualityReceipt(plan: QualityPlan, receipt: { checks: Array<{ id: string; exit_code: number | null }> }): void {
  if (!Array.isArray(receipt.checks)) throw new Error('quality receipt required');
  for (const expected of plan.checks) {
    const rows = receipt.checks.filter(c => c.id === expected.id);
    if (rows.length !== 1 || rows[0]?.exit_code !== 0) throw new Error(`required quality check missing or failed: ${expected.id}`);
  }
}

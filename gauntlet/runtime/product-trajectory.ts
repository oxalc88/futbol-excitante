export const METRICS = ['time_to_playable', 'player_visible_changes', 'player_visible_changes_per_active_hour', 'process_only_objectives', 'playtest_issues_opened', 'playtest_issues_closed', 'gameplay_regressions', 'processed_input_tokens', 'tokens_per_player_visible_change', 'active_agent_time_per_player_visible_change', 'retries', 'critic_rejects', 'integration_rejects', 'existing_eval_suite_failures', 'critic_catches', 'integration_catches', 'post_acceptance_defects', 'milestone_playtest_result'] as const;
export type MetricName = typeof METRICS[number];
export type MeasurementStatus = 'MEASURED' | 'RECONSTRUCTED_EXACT' | 'RECONSTRUCTED_ESTIMATE' | 'UNAVAILABLE';
export interface Provenance { path: string; commit: string; sha256: string }
export interface Measurement { value: number | string | null; status: MeasurementStatus; sources: Provenance[]; note: string }
export interface ProductOutcome {
  problem: string;
  smallest_playable_slice: string;
  changed_for_player: string[];
  playtest: {
    mode: 'normal_shipped_play';
    method: string;
    before: Provenance[];
    after: Provenance[];
    materially_better: boolean;
    improved: string[];
    still_wrong: string[];
    issues_opened: string[];
    issues_closed: string[];
    regressions: string[];
  };
  quality: { baseline_pass: boolean; affected_domains_pass: boolean; no_known_accepted_regression: boolean; sources: Provenance[] };
}
export function outcomeDecision(outcome: ProductOutcome): 'ACCEPT' | 'ITERATE' {
  if (![outcome.playtest?.materially_better, outcome.quality?.baseline_pass, outcome.quality?.affected_domains_pass, outcome.quality?.no_known_accepted_regression].every(v => typeof v === 'boolean')) throw new Error('outcome decisions must be booleans');
  for (const list of [outcome.changed_for_player, outcome.playtest?.improved, outcome.playtest?.still_wrong, outcome.playtest?.issues_opened, outcome.playtest?.issues_closed, outcome.playtest?.regressions]) {
    if (!Array.isArray(list) || list.some(v => typeof v !== 'string' || !v.trim()) || new Set(list).size !== list.length) throw new Error('outcome lists must contain distinct nonblank observations');
  }
  if (!outcome.problem?.trim() || !outcome.smallest_playable_slice?.trim() || outcome.playtest?.mode !== 'normal_shipped_play' || !outcome.playtest.method?.trim() || !outcome.playtest.before?.length || !outcome.playtest.after?.length || !outcome.quality?.sources?.length) throw new Error('normal-play comparison and quality evidence required');
  if (!outcome.quality.baseline_pass || !outcome.quality.affected_domains_pass || !outcome.quality.no_known_accepted_regression || outcome.playtest.regressions.length || !outcome.playtest.materially_better || !outcome.changed_for_player.length || !outcome.playtest.improved.length) return 'ITERATE';
  return 'ACCEPT';
}
export function validateMetrics(metrics: Record<MetricName, Measurement>): void {
  if (Object.keys(metrics).some(k => !(METRICS as readonly string[]).includes(k))) throw new Error('unknown trajectory metric');
  for (const key of METRICS) {
    const m = metrics[key];
    if (!m || !['MEASURED', 'RECONSTRUCTED_EXACT', 'RECONSTRUCTED_ESTIMATE', 'UNAVAILABLE'].includes(m.status) || !m.note?.trim() || !Array.isArray(m.sources)) throw new Error(`invalid measurement: ${key}`);
    if (m.status === 'UNAVAILABLE') {
      if (m.value !== null) throw new Error(`unavailable cannot be zero: ${key}`);
    } else if (m.value === null || !m.sources.length || (typeof m.value === 'number' && (!Number.isFinite(m.value) || m.value < 0))) throw new Error(`measurement lacks value/provenance: ${key}`);
    if (key !== 'milestone_playtest_result' && m.value !== null && typeof m.value !== 'number') throw new Error(`numeric metric required: ${key}`);
  }
}
export function deriveMetrics(metrics: Record<MetricName, Measurement>, activeAgentHours: Measurement): void {
  const changes = metrics.player_visible_changes;
  const ratio = (numerator: Measurement, denominator: Measurement, scale = 1): Measurement => {
    if (typeof numerator.value !== 'number' || typeof denominator.value !== 'number' || denominator.value <= 0 || numerator.status === 'UNAVAILABLE' || denominator.status === 'UNAVAILABLE') return { value: null, status: 'UNAVAILABLE', sources: [], note: 'Missing numerator or positive denominator; no zero substitution.' };
    const status: MeasurementStatus = [numerator.status, denominator.status].includes('RECONSTRUCTED_ESTIMATE') ? 'RECONSTRUCTED_ESTIMATE' : 'RECONSTRUCTED_EXACT';
    return { value: numerator.value / denominator.value * scale, status, sources: [...numerator.sources, ...denominator.sources], note: 'Derived from this Horizon only; same measurement coverage/profile required for comparison.' };
  };
  metrics.player_visible_changes_per_active_hour = ratio(changes, activeAgentHours);
  metrics.tokens_per_player_visible_change = ratio(metrics.processed_input_tokens, changes);
  metrics.active_agent_time_per_player_visible_change = ratio(activeAgentHours, changes, 3600);
}

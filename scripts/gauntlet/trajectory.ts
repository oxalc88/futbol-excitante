import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verifyCandidateQuality } from '../../gauntlet/runtime/candidate-quality.js';
import { METRICS, deriveMetrics, outcomeDecision, validateMetrics, type Measurement, type MetricName, type ProductOutcome, type Provenance } from '../../gauntlet/runtime/product-trajectory.js';

const [action, horizon, inputPath] = process.argv.slice(2);
const root = 'gauntlet/trajectory/horizons';
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
function verify(ref: Provenance): void {
  if (!ref || !/^[0-9a-f]{40}$/.test(ref.commit) || !/^[0-9a-f]{64}$/.test(ref.sha256) || ref.path.startsWith('/') || ref.path.includes('..')) throw new Error('invalid provenance');
  const bytes = execFileSync('git', ['show', `${ref.commit}:${ref.path}`]);
  if (sha(bytes) !== ref.sha256) throw new Error(`source hash mismatch: ${ref.path}`);
}
if (action === 'report') {
  const baseline = JSON.parse(readFileSync('gauntlet/trajectory/baseline-0.10.0/baseline.json', 'utf8'));
  const rows = baseline.horizons.map((h: any) => ({ horizon: `historical v${h.horizon_version}`, version: h.gauntlet_version, metrics: h.metrics }));
  if (existsSync(root)) for (const id of readdirSync(root).sort()) {
    const records = readdirSync(`${root}/${id}`).filter(n => /^attempt-\d+\.json$/.test(n)).sort((a,b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
    if (records.length) rows.push(JSON.parse(readFileSync(`${root}/${id}/${records.at(-1)}`, 'utf8')));
  }
  console.log(JSON.stringify({ baseline_id: baseline.baseline_id, rows, note: 'Compare equal coverage/harness/profile only. Historical proxies are estimates; no speed claim without observed future execution.' }, null, 2));
} else {
  if (!horizon || !/^v[1-9]\d*$/.test(horizon)) throw new Error('usage: trajectory start|playable|record vNN input.json; trajectory report');
  const dir = `${root}/${horizon}`;
  mkdirSync(dir, { recursive: true });
  if (!inputPath) throw new Error('input JSON required');
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  const now = new Date().toISOString();
  if (action === 'start') {
    if (!input.problem?.trim() || !input.smallest_playable_slice?.trim() || !input.sources?.length) throw new Error('start requires problem, smallest_playable_slice, sources');
    input.sources.forEach(verify);
    writeFileSync(`${dir}/selection.json`, JSON.stringify({ ...input, selected_at: now, gauntlet_version: '0.11.0' }, null, 2)+'\n', { flag: 'wx' });
  } else if (action === 'playable') {
    if (!existsSync(`${dir}/selection.json`) || input.mode !== 'normal_shipped_play' || !input.method?.trim() || !input.sources?.length) throw new Error('select first; playable requires actual normal shipped play with evidence');
    input.sources.forEach(verify);
    writeFileSync(`${dir}/first-playable.json`, JSON.stringify({ ...input, first_playable_at: now }, null, 2)+'\n', { flag: 'wx' });
  } else if (action === 'record') {
    const selection = JSON.parse(readFileSync(`${dir}/selection.json`, 'utf8'));
    const playable = existsSync(`${dir}/first-playable.json`) ? JSON.parse(readFileSync(`${dir}/first-playable.json`, 'utf8')) : null;
    const outcome = input.outcome as ProductOutcome;
    if (outcome.problem !== selection.problem || outcome.smallest_playable_slice !== selection.smallest_playable_slice) throw new Error('outcome must match selected product slice');
    [...outcome.playtest.before, ...outcome.playtest.after, ...outcome.quality.sources].forEach(verify);
    const decision = outcomeDecision(outcome);
    if (decision === 'ACCEPT' && !playable) throw new Error('successful Horizon requires first normal-play event');
    // No asserted "tests passed" can substitute for actual accepted candidate provenance.
    if (!Array.isArray(input.acceptances) || (decision === 'ACCEPT' && !input.acceptances.length)) throw new Error('remote-durable acceptance references required for ACCEPT');
    const acceptedObjectives = new Set<string>();
    for (const ref of input.acceptances as Provenance[]) {
      verify(ref);
      execFileSync('git', ['fetch', 'origin', 'main'], { stdio: 'pipe' });
      execFileSync('git', ['merge-base', '--is-ancestor', ref.commit, 'origin/main']);
      const acceptance = JSON.parse(execFileSync('git', ['show', `${ref.commit}:${ref.path}`], { encoding: 'utf8' }));
      if (acceptance.record_type !== 'candidate_acceptance' || acceptance.deterministic_audit?.status !== 'PASS') throw new Error('invalid acceptance source');
      if (acceptedObjectives.has(acceptance.objective_id)) throw new Error('duplicate accepted objective');
      acceptedObjectives.add(acceptance.objective_id);
      verifyCandidateQuality(process.cwd(), acceptance.candidate_commit, acceptance.objective_id, acceptance.builder.model, acceptance.critic, acceptance.integration);
      execFileSync(process.execPath, [fileURLToPath(new URL('../ci/verify-acceptance-durability.mjs', import.meta.url)), '--objective', acceptance.objective_id, '--commit', ref.commit, '--ref', ref.commit, '--mode', 'remote'], { stdio: 'pipe' });
      const manifest = JSON.parse(execFileSync('git', ['show', `${ref.commit}:docs/evidence/${acceptance.objective_id}/manifest.json`], {encoding:'utf8'}));
      if (manifest.acceptance_record !== ref.path || manifest.candidate_commit !== acceptance.candidate_commit) throw new Error('acceptance manifest provenance mismatch');
      const receiptPath = `docs/evidence/${acceptance.objective_id}/quality.json`;
      const receipt = JSON.parse(execFileSync('git', ['show', `${acceptance.candidate_commit}:${receiptPath}`], { encoding: 'utf8' }));
      if (!receipt.checks.length || receipt.checks.some((c: any) => c.exit_code !== 0)) throw new Error('quality checks not passed');
    }
    if (!Array.isArray(input.objectives) || !input.objectives.length || input.objectives.some((o: any) => !o.id || typeof o.direct_player_result !== 'boolean' || !o.enables_or_protects?.trim())) throw new Error('objectives require ids, direct_player_result and product link');
    if (new Set(input.objectives.map((o:any)=>o.id)).size !== input.objectives.length) throw new Error('duplicate objective');
    if ([...acceptedObjectives].some(id => !input.objectives.some((o:any)=>o.id === id))) throw new Error('accepted objective missing from Horizon cost scope');
    const recordRef = { path: `${dir}/attempt-${readdirSync(dir).filter(n=>/^attempt-\d+\.json$/.test(n)).length+1}.json`, commit: '', sha256: '' };
    // Self-contained observations refer to the immutable input committed before recording.
    const inputRef: Provenance = { path: inputPath, commit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), sha256: sha(readFileSync(inputPath)) };
    verify(inputRef);
    if (resolve(inputRef.path) !== resolve(inputPath) || sha(readFileSync(inputPath)) !== inputRef.sha256) throw new Error('input must match its committed source');
    const metrics = Object.fromEntries(METRICS.map(k => [k, { value: null, status: 'UNAVAILABLE', sources: [], note: 'Not recorded with complete coverage.' }])) as unknown as Record<MetricName, Measurement>;
    Object.assign(metrics, input.metrics ?? {});
    const observed = (value: number, note: string): Measurement => ({ value, status: 'MEASURED', sources: [inputRef], note });
    metrics.process_only_objectives = observed(input.objectives.filter((o:any)=>!o.direct_player_result).length, 'Selected objectives without a direct player result, including enabling work.');
    metrics.player_visible_changes = observed(outcome.changed_for_player.length, 'Distinct useful improvements observed in normal play; one entry per change, not per objective.');
    metrics.playtest_issues_opened = observed(new Set(outcome.playtest.issues_opened).size, 'Issues opened by this playtest.');
    metrics.playtest_issues_closed = observed(new Set(outcome.playtest.issues_closed).size, 'Previously open issues materially improved and retested.');
    metrics.gameplay_regressions = observed(new Set(outcome.playtest.regressions).size, 'Observed regressions in this run, not a claim of universal absence.');
    const events = (playable ? ['selection.json','first-playable.json'] : ['selection.json']).map(p => {
      const commit = execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim();
      const ref = {path:`${dir}/${p}`,commit,sha256:sha(readFileSync(`${dir}/${p}`))}; verify(ref); return ref;
    });
    metrics.time_to_playable = playable
      ? { value: (Date.parse(playable.first_playable_at) - Date.parse(selection.selected_at)) / 1000, status: 'MEASURED', sources: events, note: 'Seconds between canonical selection and first observed normal-play event; includes idle.' }
      : { value: null, status: 'UNAVAILABLE', sources: events, note: 'A useful normal-play version has not yet been reached; failed observations remain ITERATE.' };
    const active: Measurement = input.active_agent_hours ?? { value: null, status: 'UNAVAILABLE', sources: [], note: 'No reconciled interval union.' };
    if (!['MEASURED','RECONSTRUCTED_EXACT','RECONSTRUCTED_ESTIMATE','UNAVAILABLE'].includes(active.status) || (active.status === 'UNAVAILABLE' ? active.value !== null : typeof active.value !== 'number' || !Number.isFinite(active.value) || active.value < 0 || !active.sources?.length)) throw new Error('invalid active-agent hours');
    if (active.status !== 'UNAVAILABLE') active.sources.forEach(verify);
    if (metrics.processed_input_tokens.status !== 'UNAVAILABLE' && (!input.harness || !input.measurement_profile || input.token_coverage_complete !== true)) throw new Error('token measurement requires harness, profile and complete scope');
    deriveMetrics(metrics, active);
    validateMetrics(metrics);
    for (const m of Object.values(metrics)) m.sources.forEach(verify);
    writeFileSync(recordRef.path, JSON.stringify({ schema_version: 1, horizon, gauntlet_version: '0.11.0', recorded_at: now, decision, outcome, metrics, objectives: input.objectives, measurement_profile: input.measurement_profile ?? 'unavailable', harness: input.harness ?? 'unavailable', acceptances: input.acceptances, active_agent_hours: active }, null, 2)+'\n', { flag: 'wx' });
    console.log(`${decision}: ${recordRef.path}`);
  } else throw new Error('unknown trajectory command');
}

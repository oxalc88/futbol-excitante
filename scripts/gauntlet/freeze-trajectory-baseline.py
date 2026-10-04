"""Reproduce the immutable before-state from git, never the changed worktree.

Usage: python scripts/gauntlet/freeze-trajectory-baseline.py COMMIT OUTPUT_DIR
Requires PyYAML. No provider/session totals are inferred from elapsed git time.
"""
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import yaml

cutoff, destination = sys.argv[1:]
out = pathlib.Path(destination)
out.mkdir(parents=True, exist_ok=True)

def git(*args):
    return subprocess.check_output(['git', *args], text=True)

def source(ref, path):
    return {'commit': ref, 'path': path, 'sha256': hashlib.sha256(git('show', f'{ref}:{path}').encode()).hexdigest()}

def metric(value=None, status='UNAVAILABLE', sources=None, note='Not recorded with sufficient coverage.'):
    return dict(value=value, status=status, sources=sources or [], note=note)

names = 'time_to_playable player_visible_changes player_visible_changes_per_active_hour process_only_objectives playtest_issues_opened playtest_issues_closed gameplay_regressions processed_input_tokens tokens_per_player_visible_change active_agent_time_per_player_visible_change retries critic_rejects integration_rejects existing_eval_suite_failures critic_catches integration_catches post_acceptance_defects milestone_playtest_result'.split()
paths = git('ls-tree', '-r', '--name-only', cutoff).splitlines()
inspected = [p for p in paths if p.startswith(('gauntlet/evals/', 'eval/contracts/')) or p in ['gauntlet/product-flow-contract.md', 'gauntlet/timing-contract.md', 'gauntlet/runtime-efficiency-contract.md', 'gauntlet/milestone-playtest-contract.md', 'gauntlet/harness-contract.md', 'gauntlet/state/HISTORY.md', 'gauntlet/state/TIMING.md', 'gauntlet/state/HORIZON.md'] or p.endswith('/manifest.json')]
inventory = [source(cutoff, p) for p in inspected]
latest = {}
for ref in git('log', cutoff, '--format=%H', '--', 'gauntlet/state/HORIZON.md').splitlines():
    text = git('show', f'{ref}:gauntlet/state/HORIZON.md')
    block = re.search(r'```ya?ml\n(.*?)```', text, re.S)
    if not block:
        continue
    try:
        data = yaml.safe_load(block[1])
    except yaml.YAMLError:
        # Historical malformed YAML is evidence, never repaired in place.
        field = lambda key: re.search(r'^' + key + r':\s*(.*)$', block[1], re.M)
        data = {k: field(k)[1].strip('"') for k in ['horizon_version', 'horizon_id', 'status'] if field(k)}
        if 'horizon_version' in data:
            data['horizon_version'] = int(data['horizon_version'])
        data['objectives'] = []
        for item in re.split(r'(?m)^  - id: ', block[1])[1:]:
            state = re.search(r'^    status:\s*(.*)$', item, re.M)
            data['objectives'].append({'id': item.splitlines()[0].strip(), 'status': state[1].strip() if state else 'unknown'})
    version = data.get('horizon_version')
    if version is not None and version not in latest:
        latest[version] = (ref, data)

timing = git('show', f'{cutoff}:gauntlet/state/TIMING.md')
records = {}
for p in paths:
    if p.startswith('gauntlet/evals/results/') and p.endswith('-acceptance.json'):
        r = json.loads(git('show', f'{cutoff}:{p}'))
        records[r['objective_id']] = (p, r)

rows = []
for v, (ref, h) in sorted(latest.items()):
    hs = source(ref, 'gauntlet/state/HORIZON.md')
    objectives = []
    process = 0
    possible_product = 0
    complete_sources = True
    for obj in h.get('objectives', []):
        oid = obj['id']
        item = dict(id=oid, status=obj.get('status'), sources=[hs])
        match = re.search(r'^\|\s*' + re.escape(oid) + r'(?:\s*\([^|]*\))?\s*\|.*$', timing, re.M)
        if match:
            item['legacy_timing_row'] = match[0]
            item['legacy_timing_status'] = 'RECONSTRUCTED_ESTIMATE'
            item['timing_note'] = 'Rounded/estimated prose copied verbatim; not summed as exact usage or active-agent time.'
            item['sources'].append(source(cutoff, 'gauntlet/state/TIMING.md'))
        if oid in records:
            p, r = records[oid]
            item['acceptance_version'] = r.get('gauntlet_version')
            item['candidate_commit'] = r.get('candidate_commit')
            item['sources'].append(source(cutoff, p))
            candidate = r.get('candidate_commit')
            if candidate:
                changed = git('diff-tree', '--root', '--no-commit-id', '--name-only', '-r', candidate).splitlines()
                item['changed_paths'] = changed
                if obj.get('status') == 'accepted':
                    if any(p.startswith('src/') for p in changed):
                        possible_product += 1
                    else:
                        process += 1
        elif obj.get('status') == 'accepted':
            complete_sources = False
        objectives.append(item)
    metrics = {n: metric() for n in names}
    if complete_sources and any(o.get('status') == 'accepted' for o in objectives):
        refs = [s for o in objectives for s in o['sources']]
        metrics['player_visible_changes'] = metric(possible_product, 'RECONSTRUCTED_ESTIMATE', refs, 'Candidate commits touching src/ are a proxy only: no proof of normal-play reachability or material improvement. Do not compare with observed 0.11 product outcomes.')
        metrics['process_only_objectives'] = metric(process, 'RECONSTRUCTED_ESTIMATE', refs, 'Accepted candidates with no src/ delta; supporting technical work may still protect a player outcome. Scope-based estimate, not semantic classification.')
    rows.append(dict(schema_version=1, horizon_version=v, horizon_id=h.get('horizon_id', f'v{v}'), gauntlet_version='historical-mixed', lifecycle_status=h.get('status'), metrics=metrics, objectives=objectives, sources=[hs]))

audit_ref = '1a4553968adc2d00cc32094e4d3f046aa2a0743e'
audit_sources = [source(audit_ref, p) for p in ['gauntlet-token-audit.md', 'qwen-token-audit.md']]
audit = dict(harness='grok', objective_id='5V5-KICKOFF-ANTI-HUDDLE', processed_input_tokens=metric(133628307, 'RECONSTRUCTED_EXACT', [audit_sources[0]], 'Successful-call lower bound only; failed request input unavailable. Cache is a subset of input, not added twice. Not OMP-comparable.'), builder_input_tokens=metric(117964999, 'RECONSTRUCTED_EXACT', [audit_sources[1]], 'Two Qwen builder sessions; successful input only.'), builder_active_seconds=metric(15867.813, 'RECONSTRUCTED_EXACT', [audit_sources[1]], 'Builder only, not whole-Horizon active-agent time.'), session_ids=['01a06a22-ab92-7ff2-b070-d1c8e499658a', '01a06ad6-2055-78c3-9d78-5a8bd1528b9c', '01a06b86-74a6-7673-970a-cee3e006043e'])
baseline = dict(schema_version=1, baseline_id='pre-0.11-at-0.10.0', cutoff_commit=cutoff, frozen_before_behavior_change=True, gauntlet_version=json.loads(git('show', f'{cutoff}:gauntlet/VERSION.json'))['version'], horizons=rows, session_audits=[audit], sources=inventory+audit_sources, limitations=['Server Grok metadata/subagents and OMP raw sessions are unavailable in this workspace; user selected repository sources.', '0.10 was merged during Horizon v38. Older Horizons are historical mixed versions, not executions of 0.10.', 'No complete OMP measurement run is committed; OMP processed input adds input+cacheRead+cacheWrite, while Grok cache is included in input. No cross-harness token aggregation.', 'Git timestamps cannot establish selection-to-first-normal-play time, active hours, catches, regressions, or issue lifecycle counts. These remain UNAVAILABLE.', 'Rounded TIMING rows and src/ delta proxies must not be presented as measured product throughput.'])
payload = json.dumps(baseline, indent=2, ensure_ascii=False)+'\n'
(out/'baseline.json').write_text(payload)
(out/'baseline.sha256').write_text(hashlib.sha256(payload.encode()).hexdigest()+'  baseline.json\n')
report = '# Frozen pre-0.11 trajectory baseline\n\nCutoff: `'+cutoff+'` (Gauntlet 0.10.0). Frozen before any behavior edits.\n\n'+str(len(rows))+' Horizon snapshots reconstructed from git; '+str(len(inventory))+' contract/eval/manifest sources inventoried by SHA-256.\n\n'
report += '\n'.join('- '+x for x in baseline['limitations'])+'\n\n| Horizon | State | Product delta proxy | Process-only proxy | Time to playable |\n|---|---|---:|---:|---|\n'
for r in rows:
    m=r['metrics']
    report += f"| v{r['horizon_version']} | {r['lifecycle_status']} | {m['player_visible_changes']['value'] if m['player_visible_changes']['value'] is not None else 'UNAVAILABLE'} | {m['process_only_objectives']['value'] if m['process_only_objectives']['value'] is not None else 'UNAVAILABLE'} | UNAVAILABLE |\n"
report += '\nAll numeric proxy cells are RECONSTRUCTED_ESTIMATE. The exact successful-call audit lower bound is 133,628,307 Grok input tokens for anti-huddle; 117,964,999 belong to the two Qwen builder sessions. No whole-Horizon denominator is available. No speed improvement is claimed.\n\nReproduce with `python scripts/gauntlet/freeze-trajectory-baseline.py '+cutoff+' /tmp/gauntlet-baseline-reproduction`; compare baseline.sha256. Never overwrite this frozen directory.\n'
(out/'REPORT.md').write_text(report)

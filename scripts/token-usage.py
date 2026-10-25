#!/usr/bin/env python3
"""Sum Codex CLI token usage per worktree and model. Usage: codex-tokens.py [DATE_PREFIX] [WORKTREE...]"""
import json, glob, os, sys, collections
date = sys.argv[1] if len(sys.argv) > 1 else ''
want = set(sys.argv[2:])
agg = collections.defaultdict(lambda: [0, 0, 0, 0])
for f in glob.glob(os.path.expanduser('~/.codex/sessions/**/rollout-%s*.jsonl' % date), recursive=True):
    cwd = None; models = set(); effs = set(); tot = None
    for line in open(f):
        try: p = json.loads(line).get('payload', {})
        except Exception: continue
        if not isinstance(p, dict): continue
        cwd = cwd or p.get('cwd')
        if p.get('model'): models.add(p['model'])
        for k in ('effort', 'reasoning_effort'):
            if p.get(k): effs.add(p[k])
        info = p.get('info') or {}
        if isinstance(info, dict) and info.get('total_token_usage'): tot = info['total_token_usage']
    if not cwd or not tot: continue
    wt = os.path.basename(cwd)
    if want and wt not in want: continue
    a = agg[(wt, '/'.join(sorted(models)), '/'.join(sorted(effs)) or 'default')]
    a[0] += 1; a[1] += tot['total_tokens']; a[2] += tot['input_tokens'] - tot['cached_input_tokens']
    a[3] += tot['output_tokens'] + tot.get('reasoning_output_tokens', 0)
print('| worktree | modelo | effort | sesiones | total | no cacheado | salida |')
for (wt, m, e), (n, t, nc, o) in sorted(agg.items()):
    print(f'| {wt} | {m} | {e} | {n} | {t:,} | {nc:,} | {o:,} |')

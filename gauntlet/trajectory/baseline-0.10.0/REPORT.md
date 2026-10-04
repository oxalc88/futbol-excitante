# Frozen pre-0.11 trajectory baseline

Cutoff: `d3dccf77c565102de531bc5aa981bea9aca009c3` (Gauntlet 0.10.0). Frozen before any behavior edits.

38 Horizon snapshots reconstructed from git; 452 contract/eval/manifest sources inventoried by SHA-256.

- Server Grok metadata/subagents and OMP raw sessions are unavailable in this workspace; user selected repository sources.
- 0.10 was merged during Horizon v38. Older Horizons are historical mixed versions, not executions of 0.10.
- No complete OMP measurement run is committed; OMP processed input adds input+cacheRead+cacheWrite, while Grok cache is included in input. No cross-harness token aggregation.
- Git timestamps cannot establish selection-to-first-normal-play time, active hours, catches, regressions, or issue lifecycle counts. These remain UNAVAILABLE.
- Rounded TIMING rows and src/ delta proxies must not be presented as measured product throughput.

| Horizon | State | Product delta proxy | Process-only proxy | Time to playable |
|---|---|---:|---:|---|
| v1 | ACTIVE | 1 | 0 | UNAVAILABLE |
| v2 | ACTIVE | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| v3 | ACTIVE | 1 | 0 | UNAVAILABLE |
| v4 | ACTIVE | 2 | 0 | UNAVAILABLE |
| v5 | ACTIVE | 4 | 1 | UNAVAILABLE |
| v6 | ACTIVE | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| v7 | EXHAUSTED | 5 | 0 | UNAVAILABLE |
| v8 | EXHAUSTED | 1 | 4 | UNAVAILABLE |
| v9 | EXHAUSTED | 1 | 3 | UNAVAILABLE |
| v10 | EXHAUSTED | 0 | 3 | UNAVAILABLE |
| v11 | EXHAUSTED | 0 | 3 | UNAVAILABLE |
| v12 | EXHAUSTED | 0 | 3 | UNAVAILABLE |
| v13 | EXHAUSTED | 0 | 5 | UNAVAILABLE |
| v14 | EXHAUSTED | 0 | 4 | UNAVAILABLE |
| v15 | ACTIVE | 0 | 3 | UNAVAILABLE |
| v16 | EXHAUSTED | 0 | 5 | UNAVAILABLE |
| v17 | ACTIVE | 0 | 2 | UNAVAILABLE |
| v18 | EXHAUSTED | 0 | 3 | UNAVAILABLE |
| v19 | EXHAUSTED | 1 | 3 | UNAVAILABLE |
| v20 | EXHAUSTED | 1 | 3 | UNAVAILABLE |
| v21 | ACTIVE | 3 | 3 | UNAVAILABLE |
| v22 | ACTIVE | 3 | 2 | UNAVAILABLE |
| v23 | EXHAUSTED | 4 | 1 | UNAVAILABLE |
| v24 | EXHAUSTED | 2 | 4 | UNAVAILABLE |
| v25 | EXHAUSTED | 1 | 3 | UNAVAILABLE |
| v26 | EXHAUSTED | 2 | 2 | UNAVAILABLE |
| v27 | EXHAUSTED | 1 | 3 | UNAVAILABLE |
| v28 | EXHAUSTED | 1 | 3 | UNAVAILABLE |
| v29 | ACTIVE | 0 | 4 | UNAVAILABLE |
| v30 | ACTIVE | 0 | 4 | UNAVAILABLE |
| v31 | ACTIVE | 1 | 3 | UNAVAILABLE |
| v32 | ACTIVE | 3 | 1 | UNAVAILABLE |
| v33 | ACTIVE | 1 | 3 | UNAVAILABLE |
| v34 | ACTIVE | 1 | 3 | UNAVAILABLE |
| v35 | ACTIVE | 2 | 2 | UNAVAILABLE |
| v36 | ACTIVE | 2 | 2 | UNAVAILABLE |
| v37 | COMPLETE | 1 | 2 | UNAVAILABLE |
| v38 | ACTIVE | 1 | 1 | UNAVAILABLE |

All numeric proxy cells are RECONSTRUCTED_ESTIMATE. The exact successful-call audit lower bound is 133,628,307 Grok input tokens for anti-huddle; 117,964,999 belong to the two Qwen builder sessions. No whole-Horizon denominator is available. No speed improvement is claimed.

Reproduce with `python scripts/gauntlet/freeze-trajectory-baseline.py d3dccf77c565102de531bc5aa981bea9aca009c3 /tmp/gauntlet-baseline-reproduction`; compare baseline.sha256. Never overwrite this frozen directory.

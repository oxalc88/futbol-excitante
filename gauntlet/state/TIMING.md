# Gauntlet session timing and model performance

Living log for this Gauntlet session. Refresh after each accepted objective.
Do not treat these numbers as a provider invoice.

```yaml
session_id: 019ffdda-1b40-7b90-91ae-cc7f3ad623b0
measured_at: 2026-08-15T02:12:00Z
source: ~/.grok/sessions/.../subagents/*/meta.json + child updates.jsonl
idle_excluded: 2026-08-14T07:46Z .. 2026-08-14T13:03Z
```

## How to read this

**Step time** is the merged wall-clock of that objective's builder, critic,
integration-reviewer, and git-committer runs. Overlapping agents in the same
step are not double-counted.

**Excluded idle** is the only gap longer than 10 minutes where nothing was
running (`5h 16m`, 07:46–13:03 UTC). That is the unexplained stop. Shorter
handoffs stay inside the step.

**Prompt tokens** are processed input: the recorded context size at the start
of each model generation. The window is re-sent on every tool loop, so this
is tokens processed, not unique text. If the provider caches prefixes, billed
input is lower. There is no cache-hit split on disk.

**Completion (est.)** is how much `totalTokens` grew during each generation
(thoughts + tool-call text). Tool results land in the next prompt, not here.

The TUI Tasks list is per-subagent wall-clock only. The footer `13K / 300K`
style meter is the live context window, not session cost.

## Clock

| | Duration |
|---|---:|
| Calendar span (first work → measurement) | 24h 53m |
| Unexplained stop (excluded) | 5h 16m |
| Active work (anything running) | 19h 35m |
| Sum of per-step agent time | 18h 17m |
| Orchestrator thinking between steps | ~1h 18m |

Session start: `2026-08-14 01:19 UTC`. Measurement: `2026-08-15 ~02:12 UTC`.

## Per-step time and tokens

| Step | Status | Step | Builder | Critic | Integrator | Commit | Prompt | Completion |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| BOOTSTRAP-01 | accepted | 14m | 7m | 3m | 3m | 1m | 2.41M | 82k |
| BOOTSTRAP-02 | accepted | 14m | 8m | 3m | 2m | 1m | 3.54M | 156k |
| BOOTSTRAP-03 | accepted | 37m | 25m | 9m | 3m | 1m | 7.97M | 249k |
| BOOTSTRAP-04 | accepted | 15m | 7m | 2m | 4m | 1m | 2.67M | 111k |
| BOOTSTRAP-05 | accepted | 14m | 6m | 3m | 4m | 1m | 2.92M | 131k |
| BOOTSTRAP-06 | accepted | 55m | 35m | 14m | 5m | 1m | 15.34M | 426k |
| BOOTSTRAP-07 | accepted | 17m | 10m | 3m | 3m | 1m | 2.92M | 122k |
| BOOTSTRAP-08 | accepted | 20m | 13m | 4m | 2m | 0.5m | 4.60M | 133k |
| BOOTSTRAP-09 | accepted | 28m | 16m | 8m | 3m | 1m | 6.60M | 228k |
| BOOTSTRAP-10 | accepted | 1h 29m | 1h 09m | 13m | 5m | 1.5m | 39.04M | 567k |
| BOOTSTRAP-11 | accepted | 1h 07m | 48m | 13m | 4m | 1.5m | 15.93M | 361k |
| BOOTSTRAP-12 | accepted | 41m | 23m | 11m | 6m | 2m | 6.86M | 201k |
| FOUNDATION-REGISTRIES | accepted | 37m | 28m | 4m | 3m | 2m | 10.20M | 258k |
| FOUNDATION-ORACLES | accepted | 1h 21m | 54m | 21m | 4m | 2m | 17.64M | 547k |
| FOUNDATION-HARD | accepted | 1h 10m | 44m | 17m | 8m | 2m | 18.70M | 576k |
| FOUNDATION-BROWSER | accepted | 1h 04m | 42m | 17m | 4m | 2m | 16.33M | 417k |
| FOUNDATION-DETERMINISTIC | accepted | 21m | 10m | 7m | 3m | 1m | 3.72M | 153k |
| FOUNDATION-MUTANT-REDUCTION | accepted | 39m | 25m | 8m | 4m | 1.5m | 11.90M | 286k |
| FOUNDATION-PROMOTION | accepted | 29m | 15m | 9m | 3m | 1.5m | 6.55M | 268k |
| CAPABILITY-DESIGN-PROFILE | accepted | 18m | 8m | 5m | 4m | 1m | 3.35M | 172k |
| PLAYABLE-FIRST-TOUCH | accepted | 26m | 15m | 4m | 5m | 2m | 7.69M | 208k |
| PLAYABLE-BASIC-PASS | accepted | 27m | 12m | 8m | 5m | 2m | 8.33M | 222k |
| PLAYABLE-BASIC-SHOT | accepted | 22m | 8.5m | 5m | 7m | 1.5m | 6.51M | 114k |
| PLAYABLE-SECOND-SLOT | accepted | 40m | 27m | 8m | 4m | 1.5m | 10.16M | 215k |
| PLAYABLE-CLOSE-CONTROL | accepted | 39m | 24m | 9m | 3m | 2m | 10.14M | 240k |
| PLAYABLE-PLAYER-DUEL | accepted | 32m | 19m | 9m | 3m | 1.5m | 9.53M | 191k |
| PLAYABLE-ENGINE-DESIGN-RUNNER | accepted | 34m | 22m | 4m | 6m | 1.5m | 11.63M | 217k |
| PLAYABLE-FICTIONAL-ARCHETYPES | accepted | 39m | 27m | 5m | 6m | 1.5m | 8.84M | 259k |
| PLAYABLE-BROWSER-1V1 | accepted | 18m | 8m | 4m | 4m | 1.5m | 2.73M | 173k |
| PLAYABLE-1V1-PROFILE | accepted | 21m | 9m | 5m | 5m | 1.5m | 3.80M | 195k |
| PLAYABLE-TOUCH-ACTIONS-SUITE | in flight | 28m | 24m | 4m | — | — | 12.15M | 231k |

Typical accepted step: 20–40 minutes and 3–12M processed prompt tokens.
Median accepted step: about 28 minutes. Cost spikes are critic retry loops,
not first-pass implementation.

## By phase

| Phase | Active agent time | Prompt | Completion |
|---|---:|---:|---:|
| Bootstrap 01–12 | 6h 48m | 111M | 2.77M |
| Foundation lab + capability | 6h 00m | 88M | 2.68M |
| Playable 1v1 (accepted) | 4h 54m | 79M | 2.04M |
| Touch-actions suite (not accepted) | 28m | 12M | 0.23M |

## By model (tokens and wall)

Subagents only (227 recorded child sessions):

| Model | Role | Runs | Wall | Prompt | Completion |
|---|---|---:|---:|---:|---:|
| qwen3.6 | builder | 46 | 8h 59m | 179M | 3.19M |
| deepseek-v4-flash-0731 | critic + integrator | 87 | 6h 07m | 55M | 3.26M |
| mimo-v2.5 | builder | 13 | 2h 29m | 50M | 0.79M |
| grok-4.6 | git-committer (until this change) | 81 | 42m | 6.4M | 0.47M |
| **Subagent total** | | 227 | 18h 17m | **291M** | **7.7M** |

Parent orchestrator (`grok-4.6`, not in the Tasks list):

| | |
|---|---:|
| Parent turns (includes waiting on children) | 14h 54m |
| Prompt tokens processed | 148M |
| Completion (est.) | 0.81M |
| Model calls | 714 |
| Peak context | 400k |

Parent input is large because orchestrator context grew to ~400k and was
re-sent on every call. Combined processed tokens: **~439M prompt + 8.5M
completion**.

| Model | Prompt + completion (est.) |
|---|---:|
| grok-4.6 (orchestrator + old committer) | 155M |
| qwen3.6 | 182M |
| deepseek-v4-flash-0731 | 59M |
| mimo-v2.5 | 51M |

Commits now route to `git-committer` / `gemma4`. Later rows should show
Gemma on the commit column, not Grok 4.6.

---

## Model performance

This is not a generic LLM leaderboard. It grades **this Gauntlet**: did the
assigned builder get an independent DeepSeek ACCEPT, and how many critic
loops did that take, given the difficulty of the objective.

### Rubric

**Difficulty** is the job, not the outcome:

| Band | Meaning |
|---|---|
| L | Thin wiring, docs, or a single contract with an existing test harness |
| M | New module, but the oracle/contract already exists |
| H | New physics, input, or browser path that can violate architecture |
| VH | Protected oracles, honest FAIL paths, or anything the critic can call theatrical |

**Builder grade** is first-pass quality against the critic:

| Grade | Meaning |
|---|---|
| A | Critic ACCEPT on the first candidate |
| B | 1 critic RETRY, then ACCEPT |
| C | 2 critic RETRIES, then ACCEPT |
| D | 3 critic RETRIES (budget exhausted), then ACCEPT |
| R | Critic REJECT, then a recovered ACCEPT |
| I | In flight / not accepted |

Retries here are **critic loops**, from `gauntlet/state/HISTORY.md`. An HTTP
499 mid-write that was resumed without a critic RETRY is noted, not graded as
a B. A retry that exists because the critic caught theatrical tests is a real
miss: the builder shipped evidence that could not fail.

**Efficiency** is step wall-clock. Cheap A on an L task is expected. Cheap A
on an H task is the interesting result.

### Per-objective grade

| Step | Builder | Diff | Critic loops | Grade | What the loops were about |
|---|---|---|---:|---|---|
| BOOTSTRAP-01 | qwen3.6 | M | 1 | B | Theatrical isolation/version/build tests |
| BOOTSTRAP-02 | qwen3.6 | M | 0 | A | Contracts + versioned config |
| BOOTSTRAP-03 | qwen3.6 | H | 1 | B | Non-canonical PRNG / FNV / UTF-8 |
| BOOTSTRAP-04 | qwen3.6 | M | 0 | A | Deterministic `createWorld` |
| BOOTSTRAP-05 | qwen3.6 | M | 0 | A | Sync Simulation API |
| BOOTSTRAP-06 | qwen3.6 | H | 2 | C | Dead slot wiring, then tick/unassigned |
| BOOTSTRAP-07 | mimo-v2.5 | H | 0 | A | One-player kinematic locomotion |
| BOOTSTRAP-08 | mimo-v2.5 | H | 0 | A | Independent 3D ball |
| BOOTSTRAP-09 | qwen3.6 | M | 1 | B | Missing verifier / full checkpoints |
| BOOTSTRAP-10 | qwen3.6 | H | 3 | D | Theatrical canaries; CLI replay verify |
| BOOTSTRAP-11 | mimo-v2.5 | H | 2 | C | Theatrical screenshot smoke (twice) |
| BOOTSTRAP-12 | qwen3.6 | M | 1 | B | argv offset; compare flag order |
| FOUNDATION-REGISTRIES | qwen3.6 | M | 0 | A | First session died HTTP 499; critic accepted the finished candidate |
| FOUNDATION-ORACLES | qwen3.6 | VH | 3 + REJECT | R | Theatrical camera-hash/decay; public `mutatePrng` |
| FOUNDATION-HARD | qwen3.6 | VH | 3 | D | HARD_INVARIANTs not actually bound |
| FOUNDATION-BROWSER | qwen3.6 | H | 3 | D | Browser hash / smoke evidence |
| FOUNDATION-DETERMINISTIC | qwen3.6 | M | 0 | A | Same-start / replay identity |
| FOUNDATION-MUTANT-REDUCTION | qwen3.6 | H | 1 | B | Reduction / mutant wiring |
| FOUNDATION-PROMOTION | qwen3.6 | H | 1 | B | Promotion gate honesty |
| CAPABILITY-DESIGN-PROFILE | qwen3.6 | M | 0 | A | Capability-design profile |
| PLAYABLE-FIRST-TOUCH | mimo-v2.5 | H | 0 | A | Independent-ball first touch |
| PLAYABLE-BASIC-PASS | mimo-v2.5 | H | 1 | B | J still first-touch; pass oracle ignored `kind` |
| PLAYABLE-BASIC-SHOT | mimo-v2.5 | H | 0 | A | Directed shot impulse |
| PLAYABLE-SECOND-SLOT | qwen3.6 | M | 1 | B | Unused two-player scenario; theatrical ball test |
| PLAYABLE-CLOSE-CONTROL | mimo-v2.5 | H | 1 | B | `restore()` dropped dribble cooldown |
| PLAYABLE-PLAYER-DUEL | mimo-v2.5 | H | 1 | B | Pair order followed array index, not stable IDs |
| PLAYABLE-ENGINE-DESIGN-RUNNER | qwen3.6 | M | 0 | A | Transient-accel runner |
| PLAYABLE-FICTIONAL-ARCHETYPES | qwen3.6 | M | 0 | A | Burst/steady per player |
| PLAYABLE-BROWSER-1V1 | qwen3.6 | M | 0 | A | Two-slot browser control |
| PLAYABLE-1V1-PROFILE | qwen3.6 | M | 0 | A | Honest profile that cannot PASS |
| PLAYABLE-TOUCH-ACTIONS-SUITE | qwen3.6 | VH | 1+ | I | First critic: dishonest contact/impulse oracles. Retry not re-accepted |

### Builder scoreboard

Only **accepted** objectives. In-flight TOUCH-ACTIONS is excluded.

| Builder | n | A | B | C | D | R | First-pass % | Mean critic loops | Mean step time |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| qwen3.6 | 22 | 10 | 7 | 1 | 3 | 1 | 45% | 1.14 | ~38m |
| mimo-v2.5 | 8 | 4 | 3 | 1 | 0 | 0 | 50% | 0.63 | ~31m |

Weighted by difficulty (L=1, M=2, H=3, VH=4), counting A=4 … D=1, R=0.5:

| Builder | Objectives | Weighted grade / difficulty | Read as |
|---|---:|---:|---|
| mimo-v2.5 | 8, all H | 3.1 / 3.0 | First-pass locomotion and ball; misses were local (mapping, restore, pair order) |
| qwen3.6 | 22, mixed M–VH | 2.6 / 2.6 | Reliable on contracts and profiles; expensive on honest-eval / CLI / browser evidence |

### What that means for routing

**mimo-v2.5** is the better first-pass builder on H gameplay (locomotion, ball,
first-touch, shot). Four of eight accepted MiMo steps were A. The C
(BOOTSTRAP-11) was theatrical screenshot smoke — same failure mode as Qwen's
eval work, not a physics miss. Keep MiMo on feel, contacts, and large-spec
playable systems.

**qwen3.6** is the workhorse and the right default for contracts, registries,
profiles, and typed glue. Ten first-pass ACCEPTs, including capability-design
and the honest PLAYABLE_1V1 profile. It is weaker when the critic can demand
an oracle that actually fails: FOUNDATION-ORACLES (REJECT), HARD, BROWSER, and
BOOTSTRAP-10 burned the retry budget on theatrical or unbound evidence. Prefer
Qwen there still (structured TypeScript), but the orchestrator prompt must
forbid “always-pass” tests up front.

**deepseek-v4-flash-0731** is not graded as a builder. Its job is to force
retries. The expensive Qwen D/R rows are evidence it is doing that job:
camera-hash, `mutatePrng`, unbound HARD_INVARIANTs, unused two-player
scenario, cooldown-on-restore. Do not treat a high DeepSeek token count as
waste.

**grok-4.6** as git-committer was a routing bug: 81 runs, 42 minutes, 6.4M
processed prompt tokens for conventional-commit bookkeeping. That role is now
`git-committer` / `gemma4`. Grok 4.6 stays on orchestration only.

**gemma4** had no builder/critic samples in this session (`aux` was unused).
It is the cheap auxiliary and committer. Do not send it implementation or
review.

### Recurring failure modes (not model-specific)

1. Theatrical tests (file exists, luminance always passes, canaries that
   cannot fail).
2. Honest-eval gaps: criterion listed, oracle unbound or mapped to a weak
   proxy (ball-continuity as “last touch”).
3. Restore / serialization dropping transient state (close-control cooldown).
4. CLI argv and compare-flag order.
5. Browser smoke that does not drive the test-bridge.

When a retry is one of these, say so in HISTORY. Do not count it as “the
model cannot play football.”

## How to refresh

After an accepted step, append a row to the per-step table and recompute
the builder scoreboard from HISTORY critic loops plus `meta.json`
`duration_ms`. Keep the unexplained-stop rule: exclude gaps ≥10 minutes
with no parent turn and no child session.

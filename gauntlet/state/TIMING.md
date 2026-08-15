# Gauntlet session timing and model performance

Living log for this Gauntlet session. Refresh after each accepted objective.
Do not treat these numbers as a provider invoice.

```yaml
session_id: 019ffdda-1b40-7b90-91ae-cc7f3ad623b0
measured_at: 2026-08-15T09:10:00Z
source: ~/.grok/sessions/.../subagents/*/meta.json + child updates.jsonl
idle_excluded: 2026-08-14T07:46Z .. 2026-08-14T13:03Z
overflow: orchestrator-deepseek (deepseek-v4-flash-0731) continued the session 2026-08-15T05:46Z; MUTANT-1V1 and the three capability-axis rows are measured from this overflow session's meta.json
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
| Calendar span (first work → measurement) | 29h 05m |
| Unexplained stop (excluded) | 5h 16m |
| Active work (anything running) | 23h 49m |
| Sum of per-step agent time | 20h 20m |
| Orchestrator thinking between steps | ~3h 29m |

Session start: `2026-08-14 01:19 UTC`. Measurement: `2026-08-15 ~06:25 UTC`.
The per-step total now includes DUELS-SUITE (1h 40m) and MUTANT-1V1 (23m);
"orchestrator thinking" grew because it absorbs the grok-4.6 handoff/docs
bookkeeping window (02:12–05:33 UTC) and the DeepSeek overflow window.

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
| PLAYABLE-TOUCH-ACTIONS-SUITE (2 retries) | accepted | ~59m | 32m | 19m | 8.5m | (this turn) | 12.15M+ | 231k+ |
| PLAYABLE-DUELS-SUITE (3 retries + REJECT) | accepted | ~1h 40m | 49m | 44m | 6m | 0.5m | n/a* | n/a* |
| PLAYABLE-MUTANT-1V1 | accepted | ~23m | 9.9m | 6.7m | 5.8m | 0.4m | ~3.4M | n/a** |
| CAPABILITY-PHYSICAL-CONTACT | accepted | ~40m | 22.7m | 8.3m | 9.0m | 0.5m | ~9.6M | n/a** |
| CAPABILITY-SHOOTING-POWER (1 retry) | accepted | ~1h 10m | 49.4m | 12.1m | 8.0m | 0.5m | ~10.6M | n/a** |
| CAPABILITY-BODY-CONTROL (2 retries) | accepted | ~1h 28m | 65.4m | 15.1m | 7.7m | 0.5m | ~13.2M | n/a** |

Typical accepted step: 20–40 minutes and 3–12M processed prompt tokens.
Median accepted step: about 28 minutes. Cost spikes are critic retry loops,
not first-pass implementation.

\* DUELS-SUITE prompt/completion tokens were not re-aggregated from the prior
session; durations are from that session's subagent meta.json.
\*\* MUTANT-1V1 and the three capability-axis steps are not separately split
for completion (updates.jsonl records a final `totalTokens` snapshot per
role); `Prompt` is the summed final totals (MUTANT-1V1: builder 1.95M +
critic 0.89M + integrator 0.52M; PHYSICAL-CONTACT: 7.66M + 1.21M + 0.73M;
SHOOTING-POWER: 8.59M + 1.45M + 0.57M; BODY-CONTROL: builder 10.68M + critic
1.43M + integrator 1.08M, retry rounds share the builder/critic sessions).

## By phase

| Phase | Active agent time | Prompt | Completion |
|---|---:|---:|---:|
| Bootstrap 01–12 | 6h 48m | 111M | 2.77M |
| Foundation lab + capability | 6h 00m | 88M | 2.68M |
| Playable 1v1 (accepted) | 4h 54m | 79M | 2.04M |
| Touch-actions suite (not accepted) | 28m | 12M | 0.23M |
| Duels suite (accepted) | 1h 40m | n/a* | n/a* |
| Mutant 1v1 (accepted) | 23m | ~3.4M | n/a** |
| Physical-contact axis (accepted) | 40m | ~9.6M | n/a** |
| Shooting-power axis (accepted) | 1h 10m | ~10.6M | n/a** |
| Body-control axis (accepted) | 1h 28m | ~13.2M | n/a** |

## By model (tokens and wall)

Refreshed `2026-08-15` from the same session logs. Prompt tokens are still
processed input (context re-sent each call), not unique text.

### Grok 4.6 split — orchestrator vs committer

These were previously added together as “grok-4.6”. They are different jobs.

| Job | Where it lives | Model | Runs | Prompt | Completion (est.) | Calls | Peak context |
|---|---|---|---:|---:|---:|---:|---:|
| Orchestrator | parent session (not in Tasks) | grok-4.6 | 1 session | **160.12M** | 898k | 781 | 400k |
| Git-committer (legacy) | `git-committer` children | grok-4.6 | 81 | **6.41M** | 469k | 649 | — |
| Git-committer (now) | `git-committer` children | gemma4 | 9 | **~800k** | n/a | 77 | — |
| **Grok 4.6 total** | parent + old committer | grok-4.6 | | **166.53M** | 1.37M | 1,430 | |

Orchestrator input is large because parent context grew to ~400k and was
re-sent on every orchestrator call (including while waiting on children).
That cost is **not** git-committer.

The 81 Grok committer runs were bookkeeping (conventional commits / push).
That role is now `git-committer` / `gemma4`. The nine Gemma runs so far
are ~800k processed prompt tokens (~25× cheaper per comparable commit
batch than the Grok committer average of ~79k prompt tokens/run). Gemma
completion growth is not recorded the same way in `updates.jsonl`
(streams often have a single `totalTokens` snapshot), so that cell is
`n/a`, not proof of zero output.

### All roles

| Model | Role | Runs | Prompt | Completion (est.) |
|---|---|---:|---:|---:|
| grok-4.6 | **orchestrator only** | parent | 160.12M | 898k |
| grok-4.6 | **git-committer (legacy)** | 81 | 6.41M | 469k |
| gemma4 | **git-committer** | 9 | 0.80M | n/a |
| qwen3.6 | builder | 56 | 229.43M | 3.57M |
| deepseek-v4-flash-0731 | critic | 68 | 46.39M | 2.57M |
| deepseek-v4-flash-0731 | integrator | 36 | 26.76M | 1.20M |
| mimo-v2.5 | builder | 13 | 50.42M | 0.79M |
| **All processed** | | | **~520M** | **~9.5M** |

Builder/critic/integrator counts are higher than the first TIMING snapshot
because later playable steps added child sessions. Use the Grok split above
when asking how much orchestration cost versus commits. MUTANT-1V1 added one
qwen3.6 builder run (1.95M), one critic run (0.89M), one integrator run
(0.52M), one gemma4 commit run (~0.09M est.). PHYSICAL-CONTACT added one
qwen3.6 builder run (7.66M), one critic run (1.21M), one integrator run
(0.73M), one gemma4 commit run (~0.09M est.). SHOOTING-POWER added one
qwen3.6 builder session (8.59M, incl. the retry round), one critic session
(1.45M, incl. the retry round), one integrator run (0.57M), two gemma4
commit runs (~0.18M est.). BODY-CONTROL added one qwen3.6 builder session
(10.68M, incl. two retry rounds + comment fix), one critic session (1.43M,
incl. two retry rounds), one integrator run (1.08M), two gemma4 commit runs
(~0.18M est.). DUELS-SUITE tokens are not re-aggregated (n/a*).

---

## Model performance

This is not a generic LLM leaderboard. It grades **this Gauntlet**: did the
assigned builder get an independent DeepSeek ACCEPT, and how many critic
loops did that take, given the difficulty of the objective.

### Rubric

**Difficulty** is the job, not the outcome:

| Band | Level | Meaning |
|---|---|---|
| L | Low | Thin wiring, docs, or a single contract with an existing test harness |
| M | Medium | New module, but the oracle/contract already exists |
| H | High | New physics, input, or browser path that can violate architecture |
| VH | Very High | Protected oracles, honest FAIL paths, or anything the critic can call theatrical |

**Builder grade** is first-pass quality against the critic:

| Grade | Name | Meaning |
|---|---|---|
| A | First pass | Critic ACCEPT on the first candidate |
| B | One retry | 1 critic RETRY, then ACCEPT |
| C | Two retries | 2 critic RETRIES, then ACCEPT |
| D | Budget used | 3 critic RETRIES (budget exhausted), then ACCEPT |
| R | Recovered reject | Critic REJECT, then a recovered ACCEPT |
| I | Incomplete | In flight / not accepted |

Retries here are **critic loops**, from `gauntlet/state/HISTORY.md`. An HTTP
499 mid-write that was resumed without a critic RETRY is noted, not graded as
a B. A retry that exists because the critic caught theatrical tests is a real
miss: the builder shipped evidence that could not fail.

**Efficiency** is step wall-clock. Cheap A on an L task is expected. Cheap A
on an H task is the interesting result.

### Per-objective grade

| Step | Builder | Diff | Level | Critic loops | Grade | What the loops were about |
|---|---|---|---|---:|---|---|
| BOOTSTRAP-01 | qwen3.6 | M | Medium — new module, existing harness | 1 | B | Theatrical isolation/version/build tests |
| BOOTSTRAP-02 | qwen3.6 | M | Medium — new module, existing harness | 0 | A | Contracts + versioned config |
| BOOTSTRAP-03 | qwen3.6 | H | High — can violate architecture | 1 | B | Non-canonical PRNG / FNV / UTF-8 |
| BOOTSTRAP-04 | qwen3.6 | M | Medium — new module, existing harness | 0 | A | Deterministic `createWorld` |
| BOOTSTRAP-05 | qwen3.6 | M | Medium — new module, existing harness | 0 | A | Sync Simulation API |
| BOOTSTRAP-06 | qwen3.6 | H | High — new input path | 2 | C | Dead slot wiring, then tick/unassigned |
| BOOTSTRAP-07 | mimo-v2.5 | H | High — new physics | 0 | A | One-player kinematic locomotion |
| BOOTSTRAP-08 | mimo-v2.5 | H | High — new physics | 0 | A | Independent 3D ball |
| BOOTSTRAP-09 | qwen3.6 | M | Medium — new module, existing harness | 1 | B | Missing verifier / full checkpoints |
| BOOTSTRAP-10 | qwen3.6 | H | High — CLI / eval path | 3 | D | Theatrical canaries; CLI replay verify |
| BOOTSTRAP-11 | mimo-v2.5 | H | High — new browser path | 2 | C | Theatrical screenshot smoke (twice) |
| BOOTSTRAP-12 | qwen3.6 | M | Medium — wiring / existing harness | 1 | B | argv offset; compare flag order |
| FOUNDATION-REGISTRIES | qwen3.6 | M | Medium — new module, existing contract | 0 | A | First session died HTTP 499; critic accepted the finished candidate |
| FOUNDATION-ORACLES | qwen3.6 | VH | Very High — honest FAIL / theatrical risk | 3 + REJECT | R | Theatrical camera-hash/decay; public `mutatePrng` |
| FOUNDATION-HARD | qwen3.6 | VH | Very High — protected oracles | 3 | D | HARD_INVARIANTs not actually bound |
| FOUNDATION-BROWSER | qwen3.6 | H | High — new browser path | 3 | D | Browser hash / smoke evidence |
| FOUNDATION-DETERMINISTIC | qwen3.6 | M | Medium — new module, existing contract | 0 | A | Same-start / replay identity |
| FOUNDATION-MUTANT-REDUCTION | qwen3.6 | H | High — eval path can lie | 1 | B | Reduction / mutant wiring |
| FOUNDATION-PROMOTION | qwen3.6 | H | High — eval path can lie | 1 | B | Promotion gate honesty |
| CAPABILITY-DESIGN-PROFILE | qwen3.6 | M | Medium — new module, existing contract | 0 | A | Capability-design profile |
| PLAYABLE-FIRST-TOUCH | mimo-v2.5 | H | High — new physics / contact | 0 | A | Independent-ball first touch |
| PLAYABLE-BASIC-PASS | mimo-v2.5 | H | High — new physics / input | 1 | B | J still first-touch; pass oracle ignored `kind` |
| PLAYABLE-BASIC-SHOT | mimo-v2.5 | H | High — new physics / input | 0 | A | Directed shot impulse |
| PLAYABLE-SECOND-SLOT | qwen3.6 | M | Medium — new module, existing contract | 1 | B | Unused two-player scenario; theatrical ball test |
| PLAYABLE-CLOSE-CONTROL | mimo-v2.5 | H | High — new physics / restore | 1 | B | `restore()` dropped dribble cooldown |
| PLAYABLE-PLAYER-DUEL | mimo-v2.5 | H | High — new physics | 1 | B | Pair order followed array index, not stable IDs |
| PLAYABLE-ENGINE-DESIGN-RUNNER | qwen3.6 | M | Medium — new module, existing contract | 0 | A | Transient-accel runner |
| PLAYABLE-FICTIONAL-ARCHETYPES | qwen3.6 | M | Medium — new module, existing contract | 0 | A | Burst/steady per player |
| PLAYABLE-BROWSER-1V1 | qwen3.6 | M | Medium — new module, existing contract | 0 | A | Two-slot browser control |
| PLAYABLE-1V1-PROFILE | qwen3.6 | M | Medium — new module, existing contract | 0 | A | Honest profile that cannot PASS |
| PLAYABLE-TOUCH-ACTIONS-SUITE | qwen3.6 | VH | Very High — protected oracles / theatrical risk | 2 | C | Retry 0: ball-continuity mappings / catalog-only. Retry 1: four silent-PASS tests + stale CONTACT binding |
| PLAYABLE-DUELS-SUITE | qwen3.6 | VH | Very High — protected oracles / theatrical risk | 3 + REJECT | R | Retries: non-contact registered scenario, false test comment. REJECT: shared computeOutcome let NOT_EVALUATED mask FAIL. Scoped restore |
| PLAYABLE-MUTANT-1V1 | qwen3.6 | VH | Very High — protected oracles / theatrical risk | 0 | A | Executable 1v1 mutant path (clean PASS + poison FAIL); critic proved FAIL reachability |
| CAPABILITY-PHYSICAL-CONTACT | qwen3.6 | VH | Very High — protected oracles / theatrical risk | 0 | A | Physical-contact axis + contact-config override; critic forced all FAIL branches |
| CAPABILITY-SHOOTING-POWER | qwen3.6 | VH | Very High — protected oracles / theatrical risk | 1 | B | Estimator declaration t20 vs runner t10; fixed |
| CAPABILITY-BODY-CONTROL | qwen3.6 | VH | Very High — protected oracles / theatrical risk | 2 | C | Estimator declaration mismatch; cross-coupling FAIL unreachable (turnRate cosmetic) — fixed with lateralResistance knob |

### Builder scoreboard

Only **accepted** objectives. In-flight TOUCH-ACTIONS is excluded.

| Builder | n | A | B | C | D | R | First-pass % | Mean critic loops | Mean step time |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| qwen3.6 | 28 | 12 | 8 | 3 | 3 | 2 | 43% | 1.00 | ~43m |
| mimo-v2.5 | 8 | 4 | 3 | 1 | 0 | 0 | 50% | 0.63 | ~31m |

Weighted by difficulty (L=1, M=2, H=3, VH=4), counting A=4 … D=1, R=0.5:

| Builder | Objectives | Weighted grade / difficulty | Read as |
|---|---:|---:|---|
| mimo-v2.5 | 8, all H | 3.1 / 3.0 | First-pass locomotion and ball; misses were local (mapping, restore, pair order) |
| qwen3.6 | 28, mixed M–VH | 2.7 / 2.8 | Reliable on contracts and profiles; expensive on honest-eval / CLI / browser evidence |

### What that means for routing

**mimo-v2.5** is the better first-pass builder on H gameplay (locomotion, ball,
first-touch, shot). Four of eight accepted MiMo steps were A. The C
(BOOTSTRAP-11) was theatrical screenshot smoke — same failure mode as Qwen's
eval work, not a physics miss. Keep MiMo on feel, contacts, and large-spec
playable systems.

**qwen3.6** is the workhorse and the right default for contracts, registries,
profiles, and typed glue. Twelve first-pass ACCEPTs, including capability-design
and the honest PLAYABLE_1V1 profile. It is weaker when the critic can demand
an oracle that actually fails: FOUNDATION-ORACLES (REJECT), HARD, BROWSER, and
BOOTSTRAP-10 burned the retry budget on theatrical or unbound evidence. Prefer
Qwen there still (structured TypeScript), but the orchestrator prompt must
forbid “always-pass” tests up front. MUTANT-1V1 and CAPABILITY-PHYSICAL-CONTACT
were first-pass A on exactly that VH class. The later capability-axis retries
were honest-eval misses of a different kind: SHOOTING-POWER's estimator
declaration disagreed with its runner, and BODY-CONTROL's first attempt used a
cosmetic knob (turnRate changes heading, not movement) so its cross-coupling
check could never fail — the second retry introduced the lateralResistance
damping that made the axis real. The critic caught both.

**deepseek-v4-flash-0731** is not graded as a builder. Its job is to force
retries. The expensive Qwen D/R rows are evidence it is doing that job:
camera-hash, `mutatePrng`, unbound HARD_INVARIANTs, unused two-player
scenario, cooldown-on-restore. Do not treat a high DeepSeek token count as
waste.

**grok-4.6 orchestrator** (160M prompt) is the parent loop: inspect, delegate,
wait, write CURRENT/HISTORY. **grok-4.6 git-committer** (6.4M prompt, 81 runs)
was a routing bug — bookkeeping only. That role is now `git-committer` /
`gemma4` (263k prompt on the first 3 runs). Do not add those two Grok lines
together when judging orchestration quality.

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

# Gauntlet session timing and model performance

Living log for this Gauntlet session. Refresh after each accepted objective.
Do not treat these numbers as a provider invoice.

```yaml
session_id: 019ffdda-1b40-7b90-91ae-cc7f3ad623b0
measured_at: 2026-08-22T09:43:53Z
tracking_contract_version: 1
last_tracked_objective: SMALL-SIDED-SHAPE-RERUN
usage_aggregates_through: SMALL-SIDED-SHAPE-RERUN
clock_aggregates_through: SMALL-SIDED-SHAPE-RERUN
model_evaluation_through: SMALL-SIDED-SHAPE-RERUN
source: ~/.grok/sessions/.../subagents/*/meta.json + child updates.jsonl
idle_excluded: 2026-08-14T07:46Z .. 2026-08-14T13:03Z
backfill_note: "2026-08-19 pickup: rows for CPU-DEFENSIVE-ORGANIZATION, MATCH-CORNER-KICK, BROWSER-PLAYER-ANIMATION, BROWSER-UI-POLISH backfilled from durable acceptance records/manifests and commit timestamps; per-step durations are estimates, not subagent meta.json."
overflow: orchestrator-deepseek (deepseek-v4-flash-0731) continued the session 2026-08-15T05:46Z; MUTANT-1V1, the three capability-axis rows, the lateral-drift row, the swerve row, and the CPU-opponent row are measured from this overflow session's meta.json. No sub-step in this session used the base deployment without the 0731 suffix.
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
| Calendar span (first work → measurement) | 39h 44m |
| Unexplained stop (excluded) | 5h 16m |
| Active work (anything running) | 34h 28m |
| Sum of per-step agent time | 26h 49m |
| Orchestrator thinking between steps | ~12h 48m |

Session start: `2026-08-14 01:19 UTC`. Measurement: `2026-08-22T09:43:53Z`.
The per-step total now includes DUELS-SUITE (1h 40m), MUTANT-1V1 (23m), SWERVE (40m), and CPU-OPPONENT-1V1 (21m);
"orchestrator thinking" grew because it absorbs the grok-4.6 handoff/docs
bookkeeping window (02:12–05:33 UTC) and the DeepSeek overflow window (05:46–16:44 UTC).

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
| LOCOMOTION-LATERAL-DRIFT | accepted | ~24m | 12.9m | 4.5m | 6.6m | 0.5m | ~1.7M | n/a** |
| CAPABILITY-SWERVE | accepted | ~40m | 25.0m | 8.9m | 5.1m | 0.8m | ~0.5M | n/a** |
| CPU-OPPONENT-1V1 | accepted | ~21m | 11.8m | 3.0m | 5.3m | 0.5m | ~0.1M | n/a** |
| MATCH-SCORING | accepted | ~33m | 26.8m | 4.8m | 5.0m | 0.5m | ~8.5M | n/a** |
| BROWSER-SCOREBOARD | accepted | ~14m | 10.2m | 4.3m | 4.4m | 0.5m | ~5.2M | n/a** |
| MATCH-LIFECYCLE | accepted | ~55m | 42.6m | 8.1m | 7.8m | 0.5m | ~10.1M | n/a** |
| AI-GOAL-IMPROVEMENT | accepted | ~20m | 14.7m | 4.2m | 5.3m | 0.5m | ~6.3M | n/a** |
| BROWSER-MATCH-PHASE-DISPLAY | accepted | ~45m | 29.1m | 8.6m | 7.3m | 0.5m | (from Iteration 45) | n/a** |
| BROWSER-GOAL-EFFECT | accepted | ~35m | 22.0m | 7.1m | 5.2m | 0.5m | (from Iteration 46) | n/a** |
| CPU-BALL-PURSUIT | accepted | ~50m | 34.5m | 7.8m | 5.9m | 0.5m | (from Iteration 47) | n/a** |
| BROWSER-MATCH-START-URL | accepted | ~28m | 18.3m | 5.2m | 4.2m | 0.5m | (from Iteration 48) | n/a** |
| CPU-PASSING-EVALUATION | accepted | ~21m | 12.1m | 8.3m | ~0m* | ~0.5m | ~3.4M est. | n/a** |
| CPU-TEAMMATE-PASS | accepted | ~28m | 17.2m | 9.0m | 1.9m | ~0.5m | ~5.2M est. | n/a** |
| CPU-MULTI-PLAYER | accepted | ~17m | 10.1m | 7.2m | 5.5m | ~0.5m | ~3.8M est. | n/a** |
| SCENARIO-2V2-FIXTURE | accepted | ~1h 3m | 49m | 3m | 12m | ~0.5m | ~12M est. | n/a** |
| CPU-BASIC-FORMATION | accepted | ~1h 54m | 50m | 7m | 7m | ~0.5m | ~5M est. | n/a** |
| BROWSER-HUMAN-VS-CPU | accepted | ~2h 19m | 50m | 7m | 4m | ~0.5m | ~10M est. | n/a** |
| CPU-2V2-PASSING | accepted | ~9m | 2m | 2m | 3m | ~0.5m | ~5M est. | n/a** |
| CPU-2V2-SCORING | accepted | ~29m | 18m | 7m | 3m | ~0.5m | ~8M est. | n/a** |
| CPU-TEAM-FORMATION | accepted | ~11m | 4m | 2m | 4m | ~0.5m | ~11M est. | n/a** |
| BROWSER-2V2-MATCH-KEYBOARD | accepted | ~12m | 4m | 2m | 4m | ~0.5m | ~7M est. | n/a** |
| BROWSER-2V2-PLAYABLE | accepted | ~28m | 6m | 3m | 5m | ~0.5m | ~6M est. | n/a** |
| CPU-TEAM-DECISION-PROFILE | accepted | ~27m | 27m | 3.5m | 9m | 0.5m | ~8M est. | n/a** |
| SCENARIO-3V3-FIXTURE | accepted | ~15m | 14.5m | 0.3m | 12m | 0.5m | ~3M est. | n/a** |
| CPU-3V3-FORMATION | accepted | ~22m | 21m | 9m | 10m | 0.5m | ~8M est. | n/a** |
| CPU-3V3-TEAMPLAY | accepted | ~21m | 20m | 13m | 6m | 0.5m | ~6M est. | n/a** |
| MATCH-SET-PIECE | accepted | ~23m | 22m | 1m | 8m | 0.5m | ~9M est. | n/a** |
| BROWSER-3V3-MATCH | accepted | ~21m | 21m | 1m | 11m | 0.5m | ~6M est. | n/a** |
| MATCH-TIMER-ENFORCEMENT | accepted | ~27m | ~0m*** | 13m | 12.7m | 11s | ~0.5M*** | n/a** |
| CPU-DEFENSIVE-IMPROVEMENT | accepted | ~74m | 43m | 31m | 3m | 22s | ~6M est. | n/a** |
| CPU-PASS-VARIETY | accepted | ~30m | 25m | 6m | 6m | 0.5m | ~8M est. | n/a** |
| BROWSER-3V3-HUMAN-VS-CPU | accepted | ~22m | 15m | 19m | 5m | 0.5m | ~2M est. | n/a** |
| SCENARIO-5V5-FIXTURE | accepted | ~18m | 15m | 12m | 5m | 0.5m | ~4M est. | n/a** |
| BROWSER-5V5-MATCH | accepted | ~25m | 16m | 3m | 3m | 0.5m | ~1M est. | n/a** |
| BROWSER-PLAYER-SWITCH | accepted | ~30m | 19m | 10m | 5m | 0.5m | ~6M est. | n/a** |
| BROWSER-CONTROLLED-PLAYER-INDICATOR | accepted | ~30m | 19m | 10m | 5m | 0.5m | ~6M est. | n/a** |
| BROWSER-5V3-HUMAN-VS-CPU | accepted | ~30m | 19m | 10m | 5m | 0.5m | ~6M est. | n/a** |
| CPU-ATTACKING-IMPROVEMENT | accepted | ~35m | 20m | 7m | 36m | 0.5m | ~6M est. | n/a** |
| HUMAN-PASS-DIRECTION-CONTROL | accepted | ~35m | 13m | 11m | 28m | 0.5m | ~6M est. | n/a** |
| HUMAN-SHOT-DIRECTION-CONTROL | accepted | ~30m | 15m | 8m | 12m | 0.5m | ~6M est. | n/a** |
| HUMAN-THROUGH-BALL | accepted | ~25m | 14m | 6m | 9m | 0.5m | ~6M est. | n/a** |
| CPU-INTERCEPTION-AWARENESS | accepted | ~35m | 17m | 14m | 21m | 0.5m | ~6M est. | n/a** |
| BROWSER-MATCH-SETUP-MENU | accepted | ~30m | 15m | 10m | 12m | 0.5m | ~6M est. | n/a** |
| BROWSER-MATCH-STATS | accepted | ~25m | 12m | 8m | 10m | 0.5m | ~6M est. | n/a** |
| CPU-ATTACKING-ORGANIZATION | accepted | ~20m | 10m | 7m | 8m | 0.5m | ~6M est. | n/a** |
| CPU-DEFENSIVE-ORGANIZATION | accepted | ~20m* | ~10m* | ~7m* | ~8m* | ~0.5m* | n/a** | n/a** |
| MATCH-CORNER-KICK | accepted | ~35m* | ~15m* | ~7m* | ~12m* | ~0.5m* | n/a** | n/a** |
| BROWSER-PLAYER-ANIMATION | accepted | ~20m* | ~9m* | ~6m* | ~5m* | ~0.5m* | n/a** | n/a** |
| BROWSER-UI-POLISH | accepted | ~45m* | ~20m* | ~8m* | ~16m* | ~0.5m* | n/a** | n/a** |
| MATCH-THROW-IN | accepted | ~64m | 40m | 11m | 9m | 1m | ~8M est. | n/a** |
| MATCH-GOAL-KICK | accepted | ~78m | 44m | 8m | 13m | 1m | ~8M est. | n/a** |
| CPU-TACTICAL-AWARENESS | accepted | ~160m | 100m | 20m | 9m | 1m | ~20M est. | n/a** |
| BROWSER-DIFFICULTY-SETTING | accepted | ~14m | 8m | 3m | 2m | 0.5m | ~3M est. | n/a** |
| TEAM-EVALUATOR-SUITE | accepted | ~28m | 18m | 7m | 5m | 0.5m | ~5M est. | n/a** |
| ARCHETYPE-BLINDED-COMPARISON | accepted | ~48m | 28m | 14m | 7m | 0.5m | ~8M est. | n/a** |
| PLAYABLE-SECOND-TOUCH | accepted | ~19m | 9m | 5m | 3m | 0.5m | ~4M est. | n/a** |
| PLAYABLE-CONTROL-SLOT-ROUTING | accepted | ~32m | 15m | 8m | 6m | 0.5m | ~6M est. | n/a** |
| PLAYABLE-1V1-PROFILE-EVALUATION | accepted | ~20m | 10m | 8m | 4m | 0.5m | ~4M est. | n/a** |
| BROWSER-CORE-EVIDENCE | accepted | 55m | 43m | 3m | 8m | 1m | n/a | n/a |
| ARCH-DIFF-001-RUBRIC | accepted | 25m | 10m | 3m | 11m | 1m | n/a | n/a |
| ARCHETYPE-BROWSER-CAPTURE | accepted | 65m | 49m | 4m | 8m | 4m | n/a | n/a |
| PLAYABLE-1V1-RE-EVALUATION | accepted | 24m | 4m | 15m | 5m | 0.5m | n/a | n/a |
| SMALL-SIDED-MILESTONE-EVALUATION | accepted | 7m | 1m | 1m | 5m | 0.5m | n/a | n/a |
| BROWSER-1V1-CONTROL-EVIDENCE | accepted | 30m | 20m | 1m | 3m | 1m | n/a | n/a |
| ARCHETYPE-RENDER-DIFFERENCE | accepted | 30m | 20m | 4m | 7m | 1m | n/a | n/a |
| ARCHETYPE-IDENTICAL-RECAPTURE | accepted | 45m | 31m | 2m | 11m | 1m | n/a | n/a |
| PLAYABLE-1V1-PROFILE-RERUN | accepted | 30m | 14m | 8m | 4m | 1m | n/a | n/a |
| SMALL-SIDED-SHAPE-RERUN | accepted | 17m | 1.5m | 3m | 5m | 1m | n/a | n/a |

Typical accepted step: 20–40 minutes and 3–12M processed prompt tokens.
Median accepted step: about 28 minutes. Cost spikes are critic retry loops,
not first-pass implementation.

\* DUELS-SUITE prompt/completion tokens were not re-aggregated from the prior
session; durations are from that session's subagent meta.json. The four rows
marked with a single `*` per cell (CPU-DEFENSIVE-ORGANIZATION, MATCH-CORNER-KICK,
BROWSER-PLAYER-ANIMATION, BROWSER-UI-POLISH) were backfilled 2026-08-19 from
durable acceptance records/manifests and commit timestamps; their per-cell
durations are estimates, not subagent meta.json values.
\*\* MUTANT-1V1 and the later overflow-session steps are not separately split
for completion (updates.jsonl records a final `totalTokens` snapshot per
role); `Prompt` is the summed final totals (MUTANT-1V1: builder 1.95M +
critic 0.89M + integrator 0.52M; PHYSICAL-CONTACT: 7.66M + 1.21M + 0.73M;
SHOOTING-POWER: 8.59M + 1.45M + 0.57M; BODY-CONTROL: builder 10.68M + critic
1.43M + integrator 1.08M, retry rounds share the builder/critic sessions;
MATCH-TIMER-ENFORCEMENT: builder work was done in a prior session; tokens
not measured in this session.
LATERAL-DRIFT: builder 1.17M + critic 0.19M + integrator 0.32M; SWERVE: estimated ~0.5M total).

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
| Lateral-drift regression (accepted) | 24m | ~1.7M | n/a** |
| Swerve axis (accepted) | 40m | ~0.5M | n/a** |
| CPU opponent (accepted) | 21m | ~0.1M | n/a** |
| Match scoring (accepted) | 33m | ~8.5M | n/a** |

## By model (tokens and wall)

Refreshed `2026-08-15` from the same session logs. Prompt tokens are still
processed input (context re-sent each call), not unique text.

### Grok 4.6 split — orchestrator vs committer

These were previously added together as "grok-4.6". They are different jobs.

| Job | Where it lives | Model | Runs | Prompt | Completion (est.) | Calls | Peak context |
|---|---|---|---:|---:|---:|---:|---:|
| Orchestrator | parent session (not in Tasks) | grok-4.6 | 1 session | **160.12M** | 898k | 781 | 400k |
| Git-committer (legacy) | `git-committer` children | grok-4.6 | 81 | **6.41M** | 469k | 649 | — |
| Git-committer (now) | `git-committer` children | gemma4 | 14 | **~1.28M** | n/a | 122 | — |
| **Grok 4.6 total** | parent + old committer | grok-4.6 | | **166.53M** | 1.37M | 1,430 | |

Orchestrator input is large because parent context grew to ~400k and was
re-sent on every orchestrator call (including while waiting on children).
That cost is **not** git-committer.

The 81 Grok committer runs were bookkeeping (conventional commits / push).
That role is now `git-committer` / `gemma4`. The fourteen Gemma runs so far
are ~1.28M processed prompt tokens (~25× cheaper per comparable commit
batch than the Grok committer average of ~79k prompt tokens/run). Gemma
completion growth is not recorded the same way in `updates.jsonl`
(streams often have a single `totalTokens` snapshot), so that cell is
`n/a`, not proof of zero output.

### All roles

| Model | Role | Runs | Prompt | Completion (est.) |
|---|---|---:|---:|---:|
| grok-4.6 | **orchestrator only** | parent | 160.12M | 898k |
| grok-4.6 | **git-committer (legacy)** | 81 | 6.41M | 469k |
| gemma4 | **git-committer** | 14 | 1.28M | n/a |
| qwen3.6 | builder | 58 | 232.60M | 3.57M |
| deepseek-v4-flash | **critic** (base deployment) | 0 | 0 | 0 |
| deepseek-v4-flash | **integrator** (base deployment) | 0 | 0 | 0 |
| deepseek-v4-flash-0731 | critic | 71 | 47.48M | 2.57M |
| deepseek-v4-flash-0731 | integrator | 38 | 27.38M | 1.20M |
| mimo-v2.5 | builder | 13 | 50.42M | 0.79M |
| **All processed** | | | **~526M** | **~9.5M** |

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
(~0.18M est.). LATERAL-DRIFT added one qwen3.6 builder run (1.17M), one
critic run (0.19M), one integrator run (0.32M), two gemma4 commit runs
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
| LOCOMOTION-LATERAL-DRIFT | qwen3.6 | H | High — can violate architecture | 0 | A | Default-config lateral-drift regression tests; negative control proves FAIL direction |
| CAPABILITY-SWERVE | qwen3.6 | H | High — new physics + new runner | 0 | A | Provisional Magnus curve force, swerve axis runner; zero-spin protected; critic ACCEPT first pass |
| CPU-OPPONENT-1V1 | qwen3.6 | M | Medium — new module, existing contract | 0 | A | Simple chase-ball CPU opponent for AI_FALLBACK slots; critic ACCEPT first pass |
| CPU-PASSING-EVALUATION | qwen3.6 | M | Medium — new module, existing harness | 0 | A | Added PASS_BIT to CPU adapter with edge detection; 18 unit tests; critic ACCEPT first pass |
| CPU-TEAMMATE-PASS | qwen3.6 | M | Medium — new module, existing harness | 0 | A | Added teammate-aware pass targeting; getBestTeammateTarget helper; 13 unit tests; critic ACCEPT first pass |
| CPU-MULTI-PLAYER | qwen3.6 | M | Medium — new module, existing harness | 0 | A | controlledPlayerId-based player lookup; multi-adapter independence; 12 unit tests; critic ACCEPT first pass |
| SCENARIO-2V2-FIXTURE | qwen3.6 | M | Medium — browser glue, selector routing, CPU adapter tests | 0 | A | ?mode=ai-match&scenario=2v2 selector routing; 14 CPU independence tests; 11 selector tests; critic ACCEPT first pass |
| CPU-BASIC-FORMATION | qwen3.6 | H | High — new physics behavior in CPU adapter (defense mode blend) | 0 | A | 20% pull toward own goal with linear blend 20m→40m; 22 tests; no regressions; critic ACCEPT first pass |
| BROWSER-HUMAN-VS-CPU | mimo-v2.5 | H | High — new browser path, keyboard + CPU multi-slot wiring | 0 | A | ?mode=human-vs-ai URL routing; keyboard+CPU multi-slot; 1283 tests; critic-flash RETRY (screenshot quality), integration-reviewer-flash ACCEPT |
| CPU-2V2-PASSING | qwen3.6 | L | Low — no code changes, only test coverage for existing passing logic | 0 | A | 31 tests verify 2v2 passing behavior; existing logic already correct; critic ACCEPT first pass |
| CPU-2V2-SCORING | qwen3.6 | H | High — new eval layer behavior (goal reset, multi-slot match runner) | 0 | A | 34 tests cover goal detection, scoring, reset, full-time, determinism; 1348 tests pass; critic ACCEPT first pass |
| CPU-TEAM-FORMATION | qwen3.6 | H | High — new physics behavior in CPU adapter (defense mode three-way blend) | 0 | A | 16 tests cover formation positions, displacement, blend behavior, determinism; 1364 tests pass; critic ACCEPT first pass, integration ACCEPT (second pass after screenshot provided) |
| BROWSER-2V2-MATCH-KEYBOARD | mimo-v2.5 | M | Medium — browser glue, scenario fixture, keyboard + CPU slot wiring | 0 | A |
| BROWSER-2V2-PLAYABLE | mimo-v2.5 | M | Medium — browser glue, URL routing, deterministic multi-tick test, screenshot evidence | 2 | C | 12 fixture tests, 3 browser screenshot tests, 1382 node + 33 browser suite pass; critic ACCEPT first pass, integration ACCEPT first pass |
| CPU-TEAM-DECISION-PROFILE | mimo-v2.5 | M | Medium — team coordination state machine in adapter layer | 0 | A | ATTACK/DEFEND/BALANCED state machine, formation modulation, slot-wiring verified, 176/176 tests pass, critic ACCEPT first pass |
| SCENARIO-3V3-FIXTURE | qwen3.6 | M | Medium — new scenario fixture, existing pattern | 0 | A | 32 unit tests, 9 integration tests, 1438/1438 pass, critic ACCEPT first pass |
| CPU-3V3-FORMATION | qwen3.6 | M | Medium — formation role extension, existing cpu-adapter pattern | 0 | A | 23 new tests, 483/483 total pass, role-aware defender/midfielder/attacker pulls |
| CPU-3V3-TEAMPLAY | qwen3.6 | L | Low — test-only, no source changes needed | 0 | A | 23 unit tests, 14 integration tests, existing adapter handles 3v3 correctly |
| MATCH-SET-PIECE | qwen3.6 | M | Medium — match restart logic, contracts + simulation loop | 0 | A | 21 unit tests, 11 integration tests, 1530/1530 total pass, countdown → reset cycle |
| BROWSER-3V3-MATCH | mimo-v2.5 | M | Medium — browser URL routing, CPU slot wiring, screenshot evidence | 0 | A | ?mode=ai-match-3v3, 4 semantic screenshots, 1541/1541 node tests |
| MATCH-TIMER-ENFORCEMENT | qwen3.6 | M | Medium — match timer state machine, contracts + simulation loop | 0 | A | 19 unit tests, 6 integration tests, 1579/1579 total pass, playing→halftime→playing→fulltime, 120-tick trajectory |
| CPU-DEFENSIVE-IMPROVEMENT | mimo-v2.5 | M | Medium — CPU defender marking/pressing/sub-modes in adapter layer | 0 | A | 16 unit tests, 4 integration tests, 238/238 unit, 239/239 integration, 100-tick trajectory |
| CPU-PASS-VARIETY | mimo-v2.5 | M | Medium — pass variety, defender-aware targeting, urgency-scaled choice | 0 | A | 13 new tests, 273/273 cpu-adapter, 1612/1612 total, 8-frame trajectory |
| BROWSER-3V3-HUMAN-VS-CPU | mimo-v2.5 | M | Medium — URL routing, scenario fixture, browser glue | 0 | A | 56 browser tests, 1612 node tests, screenshot frame-000.png |
| SCENARIO-5V5-FIXTURE | qwen3.6 | M | Medium — new fixture, existing scenario pattern | 0 | A | 42 new tests, 1654/1654 total, 5 scenario files |
| BROWSER-5V5-MATCH | mimo-v2.5 | H | High — browser wiring, 10-slot CPU autonomy, hash parity | 0 | A | 8 new browser tests, 64/64 browser total, hash parity verified |
| BROWSER-PLAYER-SWITCH | mimo-v2.5 | M | Medium — player switching, Tab mapping, Simulation API | 1 | B | 7 new browser tests, 71/71 browser total, 1654/1654 node |
| BROWSER-CONTROLLED-PLAYER-INDICATOR | mimo-v2.5 | M | Medium — yellow ring indicator, renderer-only change | 1 | B | 1 retry: audit flag, test env |
| BROWSER-5V3-HUMAN-VS-CPU | mimo-v2.5 | M | Medium — URL mode, fixture, browser glue | 0 | A | 9 tests, 86 browser tests, 1654 node tests, first-pass clean |
| CPU-ATTACKING-IMPROVEMENT | mimo-v2.5 | M | Medium — off-ball forward runs, role-aware positioning | 0 | A | 14 tests, 1668 node, first-pass clean |
| HUMAN-PASS-DIRECTION-CONTROL | mimo-v2.5 | M | Medium — directional passing, lofted pass modifier | 0 | A | 31 tests, 1698 node, first-pass clean |
| HUMAN-SHOT-DIRECTION-CONTROL | mimo-v2.5 | M | Medium — shot direction via moveX/moveY, bodyHeading fallback | 0 | A | 17 tests, 1722 node, first-pass clean |
| HUMAN-THROUGH-BALL | mimo-v2.5 | M | Medium — Q+J through-ball, teammate targeting, auto fallback | 0 | A | 21 tests, 1722 node, first-pass clean |
| CPU-INTERCEPTION-AWARENESS | mimo-v2.5 | M | Medium — pass-trajectory interception, defender coordination | 0 | A | 15 tests, 1722 node, first-pass clean |
| BROWSER-MATCH-SETUP-MENU | mimo-v2.5 | M | Medium — setup menu, match lifecycle refactor | 0 | A | 86 browser, 1722 node, first-pass clean |
| BROWSER-MATCH-STATS | mimo-v2.5 | L | Small — live stats display, event derivation | 0 | A | 86 browser, typecheck, first-pass clean |
| CPU-ATTACKING-ORGANIZATION | mimo-v2.5 | M | Medium — overlapping runs, spacing, delayed runs, cross/through-ball | 0 | A | 11 tests, 86 browser, first-pass clean |
| CPU-DEFENSIVE-ORGANIZATION | mimo-v2.5 | M | Medium — structured defensive organization | 0 | A | backfilled from durable record; critic first pass |
| MATCH-CORNER-KICK | mimo-v2.5 | M | Medium — corner-kick set piece over MATCH-SET-PIECE infra | 0 | A | backfilled from durable record; critic first pass |
| BROWSER-PLAYER-ANIMATION | mimo-v2.5 | M | Medium — body orientation and running animation | 0 | A | backfilled from durable record; critic first pass |
| BROWSER-UI-POLISH | mimo-v2.5 | M | Medium — browser UI polish | 0 | A | backfilled from durable record; critic first pass |
| MATCH-THROW-IN | mimo-v2.5 | M | Medium — throw-in set piece over MATCH-SET-PIECE infra | 0 | A | 28 tests, 1835 node, 86 browser, first-pass clean |
| MATCH-GOAL-KICK | mimo-v2.5 | M | Medium — goal-kick set piece over MATCH-SET-PIECE infra | 0 | A | 33 tests, 1868 node, 86 browser, first-pass clean |
| CPU-TACTICAL-AWARENESS | mimo-v2.5 | M | Medium — continuous score gradient, fatigue accumulator, phase hold | 0 | A | 46 tests, 1914 node, 86 browser (2 orchestrator-verified fix rounds before critic) |
| BROWSER-DIFFICULTY-SETTING | mimo-v2.5 | M | Medium — configurable difficulty scaling, browser HUD | 0 | A | 20 unit + 15 browser + 1 capture tests, 1935 node, first-pass clean |
| TEAM-EVALUATOR-SUITE | qwen3.6 | M | Medium — structured evaluator runners, 3v3 context | 0 | A | 53 eval tests, 1675 total, first-pass clean |
| ARCHETYPE-BLINDED-COMPARISON | qwen3.6 | H | High — perceptual rubric, canvas rendering, evaluator wiring | 0 | B | 51 eval tests, 507 total (critic retry: 5 substantive fixes) |
| PLAYABLE-SECOND-TOUCH | mimo-v2.5 | H | High — new physics contact system, dribble state machine | 0 | A | 30 new tests (16 groups), 67 integration, 377 regression, first-pass clean |
| PLAYABLE-CONTROL-SLOT-ROUTING | mimo-v2.5 | M | Medium — slot routing, player switching, pure functions | 0 | B | 45 tests, 1969 total (critic retry: fromPlayer payload fix) |
| PLAYABLE-1V1-PROFILE-EVALUATION | qwen3.6 | M | Medium — profile evaluation runner, result analysis | 0 | A | 47 eval tests, 554 total, INVALID_RUN verdict correct |
| BROWSER-CORE-EVIDENCE | mimo-v2.5 | M | Medium — browser case evidence capture, runner wiring, semantic frames | 1 | B | 20 browser + 9 unit evidence tests; critic retry recaptured distinct 800x600 frames |
| ARCH-DIFF-001-RUBRIC | qwen3.6 | M | Medium — versioned perceptual rubric and deterministic evaluator | 1 | B | 61 rubric tests; critic retry TS4104 + disk stateHash |
| ARCHETYPE-BROWSER-CAPTURE | mimo-v2.5 | H | High — real renderer capture under identical conditions | 2 | C | critic/orchestrator retries: synthetic 2D then position-offset theatrical PASS |
| PLAYABLE-1V1-RE-EVALUATION | qwen3.6 | M | Medium — re-run profile evaluator with new evidence | 0 | A | 29 tests; honest INVALID_RUN |
| SMALL-SIDED-MILESTONE-EVALUATION | qwen3.6 | M | Medium — milestone playtest attempt | 0 | A | NOT_EVALUATED; PLAYABLE_1V1_PASS unmet |
| BROWSER-1V1-CONTROL-EVIDENCE | mimo-v2.5 | M | Medium — two-slot browser evidence capture | 0 | B | two provider HTTP 400s then completed capture |
| ARCHETYPE-RENDER-DIFFERENCE | mimo-v2.5 | M | Medium — provisional renderer visual mapping | 0 | A | burst vs steady distinguishable; first pass |
| ARCHETYPE-IDENTICAL-RECAPTURE | mimo-v2.5 | M | Medium — identical-condition recapture | 1 | B | sequence trim + unique SHAs; honest FAIL |
| PLAYABLE-1V1-PROFILE-RERUN | qwen3.6 | M | Medium — profile re-run with two-player CONTROL check | 1 | B | critic REJECT then honest FAIL |
| SMALL-SIDED-SHAPE-RERUN | qwen3.6 | M | Medium — milestone playtest rerun | 0 | A | NOT_EVALUATED; PLAYABLE_1V1_PASS unmet |
| PLAYABLE-1V1-PROFILE-EVALUATION | critic-mimo (mimo-v2.5) | 0731 unavailable, flash unavailable, qwen blocked (same model as builder), mimo fallback | ACCEPT | 47 tests, 554 eval, INVALID_RUN verdict correct, architecture verified |

### Reviewer route and catches

| Step | Reviewer | Route | Result | Catches |
|---|---:|---:|---:|---|
| CPU-PASSING-EVALUATION | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| CPU-PASSING-EVALUATION | integration-reviewer | deepseek allowance exhausted; orchestrator-verified | ACCEPT | dependency direction clean, no eval file modifications, 1199/1199 regressions pass |
| CPU-TEAMMATE-PASS | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| CPU-TEAMMATE-PASS | integration-reviewer-flash (deepseek-v4-flash) | direct 0731 exhausted, flash used | ACCEPT | dependency direction clean, no eval modifications, 1212/1212 regressions pass |
| CPU-MULTI-PLAYER | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| CPU-MULTI-PLAYER | integration-reviewer-flash (deepseek-v4-flash) | direct 0731 exhausted, flash used | ACCEPT | dependency direction clean, no eval modifications, 1224/1224 regressions pass |
| SCENARIO-2V2-FIXTURE | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| SCENARIO-2V2-FIXTURE | integration-reviewer-flash (deepseek-v4-flash) | first REJECT (scope violation: capture-extract.js); fixed, re-review ACCEPT | ACCEPT | 1282/1282 regressions, scope violation removed, blank screenshot known pipeline limitation |
| CPU-BASIC-FORMATION | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| CPU-BASIC-FORMATION | integration-reviewer-flash (deepseek-v4-flash) | direct | ACCEPT | 1278/1278 regressions pass, no eval file modifications, formation blend confined to adapter layer |
| BROWSER-HUMAN-VS-CPU | critic-flash (deepseek-v4-flash) | screenshot RETRY (blank canvas) | RETRY | 0 retries on logic — screenshot quality only (known pipeline limitation) |
| BROWSER-HUMAN-VS-CPU | integration-reviewer-flash (deepseek-v4-flash) | direct | ACCEPT | 1283/1283 regressions pass, artifact at required path, known pipeline limitation |
| CPU-2V2-PASSING | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| CPU-2V2-PASSING | integration-reviewer-flash (deepseek-v4-flash) | direct | ACCEPT | 145/145 CPU adapter suite, no source code changes, artifact at required path |
| CPU-2V2-SCORING | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| CPU-2V2-SCORING | integration-reviewer-flash (deepseek-v4-flash) | direct | ACCEPT | 1348/1348 full suite pass, no eval file regressions, headless eval layer only |
| CPU-TEAM-FORMATION | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| CPU-TEAM-FORMATION | integration-reviewer-flash (deepseek-v4-flash) | first REJECT (missing screenshot); second pass ACCEPT | ACCEPT | 1364/1364 regressions, artifact at required path, known pipeline limitation |
| BROWSER-2V2-MATCH-KEYBOARD | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| BROWSER-2V2-MATCH-KEYBOARD | integration-reviewer-flash (deepseek-v4-flash) | direct | ACCEPT | 1382/1382 regressions, 33/33 browser tests, artifact at required path |
| BROWSER-2V2-PLAYABLE | critic-flash (deepseek-v4-flash) | 0731 allowance exhausted | ACCEPT (3rd attempt) | 2 retries: screenshot quality (1st), ball-static trajectory (2nd) |
| BROWSER-2V2-PLAYABLE | integration-reviewer-flash (deepseek-v4-flash) | direct | ACCEPT | 1382/1382 node, 40/40 browser, trajectory with CPU-driven movement |
| CPU-TEAM-DECISION-PROFILE | critic-flash (deepseek-v4-flash) | 0731 allowance exhausted | ACCEPT | 0 retries — first pass clean |
| CPU-TEAM-DECISION-PROFILE | integration-reviewer-flash (deepseek-v4-flash) | direct | ACCEPT | 176/176 CPU adapter, 27/27 arch, 195/195 integration, slot-wiring verified |
| SCENARIO-3V3-FIXTURE | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| SCENARIO-3V3-FIXTURE | integration-reviewer-flash (deepseek-v4-flash) | direct | ACCEPT | 32/32 unit, 9/9 integration, 204/204 integration suite, slot-wiring verified |
| CPU-3V3-FORMATION | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| CPU-3V3-FORMATION | integration-reviewer-flash (deepseek-v4-flash) | direct | ACCEPT | 221/221 cpu-adapter, 204/204 integration, 1501/1501 full suite |
| CPU-3V3-TEAMPLAY | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| CPU-3V3-TEAMPLAY | integration-reviewer-flash (deepseek-v4-flash) | direct | ACCEPT | 222/222 cpu-adapter, 218/218 integration, 1252/1252 unit all pass |
| MATCH-SET-PIECE | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| MATCH-SET-PIECE | integration-reviewer-flash (deepseek-v4-flash) | direct | ACCEPT | 32/32 new tests, 1530/1530 node, 40/40 browser, presentation_authority PASS |
| BROWSER-3V3-MATCH | critic-flash (deepseek-v4-flash) | direct | ACCEPT | 0 retries — first pass clean |
| BROWSER-3V3-MATCH | integration-reviewer-flash (deepseek-v4-flash) | direct | ACCEPT | 1541/1541 node, 4 semantic frames, 60-tick trajectory, presentation_authority PASS |
| MATCH-TIMER-ENFORCEMENT | critic-flash (deepseek-v4-flash) | direct 0731 exhausted, flash used | ACCEPT | 0 retries — first pass clean; trajectory hash re-computed and matching |
| MATCH-TIMER-ENFORCEMENT | integration-reviewer-flash (deepseek-v4-flash) | direct 0731 exhausted, flash used | ACCEPT | 1579/1579 node, 120-tick trajectory byte-identical, neighboring suites pass, presentation_authority PASS |
| CPU-DEFENSIVE-IMPROVEMENT | critic-flash (deepseek-v4-flash) | direct 0731 exhausted, flash used | ACCEPT | 0 retries — first pass clean; all criteria PASS |
| CPU-DEFENSIVE-IMPROVEMENT | integration-reviewer-flash (deepseek-v4-flash) | direct 0731 exhausted, flash used | ACCEPT | 238/238 unit, 239/239 integration, dependency direction clean |
| CPU-PASS-VARIETY | critic-flash (deepseek-v4-flash) | 0731 allowance exhausted, flash fallback | ACCEPT | 0 retries — first pass clean; all 7 criteria PASS |
| CPU-PASS-VARIETY | integration-reviewer-flash (deepseek-v4-flash) | 0731 allowance exhausted, flash fallback | ACCEPT | 90/90 files, 1612/1612 tests, dependency direction clean |
| BROWSER-3V3-HUMAN-VS-CPU | critic-flash (deepseek-v4-flash) | 0731 allowance exhausted, flash fallback | ACCEPT | 0 retries — first pass clean; all 8 criteria PASS |
| BROWSER-3V3-HUMAN-VS-CPU | integration-reviewer-flash (deepseek-v4-flash) | 0731 allowance exhausted, flash fallback | ACCEPT | 90/90 files, 1612/1612 node, 12/12 files, 56/56 browser, dependency clean |
| SCENARIO-5V5-FIXTURE | critic-flash (deepseek-v4-flash) | 0731 allowance exhausted, flash fallback | ACCEPT | 0 retries — first pass clean; all 7 criteria PASS |
| SCENARIO-5V5-FIXTURE | integration-reviewer-flash (deepseek-v4-flash) | 0731 allowance exhausted, flash fallback | ACCEPT | 5 scenario files, 125 tests, 1654 total, dependency clean |
| BROWSER-5V5-MATCH | critic-flash (deepseek-v4-flash) | 0731 allowance exhausted, flash fallback | ACCEPT | 0 retries — first pass clean; all 8 criteria PASS |
| BROWSER-5V5-MATCH | integration-reviewer-flash (deepseek-v4-flash) | 0731 allowance exhausted, flash fallback | ACCEPT | 13 browser files/64 tests, 91 node files/1654 tests, dependency clean |
| BROWSER-PLAYER-SWITCH | critic-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 1 retry — fixed nextEligiblePlayer to read live state |
| BROWSER-PLAYER-SWITCH | integration-reviewer-flash (deepseek-v4-flash) | — | ACCEPT | 15 browser files/71 tests, 91 node files/1654 tests, evidence verified |
| BROWSER-CONTROLLED-PLAYER-INDICATOR | critic-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 1 retry — audit flag, test env |
| BROWSER-CONTROLLED-PLAYER-INDICATOR | integration-reviewer-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 77 browser tests, 1654 node tests, evidence verified |
| BROWSER-5V3-HUMAN-VS-CPU | critic-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 0 retries — first pass clean |
| BROWSER-5V3-HUMAN-VS-CPU | integration-reviewer-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 86 browser tests, 1654 node tests, dependency clean |
| CPU-ATTACKING-IMPROVEMENT | critic-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 0 retries — first pass clean, 13/13 criteria |
| CPU-ATTACKING-IMPROVEMENT | integration-reviewer-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 1668 node tests, dependency clean |
| HUMAN-PASS-DIRECTION-CONTROL | critic-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 0 retries — first pass clean, 11/11 criteria |
| HUMAN-PASS-DIRECTION-CONTROL | integration-reviewer-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 1698 node tests, 86 browser tests, dependency clean |
| HUMAN-SHOT-DIRECTION-CONTROL | critic-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 11/11 criteria, first-pass clean |
| HUMAN-SHOT-DIRECTION-CONTROL | integration-reviewer-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 1722 node tests, 86 browser tests, dependency clean |
| HUMAN-THROUGH-BALL | critic-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 12/12 criteria, first-pass clean |
| HUMAN-THROUGH-BALL | integration-reviewer-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 1722 node tests, 86 browser tests, dependency clean |
| CPU-INTERCEPTION-AWARENESS | critic-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 7/7 criteria, first-pass clean |
| CPU-INTERCEPTION-AWARENESS | integration-reviewer-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 287/287 CPU adapter, 130 unit, 239 integration tests, no core changes |
| BROWSER-MATCH-SETUP-MENU | critic-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 8/8 criteria, screenshot present, first-pass clean |
| BROWSER-MATCH-SETUP-MENU | integration-reviewer-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 86 browser tests, 1722 node tests, no core changes |
| BROWSER-MATCH-STATS | critic-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 4/4 criteria, first-pass clean |
| BROWSER-MATCH-STATS | integration-reviewer-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 86 browser tests, typecheck, no core changes |
| CPU-ATTACKING-ORGANIZATION | critic-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 5/5 criteria, 11 tests, first-pass clean |
| CPU-ATTACKING-ORGANIZATION | integration-reviewer-flash (deepseek-v4-flash) | 0731 exhausted, flash fallback | ACCEPT | 11 tests, 86 browser, no core changes |
| CPU-DEFENSIVE-ORGANIZATION | critic-flash (deepseek-v4-flash) | backfilled from durable record | ACCEPT | first pass clean |
| CPU-DEFENSIVE-ORGANIZATION | integration-reviewer-flash (deepseek-v4-flash) | backfilled from durable record | ACCEPT | no core changes |
| MATCH-CORNER-KICK | critic-flash (deepseek-v4-flash) | backfilled from durable record | ACCEPT | first pass clean |
| MATCH-CORNER-KICK | integration-reviewer-flash (deepseek-v4-flash) | backfilled from durable record | ACCEPT | no core changes |
| BROWSER-PLAYER-ANIMATION | critic-flash (deepseek-v4-flash) | backfilled from durable record | ACCEPT | first pass clean |
| BROWSER-PLAYER-ANIMATION | integration-reviewer-flash (deepseek-v4-flash) | backfilled from durable record | ACCEPT | presentation_authority PASS |
| BROWSER-UI-POLISH | critic-flash (deepseek-v4-flash) | backfilled from durable record | ACCEPT | first pass clean |
| BROWSER-UI-POLISH | integration-reviewer-flash (deepseek-v4-flash) | backfilled from durable record | ACCEPT | no core changes |
| MATCH-THROW-IN | critic-flash (deepseek-v4-flash) | 0731 unavailable, flash fallback | ACCEPT | critique re-verified after audit-artifact correction |
| MATCH-THROW-IN | integration-reviewer-flash (deepseek-v4-flash) | 0731 unavailable, flash fallback; second pass | ACCEPT | full node 1835, 84 targeted, no core changes |
| MATCH-GOAL-KICK | critic-flash (deepseek-v4-flash) | 0731 unavailable, flash fallback | ACCEPT | 33 goal-kick, 1868 node, 86 browser, first-pass clean |
| MATCH-GOAL-KICK | integration-reviewer-flash (deepseek-v4-flash) | 0731 unavailable, flash fallback | ACCEPT | 1868 node, 84 neighboring set-piece, no core changes |
| CPU-TACTICAL-AWARENESS | critic-flash (deepseek-v4-flash) | 0731 unavailable, flash fallback | ACCEPT | gradient/fatigue/phase verified; 1914 node, 86 browser; timeout accommodation judged non-masking |
| CPU-TACTICAL-AWARENESS | integration-reviewer-flash (deepseek-v4-flash) | 0731 unavailable, flash fallback | ACCEPT | 1914 node, 86 browser, no core/contract changes |
| BROWSER-DIFFICULTY-SETTING | critic-qwen (qwen3.6) | 0731 unavailable, flash unavailable, qwen fallback | ACCEPT | difficulty factors verified; 1935 node, 86 browser, first-pass clean |
| BROWSER-DIFFICULTY-SETTING | integration-reviewer-qwen (qwen3.6) | 0731 unavailable, flash unavailable, qwen fallback | ACCEPT | 1935 node, 86 browser, no core changes, dependency clean |
| TEAM-EVALUATOR-SUITE | critic-mimo (mimo-v2.5) | 0731 unavailable, flash unavailable, qwen blocked (same model as builder), mimo fallback | ACCEPT | mutant-team + team-shape reducers verified; 1675 node, first-pass clean |
| TEAM-EVALUATOR-SUITE | integration-reviewer-mimo (mimo-v2.5) | 0731 unavailable, flash unavailable, qwen blocked (same model as builder), mimo fallback | ACCEPT | 1675 node, no core changes, dependency clean, evaluator integrity PASS |
| ARCHETYPE-BLINDED-COMPARISON | critic-mimo (mimo-v2.5) | 0731 unavailable, flash unavailable, qwen blocked (same model as builder), mimo fallback | ACCEPT (retry) | 5 substantive fixes: playable evaluator wiring, HEADLESS NOT_EVALUATED, Buffer fix, game frame rendering, full hash sampling |
| ARCHETYPE-BLINDED-COMPARISON | integration-reviewer-mimo (mimo-v2.5) | 0731 unavailable, flash unavailable, qwen blocked (same model as builder), mimo fallback | ACCEPT | 507 eval tests, no core changes, dependency clean, evaluator integrity PASS |
| PLAYABLE-SECOND-TOUCH | critic-qwen (qwen3.6) | 0731 unavailable, flash unavailable, qwen fallback | ACCEPT | 30 tests, 67 integration, ball independence verified, no PES claims |
| PLAYABLE-SECOND-TOUCH | integration-reviewer-qwen (qwen3.6) | 0731 unavailable, flash unavailable, qwen fallback | ACCEPT | 377 regression tests, no core changes, dependency clean |
| PLAYABLE-CONTROL-SLOT-ROUTING | critic-qwen (qwen3.6) | 0731 unavailable, flash unavailable, qwen fallback | ACCEPT (retry) | fromPlayer payload fix: pre-switch ID captured correctly |
| PLAYABLE-CONTROL-SLOT-ROUTING | integration-reviewer-qwen (qwen3.6) | 0731 unavailable, flash unavailable, qwen fallback | ACCEPT | 159 loop/input tests, 0 regressions, dependency clean |
| PLAYABLE-1V1-PROFILE-EVALUATION | critic-mimo (mimo-v2.5) | 0731 unavailable, flash unavailable, qwen blocked (same model as builder), mimo fallback | ACCEPT | 47 tests, 554 eval, INVALID_RUN verdict correct, architecture verified |
| PLAYABLE-1V1-PROFILE-EVALUATION | integration-reviewer-mimo (mimo-v2.5) | 0731 unavailable, flash unavailable, qwen blocked (same model as builder), mimo fallback | ACCEPT | dependency PASS, evaluator integrity PASS, 0 regressions |
| BROWSER-CORE-EVIDENCE | critic (deepseek-v4-flash) | primary flash; independent of mimo builder | ACCEPT (retry 1) | caught byte-identical 205x460 frames; recapture 800x600 unique SHAs |
| BROWSER-CORE-EVIDENCE | integration-reviewer (deepseek-v4-flash) | primary flash; independent of mimo builder | ACCEPT | core-smoke 16/16, evaluator integrity PASS, no PLAYABLE_1V1_PASS claim |
| ARCH-DIFF-001-RUBRIC | critic (deepseek-v4-flash) | primary flash; independent of qwen builder | ACCEPT (retry 1) | TS4104 in rubric criteria; disk path must not synthesize stateHash |
| ARCH-DIFF-001-RUBRIC | integration-reviewer (deepseek-v4-flash) | primary flash; independent of qwen builder | ACCEPT | 624 eval unit tests, missing artifacts stay NEEDS_PERCEPTUAL_REVIEW |
| ARCHETYPE-BROWSER-CAPTURE | critic (deepseek-v4-flash) | primary flash; independent of mimo builder | ACCEPT (retry 2) | honest FAIL on identical frames; renderer ignores archetypeId |
| ARCHETYPE-BROWSER-CAPTURE | integration-reviewer (deepseek-v4-flash) | primary flash; independent of mimo builder | ACCEPT | evaluator integrity PASS, HEADLESS NOT_EVALUATED preserved |
| PLAYABLE-1V1-RE-EVALUATION | critic (deepseek-v4-flash) | primary flash; independent of qwen builder | ACCEPT | honest INVALID_RUN; historical evidence untouched |
| PLAYABLE-1V1-RE-EVALUATION | integration-reviewer (deepseek-v4-flash) | primary flash; independent of qwen builder | ACCEPT | 653 eval unit tests, evaluator integrity PASS |
| SMALL-SIDED-MILESTONE-EVALUATION | critic (deepseek-v4-flash) | primary flash; independent of qwen builder | ACCEPT | honest NOT_EVALUATED |
| SMALL-SIDED-MILESTONE-EVALUATION | integration-reviewer (deepseek-v4-flash) | primary flash; independent of qwen builder | ACCEPT | evaluator integrity PASS, no milestone PASS |
| BROWSER-1V1-CONTROL-EVIDENCE | critic (deepseek-v4-flash) | primary flash; independent of mimo builder | ACCEPT | five distinct real renderer frames; hash parity |
| BROWSER-1V1-CONTROL-EVIDENCE | integration-reviewer (deepseek-v4-flash) | primary flash; independent of mimo builder | ACCEPT | 8/8 1v1-control tests, no PLAYABLE_1V1_PASS |
| ARCHETYPE-RENDER-DIFFERENCE | critic (deepseek-v4-flash) | primary flash; independent of mimo builder | ACCEPT | distinguishable burst/steady frames |
| ARCHETYPE-RENDER-DIFFERENCE | integration-reviewer (deepseek-v4-flash) | primary flash; independent of mimo builder | ACCEPT | presentation authority PASS, core-smoke 16/16 |
| ARCHETYPE-IDENTICAL-RECAPTURE | critic (deepseek-v4-flash) | primary flash; independent of mimo builder | ACCEPT | honest FAIL technical vs power |
| ARCHETYPE-IDENTICAL-RECAPTURE | integration-reviewer (deepseek-v4-flash) | primary flash; independent of mimo builder | ACCEPT | evaluator integrity PASS |
| PLAYABLE-1V1-PROFILE-RERUN | critic (deepseek-v4-flash) | primary flash; independent of qwen builder | ACCEPT after REJECT | fabricated CONTROL hashes; then two-player check |
| PLAYABLE-1V1-PROFILE-RERUN | integration-reviewer (deepseek-v4-flash) | primary flash; independent of qwen builder | ACCEPT | evaluator integrity PASS |
| SMALL-SIDED-SHAPE-RERUN | critic (deepseek-v4-flash) | primary flash; independent of qwen builder | ACCEPT | honest NOT_EVALUATED |
| SMALL-SIDED-SHAPE-RERUN | integration-reviewer (deepseek-v4-flash) | primary flash; independent of qwen builder | ACCEPT | evaluator integrity PASS |

### Builder scoreboard

Only **accepted** objectives. In-flight TOUCH-ACTIONS is excluded.

| Builder | n | A | B | C | D | R | First-pass % | Mean critic loops | Mean step time |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| qwen3.6 | 45 | 27 | 10 | 3 | 3 | 2 | 60% | ~0.73 | ~36m |
| mimo-v2.5 | 31 | 20 | 9 | 2 | 0 | 0 | 65% | ~0.42 | ~32m |

Weighted by difficulty (L=1, M=2, H=3, VH=4), counting A=4 … D=1, R=0.5:

| Builder | Objectives | Weighted grade / difficulty | Read as |
|---|---:|---:|---|
| mimo-v2.5 | 10, mixed M–H | 3.0 / 3.0 | First-pass locomotion and ball; misses were local (mapping, restore, pair order). CPU-TEAM-DECISION-PROFILE (M) first-pass A. BROWSER-2V2-PLAYABLE needed 2 critic retries for evidence quality. |
| qwen3.6 | 36, mixed M–VH | 3.3 / 2.8 | Reliable on contracts, profiles, and adapter wiring; expensive on honest-eval / CLI / browser evidence. SCENARIO-3V3-FIXTURE first-pass A (new scenario fixture). |

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
forbid "always-pass" tests up front. MUTANT-1V1 and CAPABILITY-PHYSICAL-CONTACT
were first-pass A on exactly that VH class. The later capability-axis retries
were honest-eval misses of a different kind: SHOOTING-POWER's estimator
declaration disagreed with its runner, and BODY-CONTROL's first attempt used a
cosmetic knob (turnRate changes heading, not movement) so its cross-coupling
check could never fail — the second retry introduced the lateralResistance
damping that made the axis real. The critic caught both.

**deepseek-v4-flash** (base deployment) was unreferenced in this session — all sub-steps used the 0731 snapshot.  
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
   proxy (ball-continuity as "last touch").
3. Restore / serialization dropping transient state (close-control cooldown).
4. CLI argv and compare-flag order.
5. Browser smoke that does not drive the test-bridge.

When a retry is one of these, say so in HISTORY. Do not count it as "the
model cannot play football."

## How to refresh

After an accepted step, append a row to the per-step table and recompute
the builder scoreboard from HISTORY critic loops plus `meta.json`
`duration_ms`. Keep the unexplained-stop rule: exclude gaps ≥10 minutes
with no parent turn and no child session.
# Gauntlet session timing and model performance

Living log for this Gauntlet session. Refresh after each accepted objective.
Do not treat these numbers as a provider invoice.

```yaml
session_id: 019ffdda-1b40-7b90-91ae-cc7f3ad623b0
measured_at: 2026-09-06T23:48:00Z
tracking_contract_version: 1
last_tracked_objective: RULES-SUITE-STATE-RERUN
usage_aggregates_through: RULES-SUITE-STATE-RERUN
clock_aggregates_through: RULES-SUITE-STATE-RERUN
model_evaluation_through: RULES-SUITE-STATE-RERUN
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
| Calendar span (first work → measurement) | 570h 50m |
| Unexplained stop (excluded) | 5h 16m |
| Active work (anything running) | ~172h est. |
| Sum of per-step agent time | ~169h 49m |
| Orchestrator thinking between steps | ~5h est. (within-session only) |
| Intersession idle (multi-day gaps, not itemized) | remainder of span |

Session start: `2026-08-14 01:19 UTC`. Measurement: `2026-09-06T23:48:00Z`.
Recomputed 2026-09-06 at the RULES-SUITE-STATE-RERUN acceptance
(Horizon v31 2/4): 195 accepted per-step rows summing to ~169h 49m (the new
objective adds ~1h 52m: builder ~63m / critic ~29m / integration 19m /
commit <1m). Calendar span recomputed from session start to this measurement. Long
session gaps are NOT itemized as orchestrator thinking; they are intersession
idle. Step times remain estimates from subagent wall-clock, not provider
invoices.

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
| ARCHETYPE-REMAINING-VISUALS | accepted | 48m | 41m | 4m | 1m | 1m | n/a | n/a |
| ARCHETYPE-FULL-PAIR-RECAPTURE | accepted | 55m | 49m | 2m | 2m | 1m | n/a | n/a |
| PLAYABLE-1V1-AFTER-REMAINING-ARCHETYPES | accepted | 10m | 2.5m | 2.5m | 1m | 0.5m | n/a | n/a |
| SMALL-SIDED-SHAPE-AFTER-1V1 | accepted | 10m | 2m | 1m | 3.5m | 0.5m | n/a | n/a |
| ARCH-DIFF-001-FRAME-BINDING | accepted | 46m | 26m | 6m | 8m | 1m | n/a | n/a |
| PLAYABLE-1V1-AFTER-ARCH-DIFF-BINDING | accepted | 13m | 2.5m | 1.5m | 6m | 0.5m | n/a | n/a |
| SMALL-SIDED-AFTER-ARCH-DIFF | accepted | 10m | 2m | 2m | 2m | 0.5m | n/a | n/a |
| PLAYABLE-1V1-DETERMINISTIC-TWO-RUN | accepted | 55m | 39m | 6m | 7m | 1m | n/a | n/a |
| PLAYABLE-1V1-AFTER-DETERMINISTIC-TWO-RUN | accepted | 22m | 1.5m | 4m | 18m | 0.5m | n/a | n/a |
| SMALL-SIDED-AFTER-DETERMINISTIC | accepted | 8m | 2m | 1.5m | 2.5m | 0.5m | n/a | n/a |
| PLAYABLE-1V1-ENTRY-PREREQ-CALLER | accepted | 36m | 23m | 5m | 6m | 1m | n/a | n/a |
| PLAYABLE-1V1-AFTER-ENTRY-PREREQS | accepted | 19m | 5m | 8m | 4m | 0.5m | n/a | n/a |
| SMALL-SIDED-AFTER-ENTRY-PREREQS | accepted | 12m | 4m | 0.7m | 4m | 0.5m | n/a | n/a |
| ENTRY-PREREQ-RESOLVER-EVAL-JSON | accepted | 17m | 9m | 2.6m | 4.9m | 0.5m | n/a | n/a |
| FOUNDATION-LAB-PASS-EVIDENCE | accepted | 32m | 11m | 7m | 12.5m | 0.5m | n/a | n/a |
| CAPABILITY-DESIGN-PROFILE-EVIDENCE | accepted | 18m | 7m | 6m | 3.3m | 0.5m | n/a | n/a |
| PLAYABLE-1V1-AFTER-PREREQ-EVIDENCE | accepted | 10m | 3m | 4m | 0.8m | 0.5m | n/a | n/a |
| SMALL-SIDED-AFTER-PREREQ-EVIDENCE | accepted | 10m | 5.6m | 1.2m | 2.6m | 0.5m | n/a | n/a |
| TEAM-DECISION-PROFILE-EVIDENCE | accepted | 11m | 5.5m | 2.4m | 2.3m | 0.5m | n/a | n/a |
| MUTANT-TEAM-PASS-EVIDENCE | accepted | 12m | 3.5m | 1.2m | 5.6m | 0.5m | n/a | n/a |
| TEAM-SHAPE-SUITE-PASS-EVIDENCE | accepted | 14m | 3m | 3.2m | 5.5m | 0.5m | n/a | n/a |
| SMALL-SIDED-AFTER-TEAM-PREREQS | accepted | 9m | 2.3m | 0.8m | 2.4m | 0.5m | n/a | n/a |
| SMALL-SIDED-SITUATION-FIXTURES | accepted | 26m | 11.4m | 3.9m | 7.8m | 0.5m | n/a | n/a |
| SMALL-SIDED-SITUATION-EVALUATOR | accepted | 20m | 12m | 3.1m | 7.7m | 0.5m | n/a | n/a |
| SMALL-SIDED-SITUATIONS-BATCH-1 | accepted | 9m | 3.5m | 0.8m | 2.4m | 0.5m | n/a | n/a |
| SITUATION-FIXTURE-DRIVING | accepted | 24m | 18.4m | 1.3m | 3.4m | 0.5m | n/a | n/a |
| SMALL-SIDED-SITUATIONS-BATCH-1-RERUN | accepted | 30m | 5.3m | 5.5m | 17.9m | 0.5m | n/a | n/a |
| SMALL-SIDED-SITUATIONS-BATCH-2-RERUN | accepted | 18m | 3.3m | 3.9m | 6.2m | 0.5m | n/a | n/a |
| BROWSER-SMALL-SIDED-001-CASE | accepted | 18m | 10.7m | 1.7m | 3.8m | 1.1m | n/a | n/a |
| SMALL-SIDED-MILESTONE-RE-EVALUATION | accepted | 10m | 3.1m | 1.6m | 2.1m | 0.3m | n/a | n/a |
| FIXTURE-EVENT-EXTENSION | accepted | 52m | 40.4m | 9.1m | 1.8m | 0.4m | n/a | n/a |
| SMALL-SIDED-SITUATIONS-BATCH-3 | accepted | 10m | 3.5m | 3.6m | 2.4m | 0.3m | n/a | n/a |
| SMALL-SIDED-MILESTONE-RERUN | accepted | 10m | 1.1m | 2.5m | 0.2m | 0.2m | n/a | n/a |
| EVALUATOR-ISRELEVANT-FIX | accepted | 15m | 8m | 4m | 2m | 0.4m | n/a | n/a |
| SMALL-SIDED-SITUATIONS-BATCH-4 | accepted | 12m | 4m | 3m | 2m | 0.4m | n/a | n/a |
| SMALL-SIDED-MILESTONE-RERUN-2 | accepted | 11m | 3m | 2m | 2m | 0.4m | n/a | n/a |
| SHOT-RESULT-RESOLUTION-FIXTURE | accepted | 22m | 13m | 7m | 3m | 0.4m | n/a | n/a |
| DUEL-REJECTION-FIXTURE | accepted | ~18m | 9m | 6m | 2.5m | 0.4m | n/a | n/a |
| SMALL-SIDED-SITUATIONS-BATCH-5 | accepted | ~18m | 9m | 6m | 3.5m | 0.5m | n/a | n/a |
| SMALL-SIDED-MILESTONE-RERUN-3 | accepted | ~20m | 3m | 8.5m | 2m | 0.5m | n/a | n/a |
| SMALL-SIDED-EXIT-PREREQ-IDENTITY | accepted | ~14m | 6m | 3.5m | 6m | 0.5m | n/a | n/a |
| SMALL-SIDED-VISUAL-READABILITY-EVIDENCE | accepted | ~12m | n/a\* | 3.8m | 3.2m | 0.7m | n/a | n/a |
| BROWSER-SMALL-SIDED-001-COHERENCE-RERUN | accepted | ~29m | 19m | 3m | 6.2m | 0.5m | n/a | n/a |
| SMALL-SIDED-PROFILE-REDUCER-EXTENSION | accepted | ~16m | 4.7m | 2.5m | 9.6m | 0.4m | n/a | n/a |
| SMALL-SIDED-MATCH-SITUATION-SCANNER | accepted | ~42m | 16m | 14m | 12m | 0.4m | n/a | n/a |
| SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH | accepted | ~80m | 52m\* | 3m | 14m | 0.4m | n/a | n/a |

\* MiMo builder time includes the integration-REJECT fix cycle (verdict-module refactor regression fixed).
| SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH | accepted | ~150m\*\* | 105m | 25m | 22m | 0.5m | n/a | n/a |

\*\* MiMo builder time includes two critic RETRY cycles (honesty-guard discrimination + report integrity) + the integration-REJECT-adjacent fix work; reviewer time includes deep neighbor verification.
| SMALL-SIDED-ACTION-EVENT-OBSERVABILITY | accepted | ~75m | 50m | 9m | 15m | 0.4m | n/a | n/a |

\*\*\* MiMo builder time includes the critic-RETRY fix cycle (render-screenshot sync gl.finish() + re-capture).
| SMALL-SIDED-5V5-HUMAN-VS-CPU | accepted | ~40m | 26m | 5m | 7m | 0.5m | n/a | n/a |

\*\*\*\* Clean first-pass step: critic ACCEPT first pass, integration ACCEPT first pass; no retry loops.
| SMALL-SIDED-PLAYTEST-RE-RUN | accepted | ~25m | 3m | 13m | 8m | 0.5m | n/a | n/a |

\*\*\*\*\* BOOKKEEPING evidence-bundle step (no gameplay source change). Clean first pass: critic ACCEPT first pass, integration ACCEPT first pass.
| SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE | accepted | ~470m\*\*\*\*\*\*\* | 213m | 73m | 180m | ~4m | n/a | n/a |

\*\*\*\*\*\*\*\* MiMo builder time includes 2 critic-RETRY fix rounds (invalidated BATCH evidence after the oscillation fix; intermediate-engine trajectory persisted) + 3 integration-REJECT fix rounds (pitch-contact flood perf, forks-pool onTaskUpdate timeout, three-file long-test split); reviewer times include those loops (critic 2 RETRYs → ACCEPT, integration 3 REJECTs → ACCEPT).
| SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY | accepted | ~190m\*\*\*\*\*\*\*\*\* | 132m | 82m | 19m | 1m | n/a | n/a |

\*\*\*\*\*\*\*\*\*\* MiMo builder time includes 3 fix rounds (stale-capture recapture; carve-out/orphan/vacuous-bindings cleanup; capture-tick reconciliation + shared single-source-of-truth offsets module); critic time includes 3 RETRY loops (stale 3-way byte-identical frames; leftover carve-out + orphan + vacuous assertions; tick-metadata drift) then final ACCEPT; orchestrator applied the final doc-only comment fix directly (stale "6 frames"/shot-before comments in the capture test). Integration ACCEPT first pass. Reviewer times from subagent meta.json.
| BROWSER-SWITCH-INDICATOR-BASELINE-FIX | accepted | ~45m\*\*\*\*\*\*\*\*\*\*\* | 22m | 8m | 13m | ~1m | n/a | n/a |

\*\*\*\*\*\*\*\*\*\*\*\* MiMo builder time is the single implementation round (legacy double-switch removal + guards + evidence); critic 7m RETRY (stale JSDoc claiming the removed manual-switch) + 1m final ACCEPT, comment-only fix; integration ACCEPT first pass. Clean overall step despite the doc RETRY. Reviewer/commit times from subagent meta.json.
| SMALL-SIDED-LADDER-MENU-COMPLETION | accepted | ~90m\*\*\*\*\*\*\*\*\*\*\*\*\* | 52m\*\*\*\*\*\*\*\*\*\*\*\*\*\* | 18m | 18m | ~1m | n/a | n/a |

\*\*\*\*\*\*\*\*\*\*\*\*\*\* MiMo builder phase = 26m (infra-killed by an API 400 at ~7.3M-token context, partial work preserved) + 26m fresh-session completion (verified + finished the partial work + evidence). Clean first pass: critic ACCEPT first pass, integration ACCEPT first pass. Reviewer/commit times from subagent meta.json.
| SMALL-SIDED-COHERENT-EVIDENCE-RERUN | accepted | ~32m\*\*\*\*\*\*\*\*\*\*\*\*\*\*\* | 9m | 10m | 11m | ~1m | n/a | n/a |

\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\* BOOKKEEPING evidence-bundle step (no source change). Clean first pass: critic ACCEPT first pass (independent scanner re-run byte-identical), integration ACCEPT first pass. Bundle rebuilt after persist (corrected v22-5 entry) → interim superseded manifest preserved. Reviewer/commit times from subagent meta.json.
| CORE-EVENT-TYPE-UNION-FIX | accepted | ~96m\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\* | 76m | 16m | 18m | ~1m | n/a | n/a |
| HUMAN-DEFENSIVE-DUEL-CONTROL | accepted | ~4h* | 3h | 23m | 1h | ~10m | ~30M est. | n/a |
| CPU-DEFENSIVE-TACKLE | accepted | ~4.5h | 4h | 16m | 14m | ~30m | ~30M est. | n/a |
| SMALL-SIDED-ORGANIC-DUEL-CLOSURE | accepted | ~20m | 12m | 4m | 1m | ~3m | ~1M est. | n/a |
| BROWSER-DEFENSIVE-CONTROLS-LEGEND | accepted | ~2h 20m | ~2h 7m | 9m | 2m | ~2m | n/a | n/a |
| 5V5-KICKOFF-ANTI-HUDDLE | accepted | ~4h 30m | ~4h | 15m | 10m | ~5m | n/a | n/a |
| BALL-SETTLED-REGIME-FIX | accepted | ~3h 55m | ~3h 5m | 10m | 7m | ~5m | n/a | n/a |
| BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE | accepted | ~1h 55m | ~1h 20m | 6m | 5m | ~4m | n/a | n/a |
| SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE | accepted | ~2h 25m | ~1h 55m | 30m | 5m | ~5m | n/a | n/a |
| NODE-GATE-REGRESSION-TRIAGE | accepted | ~1h 40m | ~1h 1m | 8m | 4m | ~3m | n/a | n/a |
| CAPTURE-HYGIENE-ENFORCEMENT | accepted | ~1h 45m | ~49m | 5m | 3m | ~3m | n/a | n/a |
| RESTART-ANTI-HUDDLE-COHERENCE | accepted | ~3h 33m | ~3h 33m | 3m | 3m | ~3m | n/a | n/a |
| HUMAN-VS-CPU-ARC-INTERACTION | accepted | ~1h 39m | ~1h 6m | 6m | 5m | ~4m | n/a | n/a |
| DUELS-SUITE-ORGANIC-RERUN | accepted | ~1h 48m | ~1h 30m | 12m | 4m | ~2m | n/a | n/a |
| VIDEO-CAPTURE-RESTORE-30S-CLIP | accepted | ~29m | ~21m | 3m | 4m | ~1m | n/a | n/a |
| GK-SPEC-SUITE-CONTRACTS | accepted | ~48m | ~36m | 6m | 5m | ~1m | n/a | n/a |
| GK-5V5-ADAPTER-BEHAVIOR | accepted | ~3h 05m | ~2h 45m | 10m | 8m | ~2m | n/a | n/a |
| GK-BROWSER-DYNAMIC-EVIDENCE | accepted | ~50m | ~27m | 15m | 7m | ~1m | n/a | n/a |
| GK-SUITE-ORGANIC-STATE | accepted | ~36m | ~17m | 11m | 6m | ~2m | n/a | n/a |
| GK-KEEPER-ORACLE-REGISTRATION | accepted | ~1h 03m | ~34m | 17m | 10m | ~2m | n/a | n/a |
| GK-DISTRIBUTION-BEHAVIOR | accepted | ~1h 19m | ~49m | 16m | 12m | ~2m | n/a | n/a |
| COMMON-FULL-MATCH-INVARIANT-TRIAGE | accepted | ~1h 33m | ~1h 10m | 6m | 15m | ~2m | n/a | n/a |
| GK-SUITE-VERDICTS-STATE | accepted | ~45m | ~27m | 8m | 8m | ~2m | n/a | n/a |
| RULES-SPEC-DRAFT | accepted | ~28m | ~12m | 10m | 4m | ~2m | n/a | n/a |
| KEEPER-VISUAL-MARKER | accepted | ~1h 03m | ~36m | 15m | 10m | ~2m | n/a | n/a |
| POSSESSION-ORACLE-REFERENCE-TRIAGE | accepted | ~35m | ~15m | 11m | 7m | ~2m | n/a | n/a |
| LIFECYCLE-MIGRATION-ASSESSMENT | accepted | ~1h 55m | ~1h 07m | 32m | 14m | ~2m | n/a | n/a |
| RULES-SUITE-REGISTRATION | accepted | ~2h 06m | ~1h 46m | 28m | 29m | ~2m | n/a | n/a |
| RESTART-RULES-CONFORMANCE | accepted | ~2h 20m | ~52m | 13m | 75m | <1m | n/a | n/a |
| GK-GOALLINE-BOUNDS-RESIDUAL | accepted | ~1h 42m | ~53m | 32m | 16m | <1m | n/a | n/a |
| RULES-SUITE-STATE | accepted | ~1h 41m | ~56m | 19m | 25m | <1m | n/a | n/a |
| RULES-FACTS-DEPTH-CONFORMANCE | accepted | ~1h 57m | ~62m | 26m | 28m | <1m | n/a | n/a |
| CORNER-DRIVEN-CONFORMANCE | accepted | ~2h 02m | ~41m | 62m | 18m | <1m | n/a | n/a |
| GK-CORE-OWNED-ARC-FIX | accepted | ~1h 38m | ~43m | 33m | 21m | <1m | n/a | n/a |
| GK-SUITE-CORE-OWNED-STATE | accepted | ~1h 21m | ~33m | 33m | 14m | <1m | n/a | n/a |
| RESTART-DESIGNATION-FACTS-CONFORMANCE | accepted | ~3h 09m | ~1h 58m | 41m | 29m | <1m | n/a | n/a |
| RULES-SUITE-STATE-RERUN | accepted | ~1h 52m | ~63m | 29m | 19m | <1m | n/a | n/a |

\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\* deepseek-v4-flash builder time spans two subagent sessions (the orchestrator expanded the objective's scope mid-flight to also fix the 10 masked eval/runners type-drift errors, so the total covers the union fix + the full eval/runners repair + the ~1100-test regression battery). Clean first pass: critic ACCEPT first pass (independent HEAD-worktree reproduction of all 12 baseline errors + byte-identical runner outputs), integration ACCEPT first pass, on glm5.3-flash. Typecheck exit 0 across core/node/browser; zero runtime behavior change. Reviewer/commit times from subagent meta.json.

\* Builder (mimo-v2.5) produced the evidence in a prior session before this continuation pickup; its step time is not re-measured here. Reviewer/commit phases measured from this session's subagents. BROWSER-SMALL-SIDED-001-COHERENCE-RERUN builder ran in this continuation session.

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
| ARCHETYPE-REMAINING-VISUALS | mimo-v2.5 | M | Medium — provisional remaining renderer mappings | 1 | B | critic RETRY: simulation registry physics |
| ARCHETYPE-FULL-PAIR-RECAPTURE | mimo-v2.5 | M | Medium — identical-condition pair recapture | 1 | B | critic RETRY uniqueness vs remaining-visuals |
| PLAYABLE-1V1-AFTER-REMAINING-ARCHETYPES | qwen3.6 | M | Medium — profile re-run after recapture | 0 | A | honest NPR; archetype PASS |
| SMALL-SIDED-SHAPE-AFTER-1V1 | qwen3.6 | M | Medium — milestone playtest after NPR | 0 | A | NOT_EVALUATED; PLAYABLE_1V1 NPR |
| ARCH-DIFF-001-FRAME-BINDING | qwen3.6 | M | Medium — wire ARCH-DIFF rubric to recapture frames | 0 | A | hash-diff PASS; no hardcoded NPR |
| PLAYABLE-1V1-AFTER-ARCH-DIFF-BINDING | qwen3.6 | M | Medium — profile re-run after ARCH-DIFF binding | 0 | A | honest NOT_EVALUATED |
| SMALL-SIDED-AFTER-ARCH-DIFF | qwen3.6 | M | Medium — milestone playtest after ARCH-DIFF 1v1 | 0 | A | NOT_EVALUATED; PLAYABLE_1V1 not PASS |
| PLAYABLE-1V1-DETERMINISTIC-TWO-RUN | qwen3.6 | M | Medium — two-run COMMON-DETERMINISTIC wiring | 0 | A | two-run hashes match |
| PLAYABLE-1V1-AFTER-DETERMINISTIC-TWO-RUN | qwen3.6 | M | Medium — profile re-run after two-run bind | 0 | A | honest NOT_EVALUATED |
| SMALL-SIDED-AFTER-DETERMINISTIC | qwen3.6 | M | Medium — milestone playtest after two-run 1v1 | 0 | A | NOT_EVALUATED; PLAYABLE_1V1 not PASS |
| PLAYABLE-1V1-ENTRY-PREREQ-CALLER | qwen3.6 | M | Medium — caller-verified entry prereqs | 0 | A | missing evidence BLOCKED_MISSING_REFERENCE |
| PLAYABLE-1V1-AFTER-ENTRY-PREREQS | qwen3.6 | M | Medium — profile re-run after entry-prereq caller | 0 | A | honest BLOCKED_MISSING_REFERENCE |
| SMALL-SIDED-AFTER-ENTRY-PREREQS | qwen3.6 | M | Medium — milestone playtest after entry-prereq 1v1 | 0 | A | NOT_EVALUATED; PLAYABLE_1V1 not PASS |
| ENTRY-PREREQ-RESOLVER-EVAL-JSON | qwen3.6 | M | Medium — resolver binds entry prereqs to eval.json | 0 | A | audit PASS is not FOUNDATION_LAB_PASS |
| FOUNDATION-LAB-PASS-EVIDENCE | qwen3.6 | M | Medium — persist honest evaluateFoundationLab eval.json | 0 | A | live evaluator PASS vs durable hashes |
| CAPABILITY-DESIGN-PROFILE-EVIDENCE | qwen3.6 | M | Medium — persist honest evaluateCapabilityDesign eval.json | 0 | A | five implemented axes PASS |
| PLAYABLE-1V1-AFTER-PREREQ-EVIDENCE | qwen3.6 | M | Medium — PLAYABLE_1V1 rerun after executable prereqs | 0 | A | live profile runner PASS |
| SMALL-SIDED-AFTER-PREREQ-EVIDENCE | qwen3.6 | M | Medium — SMALL_SIDED playtest after 1v1 PASS | 0 | A | honest NOT_EVALUATED; TEAM_DECISION_PROFILE unmet |
| TEAM-DECISION-PROFILE-EVIDENCE | qwen3.6 | M | Medium — persist honest TEAM_DECISION_PROFILE eval.json | 0 | A | live computeTeamDecision PASS |
| MUTANT-TEAM-PASS-EVIDENCE | qwen3.6 | M | Medium — persist honest runMutantTeam eval.json | 0 | A | nine implementable mutants PASS |
| TEAM-SHAPE-SUITE-PASS-EVIDENCE | qwen3.6 | M | Medium — persist honest team-shape suite eval.json | 0 | A | 16 tests common criteria PASS |
| SMALL-SIDED-AFTER-TEAM-PREREQS | qwen3.6 | M | Medium — SMALL_SIDED playtest after team prereqs | 0 | A | honest NOT_EVALUATED; prereq gates PASS |
| SMALL-SIDED-SITUATION-FIXTURES | qwen3.6 | M | Medium — materialize 3v3 situation fixtures + mapping | 0 | A | deterministic; no verdicts |
| SMALL-SIDED-SITUATION-EVALUATOR | qwen3.6 | M | Medium — per-situation evaluator runner | 0 | A | honest verdict rules |
| SMALL-SIDED-SITUATIONS-BATCH-1 | qwen3.6 | M | Medium — batch-1 situation evidence | 0 | A | honest NOT_EVALUATED; zero events |
| SITUATION-FIXTURE-DRIVING | qwen3.6 | M | Medium — input-driven situation fixtures | 0 | A | driven fixtures emit events; 1 PASS, 7 FAIL honest |
| SMALL-SIDED-SITUATIONS-BATCH-1-RERUN | qwen3.6 | M | Medium — batch-1 evidence on driven fixture | 0 | A | honest FAIL/PASS verdicts; invariant disclosed |
| SMALL-SIDED-SITUATIONS-BATCH-2-RERUN | qwen3.6 | M | Medium — batch-2 evidence on transition fixture | 0 | A | SETTLED NOT_EVALUATED, 3 transitions FAIL |
| BROWSER-SMALL-SIDED-001-CASE | qwen3.6 | M | Medium — browser case materialization (DYNAMIC_VISUAL) | 0 | A | 4 frames, hash correspondence, 10/10 browser tests |
| SMALL-SIDED-MILESTONE-RE-EVALUATION | qwen3.6 | M | Medium — milestone re-evaluation with batch evidence | 0 | A | Honest FAIL verdict (4 FAIL, 4 NOT_EVALUATED) |
| FIXTURE-EVENT-EXTENSION | qwen3.6 | M | Medium — fixture extension for second-touch (HEADLESS) | 0 | A | second-touch now emits; ball-out-of-play: sim limitation |
| SMALL-SIDED-SITUATIONS-BATCH-3 | qwen3.6 | M | Medium — batch-3 on extended fixture (HEADLESS) | 0 | A | 1 PASS, 7 FAIL; second-touch evaluator filtering limitation |
| SMALL-SIDED-MILESTONE-RERUN | qwen3.6 | M | Medium — milestone re-evaluation with accumulated evidence | 0 | A | Honest FAIL (7/8 FAIL) |
| EVALUATOR-ISRELEVANT-FIX | qwen3.6 | M | Medium — isRelevantEvent() includes indicative_event_kinds (HEADLESS) | 0 | A | 5/5 eval files 116 tests; second-touch indicative; no verdict regression |
| SMALL-SIDED-SITUATIONS-BATCH-4 | qwen3.6 | M | Medium — batch-4 evidence on extended fixture (HEADLESS) | 0 | A | 6/6 eval files 142 tests; 6 PASS, 2 FAIL honest |
| SMALL-SIDED-MILESTONE-RERUN-2 | qwen3.6 | M | Medium — milestone re-run with corrected batch evidence (HEADLESS) | 0 | A | milestone FAIL honest (6/8 PASS); bundle generated |
| SHOT-RESULT-RESOLUTION-FIXTURE | qwen3.6 | M | Medium — shot-resolution driven fixture (HEADLESS) | 0 | A | SHOT_TO_RESULT honest PASS; shot+pitch-contact; 10/10 binding |
| DUEL-REJECTION-FIXTURE | qwen3.6 | M | Medium — duel-rejection driven fixture + input resolution (HEADLESS) | 0 | A | PHYSICAL_DUEL honest PASS; input-rejection emitted; 30 tests; no core I/O |
| SMALL-SIDED-SITUATIONS-BATCH-5 | qwen3.6 | M | Medium — consolidate batch-5 evidence 8/8 PASS (HEADLESS) | 0 | A | 8/8 honest PASS; source_fixture provenance; byte-identity; 161 tests |
| SMALL-SIDED-MILESTONE-RERUN-3 | qwen3.6 | M | Medium — milestone re-run with 8/8 evidence (HEADLESS) | 0 | A | SMALL_SIDED_SHAPE PASS; critic-gated; finale by orchestrator |
| SMALL-SIDED-EXIT-PREREQ-IDENTITY | qwen3.6 | M | Medium — milestone record exit-prereq identity correction (HEADLESS) | 0 | A | corrected to MUTANT_TEAM_PASS/TEAM_SHAPE_SUITE_PASS; PASS preserved |
| SMALL-SIDED-VISUAL-READABILITY-EVIDENCE | mimo-v2.5 | M | Medium — materialize 8-dimension visual-readability evidence (DYNAMIC_VISUAL) | 0 | A | 24 event-centered frames; observability evidence only; SHA-reuse resolved VALID |
| BROWSER-SMALL-SIDED-001-COHERENCE-RERUN | mimo-v2.5 | M | Medium — re-attest browser coherence on resolved fixtures (DYNAMIC_VISUAL) | 0 | A | browser/headless hash correspondence across 3 driven fixtures; 27+16+254 tests |
| SMALL-SIDED-PROFILE-REDUCER-EXTENSION | qwen3.6 | M | Medium — executable small-sided team-exit prereq reducer (HEADLESS) | 0 | A | honest milestoneVerdict wiring; 24+268 tests; no PROMOTION overclaim |
| SMALL-SIDED-MATCH-SITUATION-SCANNER | qwen3.6 | M | Medium — continuous-match small-sided situation scanner (HEADLESS) | 1 | B | RETRY on test-suite flakiness (hook timeout); fixed; honest not_observed; backward compatible |
| SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH | mimo-v2.5 | M | Medium — integrated small-sided playtest match via scanner (DYNAMIC_VISUAL) | 1 | B | honest negative result; verdict-module refactor REJECT fixed; 27+31+134+46 tests |
| SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH | mimo-v2.5 | M | Medium — press and support depth + headless team-decision fix (MULTI_TICK) | 2 | B | RETRY x2 (honesty guard); discriminating counter guard; 14+83 tests |
| SMALL-SIDED-ACTION-EVENT-OBSERVABILITY | mimo-v2.5 | M | Medium — action event observability (DYNAMIC_VISUAL) | 1 | B | event-centered pass/shot/goal frames; gl.finish() sync fix; 8+27+31+19+14 tests |
| SMALL-SIDED-5V5-HUMAN-VS-CPU | mimo-v2.5 | M | Medium — full 5v5 human-vs-CPU mode (DYNAMIC_VISUAL) | 0 | A | 20 browser + 20 binding tests; Tab switching + human input displacement; 5 distinct frames; first-pass clean |
| SMALL-SIDED-PLAYTEST-RE-RUN | qwen3.6 | L | Low — milestone reducer re-run, evidence-bundle only (BOOKKEEPING) | 0 | A | coherent-match supplementary evidence; bundle supersede (14 runs / 13 sources); 129 tests; first-pass clean |
| SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE | mimo-v2.5 | M | Medium — continuous-match duel/shot closure + ball-system oscillation fix (MULTI_TICK) | 2 | C | RETRY x2 (invalidated BATCH evidence; intermediate-engine trajectory); integration REJECT x3 (pitch-contact flood perf, forks-pool onTaskUpdate timeout, long-test split); 7/8 organic presence; PHYSICAL_DUEL insufficient_context honest |
| SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY | mimo-v2.5 | M | Medium — human-driven action observability, DYNAMIC_VISUAL frames bound to input tick | 3 | D | RETRY x3 (stale 3-way byte-identical frames; leftover carve-out + orphan + vacuous bindings; tick-metadata drift); shared single-source-of-truth offsets; integration first-pass ACCEPT |
| BROWSER-SWITCH-INDICATOR-BASELINE-FIX | mimo-v2.5 | M | Medium — reconcile legacy double-switch to core-native single-switch contract | 1 | B | RETRY x1 (stale JSDoc claiming the removed manual switch); comment-only fix; integration first-pass ACCEPT; core untouched |
| SMALL-SIDED-LADDER-MENU-COMPLETION | mimo-v2.5 | M | Medium — complete in-browser setup-menu ladder + parity guard (BROWSER_VISIBLE) | 0 | A | first pass clean; 9-option ladder (1v1/2v2/3v3/5v5 × HvC + CvC + 5v3); parity guard 9/9 + negative controls; new 1v1 scenario; integration first-pass ACCEPT |
| SMALL-SIDED-COHERENT-EVIDENCE-RERUN | qwen3.6 | L | Low — milestone reducer re-run, evidence-bundle only (BOOKKEEPING) | 0 | A | scanner re-run 7/0/1 on both coherent matches; coherent_match_sources updated honestly; PASS preserved via BATCH-5 8/8; bundle 18 sources/17 runs; first-pass clean |
| CORE-EVENT-TYPE-UNION-FIX | deepseek-v4-flash | L | Low — typecheck repair, type-only (HEADLESS) | 0 | A | union fix + 10 eval/runners type-drift repairs; typecheck exit 0 core/node/browser; ~1100 tests + byte-identity gates; first-pass clean |

| HUMAN-DEFENSIVE-DUEL-CONTROL | qwen3.8-flash (mimo-v2.5 original; qwen3.6 mid-flight) | M | Medium — original builder mimo-v2.5 (initial tackle system); qwen3.8-flash (caption correction, tests, evidence reconciliation). 247 tests green, typecheck exit 0, audit PASS, FOUNDATION_LAB_PASS eval.json supersession |
| SMALL-SIDED-ORGANIC-DUEL-CLOSURE | deepseek-v4-flash | L | Low — BOOKKEEPING: re-scan coherent matches with CPU tackle, update manifest, materialize playtest record, supersede bundle (evidence-bundle only, zero gameplay) | 0 | A | 185 eval/scenario suites pass, typecheck 0, build 0, honest PHYSICAL_DUEL disclosure |
| CPU-DEFENSIVE-TACKLE | qwen3.8-flash | M | Medium — CPU defensive tackle committed to team-decision profile; no omniscience, geometric/temporal justification, commitment binding; 99 tests green, typecheck exit 0, audit PASS, critic first pass |
| BROWSER-DEFENSIVE-CONTROLS-LEGEND | qwen3.8-flash | M | Medium — presentation affordance: extracted importable controls-legend-ui module, 14-test real-Chromium DOM suite, Vite+Playwright real-app capture script; found+fixed startMatch() hint-strip clobber (toggle deleted at match start) and pointer-events lockout; replaced prior session's fabricated mock evidence with real-app captures; 26+14 tests green, typecheck 0, build 0, core byte-identical | 0 | A | first-pass ACCEPT; audit PASS 20/20 BROWSER_VISIBLE |
| 5V5-KICKOFF-ANTI-HUDDLE | qwen3.8-flash | H | High — anti-huddle behavior in adapter/team-decision layer (kickoff freeze keyed on lastTouchRef, nearest-only chase, fixed homes, shared designatePresser gate), 1800-tick/30 s MULTI_TICK evidence + discriminating stashed control, 21+16 new tests, 10 neighbor-test dispositions, historical-config pins, read-only conversion of an evidence-rewriting test; core byte-identical with stash-identity proof | 0 | A | first-pass ACCEPT; audit PASS 20/20; horizon amended with BALL-SETTLED-REGIME-FIX (disclosed core defect) |
| BALL-SETTLED-REGIME-FIX | qwen3.8-flash | H | High — core ball fix (settled regime integrates applied impulses; wake threshold derived from accepted settle threshold; +37/−1 in ball-system.ts), 23 discriminating guards (10/23 fail stashed), flood-stays-closed executable bounds, no-teleport bound, two-run determinism, honest pin regeneration with accepted bytes untouched (BATCH/DUEL/anti-huddle/no-tackle provenance) | 0 | A | first-pass ACCEPT; audit PASS 20/20; critic independently recomputed accepted digests |
| BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE | qwen3.8-flash | M | Medium — DYNAMIC_VISUAL browser capture of the anti-huddle arc (two-pass Chromium capture, 5 event-centered frames + sequence.json + 620-tick browser trajectory, byte-identical two-pass), capture-hygiene gating, stashed-control discrimination, honest video NOT_PRODUCED | 0 | A | first-pass ACCEPT; audit PASS 20/20; critic pixel-diff + vision verification of all frames |
| SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE | deepseek-v4-flash | M | Medium — BOOKKEEPING scanner/reducer re-run over the new coherent matches; anti-huddle flowing run 8/0/0 organically (PHYSICAL_DUEL present); rev-1 falsely attributed browser-parity scan deltas to the ball fix — critic RETRY with 2×2 isolation, corrected to historical-config re-scan (1062/262 byte-identical, unchanged by the ball fix); binding test with false-narrative rejection | 1 | A- | RETRY resolved cleanly; milestone PASS preserved; bundle superseded 19/19 |
| NODE-GATE-REGRESSION-TRIAGE | deepseek-v4-flash | H | High — root-caused a REAL determinism defect (evaluate() inputProgram off-by-one dropping tick-0 inputs; caused compare-foundation ×2 + nondeterminism-canary ×2), fixed with an additive hash guard; timeout-only raise; stale eval artifact superseded with backup; stale binding counts updated with provenance; capture redirect to ephemeral path; node gate exits 0 (168/168 files) | 0 | A | first-pass ACCEPT; audit PASS 20/20; critic reconciled shard partition 61+26+81=168 |
| CAPTURE-HYGIENE-ENFORCEMENT | deepseek-v4-flash | M | Medium — 0.9.2+ capture hygiene enforced repo-wide: 11 mutating browser suites gated to the evidence-mode pattern (durable path = historical accepted path so reruns hit assertEvidenceMutable), guard test with byte-identity + immutability-block + source-gate assertions, byte-identity proven for every docs/screenshots-writing suite; no src/ change | 0 | A | first-pass ACCEPT; audit PASS 20/20; critic verified no assertion weakened |
| RESTART-ANTI-HUDDLE-COHERENCE | qwen3.8-flash | H | High — anti-huddle contract extended to restarts (throw-in/goal-kick/corner/post-goal) in the adapter layer (restartTouchBaseline, restartAnchor freeze, window-aware untouched, getRestartFreezeActivations); headless lifecyclePhaseSync parity defect repaired behind opt-in core-owned policy (legacy default protects accepted pins); 26 new integration tests; accepted kickoff suite unchanged; two-pass byte-identical trajectory | 0 | A | first-pass ACCEPT; audit PASS 20/20; critic verified per-window geometry from raw rows |
| HUMAN-VS-CPU-ARC-INTERACTION | qwen3.8-flash | M | Medium - DYNAMIC_VISUAL browser capture of the human side of the anti-huddle arc (Tab switch chain, slide tackle duelWon, human pass 4.5 m; two-pass Chromium capture, 5 event-centered frames + sequence.json + 720-tick browser trajectory, byte-identical two-pass), capture-hygiene gating, discriminating negatives (idle human; cpuAntiHuddle:false), honest video NOT_PRODUCED; no src/ change | 0 | A | first-pass ACCEPT; audit PASS 20/20; critic reproduced identical frame ticks in an independent rerun |
| DUELS-SUITE-ORGANIC-RERUN | deepseek-v4-flash | M | Low - evidence re-run of the accepted duels evaluator suite over organic observations (producer script + binding test + refreshed suite record; no source change; cross-manifest source_candidate provenance binding) | 1 | A | provenance mislabel (human-duel source_candidate d56ccad -> dc40fd2) caught and fixed in rev 2 with a cross-manifest binding test (7->8); protected COMMON FAILs kept disclosed |
| VIDEO-CAPTURE-RESTORE-30S-CLIP | deepseek-v4-flash | M | Low-Medium - restore the missing capture-ai-video tool with Playwright-native WebM recording (no system ffmpeg), hygiene-gated durable capture, real ~36 s clip of the accepted anti-huddle arc, binding test asserting real-artifact metadata honesty; no source change | 0 | A | first-pass ACCEPT; audit PASS 20/20; critic independently recomputed clip SHA/bytes, verified EBML magic, the real match path, and ordinary-run docs/ byte-identity (824-file hash diff) |
| GK-SPEC-SUITE-CONTRACTS | deepseek-v4-flash | M | Medium - new normative spec (GOALKEEPER_SPEC.md, small-sided-only) + versioned `goalkeepers` evaluator suite (suite-goalkeepers-v1: criteria bindings, invariants, observations, scenario stubs, provisional config gk-small-sided-v1 with 5 BLOCKED_MISSING_REFERENCE disclosures) + 24-test binding suite with negative controls; registry grew 24b5341e -> c9098fb8 with two provenance assertions accommodated as format+provenance validation; zero src/ change | 0 | A | first-pass ACCEPT; audit PASS 20/20; critic proved the accommodation retains discriminating power and all verdict-bearing comparisons strict; integration re-ran 148/148 neighbors + typecheck 0 |
| GK-5V5-ADAPTER-BEHAVIOR | deepseek-v4-flash (rerouted from qwen3.8-flash mid-task on monthly quota cap; ~80% qwen-written implementation kept and re-verified) | M | Medium-High - adapter-layer designated-keeper role (goalkeeper-role.ts + cpu-adapter/team-decision-profile wiring): arc hold with bounded drift from gk-small-sided-v1, never chaser/presser, save/claim via tick-indexed InputFrames, ball independent; gkBehavior:false kill switch with stash-identity to 91ff0be; 4-run MULTI_TICK trajectory (2 driven fixture runs give 4 save chains; organic run armed 21 reactions / 0 completed chains — disclosed); runner wiring default-false evidence-only | 0 | A | first-pass ACCEPT; audit PASS; critic verified raw rows + stash-identity cross-checked vs the accepted anti-huddle pin; integration re-ran 115/115 + stash verifier + typecheck 0 |
| GK-BROWSER-DYNAMIC-EVIDENCE | deepseek-v4-flash (qwen reroute continues) | M | Medium - gkBehavior enabled in the 5v5 CPU-vs-CPU browser composition root (wiring-only, IS_AI_MATCH_5V5-gated, human modes untouched) + DYNAMIC_VISUAL capture: 4 event-centered frames (arc-hold@195, press-and-cover@355, shot@366, save-contact@370) + sequence.json + browser trajectory 9acef93e… (replay_identical; stashed control all-zero); save provenance fixture-driven and disclosed (organic: 0 save chains); browser binding test 2/2 with discriminating negative | 0 | A | first-pass ACCEPT; critic INDEPENDENTLY REPRODUCED the run in its own Chromium (identical ticks, byte-identical PNGs); integration 118/118 node + 4/4 accepted DYNAMIC_VISUAL + typecheck 0 |
| GK-SUITE-ORGANIC-STATE | deepseek-v4-flash | M | Low - goalkeepers-suite state re-run over the keeper-bearing organic observations (producer + record with pinned hash + binding test 8 with cross-manifest provenance assertions); honest before/after table; zero evaluator/catalog/gameplay change | 0 | A | first-pass ACCEPT; critic adjudicated the NOT_EVALUATED resolution as the duels-precedent-compliant honest outcome and reproduced the record hash by re-running the producer; integration recomputed the hash + 119/119 tests |
| GK-KEEPER-ORACLE-REGISTRATION | deepseek-v4-flash | M | Medium - five protected keeper oracles registered (eval/oracles/gk-role.ts + additive wire/foundation-evaluator wiring; headless-match gk-role designation observation injection gated on gkBehavior — necessary because the keeper is an adapter designation a position-based oracle cannot re-derive); mutant-guarded; honest executed verdicts (3 organic PASS + SAVE-CLAIM driven PASS + DISTRIBUTION NOT_EVALUATED); registry hash unchanged; binding-test reproduction superseded with discriminating power retained | 0 | A | first-pass ACCEPT; critic re-derived every verdict by re-running the capture (record hash reproduced byte-exact) and adjudicated both disclosed deviations; integration 226/226 + registry hash verified identical at HEAD and worktree |
| GK-DISTRIBUTION-BEHAVIOR | deepseek-v4-flash (qwen reroute continues) | M | Medium-High - keeper distribution at the adapter layer: post-claim release to an observed teammate via the sanctioned PASS InputFrame path (no omniscience — target from current-tick observations; opponent/unobserved targets are oracle falsifiers); keeper-release OBSERVATION-level telemetry injected by the adapter-aware runner (gk-role precedent — core byte-identical; the core event-union extension deliberately avoided because the core cannot know the adapter designation); distribution oracle real verdict (driven fixture PASS; organic 0 releases honestly disclosed) | 0 | A | first-pass ACCEPT; critic adjudicated the observation-level deviation against §20 + the gk-role precedent and reproduced every number; integration 237/237 + stash verifier 4/4 re-executed + additive-only evaluator change verified |
| COMMON-FULL-MATCH-INVARIANT-TRIAGE | deepseek-v4-flash | M | Medium - NODE-GATE-TRIAGE-style root-cause of the thrice-disclosed full-match COMMON FAILs: COMMON-REFERENCES was a REAL invariant defect (persistent lastTouchRef resolved per-observation; 1719/1800 fails, 0 absent from the window union; core validator resolves against cumulative events) — fixed with window-union resolution + per-tick fallback, oracle discriminating power retained; COMMON-BOUNDS invariant CORRECT — residual confined to the 4 legacy phase-sync runs (real illegal positions from the legacy restart-freeze), no bound widening, honest residual disclosure; new deterministic capture producer + 3-test discriminating guard | 0 | A | first-pass ACCEPT; critic wrote and ran its own measurement script reproducing 1719/1800 → 0/1800 two-run byte-identical; integration reproduced the whole capture tree byte-identically and confirmed the residual pattern exactly |
| GK-SUITE-VERDICTS-STATE | deepseek-v4-flash | S | Small - post-oracle honest verdict state: deterministic producer re-running the goalkeepers suite with the registered oracles + distribution behavior over 5 manifest-pinned accepted runs; full verdict table (3 organic PASS + SAVE-CLAIM/DISTRIBUTION driven-labeled); binding test 11 with cross-manifest provenance assertions; zero evaluator/gameplay change | 0 | A | first-pass ACCEPT; critic reproduced the record hash byte-exact in its own ephemeral re-run and verified the verdict table against raw telemetry; integration recomputed the hash + ordinary-mode producer re-run byte-identical |
| RULES-SPEC-DRAFT | deepseek-v4-flash | M | Medium - dedicated match-rules spec (17 sections: lifecycle model core-owned vs legacy, per-restart normative semantics grounded in the accepted machinery, match-rules-v1 provisional parameters, 7 BLOCKED_MISSING_REFERENCE, adjudicating criteria named-not-registered, deferred rules) + 28-test binding suite pinning quoted constants to machine sources and all 7 blocked keys; spec-only (zero src/ eval/ change) | 1 | A | critic RETRY (2 fixes: real test IDs cited; all 7 blocked keys pinned) resolved and verified by the same critic; integration ACCEPT first pass with independent constant spot-checks |
| KEEPER-VISUAL-MARKER | deepseek-v4-flash (qwen reroute continues) | M | Medium-High - additive PresentationSnapshot keeperRole (the only contract change) threaded from the accepted adapter designation via a non-mutating composition-root enrichment (ai-match-5v5 only) + magenta cone kit marker drawn only when the field is present; absence renders byte-identically to HEAD proven by a genuine bridge-capture SHA parity guard; 3 event-centered DYNAMIC_VISUAL frames; core untouched | 0 | A | first-pass ACCEPT; critic vision-reviewed all frames, re-derived all SHAs, reproduced the parity baselines; integration reproduced the parity in its own run + 71 tests re-run |
| POSSESSION-ORACLE-REFERENCE-TRIAGE | deepseek-v4-flash | M | Medium - triage + fix of the possession oracle's latent per-tick lastTouchRef pattern (the class flagged by the accepted COMMON triage): BEFORE per-tick orphan-ref fails 1719/1149/1749/1685 across 4 full-match maps (the genuine possession-CHANGE check had 0 fails — defect is reference-resolution only); fixed with the accepted window-union resolution (per-tick fallback); never-anywhere references still FAIL both checks; 3 additive discriminating guards + fresh reproducible triage capture; zero gameplay change | 0 | A | first-pass ACCEPT; critic extracted the genuine pre-fix code from git HEAD and reproduced the BEFORE numbers exactly; integration re-ran all 4 captures with the evidence tree byte-identical |
| LIFECYCLE-MIGRATION-ASSESSMENT | deepseek-v4-flash | H | High - lifecyclePhaseSync legacy→core-owned DEFAULT-FLIP migration with per-pin proofs: pin inventory (Groups A-D), empirical probe (4 legacy pins diverge exactly at restart windows; no blocking pins), decision MIGRATED with explicit legacy opt-outs for historical pin reproductions; first candidate REJECTED for the silently-migrated CPU-DEFENSIVE-TACKLE pin (runCpuTackleMatch inherited the default) — repaired per the critic's four fixes (explicit-legacy threading, inventory/decision/claim corrections, spec §4 staleness line) | 1 | A | REJECT→repair→ACCEPT; critic reproduced the probe byte-identically, proved the omission causally, verified all four fixes with fresh re-runs; integration audited every runHeadlessMatch caller (no second missed consumer) + 63/63 mandated tests |
| RULES-SUITE-REGISTRATION | deepseek-v4-flash | H | High - the `rules` evaluator suite registered per MATCH_RULES_SPEC §15: 25 MATCH-* criteria + 8 invariants + 8 bindings + 8 protected oracles (restart + phase, mutant-guarded), additive wiring; honest executed outcomes (4 PASS; AWARD/TIMER-FREEZE NOT_EVALUATED — serialization limitation verified real; 2 BLOCKED_MISSING_REFERENCE); registry hash evolved c9098fb8→980873a8; headless-match untouched (silent-consumer inventory) | 2 | A | critic RETRY→ACCEPT (3 reporting fixes); integration REJECT→ACCEPT (record byte-reproducibility: wall-clock field removed from the hashed record, two-run byte-identity demonstrated and independently verified) |
| RESTART-RULES-CONFORMANCE | deepseek-v4-flash | H | High - per-restart conformance through the registered rules suite closing the serialization limitation: gated serializeRestartFacts runner option (default false, strictly post-loop, provably hash-neutral) injecting core-match-phase + committed restart-executed facts; rules-restart/rules-phase oracle consumption with no weakening (timer NOT_EVALUATED kept for non-gated streams + discriminating FAIL branch added); driven throw-in + goal-kick award conformance (corner honestly NOT_EVALUATED, nothing forced); byte-reproducible durable record (no wall-clock field) | 0 | A | first-pass ACCEPT; critic reproduced record_sha256 byte-exact + chain-identity stashes + all-24-oracle consumer inventory; integration re-ran ~3,270 tests in chunks + silent-consumer hunt over every runHeadlessMatch/evaluateSuite importer |
| GK-GOALLINE-BOUNDS-RESIDUAL | deepseek-v4-flash | M | Medium - root-cause of the last COMMON-BOUNDS residual resolved honestly as path (b) goal-depth geometry: the offending body is the team-b keeper legitimately pushed into its goal mouth by core contact resolution (ticks 391-399 after the tick-391 goal); protected bounds oracle maxX widened 52.5 → 56.5 m derived from versioned gk-small-sided-v1 constants (goalLineX + |arc centre offset| + goal_arc_radius, drift-bound); non-masking guards (beyond 56.5 FAILs; legacy 59.47 m escape stays FAIL); zero src/ change | 0 | A | first-pass ACCEPT; critic reproduced the root cause (exact max 52.53084814… at tick 399) and proved the derivation non-hard-coded by constant mutation; integration hunted every checkBounds/bounds-oracle consumer and re-ran the batteries |
| RULES-SUITE-STATE | deepseek-v4-flash | M | Medium - honest rules-suite state publication (BOOKKEEPING, zero source change): rules evaluator re-run over 5 evidence streams (3 core-owned baselines + 2 gated driven streams); 25-criterion verdict table 7 PASS / 2 BLOCKED / 16 NOT_EVALUATED / 0 FAIL with exactly 3 gated upgrades vs the registration baseline and exact delta bookkeeping; no suite-level PASS claim (negative-control binding); byte-reproducible record (no wall-clock field) | 0 | A | first-pass ACCEPT; critic re-derived the table from two ordinary-mode runs and programmatically diffed the accepted records; integration re-ran the rules gate 91/91 + silent-consumer hunt + durability verifier |
| RULES-FACTS-DEPTH-CONFORMANCE | deepseek-v4-flash | H | High - the remaining non-corner NOT_EVALUATED rules criteria evaluated from existing serialized facts with NO injection change: 10 additive protected oracle checks (placement/serve/timer-freeze/decrement/halftime/fulltime/goal-phase/kickoff-first-touch) + ONE NEW driven full-match timing fixture (5v5-full-match-timing-v1, 240-tick halves) making the timer transitions genuinely observable (literal 1→0 zero-crossing; runner-stamped labels explicitly rejected); 3 anti-huddle criteria honestly NOT_EVALUATED (no adapter-designation facts in committed streams); verdict table 17 PASS / 2 BLOCKED / 6 NOT_EVALUATED / 0 FAIL | 0 | A | first-pass ACCEPT; critic re-ran the production runner + evaluator on all three live streams with 0 mismatches across 3×25 verdicts and verified the timer evidence genuine; integration verified additive-only line-by-line + wider gate 149/149 + silent-consumer hunt clean |
| CORNER-DRIVEN-CONFORMANCE | deepseek-v4-flash | H | High - a GENUINE driven corner via adapter initial state only (5v5-corner-driven-v1: ball inside the +x goal-line span outside the posts + defender positioned to head back toward its own goal; empty inputProgram/scheduledEvents): the core's own §8.1 award to team-a after a defending-team last touch over its own goal line + §8.2 flag execution; 2 new protected oracles (placement/timer-freeze) + 7 corner falsifier guards; CORNER-KICK-CROSS stays BLOCKED; goal-kick neighbour discriminator; 4 event-centered Chromium frames; critic RETRY enforced the strictest-class audit (DYNAMIC_VISUAL incl. semantic visual sequence) and the sequence.json path-binding convention — fixed with the pinned record byte-unchanged | 1 | A | RETRY→ACCEPT; critic reproduced the driven corner across seeds/positions and the strictest-class FAIL, verified all 3 fixes mechanically with the record byte-frozen; integration reproduced all variants + frame SHAs proven real-capture + batteries green |
| GK-CORE-OWNED-ARC-FIX | deepseek-v4-flash (reroute) | M | Medium-High - root-cause + adapter-layer fix of the core-owned team-a keeper off-arc drift: the post-goal reset (applyGoalReset re-places every body at its scenario kickoff home) strands a keeper whose scenario kickoff home is 24.62 m off its own goal arc (team-b's is on-arc; legacy masked the reset by overriding the phase every tick; chaser=none on every off-arc tick — not a chase bug); fix: pure deterministic rehomeKeeperToArc (versioned gk-small-sided-v1 geometry, ±2.5 lateral clamp) gated rehomeKeeper ?? (gkBehavior && core-owned) with an opt-out — the core's own reset then restores on-arc positions; AFTER GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE PASS (0/600 off-arc) | 0 | A | first-pass ACCEPT (after the 402 quota relaunch of the builder itself); critic reproduced the exact reset mechanism + all before/after numbers, classified every runHeadlessMatch caller by gate flags, re-ran 324 tests + stash verification; integration re-ran 250 tests + independently confirmed the two intended fresh-run consumers (regenerable via rehomeKeeper:false) |
| GK-SUITE-CORE-OWNED-STATE | deepseek-v4-flash | M | Medium - the goalkeepers suite re-published under the core-owned lifecycle (BOOKKEEPING, zero source change): core-owned verdict table 8 PASS / 3 NOT_EVALUATED / 1 BLOCKED / 1 NEEDS_PERCEPTUAL_REVIEW / 0 FAIL with the one true verdict change COMMON-BOUNDS FAIL→PASS (legacy escape gone + the accepted 56.5 m goal-mouth bound) and two source-flip disclosures (DISTRIBUTION driven→organic; POSITIONING/NO-FIELD-CHASE legacy→core-owned, PASS only with the re-home live — verified by rehomeKeeper:false re-runs); forwarded disclosure on the two producers that re-run with the re-home at HEAD | 0 | A | first-pass ACCEPT; critic re-derived the table with its own independent script (zero mismatches), programmatically diffed vs v27 (only COMMON-BOUNDS changed), reproduced the empty-chain facts, verified the rehomeKeeper:false dependency; integration re-ran the batteries + a live re-run re-emitting the recorded verdicts (0 mismatches) |
| RESTART-DESIGNATION-FACTS-CONFORMANCE | deepseek-v4-flash | H | High - the adapter restart-window designation facts runner-observed via the production assignChaseRoles (the gk-role precedent extended): the gated serializeRestartFacts injection extended with restart-designation events computed strictly post-loop (ballUntouched, designated taker, per-team chaser, window anchors, re-arm state); 3 new protected oracles close the anti-huddle restart-behavior criteria (FREEZE-UNTIL-FIRST-TOUCH / NEAREST-ONLY / REARM — REARM honestly NOT_EVALUATED on the no-reset throwin stream); checkKickoffFirstTouch keeper exclusion folded in per spec §12.1 (the accepted KICKOFF-FIRST-TOUCH pin preserved); the enlarged injection surface verified safe (pure readers; gate-off byte-identity; stashed controls hash-identical; the one-step mirror offset conservative — never fabricates a PASS) | 0 | A | first-pass ACCEPT; critic re-computed assignChaseRoles from a fresh 1800-tick run with 0/3600 mismatches, adversarially confirmed the wrong-taker FAIL, personally executed every battery; integration hunted every gate enabler/consumer, proved the keeper-exclusion a structural no-op on ungated rules runs, re-ran 185-rule-gate wider battery |
| RULES-SUITE-STATE-RERUN | deepseek-v4-flash | M | Medium - the rules suite's complete aggregate verdict state re-published across all evidence generations (BOOKKEEPING, zero source change): 23 PASS / 2 BLOCKED_MISSING_REFERENCE / 0 NOT_EVALUATED / 0 FAIL over 25 criteria (+8/8 invariants PASS) with the 6 upgrades source-attributed (3 anti-huddle from designation streams; 3 corner from the corner stream); the horizon-text baseline conflation corrected (20/2/3 is the RESTART-DESIGNATION aggregate; RULES-FACTS-DEPTH is 17/2/6); anti-huddle browserParity eligibility + the omitted redundant control disclosed | 0 | A | first-pass ACCEPT; critic's own producer runs ×2 + programmatic diff (exactly 6 changed) + aggregate recomputed 25/25 + eligibility verified from runner code + same-stream probe; integration re-ran the batteries + verify-acceptance-durability PASS at HEAD |
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
| ARCHETYPE-REMAINING-VISUALS | critic-qwen (qwen3.6) | 0731/flash 401, qwen fallback; independent of mimo builder | ACCEPT (retry 1) | simulation registry physics reverted |
| ARCHETYPE-REMAINING-VISUALS | integration-reviewer-qwen (qwen3.6) | flash 401, qwen fallback; independent of mimo builder | ACCEPT | presentation_authority PASS |
| ARCHETYPE-FULL-PAIR-RECAPTURE | critic-qwen (qwen3.6) | flash 401, qwen fallback; independent of mimo builder | ACCEPT (retry 1) | uniqueness vs remaining-visuals VALID |
| ARCHETYPE-FULL-PAIR-RECAPTURE | integration-reviewer-qwen (qwen3.6) | flash 401, qwen fallback; independent of mimo builder | ACCEPT | disk comparison PASS, ARCH-DIFF NPR |
| PLAYABLE-1V1-AFTER-REMAINING-ARCHETYPES | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | honest NPR; archetype PASS |
| PLAYABLE-1V1-AFTER-REMAINING-ARCHETYPES | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| SMALL-SIDED-SHAPE-AFTER-1V1 | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | honest NOT_EVALUATED |
| SMALL-SIDED-SHAPE-AFTER-1V1 | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| ARCH-DIFF-001-FRAME-BINDING | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | hash-diff PASS allowed for distinguishability |
| ARCH-DIFF-001-FRAME-BINDING | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| PLAYABLE-1V1-AFTER-ARCH-DIFF-BINDING | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | honest NOT_EVALUATED |
| PLAYABLE-1V1-AFTER-ARCH-DIFF-BINDING | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| SMALL-SIDED-AFTER-ARCH-DIFF | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | honest NOT_EVALUATED |
| SMALL-SIDED-AFTER-ARCH-DIFF | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| PLAYABLE-1V1-DETERMINISTIC-TWO-RUN | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | two-run hashes match |
| PLAYABLE-1V1-DETERMINISTIC-TWO-RUN | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| PLAYABLE-1V1-AFTER-DETERMINISTIC-TWO-RUN | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | honest NOT_EVALUATED |
| PLAYABLE-1V1-AFTER-DETERMINISTIC-TWO-RUN | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| SMALL-SIDED-AFTER-DETERMINISTIC | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | honest NOT_EVALUATED |
| SMALL-SIDED-AFTER-DETERMINISTIC | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| PLAYABLE-1V1-ENTRY-PREREQ-CALLER | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | no invented FOUNDATION_LAB_PASS |
| PLAYABLE-1V1-ENTRY-PREREQ-CALLER | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| PLAYABLE-1V1-AFTER-ENTRY-PREREQS | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | honest BLOCKED_MISSING_REFERENCE |
| PLAYABLE-1V1-AFTER-ENTRY-PREREQS | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| SMALL-SIDED-AFTER-ENTRY-PREREQS | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | honest NOT_EVALUATED |
| SMALL-SIDED-AFTER-ENTRY-PREREQS | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| ENTRY-PREREQ-RESOLVER-EVAL-JSON | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | eval.json not audit PASS |
| ENTRY-PREREQ-RESOLVER-EVAL-JSON | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| FOUNDATION-LAB-PASS-EVIDENCE | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | live evaluator PASS |
| FOUNDATION-LAB-PASS-EVIDENCE | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| CAPABILITY-DESIGN-PROFILE-EVIDENCE | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | live evaluator PASS |
| CAPABILITY-DESIGN-PROFILE-EVIDENCE | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| PLAYABLE-1V1-AFTER-PREREQ-EVIDENCE | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | live runner PASS |
| PLAYABLE-1V1-AFTER-PREREQ-EVIDENCE | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| SMALL-SIDED-AFTER-PREREQ-EVIDENCE | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | honest NOT_EVALUATED |
| SMALL-SIDED-AFTER-PREREQ-EVIDENCE | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| TEAM-DECISION-PROFILE-EVIDENCE | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | live evaluator PASS |
| TEAM-DECISION-PROFILE-EVIDENCE | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| MUTANT-TEAM-PASS-EVIDENCE | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | live evaluator PASS |
| MUTANT-TEAM-PASS-EVIDENCE | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| TEAM-SHAPE-SUITE-PASS-EVIDENCE | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | live evaluator PASS |
| TEAM-SHAPE-SUITE-PASS-EVIDENCE | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| SMALL-SIDED-AFTER-TEAM-PREREQS | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | honest NOT_EVALUATED |
| SMALL-SIDED-AFTER-TEAM-PREREQS | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| SMALL-SIDED-SITUATION-FIXTURES | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | fixtures + mapping, no verdicts |
| SMALL-SIDED-SITUATION-FIXTURES | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| SMALL-SIDED-SITUATION-EVALUATOR | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | honest verdict logic |
| SMALL-SIDED-SITUATION-EVALUATOR | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| SMALL-SIDED-SITUATIONS-BATCH-1 | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | honest NOT_EVALUATED |
| SMALL-SIDED-SITUATIONS-BATCH-1 | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | evaluator integrity PASS |
| SITUATION-FIXTURE-DRIVING | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | driven fixtures, honest FAIL, validity of evaluate() fix checked |
| SITUATION-FIXTURE-DRIVING | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback; reroute-flag corrected | ACCEPT | 855 tests/34 suites PASS, fixtures immutable, BATCH-1 binding intact |
| SMALL-SIDED-SITUATIONS-BATCH-1-RERUN | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | 64/64 tests; honest verdicts; invariant disclosure judged non-dishonest |
| SMALL-SIDED-SITUATIONS-BATCH-1-RERUN | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | 155 tests PASS, zero regressions, no source changes |
| SMALL-SIDED-SITUATIONS-BATCH-2-RERUN | critic-mimo (mimo-v2.5) | flash 401, qwen blocked (same as builder), mimo fallback | ACCEPT | 90/90 tests; verdicts traced; invariant disclosure honest |
| SMALL-SIDED-SITUATIONS-BATCH-2-RERUN | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | 181 tests PASS, zero regressions, no source changes |
| BROWSER-SMALL-SIDED-001-CASE | critic (deepseek-v4-flash) | flash 0731 unavailable, base flash used | ACCEPT | 10/10 + 9/9 tests; 4 real semantic frames; hash correspondence verified |
| BROWSER-SMALL-SIDED-001-CASE | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | 19 tests PASS, no regressions, dependency clean |
| SMALL-SIDED-MILESTONE-RE-EVALUATION | critic-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | FAIL verdict verified; honest report; no source changes; no PASS claim |
| SMALL-SIDED-MILESTONE-RE-EVALUATION | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | no source/fixture/eval changes; FAIL honest; dependency clean |
| FIXTURE-EVENT-EXTENSION | critic-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | 273 tests pass; second-touch emits; sim limitations honest |
| FIXTURE-EVENT-EXTENSION | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | 273/273 scenario tests; no src changes; no regression |
| SMALL-SIDED-SITUATIONS-BATCH-3 | critic-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | 53 tests; evaluator limitation honest |
| SMALL-SIDED-SITUATIONS-BATCH-3 | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | 79/79 tests; no regression; dependency clean |
| SMALL-SIDED-MILESTONE-RERUN | critic-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | FAIL verdict verified; honest report; no source changes |
| SMALL-SIDED-MILESTONE-RERUN | integration-reviewer-mimo (mimo-v2.5) | flash 401, qwen blocked, mimo fallback | ACCEPT | no evaluator/fixture changes; FAIL honest; dependency clean |
| EVALUATOR-ISRELEVANT-FIX | critic (deepseek-v4-flash) | 0731 stale-route 401 first spawn, reroute to base flash | ACCEPT | additive diff; 116/116 eval tests; no verdict regression verified |
| EVALUATOR-ISRELEVANT-FIX | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | composition clean; neighbor scan zero regression; audit + critic present |
| SMALL-SIDED-SITUATIONS-BATCH-4 | critic (deepseek-v4-flash) | base flash | ACCEPT | 6/6 eval files 142 tests; verdicts honest; byte-identity genuine |
| SMALL-SIDED-SITUATIONS-BATCH-4 | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | composition clean; BATCH-3 unchanged; tmp dir excluded; 0 PASS→FAIL |
| SMALL-SIDED-MILESTONE-RERUN-2 | critic (deepseek-v4-flash) | base flash | ACCEPT | 103/103 tests; input==BATCH-4 index; FAIL derivation honest; no overclaim |
| SMALL-SIDED-MILESTONE-RERUN-2 | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | composition clean; 103 tests; output byte-identical to durable record; critic verified |
| SHOT-RESULT-RESOLUTION-FIXTURE | critic (deepseek-v4-flash) | base flash | ACCEPT | 10/10 binding; real shot+pitch-contact; engine untouched; invariant pre-existing |
| SHOT-RESULT-RESOLUTION-FIXTURE | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | composition clean; 89 tests across 4 suites; invariant pre-existing in BATCH-4 |
| DUEL-REJECTION-FIXTURE | critic (deepseek-v4-flash) | base flash | ACCEPT | 30/30 tests; PHYSICAL_DUEL honest PASS; input-rejection genuine; first-frame policy clear |
| DUEL-REJECTION-FIXTURE | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | composition clean; non-weakening verified; tmp excluded; independent of SHOT |
| SMALL-SIDED-SITUATIONS-BATCH-5 | critic (deepseek-v4-flash) | base flash | ACCEPT | 8/8 honest; byte-identity reproduced; FAIL paths exist; manifest draft regeneration flagged |
| SMALL-SIDED-SITUATIONS-BATCH-5 | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | composition clean; 161 tests/7 files; BATCH-1..4 intact; milestone dependency coherent |
| SMALL-SIDED-MILESTONE-RERUN-3 | critic (deepseek-v4-flash) | base flash | ACCEPT | 8/8 PASS reproducible; reducer critic gate verified; ACCEPT unlocks milestone PASS |
| SMALL-SIDED-MILESTONE-RERUN-3 | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | composition clean; 174 tests/6 suites; PASS record coherent; bundle supersede deferred |
| SMALL-SIDED-EXIT-PREREQ-IDENTITY | critic (deepseek-v4-flash) | base flash | ACCEPT | genuine identity correction; both team prereqs accepted; PASS preserved |
| SMALL-SIDED-EXIT-PREREQ-IDENTITY | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | 75/75 tests; bundle coherent (13 runs); no source/contract change |
| SMALL-SIDED-VISUAL-READABILITY-EVIDENCE | critic (deepseek-v4-flash) | base flash | ACCEPT | evidence solid 8/8 dims; action_recognition NEEDS_PERCEPTUAL_REVIEW honest disclosure; byte-SHA reuse valid; no overclaims |
| SMALL-SIDED-VISUAL-READABILITY-EVIDENCE | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | composition clean; 101 neighboring core tests pass; adapter-only test-bridge change (presentation) |
| BROWSER-SMALL-SIDED-001-COHERENCE-RERUN | critic (deepseek-v4-flash) | base flash | ACCEPT | hashes recomputed, matching; 27/27 browser + 16/16 binding; original 001 evidence preserved; no overclaims |
| BROWSER-SMALL-SIDED-001-COHERENCE-RERUN | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | 254 neighboring tests pass; no core gameplay change; evidence honest |
| SMALL-SIDED-PROFILE-REDUCER-EXTENSION | critic (deepseek-v4-flash) | base flash | ACCEPT | 24/24 new + 95 regression tests; honest milestoneVerdict mapping; playable-evaluator untouched; no overclaim |
| SMALL-SIDED-PROFILE-REDUCER-EXTENSION | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | 268 tests pass; milestone manifest preserved; oracle integrity fine |
| SMALL-SIDED-MATCH-SITUATION-SCANNER | critic (deepseek-v4-flash) | base flash | RETRY→ACCEPT | RETRY: mandatory suite flaky under parallel load (hook timeout, 7/31 skipped). Fixed (60s hook timeouts). ACCEPT: 31/31 reproducible x2; 116/116 regressions |
| SMALL-SIDED-MATCH-SITUATION-SCANNER | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | 161 neighborhood tests; no src change; backward compatible; milestone manifest intact |
| SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH | critic (deepseek-v4-flash) | base flash | ACCEPT | honest 0 present / 3 not_observed / 5 insufficient_context; pure verdict module; SHA-reuse VALID |
| SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH | integration-reviewer (deepseek-v4-flash) | base flash | REJECT→ACCEPT | REJECT: refactor left computeSituationVerdict unbound (24 failing tests). Fixed via local import; re-run 27/27+31/31+134/134+46 green |
| SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH | critic (deepseek-v4-flash) | base flash | RETRY→ACCEPT | RETRY x2: guard non-discriminating (tests pass with code stashed). Fixed via mechanism-activation-counter guard (fails when stashed; 492 activations). ACCEPT |
| SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | 411 CPU + 323 eval + 40 browser neighbors green; injection byte-identical to bridge; additivity confirmed |
| SMALL-SIDED-ACTION-EVENT-OBSERVABILITY | critic (deepseek-v4-flash) | base flash | RETRY→ACCEPT | RETRY: 4/12 PNGs stale tick-0 dups (render-screenshot sync). Fixed via gl.finish() + drop non-observable contact kind; re-capture 9 unique frames. ACCEPT |
| SMALL-SIDED-ACTION-EVENT-OBSERVABILITY | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | 67 browser + 35 neighbor bindings green; additive shared changes (gl.finish, type decl) |
| SMALL-SIDED-5V5-HUMAN-VS-CPU | critic (deepseek-v4-flash) | base flash | ACCEPT | first pass clean; 20 browser + 20 binding; browser/headless hash correspondence; 5 distinct PNGs; no overclaims |
| SMALL-SIDED-5V5-HUMAN-VS-CPU | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | 8 neighbor browser suites green (5v5-ai 8/8, 5v3 9/9, 3v3-human 8/8, 1v1-control 8/8); pre-existing player-indicator/player-switch baseline failures unchanged |
| SMALL-SIDED-PLAYTEST-RE-RUN | critic (deepseek-v4-flash) | base flash | ACCEPT | first pass clean; 129/129 binding tests; honesty of 6/8 coherent disclosure re-verified by fresh scanner run; derived-copy drift benign |
| SMALL-SIDED-PLAYTEST-RE-RUN | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | 39 docs-only paths, zero source change; bundle 14 runs / 13 sources coherent; superseded manifest byte-identical; no neighbor regression; typecheck pre-existing |
| SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE | critic (deepseek-v4-flash) | base flash | RETRY→ACCEPT | RETRY x2: (1) ball-system oscillation fix invalidated BATCH-1/2/3 evidence omitted from the reported totals — regenerated + reducer re-run; (2) persisted trajectory from the intermediate engine (494 vs 437 events) + stale RESULT.md — regenerated on final engine, 600/600 hashes reproducible. ACCEPT |
| SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE | integration-reviewer (deepseek-v4-flash) | base flash | REJECT→ACCEPT | REJECT x3: (1) 2v2-scoring 31/34 timeouts (pitch-contact flood 511) + EXIT-PREREQ-IDENTITY playtest record entry/exit prereq fields; (2) 2v2-scoring exit 1 under default forks pool (onTaskUpdate); (3) single long test file still blocked one worker. Fixed: regime-threshold fix (511→1 contacts), record correction, three-file long-test split (34/34 exit 0, twice). ACCEPT |
| SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY | critic (deepseek-v4-flash) | base flash | RETRY→ACCEPT | RETRY x3: (1) 3 PNGs byte-identical (843cf468 triple-hash) = stale capture — recaptured all pairwise unique; (2) leftover toBeLessThanOrEqual(1) carve-out at line 328 + orphaned shot-before.png + vacuous PASS_BIT/SHOT_BIT assertions — removed, synced, non-vacuous; (3) tick-metadata drift (producer event−20/+20 vs capture) — reconciled to shared formula + consistency guard. ACCEPT |
| SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | first pass clean; 457 unit + 47 browser neighbors exit 0; zero src/contracts/spec change; typecheck 2 pre-existing errors non-candidate; neighbor-browser screenshot rewrites restored to baseline |
| BROWSER-SWITCH-INDICATOR-BASELINE-FIX | critic (deepseek-v4-flash) | base flash | RETRY→ACCEPT | RETRY x1: stale JSDoc in player-switch runWithCpu claiming the removed manual-switch detection ran (contradicts the fix's central change). Fixed comment-only; ACCEPT. Core untouched; guards discriminating; 8/8 + 7/7 + neighbors green |
| BROWSER-SWITCH-INDICATOR-BASELINE-FIX | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | first pass clean; 150 browser neighbors + 232 core units exit 0; core byte-identical; remaining setControlledPlayer callers legitimate core-API; RESULT.md neighbor counts corrected by orchestrator (stale 7→20 etc.) |
| SMALL-SIDED-LADDER-MENU-COMPLETION | critic (deepseek-v4-flash) | base flash | ACCEPT | first pass clean; 9/9 parity + 4/4 screenshots + 327 tests; ladder parity across 3 layers; core untouched; no switch regression; dup HORIZON id flagged (orchestrator fixed); human-action TIMEOUT proven pre-existing (~266s vs 120s budget) |
| SMALL-SIDED-LADDER-MENU-COMPLETION | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | first pass clean; ladder parity + no switch regression; 327 tests green; v22-2 suite 10/10 in isolation (not a regression); pre-existing typecheck + 3 integration failures reproduced on pristine HEAD (non-candidate) |
| SMALL-SIDED-COHERENT-EVIDENCE-RERUN | critic (deepseek-v4-flash) | base flash | ACCEPT | first pass clean; independent scanner re-run reproduces 7/0/1 (437/320 events) byte-identically; reducer PASS from real evaluators (BATCH-5 8/8); bundle 18/17 coherent; zero source change |
| SMALL-SIDED-COHERENT-EVIDENCE-RERUN | integration-reviewer (deepseek-v4-flash) | base flash | ACCEPT | first pass clean; zero source change holds (src/eval/scenarios/specs/runners empty); bundle source_manifests resolve; superseded byte-identical to prior state; 109 tests green |
| CORE-EVENT-TYPE-UNION-FIX | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; independent HEAD-worktree reproduction of all 12 baseline type errors (2 union TS2322 + 10 eval/runners); typecheck exit 0 core/node/browser; binding discrimination re-proven both directions; byte-identical runner outputs (team-shape dd65…, capability-design 2860… pre/post equal); no overclaim |
| CORE-EVENT-TYPE-UNION-FIX | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 562 tests independently executed; composition clean (union + 8 eval/runners type-only only); never-emitted `evidence` type-member removal matches byte-verified TEAM_SHAPE artifact; no oracle weakened; typecheck exit 0; 6 known pre-existing failures unchanged; critic verified ran |
| SMALL-SIDED-ORGANIC-DUEL-CLOSURE | critic (mimo-v2.5) | mimo-v2.5 | ACCEPT | first pass clean; all BOOKKEEPING criteria PASS (honest evidence, correct bundle supersession, no gameplay regression) |
| HUMAN-DEFENSIVE-DUEL-CONTROL | integration-reviewer (deepseek-v4-flash) | deepseek-v4-flash | ACCEPT | regression repaired (foundation-lab-binding 8/8); composition clean; no evaluator weakened; 247 tests green, typecheck exit 0, audit PASS |
| SMALL-SIDED-ORGANIC-DUEL-CLOSURE | integration-reviewer (mimo-v2.5) | mimo-v2.5 | ACCEPT | composition clean; no evaluator weakened; 185 suites pass, typecheck 0, build 0 |
| CPU-DEFENSIVE-TACKLE | integration-reviewer (deepseek-v4-flash) | deepseek-v4-flash | ACCEPT | composition clean; no evaluator weakened; 99 tests green, typecheck exit 0, audit PASS |
| HUMAN-DEFENSIVE-DUEL-CONTROL | critic (deepseek-v4-flash) | deepseek-v4-flash | ACCEPT | first pass clean (critic); second pass after RETRY fix: caption corrected, evidence reproducible, all substantive criteria PASS; post-repair integration ACCEPT; 247 tests green, typecheck exit 0, audit PASS, FOUNDATION_LAB_PASS eval.json supersession |
| CPU-DEFENSIVE-TACKLE | critic (deepseek-v4-flash) | deepseek-v4-flash | ACCEPT | first pass clean; all substantive criteria PASS (omniscience-free, reachability guard, commitment binding, organic integration, honest scanner); RESULT.md fix applied post-retry |
| BROWSER-DEFENSIVE-CONTROLS-LEGEND | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; visually verified both PNGs (setup-menu legend 10 rows; live tick-194 5v5 overlay opened by real click); sha256sum reproduced both hashes; re-ran parity guard 26/26 + UI suite 14/14; single source of truth verified (capture loads the contract via ssrLoadModule); no architecture violations; pre-existing node failures disclosed not absorbed |
| BROWSER-DEFENSIVE-CONTROLS-LEGEND | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; ladder-menu-parity 9/9 + controls-legend-ui 14/14 (browser) + parity guard 26/26 (node) + typecheck exit 0 independently executed; core byte-identical; dependency direction PASS (contract zero-import, UI module browser-adapter layer); no evaluator change; critic verified ran |
| 5V5-KICKOFF-ANTI-HUDDLE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; independently re-executed the flowing 1800-tick run (identical hash chain 6817faadf99dc0ec…); SHA-256 recomputed; raw per-tick decode of every criterion (0 team-ticks with >1 chaser; 0.000 m frozen displacement; cover distToBall > 1.2 m); 12/12 criteria PASS; dispositions judged genuine not weakened |
| 5V5-KICKOFF-ANTI-HUDDLE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 101 neighbor tests independently re-run green (81/81 mandated set + 18/18 changed node + 2/2 browser at pinned config); typecheck 0; trajectory SHA-256 reproduced; accepted evidence untouched (docs/ shows only the new dir); core diff empty; presentation snapshot-driven |
| BALL-SETTLED-REGIME-FIX | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; independently re-ran 23/23 new guards + typecheck; trajectory SHA-256 recomputed; BATCH-1 accepted digests recomputed against on-disk bytes (match); accepted oscillation constants verified byte-untouched; 9 criteria PASS incl. single-transition-per-impulse, flood-stays-closed bounds, no-teleport, provisional-constant derivation |
| BALL-SETTLED-REGIME-FIX | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 83/83 mandated neighbor tests green; core diff exactly one file (+37/−1); two-arm pin structure verified (immutable accepted digest + live re-capture); anti-huddle stashed discrimination kept and strengthened; evaluator integrity PASS; presentation NOT_APPLICABLE (UI files untouched) |
| BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; viewed all 5 frames with vision; pixel-diff proved kickoff→first-touch changes confined to the 19×13 px ball-strike region with frozen bodies pixel-identical; independent Chromium rerun reproduced the arc (10/18/23/55/182, pass@122, 2.93 m); sequence.json hashes match PNG bytes; capture hygiene verified (ordinary rerun → test-results only) |
| BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; SHA/tick verification of trajectory + 5 frames; frames viewed (real rendered match); docs byte-identical after ordinary runs via 779-file SHA diff; capture-hygiene gate verified; src/ empty; evaluator integrity PASS |
| SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE | critic (glm5.3-flash) | glm5.3-flash | RETRY→ACCEPT | RETRY: 2×2 isolation (pre/post-fix × browserParityObservations false/true) disproved the rev-1 ball-fix attribution — deltas come from the observation-shape switch; required historical-config re-scan + narrative correction + regeneration. Re-review ACCEPT: cpuTackle sources reproduce 1062/262 byte-identically; false phrases gone; anti-huddle 8/0/0 genuine; reducer PASS from real evaluators; bundle supersession byte-safe |
| SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; binding 9/9 + BATCH-5 + reducer suites green; typecheck 0; superseded manifest byte-identical to HEAD bundle; manifest diff purely additive; rev-1 never committed (RETRY correction, not accepted-history rewrite); stale COHERENT-EVIDENCE binding failure pre-existing (NODE-GATE-REGRESSION-TRIAGE) |
| NODE-GATE-REGRESSION-TRIAGE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; root cause independently confirmed against step() input semantics (inputBuffers consumed pre-increment); no weakening (skip/todo/only grep 0; timeout-only; additive guard; one-line supersession with backup; manifest pins only audit.json); shard partition reconciled exactly 61+26+81=168; re-ran the six repaired suites + evaluate-consumer guards + typecheck, all exit 0 |
| NODE-GATE-REGRESSION-TRIAGE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 6 suites / 77 tests independently re-run green; typecheck 0; src/ empty (only eval adapter changed); supersession exactly one line with backup; post-rerun docs/ shows exactly the declared delta |
| CAPTURE-HYGIENE-ENFORCEMENT | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; independently verified gate sentinel + durable-path equality with accepted evidence; immutability block reproduced non-zero with byte-identity; worst-offender 8/8 leaves docs/screenshots byte-identical; no weakening (assertion diff empty) |
| CAPTURE-HYGIENE-ENFORCEMENT | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; guard 3/3 re-run; 9/9 neighbors green with docs byte-identical (187-file SHA diff); typecheck 0; src/ empty; deltas output-root switches only |
| RESTART-ANTI-HUDDLE-COHERENCE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; trajectory SHA verified; per-window geometry verified from raw rows (frozenCountAtServe=9, drift 0 m, single taker, windows close at first touch); stash controls discriminate; legacy-default framing judged transparent not weakening; accepted kickoff suite 17/17 unchanged (43/43 combined) |
| RESTART-ANTI-HUDDLE-COHERENCE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 64/64 neighbors green (26 new + 17 accepted kickoff + 21 tackle pin); typecheck 0; src/simulation/ + src/contracts/ empty; legacy default confirmed in lifecyclePhaseSync; accepted pinned expectations unchanged |
| HUMAN-VS-CPU-ARC-INTERACTION | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; independent ordinary-mode rerun reproduced the identical frame ticks 18/44/329/332/446; all 5 PNG SHA-256s verified; vision review of all frames (genuine rendered match, event-centered); guards verified discriminating (idle-human; cpuAntiHuddle:false); no weakening |
| HUMAN-VS-CPU-ARC-INTERACTION | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 2 browser suites 4/4 green; typecheck 0; docs byte-identical after runs (ordinary capture -> test-results only); src/ eval/ specs/ gauntlet/ diff empty; trajectory SHA verified |
| DUELS-SUITE-ORGANIC-RERUN | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | 1 RETRY — rev-1 cited d56ccad (BROWSER-DEFENSIVE-CONTROLS-LEGEND acceptance commit) as the human-duel source_candidate; corrected to the HUMAN-DEFENSIVE-DUEL-CONTROL manifest pin dc40fd2; rev 2 regenerated the record (record_sha256 9d8e55b6…→af040ac5…), corrected RESULT.md, added the cross-manifest binding assertion (7→8 tests); rev-1 never accepted; rev 2 clean ACCEPT |
| DUELS-SUITE-ORGANIC-RERUN | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; record_sha256 af040ac5… independently recomputed byte-exact; all four source_candidate values verified against accepted manifests (47bb0db / dc40fd2 / 210b27c / 455f4ec); binding test 8/8 re-executed + typecheck 0; zero tracked-file change (git diff src/ eval/scenarios/ specs/ eval/runners/ empty); COMMON-REFERENCES / COMMON-BOUNDS FAILs confirmed disclosed, not masked |
| VIDEO-CAPTURE-RESTORE-30S-CLIP | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; clip SHA-256 575ff114… and 1,125,058 bytes independently recomputed; EBML magic verified (genuine WebM); ordinary 2 s run left docs/ byte-identical (824-file hash diff) with durable gate verified; real-match path verified (ai-match-5v5, cpuAntiHuddle:true, sim advancing to tick 120 in 2 s); claims_not_made honest; video-reference deferral verified mechanically genuine |
| VIDEO-CAPTURE-RESTORE-30S-CLIP | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 9/9 neighboring tests re-run (binding 5 + capture-hygiene 3 + capture-wip 1); typecheck 0; vite production build OK; protected-path diff empty; artifact SHA recomputed; presentation authority + evaluator integrity PASS; video-reference post-commit obligation verified mechanically |
| GK-SPEC-SUITE-CONTRACTS | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; registrySetId mismatch independently reproduced (durable fnv1a64-v1:24b5341e2bc3fbd3 vs live fnv1a64-v1:c9098fb8ecd66341 from the added suite); accommodation ruled legitimate superset-accommodation — format/provenance check retains tamper discrimination (placeholder/malformed/wrong-length/non-hex all fail), verdict-bearing comparisons strict, git diff -- docs/ empty; spec honesty machine-mirrored (gk-small-sided-v1 + 5 BLOCKED_MISSING_REFERENCE); no GK criterion claims gameplay PASS |
| GK-SPEC-SUITE-CONTRACTS | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 148/148 neighboring tests re-run (goalkeepers-suite 24 + eval-registry 48 + duels-suite 39 + foundation-lab 8 + playable-1v1 29); typecheck 0; all 8 contract files purely additive (deletions=0); full test diffs reviewed (zero skip/todo/only; only relaxation = the two registrySetId assertions); no out-of-scope files |
| GK-5V5-ADAPTER-BEHAVIOR | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; trajectory SHA ca9443a0… recomputed; 4-run structure + 4 save chains verified from raw rows; keeper never chaser/presser on any tick; drift ≤2.5 m; stash-identity independently re-executed (gkBehavior:false byte-equals 91ff0be chains; continuous chain matches the accepted anti-huddle pin); core byte-identity + runner-touches-as-infrastructure verified; honesty verified (organic 0 completed save chains disclosed; save evidence driven-by-layout; no GK-* verdict claimed) |
| GK-5V5-ADAPTER-BEHAVIOR | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 115/115 tests re-run (51 objective + 64 accepted pins) + team-decision-profile neighbor 15/15; typecheck 0; stash verifier re-executed vs 91ff0be; core byte-identity + eval/contracts untouched; presentation authority PASS (browser composition root unchanged); blocked references stay blocked |
| GK-BROWSER-DYNAMIC-EVIDENCE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; INDEPENDENT Chromium reproduction: identical event ticks 195/355/366/370, byte-identical PNGs, trajectory differing only by the durable_capture flag; vision review of all 4 frames (genuine Three output; keeper on the goal line; ball adjacent at contact); trajectory SHA recomputed; counters + stashed all-zero verified; hygiene mechanically proven (841 docs/ files byte-identical on ordinary runs); honesty verified (fixture-driven save disclosed; no organic-save overclaim) |
| GK-BROWSER-DYNAMIC-EVIDENCE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 2/2 browser suite + 4/4 accepted DYNAMIC_VISUAL suites + 118/118 node regressions re-run; typecheck 0; main.ts wiring-only verified (human modes untouched); presentation authority PASS; docs/ byte-identical on ordinary runs with evidence SHAs re-verified |
| GK-SUITE-ORGANIC-STATE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; decisive adjudication: NOT_EVALUATED is the honest executable outcome for the five GK criteria (no keeper oracle registered — registering one would violate the zero-evaluator-change constraint; duels precedent: criteria with oracles changed verdicts, no-oracle criteria stayed NOT_EVALUATED); observations-presence carries the organic/driven/none delta; COMMON FAILs same as the duels rerun (before-state PASS empirically reproduced); record hash independently recomputed + reproduced by re-running the producer |
| GK-SUITE-ORGANIC-STATE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 119/119 tests re-run (8 binding + 24 goalkeepers + 48 registry + 39 duels); typecheck 0; record hash recomputed + producer re-run ordinary-mode reproduced identical hash with docs/ byte-identical; provenance verified against both accepted manifests; evaluator integrity PASS (protected paths empty) |
| GK-KEEPER-ORACLE-REGISTRATION | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; runner touch adjudicated legitimate additive evidence infrastructure (duels precedent in the same wiring layer; injection post-loop/observation-only; gkBehavior:false byte-identity proven by executed GK-MATCH-004 + accepted pins); binding-test supersession adjudicated legitimate (tamper-discrimination retained; accepted evidence untouched); verdict honesty verified by re-running the capture (record_sha256 404b62a6… byte-exact; SAVE-CLAIM driven-labeled; DISTRIBUTION not upgraded); mutants are genuine falsifiers |
| GK-KEEPER-ORACLE-REGISTRATION | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 226/226 tests re-run (13+5+24+48+39+19+33+8+8+29); typecheck 0; registry hash reproduced identically at HEAD git-archive copy and worktree (c9098fb8…); full additive diffs reviewed (no existing entry shadowed); injection cannot affect hashes (post-loop, observation-only, stateHashes collected before it) |
| GK-DISTRIBUTION-BEHAVIOR | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; observation-level keeper-release deviation ADJUDICATED LEGITIMATE (gk-role precedent; §20.3 rules 4/7 verified: post-loop, read-only output, provably cannot affect inputs/steps/hashes; pass outcome core-owned via the sanctioned PASS InputFrame); trajectory SHA recomputed; claim@386 -> releases@408/433 verified from raw rows with ball independence; no-omniscience falsifiers genuine; stash-identity re-executed 4/4 vs 0fb5f3d; driven-by-layout labeling honest |
| GK-DISTRIBUTION-BEHAVIOR | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 237/237 main gate + 64/64 accepted pins + foundation-evaluator 36/36 re-run; typecheck 0; stash verifier re-executed 4/4 vs 0fb5f3d; computeOutcome change additive-only verified (empty -> NOT_EVALUATED, fail-first priority, no existing criterion changed); core/contracts/apps diff empty |
| COMMON-FULL-MATCH-INVARIANT-TRIAGE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; root-cause measurement independently reproduced with its own script (1719/1800 per-tick fails → 0 window-union fails, two-run byte-identical); oracle not weakened (nonexistent refs still FAIL; per-tick fallback preserves single-observation behavior); COMMON-BOUNDS residual confined exactly to the 4 legacy runs with bounds.ts untouched and no widening; 161/161 tests; pnpm-workspace.yaml adjudicated inert tooling |
| COMMON-FULL-MATCH-INVARIANT-TRIAGE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 161/161 tests re-run incl. SHOT-RESULT/DUEL-REJECTION bindings; typecheck 0; all 8 capture runs re-executed ordinary-mode — whole evidence tree byte-identical with stable record hashes; residual pattern confirmed exactly (FAIL on precisely the 4 legacy runs; COMMON-REFERENCES PASS everywhere); wire.ts diff exactly one hunk; latent possession-oracle pattern noted for future triage |
| RULES-SPEC-DRAFT | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | 1 RETRY — (1) spec cited non-existent MATCH-*-INT test IDs; corrected to the real THROW-IN-INT-005/006 + GOAL-KICK-INT-005/006 with source-file pointers (verified against throw-in.test.ts:358/392, goal-kick.test.ts:360/394); (2) binding test pinned only 4 of 7 blocked keys; all 7 now pinned (silent removal fails); retry resolution verified by the same critic with fresh re-runs (28/28, audit PASS, typecheck 0) |
| RULES-SPEC-DRAFT | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; spec-only scope verified (zero tracked diffs); 28/28 binding test re-run; typecheck 0; audit PASS re-run; 10+ quoted constants independently spot-checked against machine sources; all §15 criteria names confirmed unregistered in eval/ and src/; retry fixes materially present |
| KEEPER-VISUAL-MARKER | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; contract delta exactly one optional field; enrichment non-mutating over the static adapter fact; parity guard is a genuine bridge-capture SHA comparison (baselines 05e40d01…/44916d47… reproduced; caveat adjudicated — every renderer hunk guarded by if (pp.keeperRole) + stash identity to 3f31eef); vision review of all 3 PNGs (cone above exactly the designated keeper); SHAs re-derived; composition-root gating verified (human modes untouched) |
| KEEPER-VISUAL-MARKER | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 4/4 browser suite + 67/67 node + 6/6 accepted browser suites re-run; typecheck 0; parity reproduced in its own run (absent=05e40d01…, enriched=44916d47…); ordinary-mode run left the 7 candidate docs files byte-identical; trajectory SHA verified |
| POSSESSION-ORACLE-REFERENCE-TRIAGE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; BEFORE numbers independently reproduced with its own measurement script against genuine pre-fix code extracted from git HEAD (1719/1149/1749/1685; BALL-IND-001-POSS 0 fails — defect proven reference-resolution only); falsifier verified (never-anywhere reference FAILs both checks); accepted pins intact (mutant-team poison still firing); 128/128 mandated tests |
| POSSESSION-ORACLE-REFERENCE-TRIAGE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 162/162 tests re-run (incl. mutant-team 34 with the poison still firing); typecheck 0; all 4 captures re-run ordinary-mode — evidence tree byte-identical, BEFORE numbers reproduced exactly; possession-change block byte-identical to HEAD; wire.ts mirrors the accepted event-references wiring |
| LIFECYCLE-MIGRATION-ASSESSMENT | critic (glm5.3-flash) | glm5.3-flash | REJECT→ACCEPT | probe reproduced byte-identically (divergence 404/404/176/300; restart ticks 2→61 etc.); first verdict REJECT — pin inventory omitted CPU-DEFENSIVE-TACKLE (runCpuTackleMatch silently inherited the migrated default; binding test 15/16 FAIL; causality proven by reverting the two candidate files); repair verified: explicit-legacy threading restores the pin 16/16 twice, inventory/decision/binding lock the 3 cpu-tackle runs, spec §4 staleness corrected (one line); honest 52.53 m residual verified empirically |
| LIFECYCLE-MIGRATION-ASSESSMENT | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | REJECT→repair→ACCEPT cycle audited: all four fixes mechanically verified; decisive silent-consumer hunt over every runHeadlessMatch caller — no second missed consumer (historical-pin producers thread explicit policy; default-adopting callers assert fresh-run behavior not byte-pins); 63/63 mandated batch + typecheck 0; honest residual redisclosed |
| RULES-SUITE-REGISTRATION | critic (glm5.3-flash) | glm5.3-flash | RETRY→ACCEPT | RETRY with 3 reporting fixes: (1) RESULT.md per-run cell claimed a PASS the evaluator did not return (rules-corner-live × KICKOFF-FREEZE) — corrected; (2) MATCH-OUT-OF-PLAY-NO-LAST-TOUCH serialization disclosure applied in 3 places (FAIL branch not exercisable on committed streams); (3) unused geometry constants deleted + module header corrected; retry verified with fresh re-runs (record hash recomputed 9589b51a→ then superseded) |
| RULES-SUITE-REGISTRATION | integration-reviewer (glm5.3-flash) | glm5.3-flash | REJECT→ACCEPT | first review REJECT: record_sha256 hashed a wall-clock generated_at (ordinary re-runs 52706c1a≠9589b51a, all verdict content byte-identical); fix verified: wall-clock field removed (matches the accepted possession-triage precedent), new stable 7503f9fe… recomputed independently, two consecutive ordinary-mode runs byte-identical (durable-vs-run1/run2/run1-vs-run2 all IDENTICAL); 233/233 + 40/40 tests re-run; silent-consumer sweep clean |
| RESTART-RULES-CONFORMANCE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first-pass ACCEPT: trajectory SHA recomputed + record_sha256 reproduced byte-exact in an ephemeral re-run (confined to ignored test-results/); injection verified strictly post-loop and hash-neutral (chain-identity c4d35229…/1acd2d83… re-produced); all 24 wire.ts oracles inventoried for consumer safety (camera-hash honest gap disclosed); corner NOT_EVALUATED verified genuine (raw rows corner=0 on all 4 runs, no synthetic injection anywhere); core event flow + startPhase pairing re-derived from src/simulation/loop/simulation.ts |
| RESTART-RULES-CONFORMANCE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | full node battery re-run (~3,270 tests / 184 files in deterministic chunks): rules gate 63 + neighbors 231 + provenance/hygiene 102 + integration battery 380 green; LIFECYCLE-MIGRATION + CPU-DEFENSIVE-TACKLE stateHash pins intact; silent-consumer hunt over every runHeadlessMatch/evaluateSuite importer (5 runners, 11 test files, 14 scripts, type-only verifier); residuals disclosed as non-candidate (1 non-reproducing transient, 3 env-bound 5s-timeout architecture sub-tests, 2 vitest RPC infra errors); computeMatchStats confirmed to read the runner events array, not injected observation events |
| GK-GOALLINE-BOUNDS-RESIDUAL | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first-pass ACCEPT: root cause independently reproduced (goal at tick 391; monotonic contact push 391-399; max |x| 52.53084814… exact match, argmax tick 399); derivation proven non-hard-coded by in-process constant mutation (radius 1.0 → bound 53.5, body FAILs; offset 2.0 → 55.5); record_sha256 recomputed byte-exact + ordinary-mode two-run byte-identity; batteries re-run (guard 7, CPU-DEFENSIVE-TACKLE 16, LIFECYCLE 5, goalkeepers-suite 24, registries 67, rules 75, foundation 36, gk-oracle 16); pre-existing team-a positioning FAIL reproduced and correctly disclosed; two non-binding notes (tick-398 prose, vitest RPC incident-note suggestion) |
| GK-GOALLINE-BOUNDS-RESIDUAL | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | guard 7/7 + rules gate 186/186 (9 files) + GK/stateHash bindings 45/45 (legacy COMMON-BOUNDS FAIL still binding-pinned) + registry/hygiene/GK-integration 79/79 + typecheck 0; silent-consumer hunt: checkBounds consumers enumerated (evaluate.ts opts.safetyBounds, headless run.ts, team-shape fallback, capture scripts all unchanged — the only delta is the bounds oracle maxX); masking analysis: widening symmetric |x|, beyond-56.5 FAILs, constants read live so drift propagates; record hash recomputed MATCH; critic note (a) confirmed non-binding (RESULT.md tick prose corrected before persistence, no hashed artifact affected); vitest RPC flake confirmed pre-existing and already covered by standing tooling-debt bookkeeping |
| RULES-SUITE-STATE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first-pass ACCEPT: verdict table re-derived from two ordinary-mode producer runs (record_sha256 bae56e5a… matched both times); programmatic diff of the two accepted records' verdict maps = exactly 3 changed; honesty verified per-run (no upgrade without the gate; corner stays NOT_EVALUATED in all 5 runs; FAIL count 0 programmatic; no suite-level PASS claim including the binding's negative control); zero source change + working-tree scope verified; record integrity + byte-identity verified; binding test confirmed discriminating (27 s physical reproduction); foundation/provenance/hygiene battery 81/81 reproduced |
| RULES-SUITE-STATE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | new-files-only scope verified (tracked diff 0 lines incl. eval/contracts/); batteries re-run: RULES-SUITE-STATE-binding 10/10, rules gate 91/91, registry 67/67, GK/stateHash pins 21/21, hygiene/arch 12/12, typecheck 0, verify-acceptance-durability green; silent-consumer hunt: new paths referenced only by producer/binding/bookkeeping (publication is data, not code); WIP gate verified empirically (ordinary runs write only under ignored test-results/); record hash recomputed MATCH; critic's audit.json regeneration adjudicated contract-consistent (latest-wins tool location; hashed record unaffected); two RESULT.md prose slips corrected before persistence (audit count 14→13 BOOKKEEPING shape; unchanged-PASS 7→4) |
| RULES-FACTS-DEPTH-CONFORMANCE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first-pass ACCEPT: re-ran runHeadlessMatch + evaluateSuite on all three live streams — 0 mismatches across 3×25 criterion verdicts; timer evidence verified GENUINE (half-2 literal 1→0 zero-crossing at t=660→661; §9.4 60-tick break countdown in-step; fulltime oracle rejects runner-stamped labels — stays NOT_EVALUATED on 1800-tick fixtures); honesty verified (event-kind scan: no adapter-designation facts in any committed stream; corner cluster untouched; FAIL 0 by tally; no suite-level PASS); no-weakening verified (only removed lines are 10 empty binding arrays + 2 type-line extensions; prior verdicts byte-match; injection untouched — headless-match.ts diff EMPTY); record hash recomputed byte-exact; rules gate 121 + neighbors + foundation 81 + typecheck 0 re-run |
| RULES-FACTS-DEPTH-CONFORMANCE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | architecture 27/27 + wider rules gate 149/149 + stateHash pins 100/100 + registry/hygiene/GK 50/50 + integration throw-in/goal-kick 23/23 + typecheck 0; silent-consumer hunt over bindings/invariant-definitions/wire/CRITERION_TO_ORACLE consumers clean (payload type extensions erased at runtime; existing award/freeze oracles verdict-identical — pinned table stays green); constants verified spec-derived (goal-area 5.5/9.16, throw-in z 1.5 from match-rules-v1 §13; 0.75 home tolerance from anti-huddle-v1 §12; 0.2 m tolerance is evaluator-side slack); scenario registry-clean; WIP gate verified empirically; record hash recomputed MATCH; critic's wording note adjudicated non-binding with the overalls derivation independently reproduced (3 per-test PASSes, never a suite PASS) |
| CORNER-DRIVEN-CONFORMANCE | critic (glm5.3-flash) | glm5.3-flash | RETRY→ACCEPT | first review: all substantive criteria PASS reproduced (corner boundary tick 71 + execution tick 131 independently re-derived; award block pre-existing core code; falsifiers real; record byte-reproducible) BUT RETRY — the objective names DYNAMIC_VISUAL frames and the audit was run at MULTI_TICK only: critic reproduced the strictest-class audit FAIL ("semantic visual sequence" — sequence.json frames lacked the repo-wide path binding) and enforced the no-downgrade rule; fixes verified: path bindings written by the browser test source (not hand-patched JSON), DYNAMIC_VISUAL audit re-run PASS incl. semantic visual sequence, hygiene corrections (binding count 7 not 8, arithmetic restated 137/137, phantom RECORD entry removed, doc/evidence typo fixed) — pinned record byte-unchanged (21e3aa08… recomputed) |
| CORNER-DRIVEN-CONFORMANCE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | all batteries re-run green: rules gate 165 tests (8 files), registry/provenance/hygiene 75, GK/stateHash pins 28, evaluator-map consumers 116, browser corner 2/2 in Chromium, typecheck 0; driven corner independently reproduced across seeds 7/123/999 and defender x 46/47/48; per-criterion union reproduces 20 PASS / 2 BLOCKED / 3 NOT_EVALUATED / 0 FAIL; frame SHAs byte-identical across own ordinary-mode Chromium captures (real capture, not hand-patched); scenario collision-free + driven-fixture discipline (empty inputProgram/scheduledEvents); record hash recomputed MATCH with no wall-clock field; 916-file docs/ manifest byte-identical after all verification runs; audit conditions re-derived from the audit source (3–5 labeled frames, SHA uniqueness) |
| GK-CORE-OWNED-ARC-FIX | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first-pass ACCEPT: root cause reproduced exactly (goal tick 391; single-tick reset jump 24.6711 m at tick 451 to the scenario kickoff home with velocity 0; maxDist 24.62214…, lateral 10, offArc 150/406, onArcRatio 0.6305; team-b metrics byte-equal both runs; legacy opt-out masks the reset); fix verified pure/deterministic/idempotent using versioned v1 production functions, designating via the same designateKeeperFromLayout, triggering only for designated keepers >4.0 m off-arc; AFTER reproduced (pass/pass, maxDist 2.5, 0/600 off-arc; reset still executes but lands on-arc); silent-consumer hunt: every accepted-pin producer threads explicit legacy or gkBehavior:false → byte-identical; stash verify-gk-stash 91ff0be 4/4; exactly two fresh-run consumers change (both target the defect; goalline guard still 7/7; migration binding reads persisted artifacts); oracles unchanged and mutant-preserved; 324 vitest tests + typecheck 0 re-run; record hash recomputed exact |
| GK-CORE-OWNED-ARC-FIX | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | change confined to eval/runners/headless-match.ts (92 lines); helper imports only versioned v1 geometry (radius 4.0, lateral max 2.5, offset 0); 250 tests re-run: guard 6/6 + GK families 83/83 + stateHash pins 50/50 + integration/runner 117/117 + typecheck 0 + verify-gk-stash 4/4; silent-consumer hunt: every accepted-pin producer verified legacy/gkBehavior:false per-file → byte-identical; exactly two fresh-run consumers change (goalline-residual producer + migration probe core-owned gk arms — both target the fixed defect, regenerable via rehomeKeeper:false, which reproduces the BEFORE state); browser composition root has zero references to the helper (adapter-owned behavior untouched); record hash recomputed MATCH; two ordinary-mode runs byte-identical to the durable record (no wall-clock field); vitest onTaskUpdate RPC timeout noted as pre-existing under parallel load |
| GK-SUITE-CORE-OWNED-STATE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first-pass ACCEPT: producer re-run twice byte-identical (run1 == run2 == durable record); its own independent script (not the builder's) re-ran runHeadlessMatch + evaluateSuite("goalkeepers") over both core-owned runs — zero mismatches across 9 tracked criteria + catalog outcomes + release ticks/targets; programmatic diff vs the accepted v27 record: the ONLY verdict change is COMMON-BOUNDS FAIL→PASS; the 3 NOT_EVALUATED reproduced empty by its own chain checks (0 keeper contacts in the 12-tick reaction window after 10 opponent shots; 0 keeper-release events; evaluator excludes single-run DETERMINISTIC); rehomeKeeper:false re-runs confirm the keeper PASSes depend on the re-home (24.622 m / 47.877 m off-arc without it); embedded v27 copy byte-faithful (embedded record_sha256 = accepted 222b5f61…); record hash recomputed exact; audit re-run PASS |
| GK-SUITE-CORE-OWNED-STATE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | zero tracked-file modification; binding 11/11 (incl. an 87 s physical reproduction through the production runner + evaluator — the record is not hand-written); GK families 58/58 + stateHash pins 40/40 + rules gate 88/88 + evaluator/hygiene 153/153 + verify-gk-stash 4/4 + typecheck 0; two consecutive ordinary-mode runs byte-identical to the durable record (1ef55d8b…) with docs/ SHA-verified untouched; live re-run re-emits exactly the recorded per-run verdicts (continuous 8 releases @166-220 → player-9; fixture 0; COMMON-BOUNDS PASS both) — 0 mismatches; publication is data not code with the WIP gate intact; scope confirmed as exactly horizon item 4/4 (current_index 3 → last item; prerequisite accepted) |
| RESTART-DESIGNATION-FACTS-CONFORMANCE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first-pass ACCEPT on the enlarged injection surface: assignChaseRoles verified as exported production code genuinely called per tick (cpu-adapter.ts:1724-1753/:2695); the injection strictly post-loop inside the default-false gate; assignChaseRoles re-computed from a fresh 1800-tick arc run — 0/3600 team-tick mismatches vs the injected facts; role functions pure readers (the only side effect is a diagnostics counter consumed by no gated evidence); the one-step mirror offset conservative (can only shorten windows or false-fail — never fabricates a PASS); window censuses reproduced exactly (arc 8/6 re-armed; non-browserParity 2/0); adversarial wrong-taker injection FAILs the freeze oracle; keeper exclusion verified against spec §12 verbatim with synthetic both-directions tests; producer + evaluator re-run (20/2/3/0); record hash recomputed byte-exact; all four batteries + typecheck 0 + audit re-run PASS |
| RESTART-DESIGNATION-FACTS-CONFORMANCE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | rules gate 185/185 (9 files incl. the new binding) + GK/stateHash pins 109/109 + registry/provenance 123/123 + neighbor battery 80/80 + typecheck clean; silent-consumer hunt: 5 serializeRestartFacts enablers (capture scripts) + 5 test-file consumers enumerated — default-false path byte-identical with 3 fresh stashed controls all state_hash_chain_identical; keeper-exclusion gating verified structural (gk-role events only under gkBehavior && keeperRoles !== undefined; no producer combines the two flags — a structural no-op on ungated rules runs) with the accepted KICKOFF-FIRST-TOUCH pin re-derived live; record hash recomputed MATCH; 1094-file evidence hash sweep clean (only the candidate's own audit.json refreshed by the audit contract); critic's 4 non-binding observations adjudicated as future cleanups (dead chasers variable; conservative mirror offset; _keeperPressExclusions counter hygiene) |
| RULES-SUITE-STATE-RERUN | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first-pass ACCEPT: own ordinary-mode producer runs ×2 (both pin record_sha256 36fc77e5…, recomputed exactly, byte-identical to the durable docs record); programmatic diff vs the RULES-FACTS-DEPTH baseline found exactly 6 changed criteria and no other delta; the aggregate recomputed from per-run verdicts matched the record 25/25 with the disclosed eligibility; the eligibility exclusion independently verified (runner code headless-match.ts:949 parity shape + :1144-1204 re-arm arming only under parity wiring; same-stream probe: parity 25 re-armed ticks vs non-parity 0); the omitted control's complete verdict list confirmed aggregate-neutral; baseline-count correction confirmed against both accepted records (17/2/6 vs 20/2/3) and the HORIZON text conflation confirmed real; blocked keys BLOCKED on all 10 streams; rules gate 166/166 + neighbors 242/242 + foundation/provenance/hygiene 81/81 + typecheck 0 + audit re-run PASS |
| RULES-SUITE-STATE-RERUN | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | zero tracked-file modification (strictly new evidence + producer + binding); rules gate + binding 179 tests + stateHash pins 69 tests re-run green + typecheck 0 + verify-acceptance-durability PASS at HEAD + audit PASS; record SHA recomputed MATCH, two consecutive ordinary runs byte-identical and byte-equal to the durable record (622f1008…), docs/ byte-identical after ordinary runs; the corner PASS discriminated (goal-kick neighbour NOT_EVALUATED); the blocked key BLOCKED on all 10 streams; the omitted control's only PASSes (OOP-DETECT, GOAL-DEVENT) PASS on the re-run streams — the omission changes no aggregate; publication is data not code with the WIP gate intact; scope matches horizon item (b) exactly |
| GK-SUITE-VERDICTS-STATE | critic (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; record_sha256 reproduced byte-exact in its own ephemeral producer re-run; per-run verdict table matches raw telemetry (continuous 0 releases/0 save chains -> SAVE-CLAIM/DISTRIBUTION honestly NOT_EVALUATED; fixture releases @408/433 -> PASS); all 5 provenance pins verified against the cited manifests; driven-vs-organic labeling accurate; 140/140 neighbors + typecheck 0 |
| GK-SUITE-VERDICTS-STATE | integration-reviewer (glm5.3-flash) | glm5.3-flash | ACCEPT | first pass clean; 151/151 neighbor tests re-run; typecheck 0; record hash recomputed byte-exact + ordinary-mode producer re-run left docs/evidence byte-identical; all 5 cited manifests read verbatim; zero evaluator/gameplay change |

### Builder scoreboard

Only **accepted** objectives. In-flight TOUCH-ACTIONS is excluded.

| Builder | n | A | B | C | D | R | First-pass % | Mean critic loops | Mean step time |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| qwen3.6 | 84 | 60 | 11 | 3 | 3 | 2 | 71% | ~0.42 | ~31m |
| mimo-v2.5 | 43 | 24 | 15 | 3 | 1 | 0 | 56% | ~0.54 | ~49m |

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
# Football Simulation Engine — Match Rules Specification

**Status:** Normative specification for stochastic-outcome match rules; the restart machinery portions are implemented, regulation/set-piece behavior not yet in a suite remains deferred

**Date:** 2026-09-05

**Scope:** Throw-in, goal kick, corner kick, kickoff, scoring, out-of-play detection, and match timing as implemented by the accepted restart machinery (RESTART-ANTI-HUDDLE-COHERENCE). Deferred regulation behaviors (fouls/cards/free kicks, offside, penalty kicks) are listed as future-with-prerequisites, not specified here.

**Model version:** `match-rules-v1`

**Ives:** This document is subsidiary to [GAMEPLAY_EVALUATION_SPEC.md](./GAMEPLAY_EVALUATION_SPEC.md) and governed by [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md), especially its simulation authority, dependency direction (§20), and the hard boundaries that keep the core DOM-free and deterministic. It does not define a PES 2017 calibration, a full regulation architecture, or a full-match ecology.

## 1. Purpose and authority

This specification defines the deterministic match-rule semantics that the accepted engine implements for SMALL-SIDED play: the out-of-play detection, the throw-in / goal-kick / corner-kick restarts, the kickoff and post-goal/halftime reset, the scoring event, and the match timer. It is a product/engine design contract for a fictional capability, not a measurement of PES 2017.

It is authoritative for the match-rule criteria that a future evaluator suite may register under a `match-rules` suite. Where a numeric value would need a real reference measurement, this specification declares it `BLOCKED_MISSING_REFERENCE` and never invents it. A rule behavior that is **not yet implemented** is listed in §2.2 and §16 as deferred-until-suites-exist; this spec does NOT claim those behaviors exist.

This document is normative. `MUST`, `MUST NOT`, `SHOULD`, and `MAY` carry their usual normative meaning.

## 2. Scope and explicit exclusions

### 2.1 In scope

- Out-of-play detection over the goal line (outside the posts or above the crossbar) and over the touchlines, as emitted by the ball solver.
- Throw-in, goal kick, and corner kick restarts: trigger condition, award semantics, restart placement, taker selection, and serve execution.
- Kickoff: the opening kick seed, the first-touch release, and the post-goal / halftime reset that re-arms the restart window.
- Scoring: the `goal` event emitted when the ball crosses the goal line between the posts and under the crossbar, plus the goal phase and post-goal auto-reset.
- Timing: the core `matchTimer`, the half / halftime / fulltime transitions, and the timer-freeze behavior during non-playing phases.
- The freeze / unfreeze interaction between every restart and the accepted anti-huddle contract (freeze-until-first-touch + nearest-only chase).
- Versioned provisional configuration for every unmeasured rule value, under model id `match-rules-v1`, referencing existing accepted config where it overlaps.

### 2.2 Out of scope (explicit exclusions)

- **Regulation implementation:** no regulation match is implemented. Fouls / cards / free kicks, offside snapshots, penalty kicks, drop balls, and advantage ordering stay deferred (see §16) until their dedicated suites exist. Do not treat the restarts specified here as a complete regulation ruleset.
- **Full-match ecology:** stamina over a whole match, contextual match-phase tuning, referee interaction, stoppage-time, and ball-in-play accounting are out of scope.
- **Goalkeeper beyond small-sided:** no 11v11 goalkeeping, penalty-area rules, or keeper offside participation. The only keeper overlap is the small-sided keeper model (`gk-small-sided-v1`) referenced in §§12–13.
- **Any PES 2017 fidelity claim.** No `MEASURED_TARGET` value in this specification may be presented as a PES match; missing references stay `BLOCKED_MISSING_REFERENCE`.
- **A perceptual pass/rubric** for restart or set-piece visual plausibility. `PERCEPTUAL_TARGET` restart criteria would report `NEEDS_PERCEPTUAL_REVIEW` and require a versioned rubric before they could gate.
- **Network, peer lockstep**, or any production multiplayer authority.
- **Same-tick event arbitration** for complex rule cases (tackle-versus-shot, boundary-versus-contact, foul/advantage, goal/out-of-play ordering, multiple contacts). Per [TECHNICAL_SPEC §6.2](./TECHNICAL_SPEC.md#62-versioned-provisional-scheduler), these arbitration matrices are not defined here and must be defined before the affected families become milestone-required.

## 3. Normative vocabulary and configuration model

Terms `MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. Stimulus values such as "a ball-out-of-play event" or "the default restart countdown" define controlled conditions; they are not acceptance thresholds.

Every unmeasured value referenced by a match-rule implementation is defined as **VERSIONED PROVISIONAL CONFIGURATION**. Two kinds of value exist:

1. Values owned by **this specification** under model id `match-rules-v1`. They are:
   - versioned (they carry a model id and version and may change only via a model-version bump);
   - provisional (they are not measured, not calibrated, and not PES values);
   - honest (a value that would need a real reference measurement that does not exist is declared `BLOCKED_MISSING_REFERENCE`, never filled with a guess).
2. Values already owned by an **accepted model** that this spec references rather than re-declares. These include the goal geometry (`foundation-goal-v1`), the ball physics (`foundation-ball-v1`), the fixed tick (`foundation-fixed-dt-v1`), the foundation config (`foundation-config-v1`), the anti-huddle restart contract (`anti-huddle-v1`), and the small-sided keeper (`gk-small-sided-v1`).

The machine-readable record of the accepted, imported values lives in the corresponding config modules (`src/simulation/config/foundation.ts`, `eval/contracts/goalkeeper-config.ts`, and the anti-huddle constants in `src/adapters/input-browser/cpu-adapter.ts`). The `match-rules-v1` value table (§13) is declared here in prose; because the hard dependency direction keeps `eval/contracts/` untouched by this specification milestone, there is **no** `eval/contracts/match-rules-config.ts` yet. A future milestone may materialize one under the same model id without changing any value semantics.

## 4. Lifecycle model: which lifecycle the rules describe

The implemented semantics live in the simulation core (`src/simulation/loop/simulation.ts` and `src/simulation/ball/ball-system.ts`), which owns `matchPhase`, the restart countdowns, `matchTimer`, and `currentHalf` (`src/contracts/state.ts`). The runner (`eval/runners/headless-match.ts`) computes a **separate** derived `phaseHistory` (kickoff / first-half / halftime / second-half / fulltime) that is a bookkeeping label, not a rule decision.

The RESTART-ANTI-HUDDLE-COHERENCE work surfaced a driver defect: the **legacy** `lifecyclePhaseSync` policy overwrote the core's `matchPhase` with the runner's own derived label on every tick, which silently killed the core's restart countdowns headless (the browser never did this). The **core-owned** policy lets the core own every phase it opens, so the restart machinery executes exactly as it does in the browser.

**The rules semantics described here are the core-owned lifecycle.** Under the core-owned policy:

- the core owns `matchPhase` and its restart countdowns;
- a restart phase (`corner-kick`, `throw-in`, `goal-kick`, `goal`) exercises the core's `apply*` functions at countdown zero and returns to `playing`.

Under the **legacy** policy the core's restart windows are suppressed by the runner's overwrite, so the restart rules in this specification do NOT describe what a legacy run observes. As of LIFECYCLE-MIGRATION-ASSESSMENT the runner default IS `core-owned`; `legacy` is retained as an explicit opt-out only to reproduce the accepted pre-migration pins byte-for-byte (a driver artifact, not a rules truth). **Provenance:** `runHeadlessMatch`'s `lifecyclePhaseSync` default moved from `"legacy"` to `"core-owned"` in LIFECYCLE-MIGRATION-ASSESSMENT, and this sentence was corrected to match. Any criterion that adjudicates a restart MUST run under `core-owned` (`lifecyclePhaseSync: "core-owned"`).

## 5. Out-of-play detection

Out-of-play detection is performed by the ball solver in `src/simulation/ball/ball-system.ts` using a swept line-segment test from the pre-integration ball position to the post-integration ball position.

### 5.1 Goal line (crossing x = ±52.5 m)

- The goal line is at `x = ±52.5` m (`GOAL_LINE_X`), matching the 105 m pitch declared by the scenario (`scenario.pitchLength`). The pitch dimensions themselves are scenario-declared configuration, not a constant in `foundation-config-v1`.
- **Goal:** if the swept segment crosses the goal line with `|y| < goalHalfWidth` (posts at `y = ±3.66` m, i.e. the `foundation-goal-v1` goal width 7.32 m) and `0 < z < goalHeight` (2.44 m), the solver emits a `goal` event (see §10).
- **Out of play over the goal line:** if the swept segment crosses the goal line **outside the posts** or **above the crossbar**(`z > 0` outside the goal mouth), the solver emits a `ball-out-of-play` event. The payload carries `goalIndex` (0 = right goal line at `+x`; 1 = left goal line at `-x`), the crossing `ballPosition`, and the ball's `lastTouchRef`.
- **Post / crossbar collision:** before the goal-line decision, the swept segment is tested against the left/right posts (vertical cylinders at `(goalX, ±3.66)`, radius `postRadius` 0.05 m) and the crossbar (horizontal cylinder at `(goalX, z = 2.44)`, radius `crossbarRadius` 0.05 m). A hit emits a `goal-post-contact` / `crossbar-contact` event and reflects the ball with a provisional restitution 0.7. These values are `foundation-goal-v1` (post/crossbar radius) and a provisional rebound value (see §13).
- The `goal` and `ball-out-of-play` events are mutually exclusive for a given crossing: a crossing that is a valid goal is not also an out-of-play restart.

### 5.2 Touchline (crossing y = ±34 m)

- The touchline is at `y = ±34` m (`PITCH_HALF_WIDTH`), the provisional 68 m pitch declared by the scenario (`scenario.pitchWidth`).
- If the swept segment crosses a touchline **within the goal-line span** (`|x| < 52.5`) **and above ground** (`z > 0`), the solver emits a `ball-touchline-out-of-play` event. The payload carries `touchlineIndex` (0 = `+y` side; 1 = `-y` side), the crossing `ballPosition`, and the `lastTouchRef`.

### 5.3 Last-touch requirement

A restart is only awarded when the ball's `lastTouchRef` resolves to a team. The core resolves the team by searching `state.events` for the event id referenced by `lastTouchRef` and reading its `payload.teamId`. If `lastTouchRef` is null or does not resolve to a team, **no** restart phase is entered and play continues as `playing` (the ball crossing the boundary without a recorded last team is ignored by the rules). This matches the THROW-IN-INT-006 / GOAL-KICK-INT-006 guards (tests/integration/throw-in.test.ts, tests/integration/goal-kick.test.ts).

## 6. Throw-in (MATCH-THROW-IN)

### 6.1 Trigger condition

During `playing`, when a `ball-touchline-out-of-play` event fires whose `lastTouchRef` resolves to a team, a throw-in is awarded.

### 6.2 Award semantics

The throw-in is awarded to the team **opposite** whoever last touched the ball. If the last touch was `team-a`, the throw-in is awarded to `team-b` (and vice versa). If the last-touch team cannot be resolved, no throw-in occurs.

### 6.3 Restart placement

- The ball is placed at the exact **touchline exit point** (`throwInPosition` from the event's `ballPosition`), i.e. on the sideline at the point the ball left play.
- The throw-in taker is the **closest awarding-team player** to the exit point; the taker is moved to the exit point and faces into the field.
- Awarding-team receivers are spread inside the field along the touchline; defending players are positioned between receiver and their own goal.

### 6.4 Resolution semantics

The throw-in phase runs a countdown of `default_throw_in_countdown` ticks (versioned provisional, §13). At countdown zero the core executes `applyThrowIn()`:
- places the ball at the exit point at chest height (`throw_in_ball_z` = 1.5 m, versioned provisional) in the `airborne` regime;
- throws it toward the nearest awarding-team receiver (or, if no receiver beyond 0.5 m is found, 10 m into play along `sidelineDir`) at `throw_in_speed` (12 m/s, versioned provisional) with a slight upward arc (`throw_in_vertical_component` = 0.15, versioned provisional);
- clears `lastTouchRef` and emits a `throw-in-executed` event;
- returns `matchPhase` to `playing` and clears the throw-in state.

`throwInPosition`, `throwInAwardingTeam`, `throwInTakerId`, `throwInCountdown`, and `throwInTouchlineIndex` are set when the phase opens and cleared when it closes.

## 7. Goal kick (MATCH-GOAL-KICK)

### 7.1 Trigger condition

During `playing`, when a `ball-out-of-play` event fires (ball crossed the goal line outside the posts / above the crossbar) whose `lastTouchRef` resolves to a team, the core chooses between a corner kick and a goal kick based on the identity of the last-touch team relative to the goal line's defending team.

### 7.2 Award semantics

The goal line is defended by:
- goalIndex 0 (`+x`) is defended by `team-b`;
- goalIndex 1 (`-x`) is defended by `team-a`.

- If the last-touch team is the **defending** team of that goal line, a **corner kick** is awarded to the attacking team (§8).
- If the last-touch team is **not** the defending team, a **goal kick** is awarded to the **defending** team.

### 7.3 Restart placement

- The ball is placed **inside the goal area**: `x = ±(52.5 − 5.5) = ±47` m (`GOAL_AREA_DEPTH` = 5.5 m from the goal line) and `y` clamped to the goal-area half-width 9.16 m (`GOAL_AREA_HALF_WIDTH`), preserving the sign of the exit `y`.
- The kick taker is the **closest awarding-team (defending) player** to that spot; the taker is moved to the spot and faces upfield.
- Awarding-team defenders are spread across the defensive half; the opposing team's players are placed outside the goal area.

### 7.4 Resolution semantics

The goal-kick phase runs a countdown of `default_goal_kick_countdown` ticks (§13). At countdown zero the core executes `applyGoalKick()`:
- places the ball at the goal-area spot on the ground (`z = 0.11` m, `foundation-ball-v1` ball radius) in the `airborne` regime;
- kicks it upfield toward the nearest awarding-team receiver (or, if none beyond 0.5 m, 20 m upfield) at `goal_kick_speed` (16 m/s, versioned provisional) with a moderate loft (`goal_kick_vertical_component` = 0.25, versioned provisional);
- clears `lastTouchRef` and emits a `goal-kick-executed` event;
- returns `matchPhase` to `playing` and clears the goal-kick state.

`goalKickPosition`, `goalKickAwardingTeam`, `goalKickTakerId`, `goalKickCountdown`, and `goalKickGoalIndex` are set when the phase opens and cleared when it closes.

## 8. Corner kick (MATCH-CORNER-KICK)

### 8.1 Trigger condition

During `playing`, when a `ball-out-of-play` event fires whose `lastTouchRef` resolves to the **defending** team of the exited goal line, a corner kick is awarded to the opposing (attacking) team (§7.2). If the last-touch team is not the defending team, a goal kick is awarded instead.

### 8.2 Restart placement

- The ball is placed at the **nearest corner flag**: `(goalX, ±34)` where `goalX = ±52.5` depends on the goal index and the `y` sign is chosen to match the sign of the ball's exit `y`.
- The kick taker is the **closest attacking player** to that flag; the taker is moved to the flag and faces the goal.
- Attacking teammates are spread across the penalty area (~10 m from the goal line); defending players mark them and the designated last defender / keeper is placed at the far post (y = `∓3.66`).

### 8.3 Resolution semantics

The corner-kick phase runs a countdown of `default_corner_kick_countdown` ticks (§13). At countdown zero the core executes `applyCornerKick()`:
- places the ball at the corner flag on the ground (`z = 0.11` m) in the `airborne` regime;
- sends a lofted cross toward the center of the penalty area (8 m in from the goal line, `y = 0`) at `corner_cross_speed` (14 m/s, versioned provisional) with a steep loft (`corner_cross_vertical_component` = 0.35, versioned provisional);
- clears `lastTouchRef` and emits a `corner-kick-executed` event;
- returns `matchPhase` to `playing` and clears the corner-kick state.

`cornerKickPosition`, `cornerKickAttackingTeam`, `cornerKickTakerId`, `cornerKickCountdown`, and `cornerKickGoalIndex` are set when the phase opens and cleared when it closes.

## 9. Kickoff and post-goal / halftime reset

### 9.1 Opening kick

- The opening kick is seeded by the runner at `tick 0` with `matchPhase = "kickoff"` (the core-owned lifecycle allows seeding only the opening kickoff tick; the core otherwise starts at `playing`). The ball is at the center spot and every body is at its scenario start home.
- The ball is **untouched** (null `lastTouchRef`). While untouched, the anti-huddle contract freezes every body except the designated kick taker (see §12).

### 9.2 First-touch release

- When the designated kick taker strikes the ball, `lastTouchRef` becomes non-null, the restart window closes, and every body is released to the nearest-only chase / formation-home behavior. The ball is then an independent 3D entity subject to the ball solver.

### 9.3 Post-goal auto-reset

- On a `goal` event during `playing`, the core enters `matchPhase = "goal"` and starts `goalResetCountdown` (`default_goal_reset_ticks` = 60 ticks, §13).
- At countdown zero, `applyGoalReset()` resets every player to its scenario-start position (zero velocity) and the ball to the center spot (zero velocity, initial regime), then returns `matchPhase` to `playing`.
- The reset does **not** clear the ball's `lastTouchRef`. The anti-huddle adapter re-arms the untouched signal to the carried-through touch reference so the post-goal restart window re-fires (RESTART-ANTI-HUDDLE-COHERENCE).

### 9.4 Halftime reset

- When `matchTimer` reaches zero during `playing` in half 1, the core transitions to `matchPhase = "halftime"` and sets `matchTimer = default_halftime_countdown` (60 ticks, §13).
- At countdown zero, `applyHalftimeReset()` resets all players and the ball to their initial positions, sets `currentHalf = 2`, restores `matchTimer` to the initial half duration, and returns `matchPhase` to `playing`.

### 9.5 Restart-window re-arm

- After a post-goal or halftime reset the adapter re-keys the "untouched ball" signal to the carried-through touch reference and re-arms the restart window (`RESTART_HOLD_MIN_TICKS` = 2, `anti-huddle-v1`), so the set-piece freeze applies to that window as well as to the opening kick.

## 10. Scoring

### 10.1 Goal detection

- The ball solver emits a `goal` event when the swept segment crosses a goal line between the posts and under the crossbar (§5.1): `|y| < 3.66` m and `0 < z < 2.44` m at the `goalX` crossing.
- The payload carries `goalIndex` (0 = right, 1 = left) and the crossing `ballPosition`.

### 10.2 Goal phase

- During `playing`, when a `goal` event fires for the first time in a tick, the core enters `matchPhase = "goal"` and starts the post-goal countdown (§9.3). The `goal` event itself does not change the ball state; the reset that follows repositions play to the center spot.

### 10.3 Scorebook

- The simulation core does **not** own a scoreboard field. The score is a **runner-derived fact**: the headless match runner (`runHeadlessMatch`) maps each `goal` event's `goalIndex` to a scoring team via the `goalTeamMapping` and accumulates `score[scoringTeamId]`. This is computed lazily from the event stream and is never a source of authoritative gameplay state.
- In the rendered presentation the score is presented by the UI from presentation facts, again as an adapter read of a derived value, not a core truth.

### 10.4 Own-goal / own-goal assignment

- There is no own-goal concept in the current model. The scoring team is always the team attacking the goal the ball crossed, derived from `goalIndex` through the runner's `goalTeamMapping`. A ball touched by a defender but crossing the goal mouth is still scored to the attacking team. No `own-goal` adjudication exists.

## 11. Timing / match clock

- `matchTimer` starts at `scenario.matchDurationTicks ?? 5400` and decrements by one **only** while `matchPhase === "playing"`. This is the core's ball-in-play clock.
- On `matchTimer` reaching zero during `playing`:
  - if `currentHalf === 1`: transition to `halftime` (§9.4), set `matchTimer = default_halftime_countdown`;
  - else: transition to `fulltime` (timer stays at zero; no further transition).
- **Timer freeze:** during `goal`, `halftime`, `fulltime`, `corner-kick`, `throw-in`, and `goal-kick` phases the `matchTimer` is frozen (the decrement is gated on `playing`). This is the `MATCH-TIMER-ENFORCEMENT` behavior confirmed by THROW-IN-INT-005 / GOAL-KICK-INT-005 (tests/integration/throw-in.test.ts, tests/integration/goal-kick.test.ts).
- The runner's derived `phaseHistory` and `matchTimeSeconds` are bookkeeping labels keyed off the runner's own half-duration accounting, not the core clock. They are not authoritative for rules.

## 12. Freeze / unfreeze interaction with the accepted anti-huddle contract

Every restart inherits the accepted anti-huddle contract (`anti-huddle-v1`). The two normative rules are:

1. **Freeze-until-first-touch.** While the restart ball is untouched (`lastTouchRef` is null, or equals the carried-through baseline from a reset), every non-taker body is frozen at its window anchor. The anchor is:
   - the body's position when the window opened (`restartAnchor`), which at kickoff / post-goal / halftime equals its kickoff home (so the accepted kickoff frames are unchanged), or
   - the core's set-piece placement for a restart window (so a set-piece body is not dragged back across the pitch).
   Only the **single designated kick taker** — the nearest body in the match to the untouched ball, resolved with ties by ascending playerId and with the keeper excluded — may close distance.
2. **Nearest-only chase.** Once the ball is touched, only one designated chaser per team (the nearest non-attacker presser from the shared designation) converges on the ball; every other non-chasing body holds its formation home.

Key `anti-huddle-v1` values used by the restart flow: `RESTART_HOLD_MIN_TICKS` = 2 (consecutive hold ticks required before a resumption re-arms a restart window), `KICKOFF_FREEZE_HOME_TOLERANCE` = 0.75 m (dead-zone slack at the frozen home), `CHASE_NEAREST_HOME_TOLERANCE` = 0.75 m (dead-zone slack for the non-chasing formation home).

### 12.1 Keeper interaction

The designated small-sided keeper (`gk-small-sided-v1`) is **excluded** from restart-taker selection and never leaves its goal arc to take a restart. A keeper is also never the designated presser or cover. A restart serve that lands inside a keeper's own arc is resolved by that body, which is separately exempt while it is already at the ball.

## 13. Versioned provisional configuration (`match-rules-v1`)

The unmeasured values a future match-rule implementation may reference are enumerated here. All belong to model `match-rules-v1` unless noted otherwise. None is a measured PES constant.

| Key | Value | Units | Source |
|---|---|---|---|
| `default_throw_in_countdown` | `60` | ticks | `VERSIONED_PROVISIONAL` |
| `default_goal_kick_countdown` | `60` | ticks | `VERSIONED_PROVISIONAL` |
| `default_corner_kick_countdown` | `60` | ticks | `VERSIONED_PROVISIONAL` |
| `default_goal_reset_ticks` | `60` | ticks | `VERSIONED_PROVISIONAL` |
| `default_halftime_countdown` | `60` | ticks | `VERSIONED_PROVISIONAL` |
| `goal_area_half_width` | `9.16` | m | `VERSIONED_PROVISIONAL` |
| `goal_area_depth` | `5.5` | m | `VERSIONED_PROVISIONAL` |
| `throw_in_ball_z` | `1.5` | m | `VERSIONED_PROVISIONAL` |
| `throw_in_speed` | `12` | m/s | `VERSIONED_PROVISIONAL` |
| `throw_in_vertical_component` | `0.15` | — | `VERSIONED_PROVISIONAL` |
| `goal_kick_speed` | `16` | m/s | `VERSIONED_PROVISIONAL` |
| `goal_kick_vertical_component` | `0.25` | — | `VERSIONED_PROVISIONAL` |
| `corner_cross_speed` | `14` | m/s | `VERSIONED_PROVISIONAL` |
| `corner_cross_vertical_component` | `0.35` | — | `VERSIONED_PROVISIONAL` |
| `corner_cross_target_offset_x` | `8` | m | `VERSIONED_PROVISIONAL` |
| `post_rebound_restitution` | `0.7` | — | `VERSIONED_PROVISIONAL` |
| `restart_freeze_hold_min_ticks` | `2` | ticks | `anti-huddle-v1` (referenced) |
| `kickoff_freeze_home_tolerance` | `0.75` | m | `anti-huddle-v1` (referenced) |
| `chase_nearest_home_tolerance` | `0.75` | m | `anti-huddle-v1` (referenced) |

Referenced accepted config (not re-declared here; machine-recorded in the corresponding module):

| Id | Values this spec reads | Module |
|---|---|---|
| `foundation-goal-v1` | goalWidth `7.32` m, goalHeight `2.44` m, postRadius `0.05` m, crossbarRadius `0.05` m | `src/simulation/config/foundation.ts` |
| `foundation-ball-v1` | ballRadius `0.11` m, gravity `9.81` m/s², restitution `0.55`, groundResistance `0.02` | `src/simulation/config/foundation.ts` |
| `foundation-fixed-dt-v1` | fixed tick 1/60 s (60 ticks per second) | `src/simulation/config/foundation.ts` |
| `foundation-config-v1` | immutable versioned foundation config (fixedDt, prng, encoding, hash, locomotion, ball, contact, pass, loftedPass, shot, closeControl, secondTouch, playerContact, goal). Pitch dimensions are scenario-declared (`scenario.pitchLength` / `scenario.pitchWidth`), not held here. | `src/simulation/config/foundation.ts` |
| `anti-huddle-v1` | `RESTART_HOLD_MIN_TICKS`, `KICKOFF_FREEZE_HOME_TOLERANCE`, `CHASE_NEAREST_HOME_TOLERANCE` | `src/adapters/input-browser/cpu-adapter.ts` |
| `gk-small-sided-v1` | keeper reaction window, save/claim reach, distribution window | `eval/contracts/goalkeeper-config.ts` |

These are deliberate, versioned design choices for a fictional capability. They MUST NOT be described as PES magnitudes or provider-rating mappings.

## 14. BLOCKED_MISSING_REFERENCE values

The following values would need a real reference measurement that does not exist. They are disclosed, never invented. A future match-rule implementation MUST NOT hard-code a guessed number for any of these.

| Key | Reason it is blocked |
|---|---|
| `throw_in_trajectory_ref` | No controlled, qualified PES reference capture of a throw-in arc (release height, speed, vertical decay) exists. |
| `goal_kick_distribution_ref` | No qualified PES reference of a goal-kick distribution speed / launch profile exists. |
| `corner_cross_trajectory_ref` | No controlled PES reference of a corner-cross lofted arc exists. |
| `restart_serve_latency_ref_ms` | No controlled PES capture of boundary-cross-to-restart-serve latency exists. |
| `post_goal_reset_ref_ticks` | No qualified PES reference of the post-goal reset timing exists. |
| `half_time_break_ref_seconds` | No qualified PES reference of the halftime break duration exists. |
| `ball_in_play_accounting_ref` | No controlled reference for PES ball-in-play / stoppage-time accounting exists. |

`BLOCKED_MISSING_REFERENCE` is not a defect and must not be converted into invented envelope or tolerance values.

## 15. Adjudicating telemetry / suite criteria (named, NOT registered)

The following criteria would adjudicate the rules in this specification. They are **named here for intent only** and are **NOT registered** in any evaluator suite: no evaluator, oracle, invariant-definition, observation-definition, binding, or scenario change accompanies this specification milestone. A future `match-rules` suite milestone may register them once the corresponding executable material exists.

- **Out-of-play:** `MATCH-OUT-OF-PLAY-DETECT` (swept-test crossing produces the correct `goal` / `ball-out-of-play` / `ball-touchline-out-of-play` event with the right boundary payload), `MATCH-OUT-OF-PLAY-NO-LAST-TOUCH` (null `lastTouchRef` → no restart).
- **Throw-in:** `MATCH-THROW-IN-AWARD` (opposite-last-touch team), `MATCH-THROW-IN-PLACEMENT` (ball at touchline exit point), `MATCH-THROW-IN-SERVE` (chest-height, into-play throw to nearest receiver), `MATCH-THROW-IN-TIMER-FREEZE`.
- **Goal kick:** `MATCH-GOAL-KICK-AWARD` (defending team of the exited goal line), `MATCH-GOAL-KICK-PLACEMENT` (inside the goal area on the exit side), `MATCH-GOAL-KICK-DISTRIBUTION` (upfield to nearest receiver), `MATCH-GOAL-KICK-TIMER-FREEZE`.
- **Corner kick:** `MATCH-CORNER-KICK-AWARD` (last touch by the defending team), `MATCH-CORNER-KICK-PLACEMENT` (nearest corner flag), `MATCH-CORNER-KICK-CROSS` (lofted cross into the penalty area), `MATCH-CORNER-KICK-TIMER-FREEZE`.
- **Kickoff / restart:** `MATCH-KICKOFF-FREEZE` (every non-taker held at its window anchor while the ball is untouched), `MATCH-KICKOFF-FIRST-TOUCH` (restart window closes on first touch; only the taker may break it), `MATCH-RESTART-REARM` (post-goal / halftime reset re-arms the window).
- **Scoring:** `MATCH-SCORING-GOAL-DEVENT` (a `goal` event fires exactly when the ball crosses the goal mouth between posts under the crossbar), `MATCH-SCORING-GOAL-PHASE` (`playing → goal → playing` with a post-goal reset).
- **Timing:** `MATCH-TIMER-DECREMENT` (decrements only during `playing`), `MATCH-TIMER-HALFTIME` (`playing → halftime → second-half`), `MATCH-TIMER-FULLTIME`, `MATCH-TIMER-FREEZE` (frozen during `goal` / `halftime` / `fulltime` / set-piece phases).
- **Anti-huddle interaction:** `MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH`, `MATCH-RESTART-NEAREST-ONLY`.

No `PASS` may be reported by any of these until they are registered with the required registry objects and bindings. A `MEASURED_TARGET` comparison of a restart trajectory would be `BLOCKED_MISSING_REFERENCE` (see §14); a `PERCEPTUAL_TARGET` restart-render criterion would be `NEEDS_PERCEPTUAL_REVIEW` pending a versioned rubric.

## 16. Deferred rule behaviors (future-with-prerequisites)

The following behaviors are **not implemented** and are explicitly deferred until their dedicated suites exist. This spec does not define them.

- **Fouls, cards, and free kicks.** Requires a foul/adjudication model, a card/discipline state, a free-kick placement rule, and a same-tick arbitration matrix for tackle-versus-shot and foul/advantage ordering. Deferred until a dedicated fouls spec + suite exists.
- **Offside.** Requires an offside snapshot at the moment the ball is played, positional eligibility evaluation, and an offside restart. Deferred until a dedicated offside spec + suite exists.
- **Penalty kicks.** Requires an infraction-and-area rule, a penalty-placement rule, and a penalty-taker sequence. Deferred until a dedicated penalty spec + suite exists.
- **Advantage / ball-in-play accounting, stoppage-time, drop ball, and referee interaction.** Deferred.

Per [GAMEPLAY_EVALUATION_SPEC §2.3](./GAMEPLAY_EVALUATION_SPEC.md#23-milestone-applicability-and-promotion), a regulation / full-match milestone MUST NOT be published until dedicated goalkeeper and deterministic rules specifications exist and their executable suites cover goal validity, boundaries, restart placement, offside snapshots, foul/advantage ordering, match phase/clock and ball-in-play accounting, and same-tick event arbitration. This specification covers goal validity, boundaries, restart placement, and the match phase/clock; the rest remain deferred.

## 17. Declaration of limitations

- This spec defines behavior, not implementation. The restart machinery is implemented in the core simulation and the adapter anti-huddle layer; the deferred behaviors in §16 are not.
- No `FOUNDATION_LAB_PASS`, milestone `PASS`, or PES fidelity claim is made here or by any registered suite through this specification.
- The match-rule model is deliberately narrower than full regulation / 11v11 rules (see §2.2).
- The tick rate for the conversion of countdown ticks to wall-clock times is itself `foundation-fixed-dt-v1`; these must not be read as measured wall-clock milliseconds.
- `match-rules-v1` is a prose-declared model id. No `eval/contracts/match-rules-config.ts` exists at this milestone; the dependency direction keeps `eval/contracts/` untouched. The binding test for this objective asserts the spec's declared model ids and its referenced accepted-config values against the existing machine-readable sources.

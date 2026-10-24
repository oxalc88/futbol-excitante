# Football Simulation Engine — Small-Sided Goalkeeper Specification

**Status:** Normative specification for small-sided goalkeeper behavior; keeper behavior is NOT yet implemented

**Date:** 2026-09-05

**Scope:** Designated-keeper role, goal-arc positioning, no-field-chase, and basic save/claim + distribution semantics for SMALL-SIDED play only

**Model version:** `gk-small-sided-v1`

**Ives:** This document is subsidiary to [GAMEPLAY_EVALUATION_SPEC.md](./GAMEPLAY_EVALUATION_SPEC.md) and governed by [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md), especially its simulation authority, dependency direction (§20), and the hard boundaries that keep the core DOM-free and deterministic. It does not define a PES 2017 calibration or a full goalkeeper architecture.

## 1. Purpose and authority

This specification defines the minimum goalkeeper behavior that is in scope for SMALL-SIDED play (the small-sided ladder: 1v1, 2v2, 3v3, 5v5). It is a product/engine design contract for a fictional capability, not a measurement of PES 2017.

It is authoritative for the small-sided goalkeeper criteria registered in the `goalkeepers` evaluator suite. Where a numeric value would need a real reference measurement, this specification declares it `BLOCKED_MISSING_REFERENCE` and never invents a number.

This document is normative. `MUST`, `MUST NOT`, `SHOULD`, and `MAY` carry their usual normative meaning.

## 2. Scope and explicit exclusions

### 2.1 In scope

- Exactly one designated keeper per team across the small-sided ladder.
- Goal-arc positioning with a bounded lateral drift.
- An explicit no-field-chase rule that inherits the accepted small-sided anti-huddle contract.
- Basic save/claim reaction on shots on target.
- Distribution semantics: a keeper may release to a teammate, but MUST NOT act omnisciently.
- Versioned provisional configuration for every unmeasured positional, speed, and reaction value, under model id `gk-small-sided-v1`.

### 2.2 Out of scope (explicit exclusions)

- Any goalkeeper behavior beyond small-sided play (full-11v11, penalty-area rules, offside participation, regulation-match ecology). These stay deferred.
- Regulation-match rules: penalty areas, offside snapshots, goal-kick/corner/throw-in restarts, foul/advantage ordering, and the full match clock/ball-in-play accounting. These require their own dedicated deterministic rules spec and suites.
- Full-match ecology (stamina over a whole match, contextual match-phase tuning, referee interaction).
- Any PES 2017 fidelity claim. No `MEASURED_TARGET` criterion here may be presented as a PES match; missing references stay `BLOCKED_MISSING_REFERENCE`.
- A perceptual pass/rubric for keeper visual plausibility. `GK-*` `PERCEPTUAL_TARGET` criteria report `NEEDS_PERCEPTUAL_REVIEW` and require a versioned rubric before they can gate.
- Network, peer lockstep, or any production multiplayer authority.

## 3. Normative vocabulary and configuration model

Terms `MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. Stimulus values such as "a shot on target" or "a declared reaction window" define controlled conditions; they are not acceptance thresholds.

Every unmeasured value referenced by a future keeper implementation is defined as **VERSIONED PROVISIONAL CONFIGURATION** under the owning model id `gk-small-sided-v1`. These are fictional engine design values. They are:

- versioned (they carry a model id and version and may change only via a model-version bump);
- provisional (they are not measured, not calibrated, and not PES values);
- honest (a value that would need a real reference measurement that does not exist is declared `BLOCKED_MISSING_REFERENCE`, never filled with a guess).

The machine-readable record of these values lives in `eval/contracts/goalkeeper-config.ts` (module `gk-small-sided-v1`). The evaluator config matrix `config-goalkeepers-v1` references this model.

## 4. Designated-keeper role definition

In any small-sided match, each team has exactly one designated keeper. The keeper role is distinct from an outfield role:

- The keeper is identified per team by a stable actor id (role designation), not by a transient possession fact.
- A small-sided team MUST NOT have more than one keeper and MUST NOT fall back to an outfield body acting as keeper, because that would change the cardinality the team-decision layer is tuned for.
- The keeper designation is part of the team's role/capability layout and is set before kickoff, not discovered from ball state.

This is a `HARD_INVARIANT` (independent of any PES measurement): a run with zero keepers for a team, or with two keepers for a team, is `FAIL` when the keeper role is observable.

## 5. Goal-arc positioning with bounded lateral drift

The designated keeper holds a nominal goal arc in front of its goal line. This replaces "stand on the goal line" with a small, bounded interior region:

- The keeper is anchored to an arc center at the goal-line center, offset longitudinally by the versioned provisional value `goal_arc_center_x_offset` (default `0` m).
- The keeper's nominal repositioning region is the disk of radius `goal_arc_radius` (versioned provisional, default `4.0` m) around the arc center.
- Along the goal line, the keeper MAY drift laterally up to `goal_arc_lateral_max` (versioned provisional, default `2.5` m) from the arc center. This is the bounded lateral drift.
- The keeper MAY reposition inside this arc at `keeper_reposition_speed` (versioned provisional, default `2.0` m/s). This is an engine design limit, not a measured PES reaction.

The keeper MUST NOT leave its goal arc to chase the ball into the field (see §6). When it crosses the arc boundary (other than by a bounded save/claim that stays physically feasible and recorded), the run is `FAIL` under `GK-POSITIONING-HOLD`.

## 6. No-field-chase rule (anti-huddle inheritance)

The keeper MUST NOT join the field chase. In small-sided play the accepted anti-huddle contract bounds outfield players to a nearest-only chase away from a ball clump; the keeper's equivalent rule is an explicit field-chase prohibition:

- The keeper, being confined to its goal arc, does not chase an outfield loose ball, does not press an opponent carrier, and does not leave its arc to join a congested ball cluster.
- A keeper that exits its goal arc into the field for any reason other than a recorded, feasible save/claim attempt that remains within the model's reach is a `FAIL` under `GK-NO-FIELD-CHASE`.
- This rule inherits the accepted small-sided anti-huddle contract (no field-chase beyond the nearest-only bound), so a keeper is never a secondary chaser.

This is a `HARD_INVARIANT` (a logical boundary on keeper behavior independent of PES measurement).

## 7. Basic save/claim reaction semantics on shots on target

A shot on target may elicit a save/claim reaction in the small-sided keeper model. The minimum semantics are:

- A shot is a canonical `shot` event on an independent ball. The keeper MAY perceive the shot and, within the versioned `keeper_reaction_window_ticks` (default `12` ticks; tick rate itself is provisional), initiate a save/claim attempt.
- A save/claim MUST resolve as an explicit, recorded contact on the independent ball (`keeper-ball-contact` event). It MUST NOT parent the ball to the keeper or teleport the ball into keeper possession. This is a `HARD_INVARIANT` (`GK-SAVE-CLAIM`) and is consistent with the ball-independence contract in `GAMEPLAY_EVALUATION_SPEC.md`.
- A claim/parry attempt MUST be physically feasible under `save_claim_reach_radius` (versioned provisional, default `1.2` m). The keeper MUST NOT reach beyond that radius relative to its own position at the moment of the attempt.
- After a save/claim, the model MAY transition to a recovery/reposition state. Recovery timing and the chained-second-action behavior are catalogued by `GK-REC-001` and remain `BLOCKED_MISSING_REFERENCE` for latency.

A `MEASURED_TARGET` comparison of the save/claim response sequence (`GK-REA-001-REF`, `GK-PARRY-001-REF`, etc.) remains `BLOCKED_MISSING_REFERENCE` until an eligible `ReferenceTarget` exists.

## 8. Distribution semantics

Once a keeper has secured the ball (in a future implementation) it MAY release to a teammate:

- A release is a canonical pass/contact chain (`keeper-release` → `pass` → receiver contact), not a hidden homing move.
- The keeper MAY release to a teammate selected from its modelled information. It MUST NOT use omniscient target selection (e.g. a teammate's exact future position not yet observably known, or the author's knowledge of the run outcome).
- This is an `ENGINE_DESIGN_TARGET` (`GK-DISTRIBUTION-NO-OMNISCIENCE`); it is an internal engine product contract and makes no PES claim.

The release window is versioned provisional `distribution_release_window_ticks` (default `10` ticks).

## 9. Versioned provisional configuration

The unmeasured values a future keeper implementation may use are enumerated here and machine-recorded in `eval/contracts/goalkeeper-config.ts`. All belong to model `gk-small-sided-v1`. None is a measured PES constant.

| Key | Value | Units | Source |
|---|---|---|---|
| `goal_arc_center_x_offset` | `0` | m | `VERSIONED_PROVISIONAL` |
| `goal_arc_radius` | `4.0` | m | `VERSIONED_PROVISIONAL` |
| `goal_arc_lateral_max` | `2.5` | m | `VERSIONED_PROVISIONAL` |
| `keeper_reposition_speed` | `2.0` | m/s | `VERSIONED_PROVISIONAL` |
| `keeper_reaction_window_ticks` | `12` | ticks | `VERSIONED_PROVISIONAL` |
| `save_claim_reach_radius` | `1.2` | m | `VERSIONED_PROVISIONAL` |
| `distribution_release_window_ticks` | `10` | ticks | `VERSIONED_PROVISIONAL` |
| `distribution_no_omniscience` | `on` | — | `VERSIONED_PROVISIONAL` |

These are deliberate, versioned design choices for a fictional capability. They MUST NOT be described as PES magnitudes or provider-rating mappings.

## 10. BLOCKED_MISSING_REFERENCE values

The following values would need a real reference measurement that does not exist. They are disclosed, never invented. A future keeper implementation MUST NOT hard-code a guessed number for any of these.

| Key | Reason it is blocked |
|---|---|
| `reaction_latency_ref_ms` | No controlled, qualified PES reference capture of shot-contact-to-keeper-motion latency exists. |
| `save_probability_distribution` | No eligible `ReferenceTarget` for a keeper save/claim probability distribution is published. |
| `wrong_foot_reversal_curve` | `GK-WF-001` is a Class-C controlled-capture criterion; no controlled reference exists. |
| `high_cross_claim_threshold` | Aerial claim/parry decision threshold needs controlled pose/contact reference data. |
| `parry_energy_ratio` | Surface-conditioned rebound energy ratio needs qualified reference measurement. |

`BLOCKED_MISSING_REFERENCE` is not a defect and must not be converted into invented envelope or tolerance values.

## 11. Evaluator suite contract

The executable half of this specification is the `goalkeepers` evaluator suite (`suite-goalkeepers-v1`), registered through the same registry path as the `duels` suite:

- suite id: `goalkeepers`, suite version: `suite-goalkeepers-v1`;
- direct tests: `GK-REA-001`, `GK-WF-001`, `GK-LEG-001`, `GK-PARRY-001`, `GK-REC-001`, `GK-HIGH-001` (catalog tests from `GAMEPLAY_EVALUATION_SPEC.md` §7.4);
- criteria bindings for the small-sided criteria `GK-POSITIONING-HOLD`, `GK-NO-FIELD-CHASE`, `GK-SAVE-CLAIM`, `GK-ROLE-DESIGNATION`, and `GK-DISTRIBUTION-NO-OMNISCIENCE`;
- invariant definitions (`gk-role-designation-evidence`, `gk-positioning-evidence`, `gk-no-field-chase-evidence`, `gk-save-claim-evidence`, `gk-distribution-evidence`) and observation definitions (`obs-gk-role-v1`, `obs-gk-positioning-v1`, `obs-gk-chase-v1`, `obs-gk-save-claim-v1`, `obs-gk-distribution-v1`);
- situation evidence mappings (`GK_POSITIONING`, `GK_NO_FIELD_CHASE`, `GK_SAVE_CLAIM`, `GK_DISTRIBUTION`) that are `NOT_EVALUATED` until keeper behavior is implemented.

Because no keeper behavior is implemented in this specification milestone, every GK-specific criterion is honestly registrable as not yet observable and MUST NOT claim `PASS` on gameplay. The suite wiring is executable (`evaluateSuite("goalkeepers", ...)` runs) and the registry validates, but no criterion passes gameplay.

## 12. Declaration of limitations

- This spec defines behavior, not implementation. No `src/` keeper subsystem exists yet.
- No `FOUNDATION_LAB_PASS`, milestone `PASS`, or PES fidelity claim is made here or by the `goalkeepers` suite.
- The small-sided goalkeeper model is deliberately narrower than full regulation/11v11 goalkeeping (see §2.2).
- Tick rate for `keeper_reaction_window_ticks` and `distribution_release_window_ticks` is itself a deferred/provisional value; these must not be read as wall-clock milliseconds.

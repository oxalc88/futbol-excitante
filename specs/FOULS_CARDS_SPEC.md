# Football Simulation Engine — Fouls and Cards Specification (Draft)

**Status:** Normative *draft* specification for small-sided fouls / cards semantics. NO foul, card, advantage, or free-kick behavior is implemented in this milestone. This document names what a foul IS in this engine and declares the versioned provisional parameters and named-but-not-registered adjudicating criteria a future `fouls` suite may register. The engine has NO foul machinery yet.

**Date:** 2026-09-07

**Scope:** The faithful grounding of a foul in the accepted duel/tackle machinery (what a foul IS — the man-not-ball tackle contact), the versioned provisional fouls/card parameters, the named-but-NOT-registered adjudicating criteria (the RULES-SPEC-DRAFT pattern), the deferred items (offside and penalty kicks stay regulation-only with no existence claim), and the BLOCKED_MISSING_REFERENCE disclosures. It is SPEC ONLY: zero `src/`, `eval/`, `gauntlet/`, or existing-spec change; a binding test pins quoted constants to machine sources.

**Model version:** `fouls-v1`

**Ives:** This document is subsidiary to [GAMEPLAY_EVALUATION_SPEC.md](./GAMEPLAY_EVALUATION_SPEC.md) and [MATCH_RULES_SPEC.md](./MATCH_RULES_SPEC.md) (which defers fouls/cards in its §16), and governed by [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md), especially its simulation authority, dependency direction (§20), and the hard boundaries that keep the core DOM-free and deterministic. It does not define a PES 2017 calibration, a full regulation architecture, or a full-match ecology.

## 1. Purpose and authority

This specification defines, as a **design contract** for a fictional capability, the semantics by which a foul would be recognized in the accepted engine. It is not a measurement of PES 2017 and it does **not** claim any foul behavior exists. It is authoritative for a future `fouls` evaluator suite's criteria. Where a numeric value would need a real reference measurement, this specification declares it `BLOCKED_MISSING_REFERENCE` and never invents it.

The center of the document is a single honest answer to the question *"what is a foul in this engine?"*. The accepted machinery has a duel/tackle system and a player-player-contact system; the foul is grounded **only** in what those already produce. Nothing new is invented.

This document is normative. `MUST`, `MUST NOT`, `SHOULD`, and `MAY` carry their usual normative meaning.

## 2. Scope and explicit exclusions

### 2.1 In scope

- The **engine-grounded definition of a foul**: a defensive-tackle contact that reaches an opposing player but not the independent ball in the same active-window contact.
- The **clean-tackle complement**: what is NOT a foul (a tackle that reaches the ball, and a symmetric shoulder-to-shoulder player contact).
- **Versioned provisional configuration** for every unmeasured fouls/cards value, under model id `fouls-v1`, referencing accepted config where it overlaps.
- The **adjudicating criteria**
  names (`FOUL-DETECT`, `CARD-ISSUED`, `ADVANTAGE-PLAYED`, `FOUL-CLEAN-TACKLE`, `FREE-KICK-AWARD`) specified for a future suite but **NOT registered**.
- **BLOCKED_MISSING_REFERENCE** disclosures for every value needing a reference target that does not exist.
- The **deferred set-piece consequence** of a foul (a free kick), which references the accepted restart machinery rather than inventing a new one.

### 2.2 Out of scope (explicit exclusions)

- **No foul/card/advantage/free-kick implementation.** This spec names future semantics; the engine has no foul machinery. No `src/`, `eval/`, `gauntlet/` or existing-spec change accompanies it.
- **Offside** and **penalty kicks** stay regulation-only and are **conditionally deferred** (see §16). Neither is specified here beyond confirmation that they remain deferred with no existence claim.
- **Full-match ecology / referee** interaction, stoppage-time, ball-in-play accounting, and a full regulation ruleset.
- **Any PES 2017 fidelity claim.** `fouls-v1` values are `VERSIONED_PROVISIONAL`, never PES magnitudes; missing references stay `BLOCKED_MISSING_REFERENCE`.
- **A perceptual pass/rubric** for card-display or foul-render visual plausibility. A `PERCEPTUAL_TARGET` criterion here would report `NEEDS_PERCEPTUAL_REVIEW` and require a versioned rubric before it could gate.
- **Network, peer lockstep**, or any production multiplayer authority.
- **A same-tick event arbitration matrix** for foul/advantage, tackle-versus-shot, or goal/out-of-play ordering. Per [TECHNICAL_SPEC §6.2](./TECHNICAL_SPEC.md#62-versioned-provisional-scheduler), these are not defined here and must be defined before the affected families become milestone-required.

## 3. Normative vocabulary and configuration model

Terms `MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. Stimulus values such as "an active-window tackle contact" or "a man-not-ball contact" define controlled conditions; they are not acceptance thresholds.

Every unmeasured value referenced by a future fouls implementation is defined as **VERSIONED PROVISIONAL CONFIGURATION**. Two kinds of value exist:

1. Values owned by **this specification** under model id `fouls-v1`. They are:
   - versioned (they carry a model id and version and may change only via a model-version bump);
   - provisional (they are not measured, not calibrated, and not PES values);
   - honest (a value that would need a real reference measurement that does not exist is declared `BLOCKED_MISSING_REFERENCE`, never filled with a guess).
2. Values already owned by an **accepted model** that this spec references rather than re-declares. These include the tackle geometry (`foundation-tackle-v1`), the CPU tackle decision thresholds (`foundation-cpu-tackle-v1`), the player-player contact geometry (`foundation-player-contact-v1`), the immutable versioned foundation config (`foundation-config-v1`), the fixed tick (`foundation-fixed-dt-v1`), the ball physics (`foundation-ball-v1`), the match-rule restart machinery (`match-rules-v1`), the anti-huddle restart contract (`anti-huddle-v1`), and the small-sided keeper (`gk-small-sided-v1`).

The machine-readable record of the accepted, imported values lives in the corresponding config modules (`src/simulation/config/foundation.ts`, `src/adapters/input-browser/cpu-adapter.ts`, `eval/contracts/goalkeeper-config.ts`). The `fouls-v1` value table (§9) is declared here in prose only; because the hard dependency direction keeps `eval/contracts/` untouched by this specification milestone, there is **no** `eval/contracts/fouls-config.ts` yet. A future milestone may materialize one under the same model id without changing any value semantics.

## 4. The duel/tackle machinery the foul grounds on (accepted, immutable)

A foul in this engine can only be grounded in behavior the accepted engine already produces. The relevant accepted machinery is the defensive tackle system (`foundation-tackle-v1`, `src/simulation/contacts/tackle-system.ts`) and the generic player-player contact system (`foundation-player-contact-v1`, `src/simulation/player-contact/player-contact-system.ts`).

### 4.1 Tackle action lifecycle (accepted)

A defensive tackle is an ordered commit driven by an explicit input bit (`STANDING_TACKLE_BIT` / `SLIDE_TACKLE_BIT`):

```
prepare → active → recover → released
```

Contact with the ball or an opposing player is geometrically eligible ONLY inside the explicit active window declared by `foundation-tackle-v1` and only within that attempt's finite reach (`standingReach` / `slideReach`) and the forward cone (`contactConeMinCos`). There is no permanent or omnidirectional tackle collider.

Per attempt the system resolves exactly one allowed contact. In its active window it tests:

- `ballReachable` — the ball is within the reach and forward cone;
- `opponent` — the **nearest opposing player** within the same finite reach and cone (ties broken by ascending playerId).

### 4.2 The contact events the foul reads (accepted)

Two event kinds carry the foul-relevant facts:

- **`player-player-contact`** — emitted by the tackle system with `contactType` ∈ `{"standing-tackle", "slide-tackle"}`, `tacklePhase: "active"`, `ballReachable`, `duelWon`, `planarDistance`, `reach`, `committedDirection`, and `activeWindowStartTick` / `activeWindowEndTick`. Also emitted by the generic player-contact system with `contactType: "player-player"` (symmetric shoulder contact, see §5.2).
- **`player-ball-contact`** — emitted when the tackle actually reaches the ball (`ballReachable === true`), carrying the before/after ball snapshot; its event id becomes the ball's `lastTouchRef`.

The `duelWon` flag is defined in the accepted system as `duelWon = ballReachable` for a contact that also reaches an opponent. So the four realizable tackle outcomes are:

| # | ballReachable | opponent reached | duelWon | Event produced | Engine meaning |
|---|---|---|---|---|---|
| 1 | true | false | — | `player-ball-contact` only | clean ball tackle (played the ball) |
| 2 | true | true | true | `player-player-contact` + `player-ball-contact` | duel won (won ball, separated carrier) |
| 3 | false | true | false | `player-player-contact` only | **man-not-ball contact** (foul candidate) |
| 4 | false | false | — | none | no contact |

Outcome **#3** is the engine's ground-truth candidate for a foul. Outcomes #1 and #2 are clean. Outcome #4 is a miss.

## 5. What a foul IS in this engine

### 5.1 The foul definition (engine-grounded)

A **foul** is a defensive-tackle active-window contact produced by the accepted tackle system in which the tackler reaches an opposing player but does **not** reach the independent ball in that same single allowed contact. Formally:

> A tackle case is a **foul candidate** when it emits a `player-player-contact` event with `contactType` ∈ {`standing-tackle`, `slide-tackle`}, `tacklePhase === "active"`, and `duelWon === false` — equivalently `ballReachable === false`. The ball remains an independent 3D entity; it is never parented, teleported, or assigned as possession by this recognizer.

This is **exactly** the accepted #3 outcome above. It does not add a new collider, a new event, a new action, or any new contact rule: a foul candidate is a **read** of a fact the engine already produces. This is the discipline that keeps the engine free of invented foul behavior and keeps the ball independent.

The reason a man-not-ball contact is the grounded candidate rather than, say, "any contact" is that the accepted tackle system already encodes the legal/illegal boundary geographically: contact eligibility is confined to the finite reach and forward cone; a tackle that reaches the man and not the ball is the only realizable tackle contact that leaves the ball uncontrolled while the man is struck.

### 5.2 What is NOT a foul (clean complement)

- A tackle that reaches the ball (outcomes #1 and #2: `ballReachable === true`) is a clean tackle / won duel. It is **not** a foul candidate.
- A **symmetric shoulder-to-shoulder contact** (`player-player-contact` with `contactType === "player-player"`) from the generic player-contact system is a legal parallel contact conforming to `PHY-SHLD-001-CONT`: both players receive equal positional and velocity correction, there is no possession teleport, no stat-only instant winner, and the ball is never modified by that system. It does **not** by itself constitute a foul. The foul domain is confined to the tackle system's man-not-ball contact; the engine has no mechanism that would turn a symmetric shoulder contact into an infraction.
- A tackle that reaches neither the man nor the ball (outcome #4) is a miss, not a foul.

### 5.3 Carrier identity (which contacted player is the fouled player)

The accepted engine distinguishes a ball-carrier from a bystander at the decision layer via `foundation-cpu-tackle-v1.carrierContestDistance` (2.5 m, `VERSIONED_PROVISIONAL`) — the planar distance within which the nearest opposing player is treated as the ball's carrier for a contested challenge. A future `FOUL-DETECT` criterion MAY use that value to assert that the contacted player is the carrier (the fouled player) rather than a decoy. This is **named as a criterion input**, not implemented here; the tackle event does not currently serialize the carrier-elapsed distance, so carrier identity remains a named future consideration, not a registered fact.

## 6. Advantage semantics (named, NOT implemented)

When a foul candidate is recognized, the referee (in a future implementation) decides whether to play advantage. The engine has **no** advantage machinery. This spec names:

- an **advantage window**: the tick budget within which the fouled team may either be judged to retain a playable advantage (and the pending whistle/card is withheld) or lose it (and the foul is then called).
- the advantage window is a `fouls-v1` `VERSIONED_PROVISIONAL` value (`advantage_window_ticks`, see §9). It is not a measured PES latency.

Advantage is a **named criterion** (`ADVANTAGE-PLAYED`, §10) and is deliberately **NOT registered**. A same-tick arbitration matrix for "the foul occurred but the fouled team kept the ball" is deferred per §2.2 and [TECHNICAL_SPEC §6.2](./TECHNICAL_SPEC.md#62-versioned-provisional-scheduler).

## 7. Card / disciplinary semantics (named, NOT implemented)

A card is a referee consequence of a recognized foul. The engine has **no** card/discipline state. This spec names:

- **card accumulation** counts per player per match: a versioned provisional number of accumulated fouls before a caution (yellow) and before an expulsion (red). The card thresholds are `fouls-v1` `VERSIONED_PROVISIONAL` values (`fouls_yellow_accumulation_count`, `fouls_red_accumulation_count`, `foul_card_direct_red_severity_threshold`, see §9).
- an optional **contact-severity** discriminator: a normalized value that would distinguish a hard/late challenge (direct red candidate) from a routine one. It is `fouls-v1` `VERSIONED_PROVISIONAL` and is NOT a PES magnitude.

The card itself is a **named criterion** (`CARD-ISSUED`, §10) and is deliberately **NOT registered**. No card event exists.

## 8. Set-piece consequence of a foul (free kick, deferred, references accepted machinery)

A foul that is called (advantage not played) would, in a future implementation, award a free kick to the fouled team. **No free-kick machinery exists** and this spec does not invent one. The consequence is stated as a deferred item that references the **accepted restart machinery** rather than defining a new system:

- The free kick would follow the accepted restart-WINDOW pattern in `MATCH_RULES_SPEC.md` §6–§8: a countdown-to-zero (`match-rules-v1` `default_*_countdown` shape) in a non-`playing` phase, an `apply*` at countdown zero that re-places the ball and the taker, a return to `playing`, and the freeze / first-touch / unfreeze interaction of the accepted `anti-huddle-v1` contract (see [MATCH_RULES_SPEC §12](./MATCH_RULES_SPEC.md#12-freeze--unfreeze-interaction-with-the-accepted-anti-huddle-contract)).
- The free-kick placement (a restart spot) and the kick serve would be new `match-rules`-kind semantics; they are **not defined** here and stay deferred until a dedicated free-kick spec + suite exists.

This is an honest forward-reference: the fouls spec names the free kick as a consequence and points at the machinery it would reuse, but does NOT claim a free-kick restart exists or introduce a competing restart kind.

## 9. Versioned provisional configuration (`fouls-v1`)

The unmeasured values a future fouls implementation may reference are enumerated here. All belong to model `fouls-v1` unless noted otherwise. None is a measured PES constant. The accepted values referenced (rather than re-declared) are machine-recorded in the corresponding modules.

### 9.1 `fouls-v1` owned values

| Key | Value | Units | Source |
|---|---|---|---|
| `foul_detect_contact_severity_threshold` | `0.75` | — | `VERSIONED_PROVISIONAL` |
| `fouls_yellow_accumulation_count` | `2` | fouls | `VERSIONED_PROVISIONAL` |
| `fouls_red_accumulation_count` | `5` | fouls | `VERSIONED_PROVISIONAL` |
| `foul_card_direct_red_severity_threshold` | `0.85` | — | `VERSIONED_PROVISIONAL` |
| `advantage_window_ticks` | `24` | ticks | `VERSIONED_PROVISIONAL` |
| `foul_caution_pending_ticks` | `12` | ticks | `VERSIONED_PROVISIONAL` |
| `foul_ball_carrier_contest_distance` | `2.5` | m | `foundation-cpu-tackle-v1` (referenced) |

These are deliberate, versioned design choices for a fictional capability. They MUST NOT be described as PES magnitudes or provider-rating mappings.

### 9.2 Referenced accepted config (not re-declared)

| Id | Values this spec reads | Module |
|---|---|---|
| `foundation-tackle-v1` | standingReach `1.6` m, slideReach `2.8` m, standingPrepareTicks `2`, standingActiveTicks `4`, standingRecoverTicks `12`, slidePrepareTicks `3`, slideActiveTicks `9`, slideRecoverTicks `26`, activeSpeedFactor `0.8`, slideLungeSpeed `5.0` m/s, ballDeflectionSpeed `7.5` m/s, ballDeflectionLift `0.06`, carrierImpulseSpeed `1.4` m/s, contactConeMinCos `0` | `src/simulation/config/foundation.ts` |
| `foundation-cpu-tackle-v1` | carrierContestDistance `2.5` m, reactionTicks `3`, commitMargin `0.3` m | `src/simulation/config/foundation.ts` |
| `foundation-player-contact-v1` | playerRadius `0.25` m, separationStiffness `0.5`, velocityDampingNormal `0.3` | `src/simulation/config/foundation.ts` |
| `foundation-contact-v1` | contactRadius `1.2` m | `src/simulation/config/foundation.ts` |
| `foundation-config-v1` | immutable versioned foundation config (fixedDt, prng, encoding, hash, locomotion, ball, contact, pass, loftedPass, shot, closeControl, secondTouch, playerContact, goal) | `src/simulation/config/foundation.ts` |
| `foundation-fixed-dt-v1` | fixed tick 1/60 s (60 ticks per second) | `src/simulation/config/foundation.ts` |
| `match-rules-v1` | restart-window countdown-to-zero + apply pattern (§8), timer-freeze during non-`playing` phases | `specs/MATCH_RULES_SPEC.md` |
| `anti-huddle-v1` | RESTART_HOLD_MIN_TICKS `2`, KICKOFF_FREEZE_HOME_TOLERANCE `0.75` m, CHASE_NEAREST_HOME_TOLERANCE `0.75` m | `src/adapters/input-browser/cpu-adapter.ts` |
| `gk-small-sided-v1` | keeper role model id; restart-taker exclusion / no-field-chase | `eval/contracts/goalkeeper-config.ts` |

## 10. Adjudicating telemetry / suite criteria (named, NOT registered)

The following criteria would adjudicate the fouls semantics in this specification. They are **named here for intent only** and are **NOT registered** in any evaluator suite: no evaluator, oracle, invariant-definition, observation-definition, binding, or scenario change accompanies this specification milestone. A future `fouls` suite milestone may register them once the corresponding executable material exists.

- **Foul detection:** `FOUL-DETECT` (a `player-player-contact` with `contactType` ∈ {`standing-tackle`, `slide-tackle`}, `tacklePhase === "active"`, and `duelWon === false` is recognized as a foul candidate; a clean tackle or a shoulder-to-shoulder contact is not).
- **Clean-tackle complement:** `FOUL-CLEAN-TACKLE` (a tackle that reaches the ball — `ballReachable === true` — is not a foul).
- **Card issuing:** `CARD-ISSUED` (given a recognized foul and the `fouls-v1` accumulation / severity thresholds, the correct caution / expulsion is awarded to the offending player).
- **Advantage:** `ADVANTAGE-PLAYED` (play continues when the fouled team retains a playable advantage within `advantage_window_ticks`; the pending whistle/card is withheld).
- **Free-kick award:** `FREE-KICK-AWARD` (the set-piece consequence of a called foul, grounded in the accepted restart machinery per §8).

No `PASS` may be reported by any of these until they are registered with the required registry objects and bindings. A `MEASURED_TARGET` comparison of a foul/card sequence would be `BLOCKED_MISSING_REFERENCE` (see §11); a `PERCEPTUAL_TARGET` foul-render or card-display criterion would be `NEEDS_PERCEPTUAL_REVIEW` pending a versioned rubric.

## 11. BLOCKED_MISSING_REFERENCE values

The following values would need a real reference measurement that does not exist. They are disclosed, never invented. A future fouls implementation MUST NOT hard-code a guessed number for any of these.

| Key | Reason it is blocked |
|---|---|
| `foul_card_threshold_ref` | No controlled, qualified PES reference for the accumulated-foul counts at which a caution / expulsion is shown. |
| `foul_severity_distribution_ref` | No eligible `ReferenceTarget` for a foul-contact-severity distribution. |
| `foul_ball_carrier_identity_ref` | No measured PES reference for the man-versus-ball discrimination ("playing the ball" vs "contacting the man") at PES fidelity. |
| `advantage_window_ref_ms` | No controlled PES capture of the foul-to-advantage-decision latency exists. |
| `free_kick_trajectory_ref` | No qualified PES reference of a free-kick launch profile exists (the free-kick set-piece is itself deferred, §8). |
| `disciplinary_scale_ref` | No qualified PES reference of the disciplinary scale (direct red vs cumulative yellow thresholds) exists. |
| `card_display_visual_ref` | No perceptual/reference target for card-display visuals exists; a visual card criterion would be `NEEDS_PERCEPTUAL_REVIEW` pending a versioned rubric. |

`BLOCKED_MISSING_REFERENCE` is not a defect and must not be converted into invented envelope or tolerance values.

## 12. Keeper interaction

The accepted designated small-sided keeper (`gk-small-sided-v1`) is excluded from restart-taker selection and never leaves its goal arc to take a restart (see [MATCH_RULES_SPEC §12.1](./MATCH_RULES_SPEC.md#121-keeper-interaction)). A free kick, when a future suite makes it real, MUST inherit that exclusion: the keeper is not a free-kick taker and is never a designation that drags it out of its arc. This is a forward reference, not an implemented behavior.

## 13. Declaration of limitations

- This spec defines behavior, not implementation. No `src/` foul, card, advantage, or free-kick subsystem exists yet.
- No `FOUNDATION_LAB_PASS`, milestone `PASS`, or PES fidelity claim is made here or by any registered suite through this specification.
- The fouls/cards model is deliberately narrower than full regulation / 11v11 rules (see §2.2).
- The tick rate for `advantage_window_ticks` and `foul_caution_pending_ticks` is itself `foundation-fixed-dt-v1`; these must not be read as measured wall-clock milliseconds.
- `fouls-v1` is a prose-declared model id. No `eval/contracts/fouls-config.ts` exists at this milestone; the dependency direction keeps `eval/contracts/` untouched. The binding test for this objective asserts the spec's declared model ids and its referenced accepted-config values against the existing machine-readable sources, and asserts the named adjudicating criteria are NOT registered in the evaluator registry.

## 14. Relation to GAMEPLAY_EVALUATION_SPEC

The foul definition is grounded in the accepted duels/tackles tests of [GAMEPLAY_EVALUATION_SPEC.md](./GAMEPLAY_EVALUATION_SPEC.md) §7.2 and §7.4: `PHY-SHLD-001-CONT` (symmetric shoulder contact, legal), `TACK-ST-001-PHASE` and `TACK-SL-001-PHASE` (ordered tackle phases; recovery prevents a permanent collider), and `TACK-ANG-001-CAUSAL` ("no PES success/foul threshold may be invented"). `TACK-ST-001-REG` and `TACK-SL-001-REG` name "foul" as a regression dimension to preserve; this spec provides the grounded definition those regression criteria would later bind to.

## 15. Deferred rule behaviors (future-with-prerequisites)

The following behaviors are **not implemented** and are explicitly deferred until their dedicated suites exist. This spec does not define them.

- **Offside.** Requires an offside snapshot at the moment the ball is played, positional eligibility evaluation, and an offside restart. Deferred until a dedicated offside spec + suite exists. It stays **regulation-only**: this fouls spec makes no offside existence claim.
- **Penalty kicks.** Requires an infraction-and-area rule, a penalty-placement rule, and a penalty-taker sequence. Deferred until a dedicated penalty spec + suite exists. It stays **regulation-only**: this fouls spec makes no penalty existence claim.
- **Free-kick set piece.** Requires its own restart variant (placement, serve, taker sequence) and a same-tick arbitration matrix; it is named in §8 as referencing the accepted restart machinery but is not specified here.
- **Advantage ordering and ball-in-play accounting, stoppage-time, drop ball, and referee interaction.** Deferred.

Per [GAMEPLAY_EVALUATION_SPEC §2.3](./GAMEPLAY_EVALUATION_SPEC.md#23-milestone-applicability-and-promotion), a regulation / full-match milestone MUST NOT be published until dedicated goalkeeper and deterministic rules specifications exist and their executable suites cover goal validity, boundaries, restart placement, offside snapshots, foul/advantage ordering, match phase/clock and ball-in-play accounting, and same-tick event arbitration. This fouls spec covers the engine-grounded foul definition and its named-but-unregistered criteria; the rest remain deferred.

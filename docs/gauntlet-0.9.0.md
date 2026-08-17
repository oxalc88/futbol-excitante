# Gauntlet 0.9.0 — milestone-aware playtesting

Gauntlet 0.9.0 extends objective-level acceptance with repository-first observability and milestone-level product/playtest evaluation. It does not change the canonical principle that deterministic tooling establishes facts while the independent critic judges quality against the applicable reference bar.

## Remote durability

A finalized objective is now published before orchestration advances past it. The final acceptance commit is pushed once, the configured upstream is fetched, and the exact acceptance commit must be contained by the remote branch before the next objective is delegated or an exhausted horizon is replanned.

The candidate snapshot remains a separate provenance commit and is not pushed independently. Remote durability is a continuation/observability invariant, not a gameplay acceptance criterion.

Regressions: `ORCH-REG-019`, `ORCH-REG-020`.

## Repository-first observability

`gauntlet/observability-contract.md` standardizes the repository artifacts consumed by observers, dashboards, blog tooling, and humans. Generated Gauntlet state/evidence remains owned by the live Gauntlet; consumers stay read-only and cannot define a second canonical progress state.

## Gameplay situations and milestone playtests

`gauntlet/gameplay-situations.json` maps documented football situations to required capabilities, first/integrated milestone applicability, evidence forms, and final-match relevance without storing rapidly stale implementation status.

`gauntlet/milestone-playtest-contract.md` distinguishes:

1. capability tests;
2. gameplay situations;
3. milestone playtests.

A completed horizon or increased player cardinality is explicitly not a milestone PASS.

## SMALL_SIDED_SHAPE

The normative `SMALL_SIDED_SHAPE` profile from `GAMEPLAY_EVALUATION_SPEC.md` is now materialized in `eval/contracts/profiles.ts`, together with the documented `team` suite and `BROWSER-SMALL-SIDED-001` browser execution case.

The current accepted 3v3 objectives are evidence inputs, not an automatic milestone verdict. `gauntlet/playtests/SMALL_SIDED_SHAPE.json` defines the first milestone playtest plan and remains `PLAN_ONLY` until its prerequisites and required situations are actually evaluated.

## Milestone verdict gate

`gauntlet:milestone:evaluate` writes immutable timestamped playtest results under `docs/evidence/milestones/<milestone>/playtests/`.

A milestone PASS requires:

- entry and exit prerequisites satisfied;
- every required gameplay situation evaluated as PASS;
- the existing independent critic to return ACCEPT.

Missing situation coverage remains `NOT_EVALUATED`; explicit perceptual uncertainty remains `NEEDS_PERCEPTUAL_REVIEW`.

Regressions: `ORCH-REG-023`, `ORCH-REG-024`.

## Evidence hardening

Temporal browser-visible claims now require `DYNAMIC_VISUAL`. When a claim is about an event or transition, semantic frames must be centered on the event and consequence rather than selected only by elapsed tick count.

Regressions: `ORCH-REG-021`, `ORCH-REG-022`.

Historical 0.8.x evidence is preserved and is not rewritten or backfilled.

## Milestone bundles

Milestone bundles now include all relevant objective screenshots/audit artifacts, applicable gameplay situations, playtest plan metadata, playtest run history, latest playtest result, objective reviews, and metrics. Bundles remain derived/write-once and never mutate source objective evidence.

## Roles

No new agents are introduced. Existing responsibility-based roles remain sufficient:

- `builder-structured` for contracts/evaluator infrastructure;
- `builder-gameplay` for future executable gameplay situations;
- existing `critic` for qualitative gameplay/perceptual judgment;
- existing integration reviewer for composition/regressions;
- existing `aux` only for bounded semantic ambiguity.

## Regulation/full match

0.9.0 does not publish a regulation/full-match profile. The existing specification barrier remains authoritative: goalkeeper and deterministic regulation coverage must exist before that milestone can be published.

## State migration

No manual rewrite of `gauntlet/state/**` and no historical evidence backfill is part of this release.

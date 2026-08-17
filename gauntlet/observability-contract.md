# Gauntlet observability contract

## Purpose

Gauntlet observability is repository-first. The Gauntlet produces standardized, versioned artifacts in Git; observers, dashboards, blog tooling, and humans consume those artifacts read-only.

There is no parallel hidden progress database and no observer-owned state that can redefine acceptance.

## Source-of-truth hierarchy

1. `gauntlet/VERSION.json` — Gauntlet system version.
2. `gauntlet/state/CURRENT.md` — current accepted/active selection state produced by the live Gauntlet.
3. `gauntlet/state/HORIZON.md` — rolling execution horizon produced by the live Gauntlet.
4. `gauntlet/state/HISTORY.md` — append-only accepted iteration history.
5. `gauntlet/state/TIMING.md` — tracked execution/model timing and usage.
6. `gauntlet/evals/results/**` — deterministic/model/state evaluation results.
7. `docs/evidence/<objective-id>/manifest.json` — objective-level accepted evidence provenance.
8. `docs/evidence/milestones/<milestone-id>/manifest.json` — derived milestone bundle.
9. `gauntlet/gameplay-situations.json` and `gauntlet/playtests/*.json` — stable product/playtest expectations, not generated live state.
10. `origin/gauntlet-regressions:gauntlet/regressions/inbox/*.json` — CI-produced deterministic regression notifications. These report repository health only and have no acceptance authority.

Consumers MUST NOT infer a stronger status than these sources support.

## Remote durability

A finalized objective may exist locally before it is published. Repository observers can only treat an acceptance as remotely durable after the exact final acceptance commit is contained in the configured remote branch.

The orchestration loop therefore publishes and verifies every finalized acceptance before delegating the next objective or replanning an exhausted horizon.

Remote durability is an orchestration/observability invariant, not a gameplay quality criterion.

## Deterministic regression observability

The `gauntlet-regressions` branch is a repository-hosted side channel for CI health records. It is intentionally separate from `main`: CI bookkeeping must not advance, rewrite, or dirty the accepted gameplay branch.

The branch is produced only by deterministic CI according to `gauntlet/regression-inbox-contract.md`. The live Gauntlet and all observer/dashboard/blog consumers are read-only consumers of this branch. Repeated identical failures are deduplicated by stable signature; a later passing check resolves the corresponding record.

A regression record cannot accept/reject gameplay quality, replace critic/integration review, or alter milestone status.

## Standard observable levels

### Objective

Canonical observable artifact:

`docs/evidence/<objective-id>/manifest.json`

It binds the candidate commit, evidence class, evidence artifact hashes, deterministic audit, critic verdict, integration verdict, and acceptance record.

### Milestone

Canonical observable artifact:

`docs/evidence/milestones/<milestone-id>/manifest.json`

A milestone bundle is derived from immutable objective manifests plus the applicable gameplay-situation contract. It MUST NOT rewrite source objective evidence.

### Product/playtest

`gauntlet/gameplay-situations.json` defines what football situations become testable at which milestone and what evidence form is meaningful.

`gauntlet/playtests/<milestone-id>.json` defines the milestone playtest plan. A plan is not a PASS result.

## Producer / consumer boundary

The live Gauntlet owns writes to generated state/evidence. Observer/dashboard/blog processes are read-only and may summarize or visualize repository artifacts, but may not:

- edit `gauntlet/state/**`;
- rewrite objective manifests or historical screenshots;
- upgrade `NOT_EVALUATED`, `NEEDS_PERCEPTUAL_REVIEW`, or missing evidence into PASS;
- edit or resolve CI regression inbox records;
- create a second canonical milestone status outside the repository.

## Design rule

Prefer one canonical structured artifact that several consumers can read over several consumer-specific tracking formats.

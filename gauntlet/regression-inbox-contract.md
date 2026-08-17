# Gauntlet regression inbox contract

## Purpose

Deterministic CI detects repository regressions. Agents do not decide whether a regression exists or whether a PR introduced it.

The canonical regression notification channel is the dedicated Git branch `gauntlet-regressions`, under:

`gauntlet/regressions/inbox/<check-id>.json`

This branch is repository-hosted observability state, but it is deliberately separate from `main` so CI bookkeeping cannot move the accepted gameplay branch or interfere with Gauntlet pushes.

## Producer

`Main Regression Monitor` is the only producer.

For every relevant `main` push it executes the shared deterministic validation runner. A failed check receives a normalized SHA-256 signature from stable error content.

For each check:

- FAIL with no existing OPEN record -> create/update OPEN;
- FAIL with the same OPEN signature -> no write;
- FAIL with a different signature -> update the record;
- PASS after OPEN -> mark RESOLVED;
- PASS with no OPEN record -> no write.

The monitor is scoped to `push.branches: [main]`. Commits to `gauntlet-regressions` do not trigger it. Concurrency cancels an older in-progress monitor when a newer `main` commit supersedes it; current `main` health is authoritative.

## Consumer

The live Gauntlet is read-only with respect to the inbox.

At startup/resume, after acceptance publication, and before strategic replan:

1. `git fetch origin gauntlet-regressions`.
2. Read OPEN records from `origin/gauntlet-regressions:gauntlet/regressions/inbox/`.
3. Reproduce the named deterministic check against current local `main` before acting.
4. If it still fails with the recorded signature, treat repair as higher priority than ordinary horizon work when the failure makes continued development unsafe or invalidates required checks.
5. Repair through the normal builder -> tests/evidence -> critic -> integration -> acceptance pipeline. Do not bypass ordinary acceptance because CI found the defect.
6. Never edit, commit, or mark inbox records RESOLVED. The next successful `main` CI run owns resolution.

If the latest `main` push has not yet been processed by CI, the absence of a new inbox record is not evidence of PASS. The Gauntlet may continue under its existing local acceptance checks and will inspect the inbox again at the next required pickup point.

## PR maintenance classification

Gauntlet-version PRs use the same deterministic validation runner on both PR base and head:

- base FAIL + head FAIL + same normalized signature -> `PREEXISTING_REGRESSION`, not introduced by the PR;
- head FAIL without the same base failure -> `PR_REGRESSION`, blocker;
- head PASS -> PASS or improvement.

No LLM or critic participates in this classification.

## Authority boundary

Regression inbox records report deterministic repository health. They cannot:

- accept/reject gameplay quality;
- replace the mandatory critic or integration reviewer;
- alter accepted objective history;
- redefine milestone status;
- modify `gauntlet/state/**`.

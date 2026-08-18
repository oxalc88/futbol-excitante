# Gauntlet 0.9.3

Acceptance/state remote-durability hotfix over 0.9.2.

## Fixed

- An acceptance is no longer durable merely because its final commit was pushed.
- Canonical bookkeeping changed by an acceptance must be contained in the final acceptance commit.
- `CURRENT.md`, `HORIZON.md`, `HISTORY.md`, `TIMING.md`, the objective manifest, and its acceptance result are verified semantically from `origin/main` before continuation.
- Canonical state newer than the remote is preserved as repair input instead of being treated as cleanup residue.
- Missing committed bookkeeping is classified as `MISSING_ACCEPTANCE_BOOKKEEPING`; stale remote state is classified separately from missing remote ancestry.

## Regression coverage

- `ACCEPTANCE-STATE-NOT-COMMITTED`
- `REMOTE-STATE-STALE-AFTER-PUSH`
- `CLEANUP-PRESERVES-MISSING-BOOKKEEPING`
- `FULLY-DURABLE-ACCEPTANCE`

No gameplay behavior or evidence semantics changed in this release.

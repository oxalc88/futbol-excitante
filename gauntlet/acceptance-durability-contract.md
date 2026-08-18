# Acceptance state durability contract — 0.9.3

An objective is not durably accepted until both its acceptance artifacts and canonical Gauntlet bookkeeping are committed and verified from `origin/main`.

Canonical bookkeeping paths:

- `gauntlet/state/CURRENT.md`
- `gauntlet/state/HORIZON.md`
- `gauntlet/state/HISTORY.md`
- `gauntlet/state/TIMING.md`

## Final acceptance sequence

1. Persist the acceptance result and objective manifest.
2. Apply the orchestrator-owned bookkeeping transition.
3. Run `pnpm run gauntlet:eval:state` and repair state-only failures before publication.
4. Create the final acceptance commit containing the acceptance manifest/result and every canonical bookkeeping file changed by that transition.
5. Run:

   `pnpm run gauntlet:acceptance:durability -- --objective <id> --commit <acceptance-sha> --mode local --ref <acceptance-sha>`

   A local canonical state delta that is newer than the acceptance commit is `MISSING_ACCEPTANCE_BOOKKEEPING`. Do not continue and do not clean it away. Preserve it, repair bookkeeping, re-run the state audit, and create a repaired acceptance commit.
6. Push the accepted chain once and fetch the configured upstream.
7. Run:

   `pnpm run gauntlet:acceptance:durability -- --objective <id> --commit <acceptance-sha> --mode remote --ref origin/main`

   Remote verification must establish both ancestry of the acceptance commit and semantic state consistency in `CURRENT.md`, `HORIZON.md`, `HISTORY.md`, `TIMING.md`, the objective manifest, and its referenced acceptance result.
8. Only a remote `PASS` permits delegation or strategic replan.

## Cleanup classification

Worktree cleanup must distinguish provenance:

- accepted historical evidence mutated by a test: restore the accepted bytes;
- ephemeral/untracked test output: discard/ignore according to the 0.9.2 hygiene contract;
- canonical Gauntlet state newer than `origin/main`: preserve for bookkeeping repair. Never restore or discard it as residue.

Cleanup is not allowed to make local canonical state older merely to obtain a clean tree.

## Failure classes

- `MISSING_ACCEPTANCE_BOOKKEEPING`: local canonical bookkeeping or acceptance artifacts required by the transition are absent from the acceptance commit, or newer canonical state remains dirty after the commit.
- `REMOTE_DURABILITY_MISSING`: the acceptance commit is not contained in the configured remote branch.
- `REMOTE_STATE_STALE`: the acceptance commit is remotely reachable but the canonical state/artifacts at `origin/main` do not semantically represent that acceptance.

These are orchestration/publication failures, not gameplay acceptance failures. The already-reviewed gameplay candidate is not sent back to the builder unless its own evidence or implementation is defective.

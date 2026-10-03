# Product flow contract

Gauntlet 0.9.9 uses product progress to select work. The existing acceptance pipeline still decides whether an implementation is accepted.

## Horizon rule

A normal horizon must:

1. name one player-visible outcome;
2. contain 2–4 objectives;
3. include technical, evaluator, infrastructure, or spec-only work only when it directly enables or protects that outcome;
4. prefer the smallest change that can be used in normal shipped browser play.

A feature is not product-complete while it exists only in fixtures, test bridges, capture paths, or gated code that normal shipped play does not use.

## Planning priority

Use this order unless evidence gives a stronger reason:

1. player-visible blocker;
2. gameplay feel or readability;
3. broken match flow;
4. missing core mechanic;
5. supporting eval/spec work.

## GitHub issues

GitHub issues are optional for sequential execution.

GitHub issues are mandatory for parallel implementation execution. Read `gauntlet/parallel-issue-contract.md`.

Issues are a durable work queue and context index. They do not replace canonical Gauntlet state or acceptance evidence.

A parallel issue must contain:

- Goal
- Player-visible outcome
- Why now
- Dependencies
- Expected file ownership
- Acceptance criteria
- How to play/test
- Evidence required
- Gauntlet role
- Execution state: `READY` or `BLOCKED`

## Parallel work

Two objectives may run in parallel only when:

- both objectives have synchronized GitHub issues;
- each issue has explicit dependency metadata;
- each issue is `READY`;
- neither objective depends on the acceptance of the other;
- their expected file ownership does not overlap;
- they do not both modify canonical Gauntlet state;
- each objective has an isolated workspace/worktree;
- each objective has its own tests, evidence, critic review, integration review, and acceptance record.

If GitHub write capability or issue synchronization is unavailable, run the objectives sequentially.

If these conditions stop being true, serialize the work.

## Product-flow observations

Record these at the end of a product horizon when the data exists:

- `player_visible_changes`: count of meaningful changes available in normal shipped play;
- `time_to_playable`: elapsed time from objective selection to first usable normal-play version;
- `process_only_objectives`: objectives with no direct player-visible result;
- `playtest_issues_opened`: top gameplay problems recorded from the horizon playtest;
- `playtest_issues_closed`: playtest problems materially improved by the next horizon;
- `gameplay_regressions`: previously accepted gameplay behavior broken by the horizon.

These observations are planning signals. They are not acceptance gates.

The key trend is: reduce the time between finding a gameplay problem and playing the improved version, while keeping regressions low.

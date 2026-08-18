# Quantitative analysis

## Executive findings

Across 552 sessions and 15,731 reconstructed model-visible requests, the
Gauntlet processed 1,224.18M prompt tokens and approximately 18.63M completion
tokens. These are provider-input exposures, not unique content and not a bill.

| Role | Requests | Prompt tokens | Share of prompt |
|---|---:|---:|---:|
| Parent/orchestrator | 3,714 | 592.29M | 48.38% |
| Builder | 6,603 | 475.02M | 38.80% |
| Critic | 2,088 | 69.42M | 5.67% |
| Integration reviewer | 1,490 | 48.53M | 3.96% |
| Auxiliary | 454 | 24.49M | 2.00% |
| Bookkeeping/committer | 1,382 | 14.43M | 1.18% |

The parent is the largest single contributor. Its 587.50M adjacent-window
repetition bound is 99.22% of measured parent input after initial requests and
47.99% of all prompt processing. This does not mean 99% can be deleted: a model
still needs task state and evidence. It proves that long-lived windows are
being exposed repeatedly.

## Grok 4.6 parent versus orchestrator-deepseek

`orchestrator-deepseek` includes the exact base and 0731 routes. Counts are
request-local, so model switches in a mixed parent session remain separated.

| Metric | Grok 4.6 parent | orchestrator-deepseek |
|---|---:|---:|
| Requests | 847 | 2,867 |
| Objectives touched | 34 | 47 |
| Requests / touched objective | 24.91 | 61.00 |
| Prompt tokens | 174.92M | 417.38M |
| Completion estimate | 0.957M | 2.186M |
| Mean prompt/request | 206,758 | 145,987 |
| Median context | 206,843 | 141,754 |
| p95 context | 358,220 | 257,799 |
| Peak context | 398,163 | 324,048 |
| Prompt/touched objective | 5.145M | 8.880M |
| Completion/touched objective | 28,137 | 46,514 |
| Tool calls | 1,476 | 3,194 |
| Tool calls/request | 1.74 | 1.11 |
| Tool calls/touched objective | 43.41 | 67.96 |
| Weighted repeated-context bound | 99.22% | 99.18% |
| Requests immediately after child completion | 243 | 254 |
| Explicit HTTP error generations | 0 | 3 |
| Requests carrying retry markers | 2 | 8 |
| Detected compaction drops | 3 | 2 |
| Median non-compaction context growth/request | +1,147 tokens | +575 tokens |

Offloading reduced context per request: mean fell 29.4%, p95 28.0%, peak
18.6%, and median growth/request about 49.9%. It did not reduce total parent
processing in this observed workload: requests per attributable touched
objective increased 145%, and prompt per touched objective increased 72.6%.
This is not a causal
model benchmark—the objective mix and session policies changed—but it rules out
the claim that offloading alone solved parent token burn.

Parent activity classification further shows where the window is paid:

| Activity | Requests | Prompt | Repeated bound |
|---|---:|---:|---:|
| Wait/result-processing | 1,032 | 183.99M | 183.03M |
| Acceptance/bookkeeping | 628 | 93.90M | 92.90M |
| Strategic decision | 464 | 89.24M | 88.70M |
| Strategic horizon planning | 292 | 46.11M | 45.65M |
| Substantive orchestration | 1,295 | 178.90M | 177.06M |
| Provider-error recovery | 3 | 0.153M | 0.153M |

Routine wait/result processing plus acceptance/bookkeeping exposed 275.93M
repeated parent tokens. That is a defensible upper bound on the immediately
addressable surface—46.6% of parent input and 22.5% of all prompt input—not a
claim that all 275.93M could be eliminated.

## Context shape

Context grows approximately linearly within a parent session, with occasional
large downward compaction steps and full resets only at new top-level sessions.
The median non-compaction deltas are +1,147 tokens/request for Grok and +575 for
DeepSeek. Only five parent drops met the 20% compaction threshold across 3,714
requests. Objective acceptance does not reset the parent window, so old specs,
tool results, reviews and conversations remain payable in later objectives.

For uncompacted parent prefixes, the category dataset confirms that the window
contains durable harness/canonical instructions plus accumulated historical
conversation, tool results, state, specs, source/test/git output, and child,
critic and integration reports. For compacted histories, the token time series
survives but exact historical category bytes do not; those rows are explicitly
marked unavailable rather than reconstructed from the current rewritten chat.

## The 03:06 UTC HTTP 502

Session `01a012a4-7322-7c82-8b2d-6ff45639080c`, request
`:00056`, started `2026-08-18T03:06:20.722Z` and ended 35,144 ms later.
The exact persisted start meter is 81,971 tokens. The provider-visible prefix
had 173 records and 69 prior tool calls.

The 173 records were structurally: one system record, four user records, 43
reasoning records, 56 prior assistant generations, and 69 tool-result records.
Thus the failing call was the 57th visible generation in the turn. The turn
usage reports 80 `modelCalls`, leaving 23 internal/auxiliary/provider calls that
are not independently materialized as assistant generations; their exact
purpose cannot be inferred safely.

The prefix contained 180,146 content characters. Reasoning summaries added
42,091 characters and serialized tool-call arguments added 35,396; compact
JSON serialization was 276,377 characters. The category view (character-based,
not exact tokenization) was:

| Category | Share of classified characters |
|---|---:|
| Historical conversation/turns | 38.12% |
| Gauntlet canonical prompt | 12.51% |
| Integration reports | 10.08% |
| Critic reports | 7.84% |
| CURRENT/HORIZON/HANDOFF/state | 6.21% |
| Git output | 6.03% |
| AGENTS/instructions | 4.28% |
| Test output | 3.76% |
| Specs | 3.39% |
| Remaining system, child, source and tool categories | 7.78% |

The previous request carried 80,618 tokens; the bounded repetition estimate is
98.35% for the failed request. The 69 tool calls are accumulated assistant tool
requests in the model-visible history, not 69 calls emitted by the failed
generation.

The exact provider HTTP payload cannot be reconstructed: no provider request
ID, headers, endpoint, tokenizer serialization, or wire body is persisted. The
model-visible logical prefix can be reconstructed for this uncompacted session,
but is deliberately represented only by sizes/categories/hashes.

Grok Build stored `HTTP 502: System error, please try again later.` as an
assistant message, emitted an `AgentMessageChunk` at 81,971 tokens, then wrote
`turn_completed`/`end_turn`; `signals.errorCount` remained zero. It was therefore
misrepresented as a completed turn at the harness layer. There was no automatic
retry. At 03:43 UTC a new `/gauntlet-continue` turn re-read durable state and
recovered; it was not a retry of the same provider request.

The error occurred after critic and integration ACCEPT for
`HUMAN-SHOT-DIRECTION-CONTROL` but before acceptance persistence. Durable state
was not incorrectly advanced. A safe retry required re-reading CURRENT/HORIZON,
git/evidence and review provenance, verifying whether acceptance had already
persisted, then resuming the unfinished idempotent step. Blind request replay
could duplicate state/commit side effects. In this case the result was a stall,
not corrupt Gauntlet state; the same misclassification could leave an objective
unaccepted or, if a partial side effect had preceded the failure, require an
explicit state audit before continuation.

## Provider errors and retries

Three visible provider HTTP-error generations processed 181,087 prompt tokens.
Twenty-two request intervals contain persisted retry markers and processed
2.214M prompt tokens. Together this is 2.395M (0.20% of all prompt input): real
but not the primary burn. `errors.csv` also contains 28 failed child statuses
(17 HTTP 402, six 400, two 429, two 500 and one 499) and 960 non-success tool
events. Tool failures include expected diagnostic non-zero exits and must not be
summed as provider failures.

Error recovery becomes avoidable when a failure is incorrectly closed as
success or when a retry resends a large unchanged prefix without an idempotency
check. The 502 demonstrates the first condition. The aggregate evidence does
not show provider errors as the dominant cost driver.

## Objective-level accounting and TIMING.md

`objectives.csv` separates parent, builder, critic, integration, auxiliary and
committer requests/tokens and never transfers child usage into the parent. It
also carries HISTORY retry/result fields and model routing. Parent objective
inheritance is heuristic; between-objective horizon work is null rather than
forced onto a future objective.

The complete TIMING document correctly explains processed-input semantics,
context resend and absence of request-level cache splits. Confirmed exact rows:

- Legacy Grok committer: 81 sessions, 649 calls, 6.405M prompt and 468,913
  estimated completion (TIMING rounds these to 6.41M/469k).
- Grok parent peak: 398,163, confirming the documented ~400k.
- The old Grok parent row's method is valid, but its 160.12M/781 calls is stale;
  the fixed cutoff measures 174.92M/847.

Other stale rows include Gemma committers (14/~1.28M then versus 92/8.023M),
Qwen builders (58/232.60M then versus 86/345.27M), and MiMo builders
(13/50.42M then versus 34/129.74M). The current 1.224B total is 2.33× TIMING's
~526M because this dataset extends through 18 August and includes later parent,
builder and reviewer activity. It must replace—not be added to—the overlapping
TIMING snapshot.

TIMING estimates several late objective prompt totals and leaves completions
`n/a`; this extraction supplies per-visible-loop prompt meters and completion
deltas. It does not replace TIMING's merged child-active wall-clock with the
different first-to-last attributed request span. Gaps are exact historical
bytes after compaction, hidden `modelCalls`, 40 unmetered loops, 134 unterminated
loops at cutoff, post-cutoff work and request-level cache allocation.

## Answers to the 14 questions

1. **What part is really orchestrator?** 592.29M prompt tokens, 48.38% of the
   total. This excludes every child session. Completion estimate is 3.143M.

2. **What does a routine parent turn cost?** Wait/result requests average
   179,189 tokens (median 171,765); acceptance/bookkeeping averages 149,492
   (median 147,062). A representative routine request is therefore roughly
   150k–180k processed prompt tokens.

3. **How many parent turns per objective?** Across 77 HISTORY-accepted
   objectives with attributed parent work: mean 38.38, median 25, range 1–235.
   By parent route, touched-objective rates are 24.91 Grok and 61.00 DeepSeek;
   attribution and workload differ, so this is descriptive, not causal.

4. **What percentage is resent?** The adjacent-size bound is 99.22% of parent
   prompt processing after initial requests. The exact 502 request is 98.35%
   relative to its predecessor. This is exposure repetition, not exact provider
   cache/billing.

5. **How much seems avoidable with better context management?** Routine
   wait/result and acceptance/bookkeeping carry 275.93M repeated-token exposure
   (22.5% of all prompt, 46.6% of parent prompt). Treat that as an upper bound on
   the highest-confidence reducible surface; each request still needs a compact
   state/evidence envelope.

6. **How much did cost fall after offloading/builders/Gemma/HORIZON?** Per
   parent request fell 29.4% from Grok to DeepSeek and context growth halved.
   Total parent prompt per attributable touched objective rose 72.6% because request count
   more than doubled. Gemma removed Grok from commits, but prompt/session was
   ~87k versus ~79k for legacy Grok, so token volume did not fall. Offloading
   improved model allocation and context size, not aggregate token efficiency.

7. **What parent work could be deterministic or delegated?** Polling child
   status, collecting final reports, validating fixed JSON/schema fields,
   checking review presence/status, running state audit commands, acceptance
   persistence, HISTORY/CURRENT bookkeeping, commit/push dispatch, and horizon
   index validation. These account for much of the 322M routine/horizon prompt
   surface.

8. **What really needs a strong parent model?** Selecting/replanning objectives
   under architectural constraints, resolving contradictory critic/integration
   evidence, deciding whether a blocker materially invalidates the horizon,
   scoping a safe recovery after partial side effects, and synthesizing novel
   cross-objective risks. These are the 464 high-confidence strategic decisions
   plus an unknown subset of substantive orchestration—not every poll.

9. **Are provider errors creating avoidable repetition?** Yes, locally: 2.395M
   prompt tokens sit on explicit error/retry intervals, and the 502 needed a
   later 67,331-token recovery request. At 0.20% of total, errors are secondary
   to ordinary repeated context.

10. **Is growth linear, stepped, or compaction-controlled?** Mostly linear
    within a session, with rare downward compaction steps. Median growth is
    +1,147/request for Grok and +575/request for DeepSeek; only five parent
    compaction-sized drops occur in 3,714 requests. Objectives do not reset it.

11. **Largest current contributor?** The parent/orchestrator at 48.38%, followed
    by builders at 38.80%. Mechanistically, repeated parent context is the
    largest coherent burn source.

12. **Highest-return use of Grok 4.6 when quota returns?** Strategic horizon
    selection, architecture/blocker arbitration, novel recovery, and final
    acceptance decisions with contradictory evidence. Do not spend it on
    polling, state formatting, commits, mechanical audits, or report transport.

13. **Could a different harness materially reduce tokens?** The data is
    sufficient to say that a harness with materially different context behavior
    could: 275.93M repeated tokens are concentrated in clearly routine parent
    actions, and objective boundaries do not reset the window. It is not enough
    to rank or endorse another harness, and none was researched.

14. **What properties would that harness need?** Per-request context assembly;
    immutable content-addressed references for specs/code/evidence; compact
    typed child reports; parent/child token isolation; request-level usage/cache
    telemetry; explicit provider-error states; bounded idempotent retry; durable
    state checkpoints; context reset at objective acceptance; deterministic
    polling/bookkeeping outside the model; and selective escalation of only the
    decision packet to a strong model.

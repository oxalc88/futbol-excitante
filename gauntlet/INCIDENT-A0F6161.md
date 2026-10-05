# Published deadlock investigation: a0f6161

The published `main` at `a0f61618161600f9a887b7287d417686a86e60ef` preserves actual product progress and a policy deadlock. None of its records are rewritten by this correction.

## Evidence inspected

- Incident `33cba31914e91e5b070e2e5f0aee7130af86c47c9005474b136fa4bc3adbb895`, events 000000–000006, both hash-bound legacy imports and migration manifest.
- Published stop `stop-c8245ea19a56dfdb320d3c56399f846cf8270abe2162b1f01ca42cd0dc758048.json`, including consumed diagnosis/dispatch, proposed reset/allowlist decisions, blocked objective reasons and preserved progress.
- Both canonical bootstrap certification records and their receipts: RECOVERY_BLOCKED, zero checks, no execution profile/failure proof. These are refusals, not current observations.
- PLAYER-CONTROLS-REFERENCE execution plan, A settlement, local receipt, compressed typecheck log and check proof; original Git objects, reachable main trees and local reflog.
- Rejected `babf42c4a50d726f0966f8a9a254f67a512e583f`, diagnosis, rejection, test/runner/config diff, and its integration into later published product progress.
- Available local OMP telemetry and verification logs, including `.delivery-local/pcr-gate*.log`, `machinery-repair.log`, `rpc-instrument.log`, legacy recovery/diagnosis records, and the native Codex `*.engineer.log`.

The local logs are diagnostic context, not retroactive certification. The native engineer was given a workspace at f6e804e containing only events 000000–000002, although its packet referenced 000004. It changed nothing and explicitly found no justified causal repair: missing failed files, execution output and toolchain identity. Its separate sandbox bwrap failure is not the legacy regression cause. Later local worker logs show passing assertions alongside an unhandled `onTaskUpdate` timeout. They cannot establish the missing source-bound imported failure.

## Broken controls ancestry

Original commits existed locally but were no longer ancestors after rebasing. Exact complete Git trees match:

| Original identity | Published main identity |
| --- | --- |
| f796a548d61f7c45112d292112fdaea488b32e69 | 0caa4cb1578273902c5851bec70231afa848d5f9 |
| 2421d111fc397caa9c96f02fd88a0ecde27082e7 | 955d0900454180fcdc5b17d8de1d7a79e68f28e3 |
| 07d940ecf8caa501ffb05b023ba714867656a91d | 704235321677b0061ada97d85473c808f1518ba8 |

Append-only provenance records retain each original commit object's exact bytes. Git hashes those bytes back to the original identity; the validator checks the embedded tree against the reachable whole tree. Original plans, settlements and proof hashes remain unchanged. All dependency integration, ownership, handoff, proof and candidate ancestry checks still execute using that verified equivalence.

## Rejected repair behavior

The headless runner was refactored into a generator. Its synchronous wrapper drains it in the previous statement order; its new asynchronous wrapper yields via setImmediate every 250 ticks. Three long-running existing tests use the cooperative path. Capture hooks move from npx/stdout readiness to programmatic Vite; configuration adds worker/setup behavior. No simulation core file appears in that repair commit, but evaluator execution and existing assurance bodies change. It exceeds the allowed native spawn-option transport envelope even if the allowlist were widened. Rejection was correct under that bounded recovery contract. It is already in published progress and remains untouched; current full verification must assess it without falsely claiming causal legacy recovery.

## Demonstrated policy defect and correction

The import records UNKNOWN without sufficient evidence to identify the failed source/environment. Yet it blocked every future repository/full execution, including a certification needed to obtain the missing current evidence. The rejected slot and zero-check certification refusals completed that circular dependency. Broken controls ancestry was separately repairable bookkeeping, not an external execution-policy decision.

The corrected core first repairs cryptographically verifiable ancestry bookkeeping. It then permits one full frozen-HEAD current certification observation only for an unattested legacy import with intervening product inputs and no prior observation/repair/reservation. The spent legacy budget and repair slot do not change. Historical observation PASS validates against the frozen `legacy-current-v1` full check/command/inventory contract, so later scoped-plan edits do not reinterpret its required coverage. An interruption or failure cannot retry. Complete validated current PASS changes current admission only; historical UNKNOWN/BLOCKED stays historical. Attested/current failures retain their barriers. Stops cannot override either routine action.

## Reproduction and practical limits

`mise run gauntlet-deadlock-replay` clones the exact published incident/stop/history and preserves all its product progress. It reproduces the failed ancestry, audits the old stop, recovers exact-tree provenance, rejects a new stop while certification is available, and runs the actual quality CLI using deterministic command transport. Both complete-current-evidence and failed-current-evidence branches verify unchanged history/budget and single use. The failed branch verifies a renamed CERT cannot retry. An ordinary clone verifies portable provenance without orphan objects.

These command-transport assertions are policy evidence, not product PASS. The separate real pinned-toolchain certification receipt records what actually executes on the corrected candidate; remaining failures must be reported from that receipt. No milestone, release, objective acceptance or PES fidelity is inferred from this correction.

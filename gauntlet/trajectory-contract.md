# Horizon trajectory experiment (0.11.0)

The frozen before-state is `trajectory/baseline-0.10.0/baseline.json` with a SHA-256 seal and source inventory. Historical mixed-version Horizons are separate from true 0.10 runs. Do not rewrite the seal, accepted history or evidence. Current `HORIZON.md` stays intact in this release; at the first strategic reassessment archive/replan its remaining work under the new policy without losing accepted entries.

## Canonical command, all harnesses

Use `mise exec -- pnpm run gauntlet:trajectory -- <action> v39 <input.json>`:

1. `start`: input contains `problem`, `smallest_playable_slice`, and committed `sources` (`path`, full `commit`, SHA-256). Record immediately when selecting work, before delegation. The command timestamps selection and creates `selection.json` once.
2. `playable`: input contains `mode: normal_shipped_play`, `method` and committed `sources`. Run on the first actual usable version through the ordinary shipped app. The command timestamps `first-playable.json` once. Do not substitute a test bridge, scenario-only fixture or hidden capture route. Commit both events before completion.
3. `record`: commit the input first. It contains `outcome` matching the selected problem/slice, `acceptances` pointing to remote-durable 0.11 acceptance records, `objectives` (id, direct_player_result boolean, enables_or_protects explanation), optional `metrics`, optional `active_agent_hours`, `harness`, and `measurement_profile`. The command verifies git hashes/remote containment, candidate quality/reviews and canonical acceptance snapshot durability, then appends `attempt-N.json`. An unchanged or worse product returns ITERATE even if every objective was accepted. Commit/publish this trajectory with Horizon bookkeeping before reporting product success or selecting another Horizon.
4. `report` (no Horizon/input arguments): emits the frozen historical records and latest attempt of each future Horizon as JSON. Compare v39/v40/v41 to the baseline with coverage qualifications, not a claim that the release is already faster.

Append attempts, never overwrite an event/result. Internal objective acceptance alone is insufficient. A normal Horizon is successful only on an ACCEPT product outcome. A failed comparison keeps the same player problem and iterates a smaller corrective slice. A material blocker can invalidate the Horizon under the existing rules; persist the incomplete outcome and reason rather than fabricate success.

## Outcome input

`outcome` contains `problem`, `smallest_playable_slice`, distinct `changed_for_player` entries; `playtest` contains `mode`, `method`, `before`/`after` provenance arrays, `materially_better`, `improved`, `still_wrong`, `issues_opened`, `issues_closed`, `regressions`; `quality` contains `baseline_pass`, `affected_domains_pass`, `no_known_accepted_regression`, and committed `sources`. Sources must describe the real play session, actions and observed result. CPU-vs-CPU normal app observation is valid when appropriate, but cannot attest human-control feel. Existing milestone bundles/reducers may supply evidence; a Horizon ACCEPT does not promote a normative milestone.

## Small metric set and precision

Every metric contains `value`, `status`, `sources`, `note`. Status is MEASURED, RECONSTRUCTED_EXACT, RECONSTRUCTED_ESTIMATE or UNAVAILABLE. Unavailable values are null, never zero. Provenance names an immutable git source and byte hash. Counts are nonnegative; time is seconds; active input is hours; token input is processed context, not billing. The command derives time-to-playable from recorded events, observed changes/issues/regressions from the playtest, and ratios only with complete positive denominators.

Primary: time_to_playable, player_visible_changes, player_visible_changes_per_active_hour, process_only_objectives, playtest_issues_opened, playtest_issues_closed, gameplay_regressions.

Efficiency: processed_input_tokens, tokens_per_player_visible_change, active_agent_time_per_player_visible_change, retries, critic_rejects, integration_rejects.

Quality: existing_eval_suite_failures, gameplay_regressions, critic_catches, integration_catches, post_acceptance_defects, milestone_playtest_result.

Count one useful observed improvement once, even when several objectives enable it. Process-only objectives have no direct player result; enabling work still needs the selected product link. Rejected/unaccepted work belongs in the same Horizon cost scope. Active hours require reconciled intervals, not git elapsed time or summed parallel walls. Preserve exact role/model/harness identities in the referenced telemetry. Grok cache is a subset of input in the historical audit; OMP normalized cache buckets are additive. Compare only matching definitions, inclusion scope and coverage; incomplete usage stays unavailable. Optional counters must cite complete logs and disclose retry/catch scope. Post-acceptance defects may arrive later: append a follow-up attempt/observation rather than rewrite prior truth.

# RELEASE-0.9.7-CONSOLIDATION — builder result

## Builder report

- **objective_id:** RELEASE-0.9.7-CONSOLIDATION
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** BOOKKEEPING
- **hypothesis:** Consolidate the v29-v33 delivered capability into the RELEASE-0.9.7 record following the established RELEASE pattern: what is playable (the complete small-sided loop), what is executable/attested (the rules + goalkeepers suites, COMMON-DETERMINISTIC two-run, protected-oracle discipline, designation-facts serialization), what is spec'd (FOULS_CARDS_SPEC), what stays deferred, and the honest limitations. BOOKKEEPING; zero gameplay/source change; every claim in the release record cites its accepted record.
10→
### files_changed

- `gauntlet/RELEASE-0.9.7.md` (NEW — release record per the established RELEASE pattern).
- `gauntlet/VERSION.json` (modified — `version` `0.9.6`→`0.9.7`, `previous_system_version` `0.9.5`→`0.9.6`, `baseline_commit` → `f661b38b068f884f5ed5a079d76babe3cc70b8eb`; `includes` unchanged).
- `scripts/capture-release-0-9-7-consolidation.ts` (NEW — byte-reproducible BOOKKEEPING producer).
- `tests/unit/eval/release-0-9-7-consolidation-binding.test.ts` (NEW — binding test pinning the record structure + headline facts; discriminating).
- `docs/evidence/RELEASE-0.9.7-CONSOLIDATION/release-0-9-7-consolidation.json` (NEW — release record, `record_sha256` `94ac0110…`).
- `docs/evidence/RELEASE-0.9.7-CONSOLIDATION/audit.json` (written by the audit command).
- `docs/evidence/RELEASE-0.9.7-CONSOLIDATION/RESULT.md` (this builder report).

**No changes** to `src/`, `src/adapters/`, `eval/`, `gauntlet/evals/`, `gauntlet/roles/`, or `specs/`. The producer verifies the headline facts by reading the accepted records (pinned `record_sha256`); it does not modify them.

### commands_run (actual exit codes)

| Command | Exit |
|---|---|
| `mise exec -- pnpm exec tsx scripts/capture-release-0-9-7-consolidation.ts` (ordinary mode ×2) | 0 — `record_sha256` `94ac0110…` identical both runs; leaves `docs/` byte-identical; writes `test-results/gauntlet-capture/` |
| `WIP_SECTION=__EVIDENCE__:RELEASE-0.9.7-CONSOLIDATION mise exec -- pnpm exec tsx scripts/capture-release-0-9-7-consolidation.ts` | 0 (wrote `docs/evidence/RELEASE-0.9.7-CONSOLIDATION/release-0-9-7-consolidation.json`; `record_sha256` `94ac0110…`) |
| `mise exec -- pnpm run typecheck` | 0 (core + node + browser clean) |
| Rules gate + new binding (12 files) | 0 (190/190 PASS) |
| Registry / provenance / hygiene (3 files) | 0 (70/70 PASS) |
| Architecture boundary suite (6 files) | 0 (27/27 PASS) |
| `mise exec -- pnpm run gauntlet:audit -- --objective RELEASE-0.9.7-CONSOLIDATION --class BOOKKEEPING --tests-pass true --integration-test-pass true` | 0 (status `PASS`; see `audit.json`) |

### tests_run

- **Typecheck** — exit 0 (core + node + browser clean).
- **Binding test** — `tests/unit/eval/release-0-9-7-consolidation-binding.test.ts`: **10/10 PASS** (pins record structure + headline facts; discriminating).
- **Rules gate + new binding (12 files)** — rules-oracle (75), rules-suite (17), RULES-SUITE-REGISTRATION-binding (28), restart-rules-serialization (4), RULES-SUITE-STATE-binding (10), rules-facts-depth-binding (8), corner-driven-conformance-binding (7), restart-designation-binding (8), rules-suite-state-rerun-binding (9), SUITE-DETERMINISTIC-TWO-RUN-binding (7), human-ball-server-decision-binding (7), release-0-9-7-consolidation-binding (10): **190/190 PASS**.
- **Registry / provenance / hygiene (3 files)** — eval-registry (48), oracle-registry (19), capture-hygiene.node (3): **70/70 PASS**.
- **Architecture boundary suite (6 files)** — core-boundary, core-ts-isolation, contracts-no-forbidden-imports, build-vite-resolve, toolchain-version-check, toolchain-smoke-test: **27/27 PASS**.

### integration_test_result

For `BOOKKEEPING`, the audit marks the integration-test check `NOT_APPLICABLE` (no trajectory is required). No integration suite is relevant to a release-consolidation record; the rules gate + registry + hygiene batteries re-ran green.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/RELEASE-0.9.7-CONSOLIDATION/audit.json` (status `PASS`).
- Durable record: `docs/evidence/RELEASE-0.9.7-CONSOLIDATION/release-0-9-7-consolidation.json` (`record_sha256` `94ac0110…`; byte-reproducible; no wall-clock field in hashed content).
- Executed tests (BOOKKEEPING): the binding test, the rules gate + registry/provenance/hygiene batteries, the architecture boundary suite, and typecheck 0.

### artifacts

- `gauntlet/RELEASE-0.9.7.md`
- `gauntlet/VERSION.json`
- `scripts/capture-release-0-9-7-consolidation.ts`
- `tests/unit/eval/release-0-9-7-consolidation-binding.test.ts`
- `docs/evidence/RELEASE-0.9.7-CONSOLIDATION/release-0-9-7-consolidation.json`
- `docs/evidence/RELEASE-0.9.7-CONSOLIDATION/audit.json`
- `docs/evidence/RELEASE-0.9.7-CONSOLIDATION/RESULT.md`

### spec_sections

- `specs/MATCH_RULES_SPEC.md` §15 (the `rules` suite criteria + protected oracles), §12.1 (keeper interaction).
- `specs/FOULS_CARDS_SPEC.md` (fouls-v1; spec-only).
- `specs/GOALKEEPER_SPEC.md` (small-sided GK scope exclusions).
- `gauntlet/evidence-contract.md` (BOOKKEEPING), `gauntlet/roles/builder-structured.md` (role contract), `gauntlet/RELEASE-0.9.6.md` (established release pattern).

### acceptance_criteria_met

- **Release document written** per the established pattern: `gauntlet/RELEASE-0.9.7.md` consolidates what is PLAYABLE (the complete small-sided loop), what is EXECUTABLE/ATTESTED (rules suite 23/25 + 2 blocked; goalkeepers 9/0/2/1/1; COMMON-DETERMINISTIC two-run attested for both; protected-oracle discipline; designation-facts serialization), what is SPEC'D (FOULS_CARDS_SPEC), what stays DEFERRED (the pass-button DEFER + HUMAN-BALL-SERVER-LITERAL outline; blocked references; GK beyond small-sided; regulation; full-match ecology), and the honest limitations (fixture-driven evidence, no PES fidelity, no suite-level PASS / PROMOTION / FOUNDATION_LAB_PASS).
- **Version bumped** to `0.9.7` in `gauntlet/VERSION.json` following its exact schema (version, previous_system_version, semver, baseline_commit updated; `includes` unchanged — a consolidation adds no new Gauntlet capability).
- **Zero gameplay/source change:** `git diff src/ src/adapters/ eval/ gauntlet/evals/ gauntlet/roles/ specs/` EMPTY.
- **Durable evidence** written via the `WIP_SECTION=__EVIDENCE__:RELEASE-0.9.7-CONSOLIDATION` gate; scratch output under the ignored `test-results/`.
- **Record byte-reproducibility:** `record_sha256` `94ac0110…`; no wall-clock field; two consecutive ordinary-mode runs byte-identical; an ordinary-mode run leaves `docs/` byte-identical.
- **Binding test** pins the record structure + headline facts (rules 23/25+2 blocked, goalkeepers 9/0/2/1/1, COMMON-DETERMINISTIC PASS both, protected oracles 8, designation serialization, FOULS_CARDS_SPEC spec'd, deferred items, cited record SHAs, content-addressing); verified discriminating.
- Batteries green (rules gate 190/190, registry/hygiene 70/70, architecture 27/27); `mise run typecheck` exit 0; `gauntlet:audit` status PASS.

---

## Claims provenance

Every claim in the release record cites its accepted record and is pinned by that record's `record_sha256` (verified by the producer, which throws on a mismatch):

| Fact | Source record (record_sha256) |
|---|---|
| Rules suite 23 PASS / 2 BLOCKED / 0 NOT_EVALUATED / 0 FAIL over 25 MATCH-* criteria | RULES-SUITE-STATE-RERUN `36fc77e5…` |
| Rules suite + COMMON-DETERMINISTIC = 24 PASS / 2 BLOCKED | SUITE-DETERMINISTIC-TWO-RUN `abaf6ccd…` |
| Goalkeepers suite 9/0/2/1/1 | SUITE-DETERMINISTIC-TWO-RUN `abaf6ccd…` |
| Goalkeepers core-owned baseline 8/0/3/1/1 | GK-SUITE-CORE-OWNED-STATE `5cd1c808…` |
| COMMON-DETERMINISTIC PASS for both suites (two-run byte-identity) | SUITE-DETERMINISTIC-TWO-RUN `abaf6ccd…` |
| Protected-oracle discipline (8 oracles) | RULES-SUITE-REGISTRATION `7503f9fe…` |
| Designation-facts serialization (gated `serializeRestartFacts`) | RESTART-DESIGNATION-FACTS-CONFORMANCE `271b1526…` |
| FOULS_CARDS_SPEC spec'd (fouls-v1) | FOULS-SPEC-DRAFT `e98a1efe…` |
| Pass-button DEFER + HUMAN-BALL-SERVER-LITERAL outline | HUMAN-BALL-SERVER-DECISION `5b6e391a…` |

## known_gaps

- **Prompt-gate version needle is now stale.** `gauntlet/evals/src/prompt-gate.ts` pins `"version": "0.9.6"` / `"previous_system_version": "0.9.5"` in the `semver system version is declared` check. Bumping `VERSION.json` to `0.9.7` makes that needle stale, so `prompt-gate` would report the version check as failing. Updating that needle requires touching `gauntlet/evals/`, which the objective's zero-change constraint (`git diff … gauntlet/evals/ …` EMPTY) forbids. This is a disclosed, out-of-scope gauntlet-evals maintenance change for the orchestrator, consistent with how the RELEASE-0.9.5 needle advance was recorded in its release doc. The `gauntlet:audit` gate for this objective does not invoke `prompt-gate` and passed.
- **VERSION.json `includes` left unchanged.** A consolidation release delivers no new Gauntlet system capability, so no include was added; only the version/provenance fields were updated consistently.
- **The release record's `protected_oracle_discipline.count` (8) is cited from the accepted RULES-SUITE-REGISTRATION record and its binding test** rather than re-derived from the source; the producer asserts the cited record's `record_sha256` matches its pinned value (so a mutation would fail), but does not re-count the oracle registrations from `src`.

## claims_not_made

- No suite-level PASS claim: the rules suite has 2 BLOCKED_MISSING_REFERENCE criteria; the goalkeepers suite has 1 BLOCKED + 1 NEEDS_PERCEPTUAL_REVIEW + 2 NOT_EVALUATED. Neither reduces to a suite PASS.
- No PROMOTION claim.
- No FOUNDATION_LAB_PASS claim.
- No PES 2017 fidelity / measured PES envelope claim; all unmeasured values stay VERSIONED_PROVISIONAL.
- No invented reference envelope or tolerance; blocked references stay BLOCKED_MISSING_REFERENCE.
- No criterion is upgraded beyond what the executed evaluator returns; every PASS cited is from the accepted executed records.
- Zero gameplay/source change in `src/`, `src/adapters/`, `eval/`, `gauntlet/evals/`, `gauntlet/roles/`, `specs/`.
- No accepted record mutation: the cited accepted records stay byte-untouched (verified by their pinned `record_sha256`).

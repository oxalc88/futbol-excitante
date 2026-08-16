from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.7.0"
BRANCH = "feat/gauntlet-0.7.0-deterministic-audit"
BASE_SHA = "13631a029c3c9d22096cdbfb7ad38dc8ce376b44"


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.rstrip() + "\n")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise RuntimeError(f"expected text not found in {path}: {old[:120]!r}")
    write(path, content.replace(old, new, 1))


def replace_section(path: str, start: str, end: str, replacement: str) -> None:
    content = read(path)
    a = content.find(start)
    b = content.find(end, a + len(start))
    if a < 0 or b < 0:
        raise RuntimeError(f"section markers not found in {path}: {start!r} -> {end!r}")
    write(path, content[:a] + replacement.rstrip() + "\n\n" + content[b:])


# ---------------------------------------------------------------------------
# System version + canonical principles
# ---------------------------------------------------------------------------
write(
    "gauntlet/VERSION.json",
    json.dumps(
        {
            "version": VERSION,
            "schema_version": 1,
            "semver": True,
            "previous_system_version": "0.6.0",
            "legacy_prompt_generation": "v6-browser-evidence-model-tracking",
            "baseline_commit": BASE_SHA,
            "includes": [
                "prompts",
                "agents",
                "skills",
                "model-routing",
                "deterministic-tooling",
                "deterministic-evals",
                "model-evals",
                "evidence-contract",
                "timing-contract",
                "acceptance-pipeline",
                "state-audit",
            ],
        },
        indent=2,
    ),
)

write(
    "gauntlet/principles.md",
    """# Gauntlet principles

This file is the canonical source for the acceptance philosophy. Runtime prompts should reference it instead of copying it verbatim.

1. **Deterministic audits may invalidate evidence or state, but they must never replace the Gauntlet critic's qualitative comparison against the reference bar.**
2. **Scripts establish facts. Cheap auditors resolve bounded ambiguity. Critics judge quality against the bar.**
3. A deterministic `PASS` is permission to proceed to criticism, never permission to accept an objective.
4. A cheap semantic-auditor verdict is advisory input to the critic. It can clear or reject a bounded ambiguity, but it cannot accept an objective.
5. Every accepted implementation must have an independent critic verdict and an independent integration-review verdict before the final acceptance transition.
6. Bookkeeping/audit defects are repaired by the orchestrator and re-audited; they do not send already-valid gameplay back to a builder unless implementation evidence itself is defective.
""",
)

write(
    "gauntlet/semantic-audit-contract.md",
    """# Cheap semantic audit contract

Invoke this only when `pnpm run gauntlet:audit` returns `REVIEW_REQUIRED`.

Use `aux` (`gemma4`, fallback `qwen3.6`) with only the bounded finding, objective acceptance criterion, relevant artifact metadata, and the minimum previous-artifact context needed to decide the ambiguity. Do not ask it to re-review the whole objective or compare gameplay quality against the reference bar.

The response must be one JSON object:

```json
{
  "verdict": "VALID|INVALID|INSUFFICIENT_CONTEXT",
  "finding": "EVIDENCE_DUPLICATE_SHA",
  "reason": "short evidence-grounded reason"
}
```

- `VALID`: the bounded concern is cleared; continue to the mandatory critic.
- `INVALID`: repair/capture new evidence and rerun the deterministic audit.
- `INSUFFICIENT_CONTEXT`: collect the missing bounded context; it is not an acceptance verdict.

This auditor can never produce objective `ACCEPT`.
""",
)

write(
    "gauntlet/evidence-classes.md",
    """# Evidence classes

The orchestrator classifies each objective from its acceptance criteria before review. Use the strictest applicable class.

| Class | Required deterministic evidence |
|---|---|
| `HEADLESS` | executed tests |
| `BROWSER_VISIBLE` | executed tests + objective screenshot |
| `MULTI_TICK` | executed tests + relevant integration test + structured trajectory |
| `DYNAMIC_VISUAL` | executed tests + relevant integration test + structured trajectory + objective screenshot |
| `PRESENTATION` | executed tests + objective screenshot; duplicate bytes require semantic review |
| `BOOKKEEPING` | deterministic state/tooling audit; no perceptual artifact by default |

If acceptance explicitly depends on slot/player ownership or routing, add the slot-wiring invariant check regardless of class.

A duplicate screenshot SHA is a fact, not automatically a failure. It yields `REVIEW_REQUIRED`; the cheap semantic audit decides only whether reuse can prove the named criterion. The mandatory critic still judges quality afterward.
""",
)

# ---------------------------------------------------------------------------
# Evidence contract: class-based, deterministic-first, critic-always.
# ---------------------------------------------------------------------------
write(
    "gauntlet/evidence-contract.md",
    """# Evidence contract

Every builder, critic, and integration review uses this shape. Prose without commands, exit codes, and file paths is not evidence. Evidence classes are defined in `gauntlet/evidence-classes.md`; acceptance philosophy is canonical in `gauntlet/principles.md`.

## Mandatory evidence gate

Required evidence is an acceptance gate, not advisory guidance.

- The orchestrator selects the strictest applicable evidence class from the objective's acceptance criteria before review.
- `HEADLESS`: executed tests.
- `BROWSER_VISIBLE`: executed tests plus at least one screenshot under `docs/screenshots/<objective-id>/`.
- `MULTI_TICK`: executed tests, a relevant integration-test pass, and `docs/evidence/<objective-id>/trajectory.json`.
- `DYNAMIC_VISUAL`: all `MULTI_TICK` evidence plus an objective screenshot.
- `PRESENTATION`: executed tests plus an objective screenshot.
- `BOOKKEEPING`: deterministic state/tooling audit; no screenshot is required unless the criteria are also browser-visible/presentation.
- If acceptance explicitly depends on slot/player ownership or routing, the objective audit must include the slot-wiring invariant result.
- Video is optional diagnostic evidence. It never replaces a required trajectory or screenshot.
- Screenshot byte duplication is `REVIEW_REQUIRED`, not automatic `PASS` or `FAIL`; bounded semantic review follows `gauntlet/semantic-audit-contract.md`.
- Tests and deterministic checks establish facts. They never replace the independent critic's qualitative comparison against the applicable reference bar.
- Missing mandatory evidence prevents `ACCEPT` at every review and orchestration stage.

Before the critic, run `pnpm run gauntlet:audit -- --objective <id> --class <class> ...`. `FAIL` must be repaired by the owner reported by the audit. `REVIEW_REQUIRED` invokes the bounded cheap semantic audit. Only `PASS` proceeds to the critic.

## Builder report

```markdown
## Builder report
- objective_id:
- builder_agent:
- builder_model:
- evidence_class: HEADLESS|BROWSER_VISIBLE|MULTI_TICK|DYNAMIC_VISUAL|PRESENTATION|BOOKKEEPING
- hypothesis:
- files_changed:
- commands_run:
  - cmd:
    exit_code:
- tests_run:
  - name:
    result:
- integration_test_result:
- slot_wiring_result:
- required_evidence:
- artifacts:
- spec_sections:
- acceptance_criteria_met:
- known_gaps:
- claims_not_made:
```

Rules:

- Run the commands required by the assigned objective; do not only describe them.
- `claims_not_made` must refuse PES fidelity, invented reference envelopes, and protected regression `PASS` unless the required oracle/review exists and passed.
- If a required command cannot run because the toolchain is absent, that is a failed objective unless the objective is creating that toolchain.
- Builders do not commit/push or edit specs/research/Gauntlet agent prompts.
- When a screenshot is required, capture it via `WIP_SECTION=<objective-id> pnpm run capture-wip` and list the files under `docs/screenshots/<objective-id>/`.
- When a trajectory is required, capture it with the repository-supported command and persist `docs/evidence/<objective-id>/trajectory.json`.

## Critic verdict

```markdown
## Critic verdict
- objective_id:
- critic_agent:
- critic_model:
- builder_agent:
- builder_model:
- independence_ok: true|false
- deterministic_audit: PASS|FAIL|REVIEW_REQUIRED
- semantic_audit: NOT_REQUIRED|VALID|INVALID|INSUFFICIENT_CONTEXT
- evidence_reviewed:
- required_evidence:
- evidence_presence:
- mandatory_evidence_ok: true|false
- reference_bar_reviewed:
- criteria:
  - id:
    class:
    outcome: PASS|FAIL|NOT_EVALUATED|BLOCKED_MISSING_REFERENCE|NEEDS_PERCEPTUAL_REVIEW|INVALID_RUN
    note:
- architecture_violations:
- verdict: ACCEPT|REJECT|RETRY
- required_fixes:
```

Rules:

- `independence_ok` must be true and the critic model must differ from the builder model.
- The critic is mandatory even after deterministic/semantic audit success.
- Verify mandatory artifacts and inspect the candidate against the applicable reference bar; do not merely repeat script output.
- `mandatory_evidence_ok` must be true for `ACCEPT`.
- `BLOCKED_MISSING_REFERENCE` is not a builder failure and must not be converted into invented reference numbers.

## Integration review

```markdown
## Integration review
- objective_id:
- reviewer_agent:
- reviewer_model:
- builder_model:
- independence_ok: true|false
- dependency_direction: PASS|FAIL
- neighboring_regressions:
- deterministic_audit: PASS
- critic_verdict_verified: true|false
- required_evidence:
- evidence_presence:
- mandatory_evidence_ok: true|false
- critic_evidence_gate_ok: true|false
- presentation_authority: PASS|FAIL|NOT_APPLICABLE
- evaluator_integrity: PASS|FAIL|NOT_APPLICABLE
- verdict: ACCEPT|REJECT
- required_fixes:
```

Integration must independently verify mandatory evidence and confirm that the critic actually ran and accepted. A deterministic or cheap-auditor result can never substitute for the critic.
""",
)

# ---------------------------------------------------------------------------
# Audit contracts and deterministic regression evaluator.
# ---------------------------------------------------------------------------
write(
    "gauntlet/evals/contracts/failures.ts",
    """export const GAUNTLET_FAILURE_CLASSES = [
  "premature_stop",
  "stale_active_candidate",
  "horizon_invariant",
  "reviewer_routing",
  "mandatory_evidence_missing",
  "composition_regression",
  "accepted_state_inconsistent",
  "eval_result_stale",
  "evidence_reuse_review",
  "timing_state_inconsistent",
  "critic_bypassed",
  "invalid_acceptance",
  "state_transition",
  "tracking_missing",
  "prompt_contract",
  "model_unavailable",
  "rate_limited",
  "quota_exhausted",
  "internal_error",
  "unknown",
] as const;

export type GauntletFailureClass = (typeof GAUNTLET_FAILURE_CLASSES)[number];

export function isGauntletFailureClass(value: unknown): value is GauntletFailureClass {
  return typeof value === "string" && GAUNTLET_FAILURE_CLASSES.includes(value as GauntletFailureClass);
}
""",
)

write(
    "gauntlet/evals/contracts/scenario.ts",
    """import type { GauntletFailureClass } from "./failures.js";
import type { GauntletStopReason } from "./stop-reasons.js";

export type ScenarioKind =
  | "evidence_gate"
  | "horizon_validation"
  | "routing_fallback"
  | "continuation"
  | "tracking_gate"
  | "composition_gate"
  | "accepted_state_gate"
  | "eval_freshness_gate"
  | "evidence_uniqueness_gate"
  | "timing_consistency_gate"
  | "acceptance_pipeline_gate";

export interface ScenarioExpectation {
  decision: string;
  failure_class?: GauntletFailureClass;
  next_objective?: string;
  next_agent?: string;
  clear_active_candidate?: boolean;
}

export interface EvidenceGateScenario {
  id: string;
  kind: "evidence_gate";
  input: { objective_id: string; gameplay_or_presentation: boolean; browser_behavior?: boolean; screenshot_required: boolean; screenshot_exists: boolean; critic_verdict: "ACCEPT" | "RETRY" | "REJECT" };
  expect: ScenarioExpectation;
}

export interface HorizonValidationScenario {
  id: string;
  kind: "horizon_validation";
  input: { objectives: Array<{ id: string; status: "pending" | "accepted" | "blocked" }>; current_index: number };
  expect: ScenarioExpectation;
}

export interface RoutingFallbackScenario {
  id: string;
  kind: "routing_fallback";
  input: { role: "critic" | "integration-reviewer"; failed_model: string; failure_class: GauntletFailureClass; builder_model: string };
  expect: ScenarioExpectation;
}

export interface ContinuationScenario {
  id: string;
  kind: "continuation";
  input: { active_candidate: string | null; accepted: string[]; current_index: number; objectives: Array<{ id: string; status: "pending" | "accepted" | "blocked" }>; stop_reason?: GauntletStopReason | null };
  expect: ScenarioExpectation;
}

export interface TrackingGateScenario {
  id: string;
  kind: "tracking_gate";
  input: { objective_id: string; tracking_markers_match: boolean; per_step_usage_recorded: boolean; model_aggregates_refreshed: boolean; model_evaluation_recorded: boolean };
  expect: ScenarioExpectation;
}

export interface CompositionGateScenario {
  id: string;
  kind: "composition_gate";
  input: { objective_id: string; integrated_behavior: boolean; unit_tests_pass: boolean; screenshot_exists: boolean; integration_test_pass: boolean; trajectory_exists: boolean; critic_verdict: "ACCEPT" | "RETRY" | "REJECT" };
  expect: ScenarioExpectation;
}

export interface AcceptedStateGateScenario {
  id: string;
  kind: "accepted_state_gate";
  input: { latest_accepted_in_list: boolean; current_horizon_consistent: boolean };
  expect: ScenarioExpectation;
}

export interface EvalFreshnessGateScenario {
  id: string;
  kind: "eval_freshness_gate";
  input: { v07_records_exist: boolean; latest_accepted_has_record: boolean };
  expect: ScenarioExpectation;
}

export interface EvidenceUniquenessGateScenario {
  id: string;
  kind: "evidence_uniqueness_gate";
  input: { duplicate_sha: boolean; criterion_claims_new_evidence: boolean };
  expect: ScenarioExpectation;
}

export interface TimingConsistencyGateScenario {
  id: string;
  kind: "timing_consistency_gate";
  input: { tracking_markers_match: boolean; clock_measurement_matches: boolean; latest_rows_present: boolean };
  expect: ScenarioExpectation;
}

export interface AcceptancePipelineGateScenario {
  id: string;
  kind: "acceptance_pipeline_gate";
  input: { deterministic_audit: "PASS" | "FAIL" | "REVIEW_REQUIRED"; semantic_audit: "NOT_REQUIRED" | "VALID" | "INVALID" | "INSUFFICIENT_CONTEXT"; critic_verdict: "ACCEPT" | "RETRY" | "REJECT" | "MISSING"; integration_verdict: "ACCEPT" | "REJECT" | "MISSING" };
  expect: ScenarioExpectation;
}

export type GauntletScenario = EvidenceGateScenario | HorizonValidationScenario | RoutingFallbackScenario | ContinuationScenario | TrackingGateScenario | CompositionGateScenario | AcceptedStateGateScenario | EvalFreshnessGateScenario | EvidenceUniquenessGateScenario | TimingConsistencyGateScenario | AcceptancePipelineGateScenario;

export interface EvaluationResult extends ScenarioExpectation { scenario_id: string }
""",
)

write(
    "gauntlet/evals/src/evaluate-state.ts",
    """import { isAllowedStopReason } from "../contracts/stop-reasons.js";
import type { EvaluationResult, GauntletScenario, ContinuationScenario, EvidenceGateScenario, HorizonValidationScenario, RoutingFallbackScenario, TrackingGateScenario, CompositionGateScenario, AcceptedStateGateScenario, EvalFreshnessGateScenario, EvidenceUniquenessGateScenario, TimingConsistencyGateScenario, AcceptancePipelineGateScenario } from "../contracts/scenario.js";

function evaluateEvidence(s: EvidenceGateScenario): EvaluationResult {
  const mandatory = s.input.gameplay_or_presentation || s.input.browser_behavior === true || s.input.screenshot_required;
  if (mandatory && !s.input.screenshot_exists && s.input.critic_verdict === "ACCEPT") return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "mandatory_evidence_missing" };
  return { scenario_id: s.id, decision: "allow_review_result" };
}

function evaluateHorizon(s: HorizonValidationScenario): EvaluationResult {
  const ids = s.input.objectives.map((o) => o.id);
  if (new Set(ids).size !== ids.length) return { scenario_id: s.id, decision: "reject_state", failure_class: "horizon_invariant" };
  const firstPending = s.input.objectives.findIndex((o) => o.status === "pending");
  const expected = firstPending === -1 ? s.input.objectives.length : firstPending;
  if (s.input.current_index !== expected) return { scenario_id: s.id, decision: "reject_state", failure_class: "horizon_invariant" };
  return { scenario_id: s.id, decision: "state_valid" };
}

function evaluateRouting(s: RoutingFallbackScenario): EvaluationResult {
  const modelSpecific = ["quota_exhausted", "model_unavailable", "rate_limited"].includes(s.input.failure_class);
  if (s.input.failed_model === "deepseek-v4-flash-0731" && modelSpecific) return { scenario_id: s.id, decision: "fallback", next_agent: s.input.role === "critic" ? "critic-flash" : "integration-reviewer-flash" };
  return { scenario_id: s.id, decision: "do_not_model_fallback", failure_class: "reviewer_routing" };
}

function nextPending(s: ContinuationScenario): string | undefined {
  for (let i = s.input.current_index; i < s.input.objectives.length; i += 1) if (s.input.objectives[i]?.status === "pending") return s.input.objectives[i]?.id;
  return undefined;
}

function evaluateContinuation(s: ContinuationScenario): EvaluationResult {
  if (s.input.stop_reason && isAllowedStopReason(s.input.stop_reason)) return { scenario_id: s.id, decision: "stop" };
  const next = nextPending(s);
  const stale = s.input.active_candidate !== null && s.input.accepted.includes(s.input.active_candidate);
  if (stale && next) return { scenario_id: s.id, decision: "repair_and_continue", failure_class: "stale_active_candidate", clear_active_candidate: true, next_objective: next };
  if (next) return { scenario_id: s.id, decision: "continue", next_objective: next };
  return { scenario_id: s.id, decision: "replan" };
}

function evaluateTracking(s: TrackingGateScenario): EvaluationResult {
  const complete = s.input.tracking_markers_match && s.input.per_step_usage_recorded && s.input.model_aggregates_refreshed && s.input.model_evaluation_recorded;
  return complete ? { scenario_id: s.id, decision: "tracking_complete" } : { scenario_id: s.id, decision: "repair_tracking", failure_class: "tracking_missing" };
}

function evaluateComposition(s: CompositionGateScenario): EvaluationResult {
  const complete = !s.input.integrated_behavior || (s.input.integration_test_pass && s.input.trajectory_exists);
  if (!complete && s.input.critic_verdict === "ACCEPT") return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "composition_regression" };
  return { scenario_id: s.id, decision: "allow_review_result" };
}

function evaluateAcceptedState(s: AcceptedStateGateScenario): EvaluationResult {
  if (!s.input.latest_accepted_in_list || !s.input.current_horizon_consistent) return { scenario_id: s.id, decision: "repair_state", failure_class: "accepted_state_inconsistent" };
  return { scenario_id: s.id, decision: "state_valid" };
}

function evaluateFreshness(s: EvalFreshnessGateScenario): EvaluationResult {
  if (s.input.v07_records_exist && !s.input.latest_accepted_has_record) return { scenario_id: s.id, decision: "repair_persistence", failure_class: "eval_result_stale" };
  return { scenario_id: s.id, decision: "persistence_fresh" };
}

function evaluateUniqueness(s: EvidenceUniquenessGateScenario): EvaluationResult {
  if (s.input.duplicate_sha && s.input.criterion_claims_new_evidence) return { scenario_id: s.id, decision: "review_required", failure_class: "evidence_reuse_review" };
  return { scenario_id: s.id, decision: "evidence_clear" };
}

function evaluateTimingConsistency(s: TimingConsistencyGateScenario): EvaluationResult {
  if (!s.input.tracking_markers_match || !s.input.clock_measurement_matches || !s.input.latest_rows_present) return { scenario_id: s.id, decision: "repair_tracking", failure_class: "timing_state_inconsistent" };
  return { scenario_id: s.id, decision: "timing_consistent" };
}

function evaluateAcceptancePipeline(s: AcceptancePipelineGateScenario): EvaluationResult {
  if (s.input.deterministic_audit !== "PASS") return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "invalid_acceptance" };
  if (!["NOT_REQUIRED", "VALID"].includes(s.input.semantic_audit)) return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "invalid_acceptance" };
  if (s.input.critic_verdict === "MISSING") return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "critic_bypassed" };
  if (s.input.critic_verdict !== "ACCEPT" || s.input.integration_verdict !== "ACCEPT") return { scenario_id: s.id, decision: "reject_acceptance", failure_class: "invalid_acceptance" };
  return { scenario_id: s.id, decision: "candidate_acceptance_ready" };
}

export function evaluateScenario(s: GauntletScenario): EvaluationResult {
  switch (s.kind) {
    case "evidence_gate": return evaluateEvidence(s);
    case "horizon_validation": return evaluateHorizon(s);
    case "routing_fallback": return evaluateRouting(s);
    case "continuation": return evaluateContinuation(s);
    case "tracking_gate": return evaluateTracking(s);
    case "composition_gate": return evaluateComposition(s);
    case "accepted_state_gate": return evaluateAcceptedState(s);
    case "eval_freshness_gate": return evaluateFreshness(s);
    case "evidence_uniqueness_gate": return evaluateUniqueness(s);
    case "timing_consistency_gate": return evaluateTimingConsistency(s);
    case "acceptance_pipeline_gate": return evaluateAcceptancePipeline(s);
  }
}
""",
)

# ---------------------------------------------------------------------------
# Shared state audit core + live state audit.
# ---------------------------------------------------------------------------
write(
    "gauntlet/evals/src/audit-state-core.ts",
    r'''import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface StateCheck { name: string; pass: boolean; detail?: string; owner: "orchestrator" }

function yamlValue(content: string, key: string): string | null {
  const m = content.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, "m"));
  return m?.[1]?.trim() ?? null;
}

export function latestAcceptedObjective(current: string): string | null {
  const marker = "## Last accepted objective";
  const start = current.indexOf(marker);
  if (start < 0) return null;
  const line = current.slice(start + marker.length).split("\n").map((v) => v.trim()).find(Boolean);
  return line?.split(/\s+—\s+|\s+-\s+/)[0]?.trim() || null;
}

function acceptedSection(current: string): string {
  const start = current.indexOf("accepted:");
  if (start < 0) return "";
  const end = current.indexOf("\nblocked:", start);
  return current.slice(start, end < 0 ? current.length : end);
}

function parseHorizon(horizon: string): { currentIndex: number | null; objectives: Array<{id: string; status: string}> } {
  const index = Number(yamlValue(horizon, "current_index"));
  const objectives: Array<{id: string; status: string}> = [];
  const lines = horizon.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const id = lines[i]?.match(/^\s*- id:\s*([^\s#]+)\s*$/)?.[1];
    if (!id) continue;
    let status = "";
    for (let j = i + 1; j < Math.min(lines.length, i + 8); j += 1) {
      const sm = lines[j]?.match(/^\s+status:\s*([^\s#]+)\s*$/);
      if (sm) { status = sm[1] ?? ""; break; }
      if (/^\s*- id:/.test(lines[j] ?? "")) break;
    }
    objectives.push({ id, status });
  }
  return { currentIndex: Number.isFinite(index) ? index : null, objectives };
}

async function acceptanceRecords(repoRoot: string): Promise<Array<Record<string, unknown>>> {
  const root = path.join(repoRoot, "gauntlet/evals/results");
  const records: Array<Record<string, unknown>> = [];
  let days: string[] = [];
  try { days = await readdir(root); } catch { return records; }
  for (const day of days) {
    const dir = path.join(root, day);
    let files: string[] = [];
    try { files = await readdir(dir); } catch { continue; }
    for (const file of files.filter((f) => f.endsWith("-acceptance.json"))) {
      try { records.push(JSON.parse(await readFile(path.join(dir, file), "utf8")) as Record<string, unknown>); } catch { /* malformed record is handled elsewhere */ }
    }
  }
  return records;
}

function rowContains(sectionText: string, objective: string): boolean {
  return sectionText.split("\n").some((line) => line.trimStart().startsWith(`| ${objective} |`));
}

function section(content: string, heading: string, nextHeadingPrefix: string): string {
  const start = content.indexOf(heading);
  if (start < 0) return "";
  const after = start + heading.length;
  const next = content.indexOf(`\n${nextHeadingPrefix}`, after);
  return content.slice(after, next < 0 ? content.length : next);
}

export async function runStateChecks(repoRoot: string): Promise<{ objective: string | null; checks: StateCheck[] }> {
  const [current, horizon, timing] = await Promise.all([
    readFile(path.join(repoRoot, "gauntlet/state/CURRENT.md"), "utf8"),
    readFile(path.join(repoRoot, "gauntlet/state/HORIZON.md"), "utf8"),
    readFile(path.join(repoRoot, "gauntlet/state/TIMING.md"), "utf8"),
  ]);
  const objective = latestAcceptedObjective(current);
  const checks: StateCheck[] = [];
  if (!objective) return { objective, checks: [{ name: "latest accepted objective is parseable", pass: false, detail: "CURRENT.md has no Last accepted objective", owner: "orchestrator" }] };

  checks.push({ name: "CURRENT accepted list contains latest accepted", pass: acceptedSection(current).includes(objective), detail: acceptedSection(current).includes(objective) ? undefined : `${objective} missing from CURRENT.accepted`, owner: "orchestrator" });

  const parsed = parseHorizon(horizon);
  const firstPending = parsed.objectives.findIndex((o) => o.status === "pending");
  const expectedIndex = firstPending < 0 ? parsed.objectives.length : firstPending;
  checks.push({ name: "HORIZON current_index matches first pending", pass: parsed.currentIndex === expectedIndex, detail: parsed.currentIndex === expectedIndex ? undefined : `expected ${expectedIndex}, found ${parsed.currentIndex}`, owner: "orchestrator" });
  const inHorizon = parsed.objectives.find((o) => o.id === objective);
  checks.push({ name: "latest accepted horizon entry is not pending", pass: !inHorizon || inHorizon.status === "accepted", detail: !inHorizon || inHorizon.status === "accepted" ? undefined : `${objective} is ${inHorizon.status}`, owner: "orchestrator" });
  const nextObjective = yamlValue(current, "next_objective_id");
  const indexed = parsed.currentIndex !== null ? parsed.objectives[parsed.currentIndex]?.id ?? null : null;
  checks.push({ name: "CURRENT next objective matches HORIZON index", pass: nextObjective === indexed || (indexed === null && nextObjective === null), detail: nextObjective === indexed || (indexed === null && nextObjective === null) ? undefined : `CURRENT=${nextObjective}, HORIZON=${indexed}`, owner: "orchestrator" });

  const markerKeys = ["last_tracked_objective", "usage_aggregates_through", "model_evaluation_through"];
  for (const key of markerKeys) {
    const value = yamlValue(timing, key);
    checks.push({ name: `${key} matches latest accepted`, pass: value === objective, detail: value === objective ? undefined : `expected ${objective}, found ${value ?? "missing"}`, owner: "orchestrator" });
  }
  const usage = section(timing, "## Per-step time and tokens", "## ");
  const grades = section(timing, "### Per-objective grade", "### ");
  const routes = section(timing, "### Reviewer route and catches", "### ");
  checks.push({ name: "TIMING latest per-step row exists", pass: rowContains(usage, objective), detail: rowContains(usage, objective) ? undefined : `${objective} missing from per-step table`, owner: "orchestrator" });
  checks.push({ name: "TIMING latest builder grade exists", pass: rowContains(grades, objective), detail: rowContains(grades, objective) ? undefined : `${objective} missing from grade table`, owner: "orchestrator" });
  checks.push({ name: "TIMING latest reviewer route exists", pass: rowContains(routes, objective), detail: rowContains(routes, objective) ? undefined : `${objective} missing from reviewer table`, owner: "orchestrator" });

  const measuredAt = yamlValue(timing, "measured_at");
  const clockMatch = timing.match(/Measurement:\s*`?(\d{4}-\d{2}-\d{2})/);
  if (measuredAt && clockMatch?.[1]) {
    checks.push({ name: "TIMING clock measurement date matches measured_at", pass: measuredAt.slice(0, 10) === clockMatch[1], detail: measuredAt.slice(0, 10) === clockMatch[1] ? undefined : `measured_at=${measuredAt}, clock=${clockMatch[1]}`, owner: "orchestrator" });
  }

  const records = await acceptanceRecords(repoRoot);
  const v07 = records.filter((r) => r.gauntlet_version === "0.7.0");
  const hasLatest = v07.some((r) => r.objective_id === objective);
  checks.push({ name: "v0.7 acceptance result freshness", pass: v07.length === 0 || hasLatest, detail: v07.length === 0 || hasLatest ? (v07.length === 0 ? "legacy baseline: no v0.7 acceptance records yet" : undefined) : `${objective} has no v0.7 acceptance record`, owner: "orchestrator" });

  return { objective, checks };
}
''',
)

write(
    "gauntlet/evals/src/run-state-audit.ts",
    '''import path from "node:path";
import { fileURLToPath } from "node:url";
import { runStateChecks } from "./audit-state-core.js";
import { writeEvalResult } from "./write-result.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const { objective, checks } = await runStateChecks(repoRoot);
const failures = checks.filter((c) => !c.pass);

console.log(`Gauntlet live state audit — latest accepted=${objective ?? "unknown"}`);
for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
const resultFile = await writeEvalResult(repoRoot, { evaluator: "state_audit", passed: checks.length - failures.length, failed: failures.length, results: [{ objective, checks }] });
console.log(`Result artifact: ${resultFile}`);
if (failures.length) {
  console.error(`\\nGauntlet live state audit failed: ${failures.length} check(s). Repair bookkeeping/tracking through the orchestrator; do not send a valid implementation back to a builder for state-only failures.`);
  process.exitCode = 1;
} else console.log(`\\nGauntlet live state audit passed: ${checks.length} checks`);
''',
)

# ---------------------------------------------------------------------------
# Objective deterministic audit.
# ---------------------------------------------------------------------------
write(
    "gauntlet/evals/src/gauntlet-audit.ts",
    r'''import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runStateChecks } from "./audit-state-core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

type Status = "PASS" | "FAIL" | "REVIEW_REQUIRED" | "NOT_APPLICABLE";
type Owner = "builder" | "orchestrator" | "semantic";
interface Check { name: string; status: Status; owner: Owner; detail?: string }

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (!key?.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) { args.set(key.slice(2), next); i += 1; } else args.set(key.slice(2), "true");
}
const objective = args.get("objective");
const evidenceClass = (args.get("class") ?? "").toUpperCase();
if (!objective || !["HEADLESS", "BROWSER_VISIBLE", "MULTI_TICK", "DYNAMIC_VISUAL", "PRESENTATION", "BOOKKEEPING"].includes(evidenceClass)) {
  console.error("usage: pnpm run gauntlet:audit -- --objective <id> --class <HEADLESS|BROWSER_VISIBLE|MULTI_TICK|DYNAMIC_VISUAL|PRESENTATION|BOOKKEEPING> [--tests-pass true] [--integration-test-pass true] [--requires-slot-wiring true --slot-wiring-pass true]");
  process.exit(2);
}
const bool = (key: string) => args.get(key) === "true";
const checks: Check[] = [];
const add = (name: string, status: Status, owner: Owner, detail?: string) => checks.push({ name, status, owner, detail });

if (evidenceClass === "BOOKKEEPING") add("tests result", "NOT_APPLICABLE", "builder");
else add("tests result", bool("tests-pass") ? "PASS" : "FAIL", "builder", bool("tests-pass") ? undefined : "executed test result was not supplied as passing");

const screenshotRequired = ["BROWSER_VISIBLE", "DYNAMIC_VISUAL", "PRESENTATION"].includes(evidenceClass);
const trajectoryRequired = ["MULTI_TICK", "DYNAMIC_VISUAL"].includes(evidenceClass);
const integrationRequired = trajectoryRequired;

const screenshotDir = path.join(repoRoot, "docs/screenshots", objective);
let objectiveScreenshots: string[] = [];
try { objectiveScreenshots = (await readdir(screenshotDir)).filter((f) => /\\.(png|jpg|jpeg|webp)$/i.test(f)); } catch { /* absent */ }
add("required screenshot exists", screenshotRequired ? (objectiveScreenshots.length ? "PASS" : "FAIL") : "NOT_APPLICABLE", "builder", screenshotRequired && !objectiveScreenshots.length ? `missing docs/screenshots/${objective}/` : undefined);

const trajectory = path.join(repoRoot, "docs/evidence", objective, "trajectory.json");
let trajectoryExists = false;
try { trajectoryExists = (await stat(trajectory)).isFile(); } catch { /* absent */ }
add("required trajectory exists", trajectoryRequired ? (trajectoryExists ? "PASS" : "FAIL") : "NOT_APPLICABLE", "builder", trajectoryRequired && !trajectoryExists ? `missing docs/evidence/${objective}/trajectory.json` : undefined);
add("integration test result", integrationRequired ? (bool("integration-test-pass") ? "PASS" : "FAIL") : "NOT_APPLICABLE", "builder", integrationRequired && !bool("integration-test-pass") ? "multi-tick evidence requires a relevant integration-test pass" : undefined);

if (bool("requires-slot-wiring")) add("slot/player wiring invariants", bool("slot-wiring-pass") ? "PASS" : "FAIL", "builder", bool("slot-wiring-pass") ? undefined : "slot/player ownership or routing criterion requires a passing invariant test");
else add("slot/player wiring invariants", "NOT_APPLICABLE", "builder");

if (objectiveScreenshots.length) {
  const allRoot = path.join(repoRoot, "docs/screenshots");
  const objectiveHashes = new Map<string, string>();
  for (const file of objectiveScreenshots) {
    const bytes = await readFile(path.join(screenshotDir, file));
    objectiveHashes.set(createHash("sha256").update(bytes).digest("hex"), file);
  }
  const duplicates: Array<{ current: string; other: string; sha256: string }> = [];
  for (const dirent of await readdir(allRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory() || dirent.name === objective) continue;
    let files: string[] = [];
    try { files = (await readdir(path.join(allRoot, dirent.name))).filter((f) => /\\.(png|jpg|jpeg|webp)$/i.test(f)); } catch { continue; }
    for (const file of files) {
      const bytes = await readFile(path.join(allRoot, dirent.name, file));
      const sha = createHash("sha256").update(bytes).digest("hex");
      const current = objectiveHashes.get(sha);
      if (current) duplicates.push({ current, other: `${dirent.name}/${file}`, sha256: sha });
    }
  }
  add("screenshot SHA uniqueness", duplicates.length ? "REVIEW_REQUIRED" : "PASS", duplicates.length ? "semantic" : "builder", duplicates.length ? JSON.stringify(duplicates.slice(0, 8)) : undefined);
} else add("screenshot SHA uniqueness", "NOT_APPLICABLE", "builder");

const state = await runStateChecks(repoRoot);
for (const c of state.checks) add(c.name, c.pass ? "PASS" : "FAIL", "orchestrator", c.detail);

const hasFail = checks.some((c) => c.status === "FAIL");
const hasReview = checks.some((c) => c.status === "REVIEW_REQUIRED");
const status: Status = hasFail ? "FAIL" : hasReview ? "REVIEW_REQUIRED" : "PASS";
const result = { schema_version: 1, gauntlet_version: "0.7.0", objective_id: objective, evidence_class: evidenceClass, status, checks };
console.log(JSON.stringify(result, null, 2));
if (status === "FAIL") process.exitCode = 1;
else if (status === "REVIEW_REQUIRED") process.exitCode = 3;
''',
)

# ---------------------------------------------------------------------------
# Candidate acceptance persistence: mechanically enforces critic-always.
# ---------------------------------------------------------------------------
write(
    "gauntlet/evals/src/persist-acceptance.ts",
    '''import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const raw = process.env.GAUNTLET_ACCEPTANCE_JSON;
if (!raw) throw new Error("GAUNTLET_ACCEPTANCE_JSON is required");
const input = JSON.parse(raw) as Record<string, any>;
const required = ["objective_id", "candidate_commit", "builder", "critic", "integration", "deterministic_audit"];
for (const key of required) if (!input[key]) throw new Error(`missing acceptance field: ${key}`);
if (input.deterministic_audit.status !== "PASS") throw new Error("deterministic audit must PASS before persistence");
if (input.semantic_audit && input.semantic_audit.verdict !== "VALID") throw new Error("semantic audit must be VALID when invoked");
if (input.critic.verdict !== "ACCEPT") throw new Error("critic ACCEPT is mandatory; deterministic/cheap audits cannot substitute");
if (input.integration.verdict !== "ACCEPT") throw new Error("integration ACCEPT is mandatory");
if (input.builder.model === input.critic.model) throw new Error("builder/critic model independence violated");
const version = JSON.parse(await readFile(path.join(repoRoot, "gauntlet/VERSION.json"), "utf8")) as { version: string };
const now = new Date();
const day = now.toISOString().slice(0, 10);
const stamp = now.toISOString().replace(/[:.]/g, "-");
const safeObjective = String(input.objective_id).replace(/[^A-Za-z0-9_-]/g, "_");
const dir = path.join(repoRoot, "gauntlet/evals/results", day);
await mkdir(dir, { recursive: true });
const record = { schema_version: 1, record_type: "candidate_acceptance", gauntlet_version: version.version, persisted_at: now.toISOString(), state_audit_required: true, ...input };
const file = path.join(dir, `${stamp}-${safeObjective}-acceptance.json`);
await writeFile(file, `${JSON.stringify(record, null, 2)}\\n`, "utf8");
console.log(file);
''',
)

# ---------------------------------------------------------------------------
# Regression scenarios 008-013.
# ---------------------------------------------------------------------------
scenarios = {
    "orch-reg-008-accepted-list-consistency.json": {
        "id": "ORCH-REG-008",
        "kind": "accepted_state_gate",
        "input": {"latest_accepted_in_list": False, "current_horizon_consistent": True},
        "expect": {"decision": "repair_state", "failure_class": "accepted_state_inconsistent"},
    },
    "orch-reg-009-persisted-eval-freshness.json": {
        "id": "ORCH-REG-009",
        "kind": "eval_freshness_gate",
        "input": {"v07_records_exist": True, "latest_accepted_has_record": False},
        "expect": {"decision": "repair_persistence", "failure_class": "eval_result_stale"},
    },
    "orch-reg-010-objective-evidence-uniqueness.json": {
        "id": "ORCH-REG-010",
        "kind": "evidence_uniqueness_gate",
        "input": {"duplicate_sha": True, "criterion_claims_new_evidence": True},
        "expect": {"decision": "review_required", "failure_class": "evidence_reuse_review"},
    },
    "orch-reg-011-required-evidence-presence.json": {
        "id": "ORCH-REG-011",
        "kind": "composition_gate",
        "input": {"objective_id": "SYNTH-MULTI-TICK", "integrated_behavior": True, "unit_tests_pass": True, "screenshot_exists": True, "integration_test_pass": True, "trajectory_exists": False, "critic_verdict": "ACCEPT"},
        "expect": {"decision": "reject_acceptance", "failure_class": "composition_regression"},
    },
    "orch-reg-012-timing-state-consistency.json": {
        "id": "ORCH-REG-012",
        "kind": "timing_consistency_gate",
        "input": {"tracking_markers_match": True, "clock_measurement_matches": False, "latest_rows_present": True},
        "expect": {"decision": "repair_tracking", "failure_class": "timing_state_inconsistent"},
    },
    "orch-reg-013-critic-cannot-be-bypassed.json": {
        "id": "ORCH-REG-013",
        "kind": "acceptance_pipeline_gate",
        "input": {"deterministic_audit": "PASS", "semantic_audit": "VALID", "critic_verdict": "MISSING", "integration_verdict": "ACCEPT"},
        "expect": {"decision": "reject_acceptance", "failure_class": "critic_bypassed"},
    },
    "orch-reg-013-valid-critic-path.json": {
        "id": "ORCH-REG-013-VALID",
        "kind": "acceptance_pipeline_gate",
        "input": {"deterministic_audit": "PASS", "semantic_audit": "NOT_REQUIRED", "critic_verdict": "ACCEPT", "integration_verdict": "ACCEPT"},
        "expect": {"decision": "candidate_acceptance_ready"},
    },
}
for name, payload in scenarios.items():
    write(f"gauntlet/evals/scenarios/{name}", json.dumps(payload, indent=2))

# ---------------------------------------------------------------------------
# Prompt gate v0.7: protect operational behavior, not repeated prose.
# ---------------------------------------------------------------------------
write(
    "gauntlet/evals/src/prompt-gate.ts",
    '''import { readFile } from "node:fs/promises";
import path from "node:path";
export interface PromptGateResult { name: string; pass: boolean; detail?: string }
interface GateRule { name: string; file: string; mustContain: string[] }
const RULES: GateRule[] = [
  { name: "canonical principles exist", file: "gauntlet/principles.md", mustContain: ["Deterministic audits may invalidate evidence or state", "Scripts establish facts. Cheap auditors resolve bounded ambiguity. Critics judge quality against the bar."] },
  { name: "main prompt uses deterministic-first critic-always pipeline", file: "gauntlet/PROMPT.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "REVIEW_REQUIRED", "The critic is mandatory", "GAUNTLET_ACCEPTANCE_JSON", "pnpm run gauntlet:eval:state"] },
  { name: "grok orchestrator uses deterministic-first critic-always pipeline", file: ".grok/agents/orchestrator.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "REVIEW_REQUIRED", "critic is mandatory", "GAUNTLET_ACCEPTANCE_JSON", "pnpm run gauntlet:eval:state"] },
  { name: "deepseek orchestrator uses deterministic-first critic-always pipeline", file: ".grok/agents/orchestrator-deepseek.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "REVIEW_REQUIRED", "critic is mandatory", "GAUNTLET_ACCEPTANCE_JSON", "pnpm run gauntlet:eval:state"] },
  { name: "main skill cannot bypass critic", file: ".grok/skills/gauntlet/SKILL.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "REVIEW_REQUIRED", "Critic ACCEPT alone is never final", "GAUNTLET_ACCEPTANCE_JSON"] },
  { name: "continue skill cannot bypass critic", file: ".grok/skills/gauntlet-continue/SKILL.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "The critic remains mandatory", "GAUNTLET_ACCEPTANCE_JSON"] },
  { name: "class-based evidence contract cannot regress", file: "gauntlet/evidence-contract.md", mustContain: ["`HEADLESS`", "`BROWSER_VISIBLE`", "`MULTI_TICK`", "`DYNAMIC_VISUAL`", "`PRESENTATION`", "`BOOKKEEPING`", "The critic is mandatory"] },
  { name: "semantic audit is bounded and cannot accept", file: "gauntlet/semantic-audit-contract.md", mustContain: ["VALID|INVALID|INSUFFICIENT_CONTEXT", "can never produce objective `ACCEPT`"] },
  { name: "semver system version is declared", file: "gauntlet/VERSION.json", mustContain: ["\\\"version\\\": \\\"0.7.0\\\"", "\\\"semver\\\": true"] },
  { name: "reviewer fallback remains explicit", file: "gauntlet/PROMPT.md", mustContain: ["critic-flash", "integration-reviewer-flash"] },
];
export async function runPromptGate(repoRoot: string): Promise<PromptGateResult[]> {
  const results: PromptGateResult[] = [];
  for (const rule of RULES) {
    const content = await readFile(path.join(repoRoot, rule.file), "utf8");
    const missing = rule.mustContain.filter((needle) => !content.includes(needle.replace(/\\\\\"/g, '\"')));
    results.push({ name: rule.name, pass: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : undefined });
  }
  return results;
}
''',
)

# ---------------------------------------------------------------------------
# package scripts and model registry.
# ---------------------------------------------------------------------------
package = json.loads(read("package.json"))
package["scripts"]["gauntlet:audit"] = "tsx gauntlet/evals/src/gauntlet-audit.ts"
package["scripts"]["gauntlet:acceptance:persist"] = "tsx gauntlet/evals/src/persist-acceptance.ts"
write("package.json", json.dumps(package, indent=2))

models = json.loads(read("gauntlet/models.json"))
models["version"] = "gauntlet-models-v4"
models["roles"]["evidence_auditor"] = {
    "agent": "aux",
    "mode": "subagent",
    "provider": "nan",
    "model": "gemma4",
    "api_model": "gemma4",
    "fallback": ["qwen3.6"],
    "constraint": "Bounded semantic audit only after deterministic REVIEW_REQUIRED. Never judges overall reference-bar quality and never accepts an objective.",
}
write("gauntlet/models.json", json.dumps(models, indent=2))

# ---------------------------------------------------------------------------
# Runtime prompt: replace only objective loop, preserving planning/routing.
# ---------------------------------------------------------------------------
replace_once(
    "gauntlet/PROMPT.md",
    "Preserve the adversarial objective loop exactly:\n\nbuilder → required evidence → critic → fix/retry → critic → integration-reviewer → orchestrator evidence gate → accept\n\nA critic ACCEPT is never final. An objective is accepted only after the independent integration review accepts it and the orchestrator verifies every mandatory evidence gate.",
    "Follow the acceptance philosophy in `gauntlet/principles.md`. Preserve the adversarial critic as the qualitative judge; deterministic/cheap audits cannot accept an objective.\n\nCurrent Gauntlet system version is read from `gauntlet/VERSION.json`.\n\nThe v0.7 pipeline is: builder → tests/artifacts → deterministic audit → optional bounded cheap semantic audit → mandatory critic → integration-reviewer → final evidence gate → persist candidate result → bookkeeping → state audit → accept.\n\nA critic ACCEPT is never final. An objective is accepted only after the independent integration review accepts it and the post-bookkeeping state audit passes."
)
new_loop = '''## Loop

Loop until you are stopped or a human-needed blocker is reached:

1. Inspect repository state, `CURRENT.md`, and `HORIZON.md`. Repair a stale accepted `active_candidate`, then validate horizon invariants before selection.
2. If the horizon is missing/exhausted/materially invalidated, perform strategic reassessment and persist a validated 4–8 objective horizon. Otherwise advance without global replanning.
3. Determine the strictest evidence class from `gauntlet/evidence-classes.md`, then delegate one coherent implementation to `builder-qwen` or `builder-mimo`. Require executed tests and class-specific artifacts from `gauntlet/evidence-contract.md`.
4. Run the deterministic pre-review gate: `pnpm run gauntlet:audit -- --objective <id> --class <class> --tests-pass true` plus `--integration-test-pass true` for multi-tick classes and `--requires-slot-wiring true --slot-wiring-pass true` when ownership/routing is an acceptance criterion. The audit covers test facts, artifact existence, screenshot SHA reuse, trajectory requirements, baseline CURRENT/HORIZON consistency, TIMING consistency, v0.7 eval-result freshness, and optional slot/player wiring invariants.
   - `FAIL` with `owner: builder`: return concrete evidence/implementation fixes to the builder.
   - `FAIL` with `owner: orchestrator`: repair bookkeeping/tracking/persistence locally and rerun the audit; do not send valid gameplay back to the builder.
   - `REVIEW_REQUIRED`: invoke `aux` (`gemma4`, fallback `qwen3.6`) under `gauntlet/semantic-audit-contract.md`. It resolves only the bounded ambiguity. `INVALID` returns for new evidence; `INSUFFICIENT_CONTEXT` gathers bounded context; `VALID` proceeds.
   - `PASS`: proceed.
5. The critic is mandatory on every candidate, including deterministic `PASS` and cheap-auditor `VALID`. Default is `critic` on `deepseek-v4-flash-0731`; use `critic-flash` only for model-specific 0731 availability/allowance/capacity failure, then independent Qwen/MiMo fallbacks as already defined. The critic must inspect the candidate against the applicable reference bar and verify evidence; script output is not a qualitative verdict.
6. On critic `RETRY`/`REJECT`, follow the existing retry/revert policy. On critic `ACCEPT`, invoke the independent `integration-reviewer` (or explicit role fallback) to verify composition, neighboring regressions, mandatory evidence, and that the critic actually ran.
7. After critic + integration `ACCEPT`, perform the final evidence gate. Then persist a machine-readable candidate result before state mutation by running `GAUNTLET_ACCEPTANCE_JSON='<json>' pnpm run gauntlet:acceptance:persist`. The JSON must include objective/candidate commit, builder, deterministic audit, optional semantic audit, critic, and integration metadata. The persistence command mechanically refuses a missing/non-ACCEPT critic, missing integration ACCEPT, failed deterministic audit, invalid semantic audit, or builder/critic model collision.
8. Update acceptance bookkeeping as one orchestrator-owned transition: clear `active_candidate`, update `CURRENT.md`, append `HISTORY.md`, refresh `TIMING.md`, mark the existing horizon entry accepted, and recompute `current_index`. Never rewrite historical accepted evidence/state manually.
9. Run `pnpm run gauntlet:eval:state`. It validates accepted-list consistency, CURRENT/HORIZON alignment, TIMING markers/rows/clock consistency, and v0.7 persisted-result freshness. Repair state-only failures locally and rerun until it passes. Only now is the objective `ACCEPT` and eligible for `git-committer`.
10. A successful acceptance commit is not a stopping point. Continue the validated horizon immediately; when exhausted, reassess and start the next horizon.

The deterministic audit and cheap semantic audit are filters before criticism, not substitutes for criticism. Read the canonical wording only from `gauntlet/principles.md`; do not duplicate it into child prompts.
'''
replace_section("gauntlet/PROMPT.md", "## Loop", "## Continuation and stop semantics", new_loop)

# ---------------------------------------------------------------------------
# Orchestrator agents: concise v0.7 execution section; principles referenced.
# ---------------------------------------------------------------------------
new_objective_execution = '''## Objective execution

Follow `gauntlet/principles.md`; do not restate it into child prompts. For each horizon objective:

1. Determine the strictest evidence class from `gauntlet/evidence-classes.md`; delegate implementation to Qwen/MiMo and require the builder report/artifacts in `gauntlet/evidence-contract.md`.
2. Before any critic, run `pnpm run gauntlet:audit -- --objective <id> --class <class> ...` with actual test/integration/slot-wiring results. `FAIL` owned by the builder returns concrete fixes; `FAIL` owned by the orchestrator repairs state/tracking locally. `REVIEW_REQUIRED` invokes `aux`/Gemma (Qwen fallback) only under `gauntlet/semantic-audit-contract.md` and only for the bounded finding.
3. The critic is mandatory after every audit `PASS` and every semantic `VALID`. Default/fallback reviewer routing remains `critic` → `critic-flash` → independent Qwen/MiMo. The critic must judge quality against the applicable reference bar and verify mandatory evidence.
4. Critic `ACCEPT` is not final. Invoke the independent integration reviewer with existing explicit fallback routing; require evidence verification, architecture/neighbor checks, and proof that the critic ran.
5. After critic + integration `ACCEPT`, recheck final evidence and persist the candidate result with `GAUNTLET_ACCEPTANCE_JSON='<json>' pnpm run gauntlet:acceptance:persist`. That command must succeed before state mutation.
6. Perform the bookkeeping transition (`CURRENT`, `HISTORY`, `TIMING`, existing `HORIZON` entry/current_index), then run `pnpm run gauntlet:eval:state`. Repair state-only failures locally until it passes. Only then is the objective accepted and eligible for `git-committer`.
7. Continue immediately to the next valid horizon objective; acceptance, commit completion, bookkeeping repair, and horizon exhaustion are not stop conditions.

Use `aux` for bounded semantic evidence ambiguity or condensation. It can never accept an objective. You may write only `gauntlet/state/**`, `gauntlet/objectives.md`, and transient gitignored `gauntlet/artifacts/**`; never implementation/spec/research/agent files. Never commit or push yourself.
'''
replace_section(".grok/agents/orchestrator.md", "## Objective execution", "## Model discipline", new_objective_execution)

new_overflow_loop = '''## Objective loop

Follow `gauntlet/principles.md` and the v0.7 pipeline in `gauntlet/PROMPT.md`.

For every candidate: builder → tests/artifacts → `pnpm run gauntlet:audit` → optional bounded `aux` semantic audit on `REVIEW_REQUIRED` → mandatory critic → integration reviewer → final evidence gate → `GAUNTLET_ACCEPTANCE_JSON=... pnpm run gauntlet:acceptance:persist` → bookkeeping → `pnpm run gauntlet:eval:state` → accept.

The critic is mandatory even when every deterministic check passes or Gemma/Qwen clears an ambiguity. Scripts establish mechanical facts; only the critic judges candidate quality against the applicable reference bar. Cheap semantic review follows `gauntlet/semantic-audit-contract.md` and cannot return objective ACCEPT.

Audit `FAIL` owned by the builder returns concrete fixes. Audit/state `FAIL` owned by the orchestrator is repaired locally and re-audited; do not resend valid gameplay to a builder for bookkeeping-only defects.

Keep reviewer fallback role-based: `critic`/0731 → `critic-flash` on model-specific 0731 failure → independent Qwen/MiMo; integration uses the corresponding explicit role fallback. Never override a spawned reviewer model in place.

After both reviews accept, candidate persistence must succeed before state mutation. Update `CURRENT`, `HISTORY`, `TIMING`, and the existing `HORIZON` entry/current_index, then require `gauntlet:eval:state` PASS before final acceptance/commit. Continue immediately afterward.

Use `aux` only for bounded semantic audit/condensation. You may write only `gauntlet/state/**`, `gauntlet/objectives.md`, and transient gitignored `gauntlet/artifacts/**`. Never implement or commit directly.
'''
replace_section(".grok/agents/orchestrator-deepseek.md", "## Objective loop", "## Stop conditions", new_overflow_loop)

# Main skill body: keep frontmatter, make runtime contract compact.
skill = read(".grok/skills/gauntlet/SKILL.md")
parts = skill.split("---", 2)
if len(parts) != 3: raise RuntimeError("unexpected gauntlet skill frontmatter")
write(".grok/skills/gauntlet/SKILL.md", "---" + parts[1] + "---\n\n" + '''Start the PES Simulator Gauntlet Loop now. Do not implement gameplay yourself.

Read `gauntlet/PROMPT.md`, `gauntlet/principles.md`, `gauntlet/VERSION.json`, `CURRENT.md`, and `HORIZON.md`. Follow the validated rolling horizon and existing model routing.

For each candidate: builder → tests/artifacts → `pnpm run gauntlet:audit` → optional bounded `aux`/Gemma(Qwen fallback) semantic audit only on `REVIEW_REQUIRED` → mandatory independent critic → integration reviewer → final evidence gate → `GAUNTLET_ACCEPTANCE_JSON=... pnpm run gauntlet:acceptance:persist` → bookkeeping → `pnpm run gauntlet:eval:state` → accept.

Critic ACCEPT alone is never final, and deterministic/cheap-auditor success never bypasses the critic. Audit failures owned by state/bookkeeping are repaired by the orchestrator; implementation/evidence failures return to the builder.

Persist/validate acceptance exactly as `gauntlet/PROMPT.md` specifies, then continue to the next horizon objective. A successful acceptance commit, tracking repair, or horizon exhaustion is not a stop condition. Preserve the existing SuperGrok ≥89% handoff rule.

If the user supplies extra focus, apply it only to objective selection; never skip deterministic audit, critic, integration review, persistence, or state audit.
''')

continue_skill = read(".grok/skills/gauntlet-continue/SKILL.md")
parts = continue_skill.split("---", 2)
if len(parts) != 3: raise RuntimeError("unexpected continue skill frontmatter")
write(".grok/skills/gauntlet-continue/SKILL.md", "---" + parts[1] + "---\n\n" + '''Resume from persisted `HANDOFF.md`/`CURRENT.md`/`HORIZON.md`; do not start over. Read `gauntlet/PROMPT.md`, `gauntlet/principles.md`, and `gauntlet/VERSION.json` before delegation.

Repair stale accepted `active_candidate` and horizon bookkeeping locally. Continue the current horizon unless a documented strategic-boundary condition requires replanning.

For every candidate, preserve v0.7: builder → tests/artifacts → `pnpm run gauntlet:audit` → optional bounded semantic audit on `REVIEW_REQUIRED` → mandatory critic → integration → final gate → `GAUNTLET_ACCEPTANCE_JSON=... pnpm run gauntlet:acceptance:persist` → bookkeeping → `pnpm run gauntlet:eval:state` → accept. The critic remains mandatory after deterministic/cheap audit success.

Continue after acceptance/commit or horizon exhaustion; stop only for the explicit blockers in `gauntlet/PROMPT.md`.
''')

# ---------------------------------------------------------------------------
# README: add system-version section and replace old loop section, preserving setup docs.
# ---------------------------------------------------------------------------
readme = read("gauntlet/README.md")
insert = '''## Gauntlet system version

The Gauntlet is versioned as a complete harness under SemVer in `gauntlet/VERSION.json`: prompts + agents + skills + routing + deterministic tooling/evals + evidence/timing contracts + acceptance/state-audit machinery. Legacy changelog labels such as `v6-browser-evidence-model-tracking` are prompt-generation names, not SemVer releases. The normalized predecessor is `0.6.0`; this architecture is `0.7.0`.

Canonical acceptance philosophy lives in `gauntlet/principles.md` and is referenced by runtime prompts rather than duplicated into every agent. v0.7 is deterministic-first and critic-always: scripts establish facts, bounded ambiguity can be sent cheaply to `aux`/Gemma (Qwen fallback), but every candidate still reaches an independent qualitative critic before integration and final acceptance.

Run the pre-review audit with `pnpm run gauntlet:audit`; candidate acceptance persistence uses `pnpm run gauntlet:acceptance:persist`; post-bookkeeping consistency remains `pnpm run gauntlet:eval:state`.

'''
if "## Gauntlet system version" not in readme:
    readme = readme.replace("## Launch\n", insert + "## Launch\n", 1)
write("gauntlet/README.md", readme)
new_readme_loop = '''## Loop

```text
OBJECTIVE
  ↓
BUILDER
  ↓
tests + class-specific artifacts
  ↓
gauntlet:audit (deterministic facts)
  ├─ FAIL/builder → retry builder
  ├─ FAIL/orchestrator → repair state and re-audit
  └─ REVIEW_REQUIRED → bounded aux/Gemma audit → re-enter gate
  ↓
mandatory independent CRITIC (reference-bar quality)
  ↓
INTEGRATION REVIEWER
  ↓
FINAL EVIDENCE GATE
  ↓
persist candidate acceptance result
  ↓
update CURRENT/HISTORY/HORIZON/TIMING
  ↓
gauntlet:eval:state
  ↓
ACCEPT → next horizon objective
```

Deterministic and cheap semantic audits can block progression but cannot accept an objective. See `gauntlet/principles.md`, `gauntlet/evidence-classes.md`, and `gauntlet/evidence-contract.md`.

Reviewer fallback, rolling-horizon planning, retry/revert semantics, SuperGrok handoff, and builder/critic model independence remain unchanged.
'''
replace_section("gauntlet/README.md", "## Loop", "## What counts as success", new_readme_loop)

# ---------------------------------------------------------------------------
# Eval README: concise v0.7 surface.
# ---------------------------------------------------------------------------
eval_readme = read("gauntlet/evals/README.md")
if "## v0.7 deterministic audit" not in eval_readme:
    eval_readme += '''\n\n## v0.7 deterministic audit\n\n`pnpm run gauntlet:audit -- --objective <id> --class <class> ...` is the pre-critic filesystem/state gate. It emits `PASS`, `FAIL`, or `REVIEW_REQUIRED` with an owner per check. `REVIEW_REQUIRED` is the only path to bounded cheap semantic review.\n\n`GAUNTLET_ACCEPTANCE_JSON='<json>' pnpm run gauntlet:acceptance:persist` writes a candidate acceptance record only after deterministic PASS, semantic VALID when invoked, critic ACCEPT, integration ACCEPT, and builder/critic model independence. `pnpm run gauntlet:eval:state` then checks post-bookkeeping state before final acceptance.\n'''
write("gauntlet/evals/README.md", eval_readme)

# ---------------------------------------------------------------------------
# Changelog: prepend v0.7 without rewriting legacy entries.
# ---------------------------------------------------------------------------
changelog = read("docs/gauntlet-changelog.md")
entry = '''## 2026-08-16 — Deterministic audit and semantic escalation

**Gauntlet system version (SemVer):** `0.7.0`  
**Previous normalized system version:** `0.6.0`  
**Legacy predecessor prompt generation:** `v6-browser-evidence-model-tracking`

### Changed

- Formalized SemVer for the complete project-local Gauntlet harness via `gauntlet/VERSION.json`; version now covers prompts, agents, skills, model routing, deterministic tooling/evals, evidence/timing contracts, acceptance persistence, and state audit.
- Added canonical `gauntlet/principles.md` so the acceptance philosophy is not duplicated token-for-token across agents. Runtime surfaces reference it and deterministic prompt gates enforce the operational consequences.
- Added class-based evidence requirements (`HEADLESS`, `BROWSER_VISIBLE`, `MULTI_TICK`, `DYNAMIC_VISUAL`, `PRESENTATION`, `BOOKKEEPING`).
- Added `gauntlet:audit`, a pre-critic deterministic gate for tests, evidence existence, screenshot SHA reuse, trajectory/integration requirements, CURRENT/HORIZON consistency, TIMING consistency, v0.7 result freshness, and optional slot/player wiring invariants.
- Added bounded semantic escalation: only `REVIEW_REQUIRED` findings go to existing `aux`/Gemma (Qwen fallback), under a closed `VALID|INVALID|INSUFFICIENT_CONTEXT` contract. This role cannot accept an objective or replace reference-bar criticism.
- Added `gauntlet:acceptance:persist`, which refuses candidate persistence unless deterministic audit passed, optional semantic review is valid, critic and integration both accepted, and builder/critic models are independent.
- Extended live state audit to check accepted-list consistency, CURRENT/HORIZON alignment, TIMING tracking/clock consistency, and v0.7 acceptance-result freshness. Historical v0.6-and-earlier objectives are a legacy baseline until the first v0.7 acceptance record exists.
- Added `ORCH-REG-008` through `ORCH-REG-013`, including a protected regression that deterministic/cheap audit success cannot bypass the critic.

### Acceptance pipeline

`builder → tests/artifacts → deterministic audit → optional bounded cheap semantic audit → mandatory critic → integration reviewer → final evidence gate → persist candidate result → bookkeeping → state audit → ACCEPT → next objective`

### Preserved Gauntlet philosophy

The qualitative critic remains the judge against the reference bar. Deterministic tooling removes mechanical work and can invalidate bad evidence/state; it does not convert the Gauntlet into CI or grant acceptance. The canonical wording is intentionally stored once in `gauntlet/principles.md`.

### Migration/runtime notes

No manual rewrite of `gauntlet/state/**` is part of this release. Existing state defects are surfaced by the new audit and must be repaired by the running orchestrator. Existing `aux = gemma4` routing is reused for bounded semantic audit, so no new user-level subagent mapping is required.

### Prompt/rule/tooling surface

- `gauntlet/VERSION.json`
- `gauntlet/principles.md`
- `gauntlet/PROMPT.md`
- `gauntlet/README.md`
- `gauntlet/evidence-contract.md`
- `gauntlet/evidence-classes.md`
- `gauntlet/semantic-audit-contract.md`
- `.grok/agents/orchestrator*.md`
- `.grok/skills/gauntlet*/SKILL.md`
- `gauntlet/evals/**`
- `gauntlet/models.json`
- `package.json`

---

'''
if "Gauntlet system version (SemVer):** `0.7.0`" not in changelog:
    idx = changelog.find("## 2026-")
    if idx < 0: raise RuntimeError("changelog has no dated entries")
    changelog = changelog[:idx] + entry + changelog[idx:]
write("docs/gauntlet-changelog.md", changelog)

# Remove temporary remote-applier files from final diff.
(ROOT / "scripts/temp-apply-gauntlet-v07.py").unlink(missing_ok=True)
(ROOT / ".github/workflows/temp-gauntlet-v07-apply.yml").unlink(missing_ok=True)
print("Gauntlet 0.7.0 files applied")

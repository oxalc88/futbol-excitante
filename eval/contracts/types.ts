/**
 * @module @pes/eval/contracts/types
 *
 * Machine-readable registry interfaces from
 * GAMEPLAY_EVALUATION_SPEC.md §3.
 *
 * These are the structural contracts that materialized registry
 * documents must conform to.  They are NOT the gameplay simulation
 * contracts.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

// ---------------------------------------------------------------------------
// Criterion and execution
// ---------------------------------------------------------------------------

/** Every acceptance criterion has exactly one class (spec §2.1). */
export type CriterionClass =
  | "HARD_INVARIANT"
  | "ENGINE_DESIGN_TARGET"
  | "MEASURED_TARGET"
  | "PERCEPTUAL_TARGET"
  | "REGRESSION"
  | "UNKNOWN";

export type ExecutionPath = "HEADLESS" | "BROWSER";
export type VisualRequirement = "NONE" | "CONDITIONAL" | "REQUIRED";
export type ReferenceClass = "A" | "B" | "C" | "D";
export type CapabilityDisposition =
  | "REQUIRED"
  | "OPTIONAL_DIAGNOSTIC"
  | "DEFERRED"
  | "PROHIBITED";

// ---------------------------------------------------------------------------
// EvaluationCriterion
// ---------------------------------------------------------------------------

export interface EvaluationCriterion {
  criterion_id: string;
  class: CriterionClass;
  rule: string;
}

// ---------------------------------------------------------------------------
// MilestoneProfile (spec §2.3)
// ---------------------------------------------------------------------------

export interface MilestoneProfile {
  milestone_id: "FOUNDATION_LAB" | "PLAYABLE_1V1" | "SMALL_SIDED_SHAPE";
  profile_version: string;
  required_capabilities: string[];
  optional_diagnostic_capabilities: string[];
  deferred_capabilities: string[];
  prohibited_capabilities: string[];
  required_suite_ids: string[];
  required_execution_paths: ExecutionPath[];
  required_browser_case_ids: string[];
  required_criterion_classes: CriterionClass[];
  accepted_required_outcomes: readonly ["PASS"];
  entry_prerequisites: string[];
  exit_prerequisites: string[];
}

// ---------------------------------------------------------------------------
// CapabilityManifest (spec §3)
// ---------------------------------------------------------------------------

export interface CapabilityManifest {
  manifest_id: string;
  manifest_version: string;
  implementation_versions: Record<string, string>;
  dispositions: Record<string, CapabilityDisposition>;
}

// ---------------------------------------------------------------------------
// TestImplementationBinding (spec §3)
// ---------------------------------------------------------------------------

export interface TestImplementationBinding {
  test_id: string;
  scenario_ids: string[];
  metric_ids: string[];
  invariant_ids: string[];
  observation_ids: string[];
  criterion_bindings: Record<string, string[]>;
  required_schema_versions: Record<string, string>;
  implementation_version: string;
}

// ---------------------------------------------------------------------------
// ScenarioDefinition (spec §3)
// ---------------------------------------------------------------------------

export interface ScenarioDefinition {
  scenario_id: string;
  scenario_version: string;
  capability_requirements: string[];
  duration_ticks: number;
  seed_policy: { kind: "FIXED" | "MATRIX" | "HELD_OUT"; values_or_set_id: string };
  initial_state_schema: string;
  initial_state: unknown;
  config_refs: Record<string, string>;
  input_program: { schema_id: string; schema_version: string; value: unknown };
  scheduled_events: unknown[];
  observation_windows: ObservationWindow[];
  requested_observation_ids: string[];
}

export interface ObservationWindow {
  window_id: string;
  start: BoundarySelector;
  end: BoundarySelector;
  boundary_inclusion: "OPEN" | "CLOSED" | "LEFT_CLOSED" | "RIGHT_CLOSED";
  discontinuity_policy: "REJECT" | "RESET" | "OBSERVE";
}

export interface BoundarySelector {
  kind: "ABSOLUTE_TICK" | "EVENT_OCCURRENCE" | "SCENARIO_END";
  tick?: number;
  event_schema_id?: string;
  event_type?: string;
  occurrence?: "FIRST" | "LAST" | number;
  offset_ticks: number;
  missing_boundary_behavior: "INVALID_RUN" | "EMPTY_WINDOW";
}

// ---------------------------------------------------------------------------
// ObservationDefinition (spec §3)
// ---------------------------------------------------------------------------

export interface ObservationDefinition {
  observation_id: string;
  observation_version: string;
  source_kind: "RAW_CANONICAL" | "CANDIDATE_SEMANTIC" | "EVALUATOR_DERIVED" | "PRESENTATION_DIAGNOSTIC";
  producer_boundary: "SIMULATION_SERIALIZER" | "CANDIDATE_EVENT_STREAM" | "EVALUATOR" | "PRESENTATION_SESSION";
  schema_id: string;
  schema_version: string;
  required_fields: string[];
  cadence: "PER_TICK" | "PER_EVENT" | "WINDOW_BOUNDARY" | "CAPTURE_TICK";
  missing_data_behavior: "INVALID_RUN";
}

// ---------------------------------------------------------------------------
// MetricDefinition (spec §3)
// ---------------------------------------------------------------------------

export interface MetricDefinition {
  metric_id: string;
  metric_version: string;
  input_observation_ids: string[];
  units: string;
  estimator_id: string;
  estimator_version: string;
  filters: Array<{ filter_id: string; version: string; parameters: Record<string, unknown> }>;
  window_ids: string[];
  boundary_policy_id: string;
  boundary_policy_version: string;
  invalid_data_behavior: "INVALID_RUN" | "NOT_EVALUATED";
  output_schema_id: string;
  output_schema_version: string;
}

// ---------------------------------------------------------------------------
// InvariantDefinition (spec §3)
// ---------------------------------------------------------------------------

export interface InvariantDefinition {
  invariant_id: string;
  invariant_version: string;
  input_observation_ids: string[];
  oracle_id: string;
  oracle_version: string;
  owner: "PROTECTED_EVALUATOR";
  invalid_data_behavior: "INVALID_RUN";
  output_schema_id: string;
  output_schema_version: string;
}

// ---------------------------------------------------------------------------
// SuiteDefinition (spec §8)
// ---------------------------------------------------------------------------

export interface SuiteDefinition {
  suite_id: string;
  suite_version: string;
  direct_test_ids: string[];
  common_criterion_ids: string[];
  impact_closure: "NONE" | "REACHABLE_FIXED_POINT";
  prerequisite_capabilities: string[];
  seed_matrix_id: string;
  config_matrix_id: string;
  held_out_policy_id: string | null;
  browser_case_ids: string[];
  resource_policy_id: string;
  outcome_reduction_profile_id: string;
  expected_expansion_manifest_id: string;
}

// ---------------------------------------------------------------------------
// TierDefinition (spec §8)
// ---------------------------------------------------------------------------

export interface TierDefinition {
  tier_id: "FAST" | "TARGETED" | "DEEP" | "PROMOTION";
  tier_version: string;
  suite_selection: "FIXED" | "CHANGED_FAMILY" | "CHANGED_FAMILY_WITH_IMPACT" | "MILESTONE_PROFILE";
  suite_ids: string[];
  impact_closure: "NONE" | "REACHABLE_FIXED_POINT";
  seed_matrix_id: string;
  config_matrix_id: string;
  held_out_policy_id: string | null;
  browser_case_policy_id: string;
  resource_policy_id: string;
  outcome_reduction_profile_id: string;
}

// ---------------------------------------------------------------------------
// ReferenceTarget (spec §3 / §5)
// ---------------------------------------------------------------------------

export interface ReferenceTarget {
  target_id: string;
  test_id: string;
  criterion_id: string;
  reference_class: ReferenceClass;
  target_version: string;
  source_stratum: {
    platform: string | null;
    build: string | null;
    settings_hash: string | null;
  };
  observable_conditions: Record<string, unknown>;
  metric_ids: string[];
  distribution_or_envelope_uri: string;
  measurement_uncertainty_uri: string;
  between_event_variability_uri: string;
  provenance_uri: string;
  acceptance_policy_id: string;
  acceptance_parameters: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Expansion manifest
// ---------------------------------------------------------------------------

export interface ExpansionManifest {
  suite_id: string;
  suite_version: string;
  direct_test_ids: string[];
  expanded_test_ids: string[];
  common_criterion_ids: string[];
  impact_closure: "NONE" | "REACHABLE_FIXED_POINT";
  catalog_version: string;
  registry_set_id: string;
  content_hash: string;
}

// ---------------------------------------------------------------------------
// Registry load outcome helpers
// ---------------------------------------------------------------------------

/** Outcome of evaluating a criterion on a test run. */
export type EvaluationOutcome =
  | "PASS"
  | "FAIL"
  | "NOT_EVALUATED"
  | "BLOCKED_MISSING_REFERENCE"
  | "NEEDS_PERCEPTUAL_REVIEW"
  | "INVALID_RUN";

/** A single criterion evaluation result. */
export interface CriterionEvaluationResult {
  criterion_id: string;
  class: CriterionClass;
  outcome: EvaluationOutcome;
  target_id: string | null;
  evidence: string[];
}

// ---------------------------------------------------------------------------
// Browser case result
// ---------------------------------------------------------------------------

/**
 * Result recorded when a browser case is executed.
 * Browser case results populate `RegistrySet.browser_cases`.
 */
export interface BrowserCaseResult {
  /** Case identifier — must match a definition in the browser-case registry. */
  case_id: string;
  /** Whether the case passed. */
  passed: boolean;
  /** Optional error message if the case failed or could not run. */
  error?: string;
  /** Evidence proving a real browser run occurred. */
  evidence: {
    /** Initial state hash from the bridge after reset (stateHash()). */
    initialHash: string;
    /** Per-tick state hashes from bridge.step() if inputs were injected. */
    perTickHashes?: string[];
  };
}

/** Overall test outcome. */
export interface TestEvaluationResult {
  test_id: string;
  scenario_id: string;
  candidate_run_manifest_hash: string;
  baseline_run_manifest_hash: string;
  comparison_condition_hash: string;
  criteria: CriterionEvaluationResult[];
  overall: EvaluationOutcome;
}
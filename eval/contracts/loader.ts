/**
 * @module @pes/eval/contracts/loader
 *
 * Load and validate the evaluation registry set.
 *
 * The loader assembles all registry modules, deduplicates IDs,
 * cross-validates references, and produces a content hash.  Missing
 * ReferenceTarget for a MEASURED_TARGET criterion is treated as
 * BLOCKED_MISSING_REFERENCE at evaluation time (not a loader failure).
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { encodeCanonical } from "../../src/simulation/determinism/canonical.js";
import { hashFnv1a64 } from "../../src/simulation/determinism/hash.js";

import type {
  MilestoneProfile,
  CapabilityManifest,
  EvaluationCriterion,
  InvariantDefinition,
  ObservationDefinition,
  MetricDefinition,
  SuiteDefinition,
  TestImplementationBinding,
  ReferenceTarget,
  ScenarioDefinition,
  ExpansionManifest,
  BrowserCaseResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Import all registry modules
// ---------------------------------------------------------------------------

import { MILESTONE_PROFILES } from "./profiles.js";
import { CAPABILITY_MANIFESTS } from "./capabilities.js";
import { COMMON_CRITERIA } from "./common-criteria.js";
import { INVARIANT_DEFINITIONS } from "./invariant-definitions.js";
import { OBSERVATION_DEFINITIONS } from "./observation-definitions.js";
import { METRIC_DEFINITIONS } from "./metric-definitions.js";
import { SCENARIO_REGISTRY } from "./scenarios.js";
import { SUITES } from "./suites.js";
import { REFERENCE_TARGETS } from "./reference-targets.js";
import { SEED_POLICIES } from "./policies.js";
import { CONFIG_POLICIES } from "./policies.js";
import { RESOURCE_POLICIES } from "./policies.js";
import { OUTCOME_REDUCTION_POLICIES } from "./policies.js";
import { EXPANSION_MANIFESTS } from "./policies.js";
import { TEST_BINDINGS } from "./bindings.js";
import { BROWSER_CASES } from "./browser-cases.js";

// ---------------------------------------------------------------------------
// Typed registry set
// ---------------------------------------------------------------------------

export interface RegistrySet {
  /** Unique identifier for this registry set. */
  registry_set_id: string;
  /** Content hash covering every loaded definition. */
  content_hash: string;
  milestone_profiles: Record<string, MilestoneProfile>;
  capability_manifests: Record<string, CapabilityManifest>;
  common_criteria: Record<string, EvaluationCriterion>;
  invariant_definitions: Record<string, InvariantDefinition>;
  observation_definitions: Record<string, ObservationDefinition>;
  metric_definitions: Record<string, MetricDefinition>;
  scenario_definitions: Record<string, ScenarioDefinition>;
  suite_definitions: Record<string, SuiteDefinition>;
  test_bindings: Record<string, TestImplementationBinding>;
  reference_targets: Record<string, ReferenceTarget>;
  seed_policies: Record<string, any>;
  config_policies: Record<string, any>;
  resource_policies: Record<string, any>;
  outcome_reduction_policies: Record<string, any>;
  expansion_manifests: Record<string, ExpansionManifest>;
  /** Browser case results from a browser evaluation run. */
  browser_cases: BrowserCaseResult[];
}

// ---------------------------------------------------------------------------
// Resolve outcome
// ---------------------------------------------------------------------------

export type ResolveOutcome =
  | { kind: "RESOLVED"; target: ReferenceTarget }
  | { kind: "BLOCKED_MISSING_REFERENCE" }
  | { kind: "INVALID_RUN"; reason: string };

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

export interface ValidationError {
  /** The registry object type where the error occurred. */
  source: string;
  /** Short description. */
  message: string;
}

// ---------------------------------------------------------------------------
// Known policy field names — unrecognized fields are rejected
// ---------------------------------------------------------------------------

const KNOWN_SEED_FIELDS = new Set([
  "policy_id",
  "policy_version",
  "kind",
  "seeds",
  "scenario_ids",
  "description",
]);

const KNOWN_CONFIG_FIELDS = new Set([
  "policy_id",
  "policy_version",
  "config_refs",
  "description",
]);

const KNOWN_RESOURCE_FIELDS = new Set([
  "policy_id",
  "policy_version",
  "tier",
  "max_concurrent",
  "description",
]);

const KNOWN_OUTCOME_FIELDS = new Set([
  "policy_id",
  "policy_version",
  "required_outcome",
  "treat_unknown_as",
  "description",
]);

/** Check that a plain object has no unrecognized fields. */
function checkNoExtraFields(
  obj: Record<string, unknown>,
  knownFields: Set<string>,
  source: string,
  id: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const key of Object.keys(obj)) {
    if (!knownFields.has(key)) {
      errors.push({
        source,
        message: `Unrecognized field "${key}" in ${source} "${id}"`,
      });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate the entire registry set.
 *
 * Checks:
 * - No duplicate IDs across all registries.
 * - All referenced IDs (scenarios, metrics, invariants, observations)
 *   resolve to registered definitions.
 * - Scenario IDs in suite direct_test_ids are not checked (tests have
 *   their own scenario_ids bindings); only binding scenarios are checked.
 * - Unrecognized fields in policy objects.
 *
 * @returns Array of validation errors (empty if valid).
 */
export function validateRegistrySet(set: RegistrySet): ValidationError[] {
  const errors: ValidationError[] = [];

  // ---- Deduplication within each registry ----
  errors.push(
    ...checkDuplicateIds(set.milestone_profiles, "milestone_profile"),
  );
  errors.push(...checkDuplicateIds(set.capability_manifests, "capability"));
  errors.push(...checkDuplicateIds(set.common_criteria, "criterion"));
  errors.push(...checkDuplicateIds(set.invariant_definitions, "invariant"));
  errors.push(
    ...checkDuplicateIds(set.observation_definitions, "observation"),
  );
  errors.push(...checkDuplicateIds(set.metric_definitions, "metric"));
  errors.push(...checkDuplicateIds(set.scenario_definitions, "scenario"));
  errors.push(...checkDuplicateIds(set.suite_definitions, "suite"));
  errors.push(...checkDuplicateIds(set.test_bindings, "test_binding"));
  errors.push(
    ...checkDuplicateIds(set.reference_targets, "reference_target"),
  );
  errors.push(...checkDuplicateIds(set.seed_policies, "seed_policy"));
  errors.push(...checkDuplicateIds(set.config_policies, "config_policy"));
  errors.push(...checkDuplicateIds(set.resource_policies, "resource_policy"));
  errors.push(
    ...checkDuplicateIds(set.outcome_reduction_policies, "outcome_policy"),
  );
  errors.push(
    ...checkDuplicateIds(set.expansion_manifests, "expansion_manifest"),
  );

  // ---- Reference validation ----
  errors.push(
    ...validateScenarioRefs(set.scenario_definitions, set.test_bindings),
  );
  errors.push(
    ...validateMetricRefs(set.metric_definitions, set.test_bindings),
  );
  errors.push(
    ...validateInvariantRefs(
      set.invariant_definitions,
      set.test_bindings,
    ),
  );
  errors.push(
    ...validateObservationRefs(
      set.observation_definitions,
      set.test_bindings,
    ),
  );
  errors.push(
    ...validateSuiteRefs(set.suite_definitions, set.test_bindings),
  );
  errors.push(
    ...validateTestBindingRequiredObservables(set.test_bindings),
  );
  errors.push(
    ...checkExtraPolicyFields(
      set.seed_policies,
      KNOWN_SEED_FIELDS,
    ),
  );
  errors.push(
    ...checkExtraPolicyFields(set.config_policies, KNOWN_CONFIG_FIELDS),
  );
  errors.push(
    ...checkExtraPolicyFields(set.resource_policies, KNOWN_RESOURCE_FIELDS),
  );
  errors.push(
    ...checkExtraPolicyFields(
      set.outcome_reduction_policies,
      KNOWN_OUTCOME_FIELDS,
    ),
  );

  return errors;
}

/** Check for duplicate IDs within a registry.
 * JS object keys are unique, so this checks that the primary `_id` field
 * of each value matches the key.  Non-primary `_id` fields (oracle_id,
 * estimator_id, schema_id, etc.) are references and must not be compared.
 *
 * We identify the primary `_id` by checking: is the value's own registry
 * key (the map key) equal to any `_id` field?  Only then is that field
 * the primary id. */
function checkDuplicateIds(
  registry: Record<string, unknown>,
  typeName: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [key, value] of Object.entries(registry)) {
    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, string>;
      // Find the primary _id: the one whose value equals the registry key.
      // This avoids false positives from reference fields like oracle_id,
      // estimator_id, schema_id, boundary_policy_id, etc.
      let foundPrimary = false;
      for (const idKey of Object.keys(obj)) {
        if (idKey.endsWith("_id") && obj[idKey] === key) {
          foundPrimary = true;
          break;
        }
      }
      // If we find no primary _id that matches the key, the registry
      // structure is malformed.  Log once per registry.
      if (!foundPrimary && Object.keys(obj).length > 0) {
        errors.push({
          source: "dedup",
          message: `${typeName} key "${key}" has no primary _id matching the key`,
        });
      }
    }
  }
  return errors;
}

/** Check that every scenario_id referenced by bindings exists. */
function validateScenarioRefs(
  scenarios: Record<string, ScenarioDefinition>,
  bindings: Record<string, TestImplementationBinding>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [testId, binding] of Object.entries(bindings)) {
    for (const sid of binding.scenario_ids) {
      if (!(sid in scenarios)) {
        errors.push({
          source: "ref",
          message: `Test binding "${testId}" references missing scenario "${sid}"`,
        });
      }
    }
  }
  return errors;
}

/** Check that every metric_id referenced by bindings exists. */
function validateMetricRefs(
  metrics: Record<string, MetricDefinition>,
  bindings: Record<string, TestImplementationBinding>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [testId, binding] of Object.entries(bindings)) {
    for (const mid of binding.metric_ids) {
      if (!(mid in metrics)) {
        errors.push({
          source: "ref",
          message: `Test binding "${testId}" references missing metric "${mid}"`,
        });
      }
    }
  }
  return errors;
}

/** Check that every invariant_id referenced by bindings exists. */
function validateInvariantRefs(
  invariants: Record<string, InvariantDefinition>,
  bindings: Record<string, TestImplementationBinding>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [testId, binding] of Object.entries(bindings)) {
    for (const iid of binding.invariant_ids) {
      if (!(iid in invariants)) {
        errors.push({
          source: "ref",
          message: `Test binding "${testId}" references missing invariant "${iid}"`,
        });
      }
    }
  }
  return errors;
}

/** Check that every observation_id referenced by bindings exists. */
function validateObservationRefs(
  observations: Record<string, ObservationDefinition>,
  bindings: Record<string, TestImplementationBinding>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [testId, binding] of Object.entries(bindings)) {
    for (const oid of binding.observation_ids) {
      if (!(oid in observations)) {
        errors.push({
          source: "ref",
          message: `Test binding "${testId}" references missing observation "${oid}"`,
        });
      }
    }
  }
  return errors;
}

/** Check that every suite references valid bindings. */
function validateSuiteRefs(
  suites: Record<string, SuiteDefinition>,
  bindings: Record<string, TestImplementationBinding>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [suiteId, suite] of Object.entries(suites)) {
    for (const tid of suite.direct_test_ids) {
      if (!(tid in bindings)) {
        errors.push({
          source: "ref",
          message: `Suite "${suiteId}" references missing test binding "${tid}"`,
        });
      }
    }
  }
  return errors;
}

/**
 * Validate that every test binding declares at least one scenario and one
 * observation — both are required logical observables per spec.
 */
function validateTestBindingRequiredObservables(
  bindings: Record<string, TestImplementationBinding>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [testId, binding] of Object.entries(bindings)) {
    if (binding.scenario_ids.length === 0) {
      errors.push({
        source: "obs",
        message: `Test binding "${testId}" declares no scenario_ids (required observable)`,
      });
    }
    if (binding.observation_ids.length === 0) {
      errors.push({
        source: "obs",
        message: `Test binding "${testId}" declares no observation_ids (required observable)`,
      });
    }
  }
  return errors;
}

/** Check for extra fields in policy objects. */
function checkExtraPolicyFields(
  policies: Record<string, any>,
  knownFields: Set<string>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [id, obj] of Object.entries(policies)) {
    if (typeof obj === "object" && obj !== null) {
      errors.push(...checkNoExtraFields(obj, knownFields, "policy", id));
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Load the registry set
// ---------------------------------------------------------------------------

/**
 * Assemble the complete registry set from all contract modules.
 *
 * This is a static assembly — no file I/O happens inside this module.
 * Actual file loading is done at the caller level (eval package root)
 * and passed in as plain objects.  For the bootstrap case the values
 * are the already-loaded module exports.
 */
export function loadRegistrySet(): RegistrySet {
  const registry: RegistrySet = {
    registry_set_id: "placeholder",
    content_hash: "placeholder",
    milestone_profiles: MILESTONE_PROFILES,
    capability_manifests: CAPABILITY_MANIFESTS,
    common_criteria: COMMON_CRITERIA,
    invariant_definitions: INVARIANT_DEFINITIONS,
    observation_definitions: OBSERVATION_DEFINITIONS,
    metric_definitions: METRIC_DEFINITIONS,
    scenario_definitions: SCENARIO_REGISTRY,
    suite_definitions: SUITES,
    test_bindings: TEST_BINDINGS,
    reference_targets: REFERENCE_TARGETS,
    seed_policies: SEED_POLICIES,
    config_policies: CONFIG_POLICIES,
    resource_policies: RESOURCE_POLICIES,
    outcome_reduction_policies: OUTCOME_REDUCTION_POLICIES,
    expansion_manifests: EXPANSION_MANIFESTS,
    browser_cases: [],
  };

  // Validate
  const errors = validateRegistrySet(registry);
  if (errors.length > 0) {
    const msgs = errors.map((e) => `${e.source}: ${e.message}`);
    throw new Error(
      `Registry validation failed with ${errors.length} error(s):\n${msgs.join("\n")}`,
    );
  }

  // Compute content hash from canonical form
  const hashable = {
    catalogVersion: "gameplay-evaluation-v2",
    milestoneProfiles: MILESTONE_PROFILES,
    capabilityManifests: CAPABILITY_MANIFESTS,
    commonCriteria: COMMON_CRITERIA,
    invariantDefinitions: INVARIANT_DEFINITIONS,
    observationDefinitions: OBSERVATION_DEFINITIONS,
    metricDefinitions: METRIC_DEFINITIONS,
    scenarioRegistry: SCENARIO_REGISTRY,
    suites: SUITES,
    testBindings: TEST_BINDINGS,
    referenceTargets: REFERENCE_TARGETS,
    seedPolicies: SEED_POLICIES,
    configPolicies: CONFIG_POLICIES,
    resourcePolicies: RESOURCE_POLICIES,
    outcomeReductionPolicies: OUTCOME_REDUCTION_POLICIES,
    expansionManifests: EXPANSION_MANIFESTS,
    browserCases: BROWSER_CASES,
  };

  // Assign schema version to the top-level hashable
  const hashableWithSchema: Record<string, unknown> = hashable;
  hashableWithSchema.schemaVersion = "registry-set-schema-v1";

  try {
    const canonical = encodeCanonical(hashableWithSchema);
    const hash = hashFnv1a64(canonical);
    registry.registry_set_id = hash;
    registry.content_hash = hash;
  } catch {
    // Fallback hash from plain JSON stringify if encodeCanonical fails
    const json = JSON.stringify(
      Object.fromEntries(
        Object.keys(hashable).sort().map((k) => [k, hashable[k as keyof typeof hashable]]),
      ),
    );
    const hash = hashFnv1a64(json);
    registry.registry_set_id = hash;
    registry.content_hash = hash;
  }

  return registry;
}

// ---------------------------------------------------------------------------
// Resolve function
// ---------------------------------------------------------------------------

/**
 * Resolve a reference target for a (test_id, criterion_id) pair.
 *
 * Returns:
 * - RESOLVED           when a ReferenceTarget exists for the pair
 * - BLOCKED_MISSING_REFERENCE when resolveReferenceTarget returns undefined
 *   (no target is registered yet at bootstrap)
 * - INVALID_RUN        when the test_id or criterion_id is not found
 *   in the known registries
 *
 * A missing ReferenceTarget for a MEASURED_TARGET criterion does NOT
 * cause a loader failure; it yields BLOCKED_MISSING_REFERENCE at
 * evaluation time.
 */
export function resolveReference(
  testId: string,
  criterionId: string,
  registry: RegistrySet,
): ResolveOutcome {
  // Verify test_id exists in bindings
  const binding = registry.test_bindings[testId];
  if (!binding) {
    return { kind: "INVALID_RUN", reason: `Unknown test_id: ${testId}` };
  }

  // Verify criterion_id exists in common criteria or bindings
  const criterion = registry.common_criteria[criterionId];
  if (!criterion && !binding.criterion_bindings[criterionId]) {
    return { kind: "INVALID_RUN", reason: `Unknown criterion_id: ${criterionId}` };
  }

  // Check reference targets
  const target = registry.reference_targets[
    `${testId}:${criterionId}`
  ] as ReferenceTarget | undefined;

  if (!target) {
    return { kind: "BLOCKED_MISSING_REFERENCE" };
  }

  return { kind: "RESOLVED", target };
}

// ---------------------------------------------------------------------------
// Quick resolve using the default registry (convenience)
// ---------------------------------------------------------------------------

/**
 * Convenience function that loads a fresh registry set and resolves.
 */
export function resolveReferenceDefault(
  testId: string,
  criterionId: string,
): ResolveOutcome {
  const registry = loadRegistrySet();
  return resolveReference(testId, criterionId, registry);
}
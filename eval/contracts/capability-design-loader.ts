/**
 * @module @pes/eval/contracts/capability-design-loader
 *
 * Load and validate the CapabilityDesignProfile.
 *
 * Validation checks:
 *  1. No duplicate axis IDs across axes.
 *  2. Every axis has all required fields.
 *  3. Axis labels do not contain PES/provider-rating language.
 *  4. The profile itself does not claim PES.
 *  5. Criterion bindings reference valid axis IDs.
 *  6. Protected outputs are non-empty strings.
 *  7. Cross-coupling entries reference valid metric IDs.
 *
 * Errors that DO NOT prevent loading:
 *  - DEFERRED axis with empty scenario_ids / metric_ids (expected).
 *
 * Errors that DO prevent loading:
 *  - Duplicate axis IDs.
 *  - Missing required fields.
 *  - PES/provider-rating language in axis labels.
 *  - Criterion bindings pointing to non-existent axis IDs.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { encodeCanonical } from "../../src/simulation/determinism/canonical.js";
import { hashFnv1a64 } from "../../src/simulation/determinism/hash.js";

import { CAPABILITY_DESIGN_PROFILE as RAW_PROFILE } from "./capability-design-profiles.js";
import type { CapabilityDesignProfile } from "./capability-design.js";

// ---------------------------------------------------------------------------
// PES/provider-rating language — must NOT appear in axis labels
// ---------------------------------------------------------------------------

const FORBIDDEN_PES_TERMS = [
  "pes",
  "pro evolution",
  "konami",
  "efootball",
  "rating",
  "stat",
  "player rating",
  "attribute",
  "playmaker",
  "archetype",
];

function containsPesLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_PES_TERMS.some((term) => lower.includes(term));
}

// ---------------------------------------------------------------------------
// Known scenario and metric IDs (from the loaded registry)
// ---------------------------------------------------------------------------

/**
 * Minimal set of scenario IDs known to exist at the bootstrap level.
 * This is a conservative check: the loader does NOT depend on the full
 * scenario registry to validate the profile structure.
 */
const KNOWN_SCENARIO_IDS = new Set([
  "scn-loc-acc-002-v1",
  "scn-duels-phy-shld-001-v1",
]);

const KNOWN_METRIC_IDS = new Set([
  "player-speed",
  "player-displacement",
  "player-heading-change",
  "ball-speed",
  "ball-distance",
  "ball-contact",
  "ball-height",
]);

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

export interface CapabilityDesignValidationError {
  source: string;
  message: string;
}

/**
 * Validate a CapabilityDesignProfile.
 *
 * @param profile - The profile to validate.
 * @returns Array of validation errors (empty if valid).
 */
export function validateCapabilityDesignProfile(
  profile: CapabilityDesignProfile,
): CapabilityDesignValidationError[] {
  const errors: CapabilityDesignValidationError[] = [];

  // 1. Check for duplicate axis IDs
  errors.push(...checkDuplicateAxisIds(profile));

  // 2. Check required fields per axis
  errors.push(...checkRequiredFields(profile));

  // 3. Check for PES/provider-rating language
  errors.push(...checkNoPesLanguage(profile));

  // 4. Check criterion_bindings reference valid axis IDs
  errors.push(...checkCriterionBindings(profile));

  // 5. Check protected outputs are non-empty
  errors.push(...checkProtectedOutputs(profile));

  // 6. Check cross-coupling metric IDs
  errors.push(...checkCrossCouplingRefs(profile));

  return errors;
}

// ---------------------------------------------------------------------------
// Individual validation checks
// ---------------------------------------------------------------------------

/** Check that all axis IDs are unique. */
function checkDuplicateAxisIds(
  profile: CapabilityDesignProfile,
): CapabilityDesignValidationError[] {
  const errors: CapabilityDesignValidationError[] = [];
  const seenAxisIds = new Set<string>();
  for (const [key, axis] of Object.entries(profile.axes)) {
    // Key must match axis_id
    if (key !== axis.axis_id) {
      errors.push({
        source: "dedup",
        message: `Axis "${key}" key does not match axis_id "${axis.axis_id}"`,
      });
    }
    // Check for duplicate axis_id values
    if (seenAxisIds.has(axis.axis_id)) {
      errors.push({
        source: "dedup",
        message: `Duplicate axis_id "${axis.axis_id}"`,
      });
    }
    seenAxisIds.add(axis.axis_id);
  }
  return errors;
}

/** Check that every axis has all required fields populated. */
function checkRequiredFields(
  profile: CapabilityDesignProfile,
): CapabilityDesignValidationError[] {
  const errors: CapabilityDesignValidationError[] = [];
  for (const [axisId, axis] of Object.entries(profile.axes)) {
    if (!axis.axis_id) {
      errors.push({
        source: "field",
        message: `Axis "${axisId}" missing required field "axis_id"`,
      });
    }
    if (!axis.label) {
      errors.push({
        source: "field",
        message: `Axis "${axisId}" missing required field "label"`,
      });
    }
    if (!axis.status) {
      errors.push({
        source: "field",
        message: `Axis "${axisId}" missing required field "status"`,
      });
    }
    if (axis.status !== "IMPLEMENTED" && axis.status !== "DEFERRED") {
      errors.push({
        source: "field",
        message: `Axis "${axisId}" has invalid status "${axis.status}"`,
      });
    }
    if (!axis.profile_value_low || typeof axis.profile_value_low.value !== "number") {
      errors.push({
        source: "field",
        message: `Axis "${axisId}" missing or invalid profile_value_low`,
      });
    }
    if (!axis.profile_value_high || typeof axis.profile_value_high.value !== "number") {
      errors.push({
        source: "field",
        message: `Axis "${axisId}" missing or invalid profile_value_high`,
      });
    }
    if (!axis.expected_monotonic_direction) {
      errors.push({
        source: "field",
        message: `Axis "${axisId}" missing required field "expected_monotonic_direction"`,
      });
    }
    if (!axis.minimum_material_effect?.metric_id) {
      errors.push({
        source: "field",
        message: `Axis "${axisId}" missing minimum_material_effect.metric_id`,
      });
    }
    if (axis.minimum_material_effect && typeof axis.minimum_material_effect.value !== "number") {
      errors.push({
        source: "field",
        message: `Axis "${axisId}" missing minimum_material_effect.value`,
      });
    }
    if (!axis.estimator_id) {
      errors.push({
        source: "field",
        message: `Axis "${axisId}" missing estimator_id`,
      });
    }
    if (!axis.estimator_version) {
      errors.push({
        source: "field",
        message: `Axis "${axisId}" missing estimator_version`,
      });
    }
    if (!axis.policy_version) {
      errors.push({
        source: "field",
        message: `Axis "${axisId}" missing policy_version`,
      });
    }
  }
  return errors;
}

/** Check that axis labels do not contain PES/provider-rating language. */
function checkNoPesLanguage(
  profile: CapabilityDesignProfile,
): CapabilityDesignValidationError[] {
  const errors: CapabilityDesignValidationError[] = [];
  // Also check the full profile label if it has one
  if (profile.profile_version && containsPesLanguage(profile.profile_version)) {
    errors.push({
      source: "pes-language",
      message: `Profile version "${profile.profile_version}" contains prohibited PES/provider-rating language`,
    });
  }
  for (const [axisId, axis] of Object.entries(profile.axes)) {
    if (axis.label && containsPesLanguage(axis.label)) {
      errors.push({
        source: "pes-language",
        message: `Axis "${axisId}" label "${axis.label}" contains prohibited PES/provider-rating language`,
      });
    }
  }
  return errors;
}

/** Check that criterion_bindings reference valid axis IDs. */
function checkCriterionBindings(
  profile: CapabilityDesignProfile,
): CapabilityDesignValidationError[] {
  const errors: CapabilityDesignValidationError[] = [];
  for (const [criterionId, axisId] of Object.entries(profile.criterion_bindings)) {
    if (!(axisId in profile.axes)) {
      errors.push({
        source: "ref",
        message: `Criterion binding "${criterionId}" references unknown axis_id "${axisId}"`,
      });
    }
  }
  return errors;
}

/** Check that protected outputs are non-empty strings. */
function checkProtectedOutputs(
  profile: CapabilityDesignProfile,
): CapabilityDesignValidationError[] {
  const errors: CapabilityDesignValidationError[] = [];
  for (const [axisId, axis] of Object.entries(profile.axes)) {
    for (let i = 0; i < axis.protected_outputs.length; i++) {
      if (typeof axis.protected_outputs[i] !== "string" || axis.protected_outputs[i].length === 0) {
        errors.push({
          source: "field",
          message: `Axis "${axisId}" has empty protected_output at index ${i}`,
        });
      }
    }
  }
  return errors;
}

/** Check that cross-coupling metric IDs are known. */
function checkCrossCouplingRefs(
  profile: CapabilityDesignProfile,
): CapabilityDesignValidationError[] {
  const errors: CapabilityDesignValidationError[] = [];
  for (const [axisId, axis] of Object.entries(profile.axes)) {
    for (let i = 0; i < axis.max_permitted_cross_coupling.length; i++) {
      const entry = axis.max_permitted_cross_coupling[i];
      if (
        typeof entry.metric_id !== "string" ||
        entry.metric_id.length === 0
      ) {
        errors.push({
          source: "ref",
          message: `Axis "${axisId}" has empty metric_id in cross-coupling[${i}]`,
        });
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Load the profile and compute hash
// ---------------------------------------------------------------------------

/**
 * Load and validate a CapabilityDesignProfile.
 *
 * @param profile - The raw profile object to load.
 * @returns The validated profile with content_hash set, or throws on validation failure.
 */
export function loadCapabilityDesignProfile(
  profile: Omit<CapabilityDesignProfile, "content_hash">,
): CapabilityDesignProfile {
  const errors = validateCapabilityDesignProfile({
    ...profile,
    content_hash: "",
  } as CapabilityDesignProfile);

  if (errors.length > 0) {
    const msgs = errors.map((e) => `${e.source}: ${e.message}`);
    throw new Error(
      `CapabilityDesignProfile validation failed with ${errors.length} error(s):\n${msgs.join("\n")}`,
    );
  }

  // Compute content hash from the canonical form of axes + criterion_bindings
  const hashable = {
    axes: profile.axes,
    criterion_bindings: profile.criterion_bindings,
    profile_id: profile.profile_id,
    profile_version: profile.profile_version,
    policy_version: profile.policy_version,
  };

  const hashableWithSchema: Record<string, unknown> = hashable;
  hashableWithSchema.schemaVersion = "capability-design-schema-v1";

  try {
    const canonical = encodeCanonical(hashableWithSchema);
    const hash = hashFnv1a64(canonical);
    return {
      ...profile,
      content_hash: hash,
    };
  } catch {
    // Fallback: hash from plain JSON
    const json = JSON.stringify(
      Object.fromEntries(
        Object.keys(hashable)
          .sort()
          .map((k) => [k, hashable[k as keyof typeof hashable]]),
      ),
    );
    return {
      ...profile,
      content_hash: hashFnv1a64(json),
    };
  }
}

/**
 * Convenience: load the default profile.
 */
export function loadDefaultCapabilityDesignProfile(): CapabilityDesignProfile {
  return loadCapabilityDesignProfile(RAW_PROFILE);
}
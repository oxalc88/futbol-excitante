/**
 * @module @pes/eval/bootstrap-registry
 *
 * Bootstrap catalog of fixture IDs only.
 *
 * This file is a versioned manifest of scenario fixtures that the
 * bootstrap evaluator can reference.  It does NOT contain PES reference
 * targets, gameplay envelopes, or evaluation policies.
 *
 * Each entry declares:
 * - `id`       — unique scenario identifier
 * - `version`  — scenario version string
 * - `family`   — grouping family
 */

export interface BootstrapFixtureEntry {
  /** Scenario ID (must match the scenario's `id` field). */
  id: string;
  /** Scenario version (must match the scenario's `version` field). */
  version: string;
  /** Scenario family (must match the scenario's `family` field). */
  family: string;
}

/**
 * Registry of all bootstrap scenario fixtures.
 *
 * New fixtures are added here by adding an entry.  The fixture JSON
 * must live in `eval/scenarios/<id>.v1.json`.
 */
export const BOOTSTRAP_REGISTRY: BootstrapFixtureEntry[] = [
  {
    id: "foundation-move-and-roll-v1",
    version: "1.0.0",
    family: "bootstrap",
  },
] as const;

/**
 * Get a registry entry by scenario id.
 * Returns `undefined` if not found.
 */
export function getRegistryEntry(id: string): BootstrapFixtureEntry | undefined {
  return BOOTSTRAP_REGISTRY.find((entry) => entry.id === id);
}
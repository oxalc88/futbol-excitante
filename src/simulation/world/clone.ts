/**
 * @module @pes/simulation/world/clone
 *
 * Deep-clone utilities for WorldState and related types.
 *
 * Used internally by create (freeze), and available for snapshot/restore
 * and replay infrastructure.
 *
 * Pure, synchronous, DOM-free, no-Node-I/O.
 */

import type { WorldState } from "../../contracts/state.js";
import type { ScenarioDefinition } from "../../contracts/scenario.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deep-clone a plain object graph via JSON round-trip.
 *
 * This is safe for contract types (all data is plain JSON-serializable).
 * Functions, undefined, and symbols are NOT supported — callers must
 * ensure the value is plain data before calling.
 */
export function deepClone(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

/** Type-safe wrapper for a known contract type. */
function deepCloneAs<T>(value: unknown): T {
  return deepClone(value) as T;
}

/**
 * Create an immutable (deep-frozen) copy of a WorldState.
 *
 * The returned object is a deep clone with all arrays and nested objects
 * frozen via `Object.freeze` at every level.  Consumers cannot mutate it.
 */
export function freezeWorldState(state: WorldState): WorldState {
  const cloned = deepCloneAs<Record<string, unknown>>(state);
  // Freeze at every level
  function freeze(obj: unknown): unknown {
    if (obj == null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        obj[i] = freeze(obj[i]);
      }
      return Object.freeze(obj);
    }
    for (const key of Object.keys(obj)) {
      (obj as Record<string, unknown>)[key] = freeze(
        (obj as Record<string, unknown>)[key]
      );
    }
    return Object.freeze(obj);
  }
  return freeze(cloned) as WorldState;
}

/**
 * Deep-clone a ScenarioDefinition (used internally by create).
 */
export function freezeScenario(scenario: ScenarioDefinition): ScenarioDefinition {
  return deepCloneAs<ScenarioDefinition>(scenario);
}
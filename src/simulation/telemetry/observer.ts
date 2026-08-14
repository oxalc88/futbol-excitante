/**
 * @module @pes/simulation/telemetry/observer
 *
 * No-op observer interface for the simulation core.
 *
 * The core writes observations through this interface at well-defined
 * points in the stepping pipeline (before-step, after-step,
 * invariant-failure, presentation). The observer must not mutate
 * authoritative state, consume the PRNG, or affect event ordering.
 *
 * A no-op implementation (all methods are empty) is always available
 * and yields identical state hashes to any other observer.
 */

import type { TelemetryObservation } from "../../contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Observer interface
// ---------------------------------------------------------------------------

/**
 * Callback fired by the simulation core at various pipeline stages.
 *
 * All methods accept a `reason` string so callers can distinguish
 * why the hook was called (e.g., "invariant-failure" vs normal step).
 */
export interface SimulationObserver {
  /** Called before the stepping stages run (before tick increment). */
  onBeforeStep?(reason: string): void;

  /** Called after all stepping stages have committed. */
  onAfterStep?(reason: string): void;

  /**
   * Called when an invariant validation succeeds.
   * @param observation - Full per-tick telemetry data.
   */
  onInvariantPass?(observation: TelemetryObservation): void;

  /**
   * Called when an invariant validation detects an error.
   * @param observation - Full per-tick telemetry data (if available).
   * @param reason - Description of the failure.
   */
  onInvariantFail?(observation: TelemetryObservation, reason: string): void;

  /** Called after presentation snapshot derivation. */
  onPresent?(reason: string): void;
}

// ---------------------------------------------------------------------------
// No-op observer (always safe)
// ---------------------------------------------------------------------------

/**
 * A no-op observer — every method is an empty function.
 *
 * Using a no-op observer yields identical state hashes to any other
 * observer implementation that does not mutate core state.
 */
export const NO_OP_OBSERVER: SimulationObserver = Object.freeze({
  onBeforeStep() { /* no-op */ },
  onAfterStep() { /* no-op */ },
  onInvariantPass() { /* no-op */ },
  onInvariantFail() { /* no-op */ },
  onPresent() { /* no-op */ },
});
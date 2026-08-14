/**
 * @module eval/oracles/oracle-registry
 *
 * Protected oracle registry: maps oracle_id + oracle_version to
 * executable check functions.  Oracles are read-only to any gameplay
 * candidate — candidates cannot disable them by config.
 *
 * Each oracle function receives telemetry observations and returns an
 * invariant-style result.  The registry itself never mutates simulation
 * state, consumes the PRNG, or accesses the DOM / wall clock / Node I/O.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Oracle signature
// ---------------------------------------------------------------------------

/**
 * A protected oracle check function.
 *
 * Receives all observations collected so far (ordered by tick) and
 * returns an InvariantResult (or array of results for multi-tick oracles
 * such as ball-continuity).
 */
export type OracleFn = (
  observations: TelemetryObservation[],
) => InvariantResult | InvariantResult[];

// ---------------------------------------------------------------------------
// Oracle entry
// ---------------------------------------------------------------------------

export interface OracleEntry {
  oracle_id: string;
  oracle_version: string;
  fn: OracleFn;
}

// ---------------------------------------------------------------------------
// Internal registry
// ---------------------------------------------------------------------------

const registry = new Map<string, OracleEntry>();

/**
 * Register an oracle.  oracle_id + oracle_version must be unique.
 */
export function registerOracle(entry: OracleEntry): void {
  const key = `${entry.oracle_id}@${entry.oracle_version}`;
  if (registry.has(key)) {
    throw new Error(
      `Oracle already registered: ${key}`,
    );
  }
  registry.set(key, entry);
}

/**
 * Look up an oracle by id + version.
 *
 * @returns the entry or undefined.
 */
export function getOracle(
  oracleId: string,
  oracleVersion: string,
): OracleEntry | undefined {
  const key = `${oracleId}@${oracleVersion}`;
  return registry.get(key);
}

/**
 * Execute a named oracle over observations.
 *
 * @param oracleId - The oracle_id to execute.
 * @param oracleVersion - Expected version; mismatched versions are rejected.
 * @param observations - Telemetry observations (ordered by tick).
 * @returns InvariantResult(s).
 * @throws Error if the oracle_id is unknown or the version does not match
 *   the registered version.
 */
export function executeOracle(
  oracleId: string,
  oracleVersion: string,
  observations: TelemetryObservation[],
): InvariantResult[] {
  const key = `${oracleId}@${oracleVersion}`;
  const entry = registry.get(key);
  if (!entry) {
    throw new Error(
      `Unknown oracle_id or version mismatch: ${oracleId} @ ${oracleVersion}`,
    );
  }
  // Enforce version match.
  if (entry.oracle_version !== oracleVersion) {
    throw new Error(
      `Version mismatch for ${oracleId}: expected ${oracleVersion}, registered ${entry.oracle_version}`,
    );
  }
  const result = entry.fn(observations);
  if (Array.isArray(result)) {
    return result.map((r) => ({ ...r, id: `${oracleId}-${r.id}` }));
  }
  return [{ ...result, id: `${oracleId}-${result.id}` }];
}
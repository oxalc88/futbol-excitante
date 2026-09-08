/**
 * @module eval/oracles/gk-regression
 *
 * Protected SMALL-SIDED goalkeeper regression canary (objective
 * GK-REGRESSION-POLICY-REGISTRATION).
 *
 * This is the suite-level regression POLICY for the goalkeepers suite's
 * REGRESSION-class criteria (GK-*-REG), per specs/GOALKEEPER_SPEC.md §11.2 and
 * GAMEPLAY_EVALUATION_SPEC §5.5 (candidate-versus-immutable-best under an
 * identical comparison condition).  It FAILs when an accepted GK behavior pin
 * diverges WITHOUT a corresponding model-version bump; it is a genuine
 * divergence detector, not a tautology.
 *
 * The pins it guards are the ACCEPTED, committed facts:
 *   - gk-small-sided-v1 constants as consumed (the adapter's GK_SMALL_SIDED_V1
 *     and the versioned record GK_PROVISIONAL_VALUES must carry the owning
 *     version id "gk-small-sided-v1" and the §9 accepted values; a silent value
 *     change with an identical version id is FAIL);
 *   - the keeper-marker designation baseline (one designated keeper per team,
 *     §4);
 *   - the goal-arc-hold (§5) and no-field-chase (§6) behavior;
 *   - the save/claim reaction (§7): an in-window, in-reach keeper contact is the
 *     observed pin (preserved); an in-window contact outside
 *     `save_claim_reach_radius` is FAIL.  A contact beyond
 *     `keeper_reaction_window_ticks`, or an opposing shot answered by no
 *     recorded in-window keeper contact, is NOT_EVALUATED per the accepted
 *     GK-SAVE-CLAIM oracle (the shot may legitimately score); this pin never
 *     turns a legitimately unanswered shot into a FAIL;
 *   - the distribution release behavior (§8): a release to a non-observed or
 *     non-teammate target (omniscience) is FAIL.
 *
 * It also verifies the committed per-tick state-hash chain is intact (monotonic
 * ticks, non-empty committed stateHash/prngStateHash/observationCoreHash); a
 * discontinuity is FAIL.
 *
 * NON-CIRCULARITY: the pinned baseline is a FIXED set of committed acceptance
 * facts (hard-coded here from the accepted §9 record and the accepted GK
 * records).  The canary does NOT recompute a hash of the same data it compares
 * against; it reads committed `stateHash`/`prngStateHash`/`observationCoreHash`
 * integrity and derives behavior facts from the stream, then compares them to
 * the pinned baseline.  A mutated / weakened run diverges from the pinned
 * baseline and FAILs (power is proved by the companion binding test's mutant /
 * canary guards).
 *
 * A stream that is not a two-team keeper match, or that carries no observable
 * behavior pin, is the honest NOT_EVALUATED — never a PASS by silence.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";
import { GK_MODEL_ID, GK_MODEL_VERSION, GK_PROVISIONAL_VALUES } from "../contracts/goalkeeper-config.js";
import { GK_SMALL_SIDED_V1 } from "../../src/adapters/input-browser/goalkeeper-role.js";
import {
  checkGkRoleDesignation,
  checkGkPositioningHold,
  checkGkNoFieldChase,
  checkGkSaveClaim,
  checkGkDistributionNoOmniscience,
} from "./gk-role.js";

// ---------------------------------------------------------------------------
// Pinned acceptance baseline (specs/GOALKEEPER_SPEC.md §9, committed facts)
// ---------------------------------------------------------------------------

/** The accepted gk-small-sided-v1 constant values. A value change with the
 * same version id is an un-versioned divergence and FAILs. */
const PINNED_GK_CONSTANTS: Record<string, number | string> = {
  goal_arc_center_x_offset: 0,
  goal_arc_radius: 4.0,
  goal_arc_lateral_max: 2.5,
  keeper_reposition_speed: 2.0,
  keeper_reaction_window_ticks: 12,
  save_claim_reach_radius: 1.2,
  distribution_release_window_ticks: 10,
  distribution_no_omniscience: "on",
};

// ---------------------------------------------------------------------------
// Consumed-config shape (the adapter's versioned record under gk-small-sided-v1)
// ---------------------------------------------------------------------------

/** Minimal shape of a consumed gk-small-sided-v1 config entry. */
interface GkConsumedConfig {
  id: string;
  [key: string]: unknown;
}

function numericValue(cfg: GkConsumedConfig, key: string): number | string | undefined {
  const entry = cfg[key];
  if (entry === null || entry === undefined || typeof entry !== "object") return undefined;
  const maybe = entry as { value?: unknown };
  return typeof maybe.value === "number" || typeof maybe.value === "string"
    ? maybe.value
    : undefined;
}

// ---------------------------------------------------------------------------
// State-hash chain integrity
// ---------------------------------------------------------------------------

function verifyStateHashChain(observations: TelemetryObservation[]): string[] {
  const issues: string[] = [];
  let prevTick = -1;
  for (const o of observations) {
    if (o.tick <= prevTick) {
      issues.push(`tick ${o.tick} is not strictly increasing (previous ${prevTick})`);
    }
    prevTick = o.tick;
    if (!o.stateHash) issues.push(`tick ${o.tick} missing committed stateHash`);
    if (!o.prngStateHash) issues.push(`tick ${o.tick} missing committed prngStateHash`);
    if (!o.observationCoreHash) issues.push(`tick ${o.tick} missing committed observationCoreHash`);
    if (o.players.length === 0) issues.push(`tick ${o.tick} has no committed players`);
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Version pin
// ---------------------------------------------------------------------------

/**
 * Verify the gk-small-sided-v1 constants as consumed carry the accepted version
 * id and values.
 *
 * @param consumed The adapter's GK_SMALL_SIDED_V1 record.
 * @returns null when the pins hold, an "unversioned-change" failure summary when
 *          a value diverges with an identical version id, or "version-bumped"
 *          when the owning model id is no longer gk-small-sided-v1 (a deliberate
 *          versioned change, handled as NOT_EVALUATED by the caller).
 */
function verifyVersionPin(consumed: GkConsumedConfig): null | "version-bumped" | string {
  if (consumed.id !== GK_MODEL_ID) {
    return "version-bumped";
  }
  const issues: string[] = [];
  for (const [key, expected] of Object.entries(PINNED_GK_CONSTANTS)) {
    const actual = numericValue(consumed, key);
    if (actual !== expected) {
      issues.push(`${key}: pinned ${expected}, consumed ${actual}`);
    }
  }
  // The versioned record must also still be the accepted model/version.
  for (const entry of GK_PROVISIONAL_VALUES) {
    if (entry.version !== GK_MODEL_VERSION) {
      issues.push(`record key "${entry.key}" carries version "${entry.version}"`);
    }
  }
  if (issues.length > 0) return `unversioned-change: ${issues.join("; ")}`;
  return null;
}

// ---------------------------------------------------------------------------
// Public canary
// ---------------------------------------------------------------------------

/**
 * Suite-level GK regression canary.
 *
 * @param observations Committed GK telemetry stream.
 * @param consumedConfig Optional override of the consumed gk-small-sided-v1
 *        record (defaults to the adapter's GK_SMALL_SIDED_V1).  Tests inject a
 *        divergent record to prove the version-pin power.
 */
export function checkGkRegression(
  observations: TelemetryObservation[],
  consumedConfig: GkConsumedConfig = GK_SMALL_SIDED_V1 as unknown as GkConsumedConfig,
): InvariantResult[] {
  // 1. Committed state-hash chain integrity.
  const chainIssues = verifyStateHashChain(observations);
  if (chainIssues.length > 0) {
    return [
      {
        id: "gk-regression-state-hash-chain-diverged",
        status: "fail",
        description: `GK stream state-hash chain diverged: ${chainIssues.join("; ")}`,
        details: { chainIssues, observations: observations.length },
      },
    ];
  }

  // 2. Version pin (constants as consumed + version id continuity).
  const versionPin = verifyVersionPin(consumedConfig);
  if (versionPin === "version-bumped") {
    return [
      {
        id: "gk-regression-version-bumped",
        status: "not_evaluated",
        description:
          `The gk-small-sided-v1 model was version-bumped (consumed id "${consumedConfig.id}"); ` +
          `the pinned behavioral baseline re-pin is deliberate and must be re-registered explicitly`,
        details: { consumedId: consumedConfig.id },
      },
    ];
  }
  if (versionPin !== null) {
    return [
      {
        id: "gk-regression-unversioned-constant-change",
        status: "fail",
        description: `An adopted GK constant changed without a model-version bump: ${versionPin}`,
        details: { versionPin },
      },
    ];
  }

  // 3. Behavior pins (candidate vs accepted baseline) — reuse the accepted
  //    protected keeper oracles.  Any fail is a diverged pin.
  const behaviorChecks: Array<{ label: string; results: InvariantResult[] }> = [
    { label: "keeper-marker designation baseline", results: checkGkRoleDesignation(observations) },
    { label: "goal-arc-hold", results: checkGkPositioningHold(observations) },
    { label: "no-field-chase", results: checkGkNoFieldChase(observations) },
    { label: "save/claim reaction", results: checkGkSaveClaim(observations) },
    { label: "distribution release", results: checkGkDistributionNoOmniscience(observations) },
  ];

  const failures: string[] = [];
  for (const check of behaviorChecks) {
    for (const r of check.results) {
      if (r.status === "fail") {
        failures.push(`${check.label}: ${r.description}`);
      }
    }
  }
  if (failures.length > 0) {
    return [
      {
        id: "gk-regression-behavior-diverged",
        status: "fail",
        description: `A GK behavior pin diverged from the accepted baseline: ${failures.join("; ")}`,
        details: { failures },
      },
    ];
  }

  // Was any behavior pin actually observable on this stream?  If the stream
  // carries no observable pin (e.g. no keeper reached its arc, no shot faced,
  // no release), the regression is honestly NOT_EVALUATED — never a PASS by
  // silence.
  const anyObservable = behaviorChecks.some((c) =>
    c.results.some((r) => r.status === "pass" || r.status === "fail"),
  );
  if (!anyObservable) {
    return [
      {
        id: "gk-regression-not-evaluated",
        status: "not_evaluated",
        description:
          `No observable GK behavior pin in ${observations.length} observations; ` +
          `the regression policy has nothing to preserve (honest absence, not a PASS)`,
        details: { observations: observations.length },
      },
    ];
  }

  return [
    {
      id: "gk-regression-pins-held",
      status: "pass",
      description:
        `All accepted GK behavior pins hold (constants versioned, designation held, ` +
        `arc-hold/no-field-chase/save-claim/distribution preserved, state-hash chain intact ` +
        `over ${observations.length} observations)`,
      details: { observations: observations.length },
    },
  ];
}

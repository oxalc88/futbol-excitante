/**
 * @module tests/unit/eval/match-rules-spec-binding
 *
 * Binding tests for specs/MATCH_RULES_SPEC.md (RULES-SPEC-DRAFT).
 *
 * The objective is spec-only: no implementation, no evaluator/oracle/catalog/
 * scenario/adapter change.  These tests assert that the spec:
 *  1. declares its owning model id `match-rules-v1`;
 *  2. declares the accepted config model ids it references
 *     (`foundation-goal-v1`, `foundation-ball-v1`, `foundation-fixed-dt-v1`,
 *     `foundation-config-v1`, `anti-huddle-v1`, `gk-small-sided-v1`);
 *  3. quotes the accepted machine-readable values correctly (goal geometry,
 *     ball radius, fixed tick, anti-huddle hold, goalkeeper model id);
 *  4. declares BLOCKED_MISSING_REFERENCE values rather than inventing them;
 *  5. lists the deferred regulation behaviors (fouls/cards/free kicks,
 *     offside, penalty kicks) as future-with-prerequisites;
 *  6. names adjudicating criteria but explicitly states they are NOT
 *     registered in any evaluator suite.
 *
 * This is a binding/consistency test, not an evaluator change.  It does not
 * claim any gameplay PASS and makes no PES fidelity claim.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in core-facing code;
 * node:fs is used here only to read the spec file under test.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FOUNDATION_GOAL_V1,
  FOUNDATION_BALL_V1,
  FOUNDATION_FIXED_DT_V1,
  FOUNDATION_CONFIG,
} from "../../../src/simulation/config/foundation.js";
import {
  GK_MODEL_ID,
  GK_MODEL_VERSION,
} from "../../../eval/contracts/goalkeeper-config.js";
import {
  ANTI_HUDDLE_V1_ID,
  RESTART_HOLD_MIN_TICKS,
} from "../../../src/adapters/input-browser/cpu-adapter.js";

// ---------------------------------------------------------------------------
// Load the spec under test
// ---------------------------------------------------------------------------

function loadSpec(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const specPath = join(__dirname, "../../../specs/MATCH_RULES_SPEC.md");
  return readFileSync(specPath, "utf-8");
}

const SPEC = loadSpec();

// ---------------------------------------------------------------------------
// 1. Owning model id
// ---------------------------------------------------------------------------

describe("MATCH_RULES_SPEC declares its owning model id", () => {
  it("declares match-rules-v1", () => {
    expect(SPEC).toContain("match-rules-v1");
  });

  it("labels the spec's values as versioned provisional config", () => {
    expect(SPEC).toContain("VERSIONED_PROVISIONAL");
    expect(SPEC).toContain("Model version");
  });
});

// ---------------------------------------------------------------------------
// 2. Referenced accepted config model ids
// ---------------------------------------------------------------------------

describe("MATCH_RULES_SPEC references accepted config model ids", () => {
  it("references foundation-goal-v1", () => {
    expect(SPEC).toContain(FOUNDATION_GOAL_V1.id);
  });

  it("references foundation-ball-v1", () => {
    expect(SPEC).toContain(FOUNDATION_BALL_V1.id);
  });

  it("references foundation-fixed-dt-v1", () => {
    expect(SPEC).toContain(FOUNDATION_FIXED_DT_V1.id);
  });

  it("references foundation-config-v1", () => {
    expect(SPEC).toContain(FOUNDATION_CONFIG.id);
  });

  it("references the accepted anti-huddle model id", () => {
    expect(SPEC).toContain(ANTI_HUDDLE_V1_ID);
  });

  it("references the accepted small-sided goalkeeper model id", () => {
    expect(SPEC).toContain(GK_MODEL_ID);
    expect(GK_MODEL_VERSION).toBe(GK_MODEL_ID);
  });
});

// ---------------------------------------------------------------------------
// 3. Quoted values match the machine-readable sources
// ---------------------------------------------------------------------------

describe("MATCH_RULES_SPEC quotes accepted values correctly", () => {
  it("quotes the foundation-goal-v1 goal width (7.32 m)", () => {
    expect(SPEC).toContain(String(FOUNDATION_GOAL_V1.goalWidth.value));
  });

  it("quotes the foundation-goal-v1 goal height (2.44 m)", () => {
    expect(SPEC).toContain(String(FOUNDATION_GOAL_V1.goalHeight.value));
  });

  it("quotes the foundation-goal-v1 post radius (0.05 m)", () => {
    expect(SPEC).toContain(String(FOUNDATION_GOAL_V1.postRadius.value));
  });

  it("quotes the foundation-goal-v1 crossbar radius (0.05 m)", () => {
    expect(SPEC).toContain(String(FOUNDATION_GOAL_V1.crossbarRadius.value));
  });

  it("quotes the foundation-ball-v1 ball radius (0.11 m)", () => {
    expect(SPEC).toContain(String(FOUNDATION_BALL_V1.ballRadius.value));
  });

  it("quotes the foundation-fixed-dt-v1 tick rate as 1/60", () => {
    expect(SPEC).toContain(
      `${FOUNDATION_FIXED_DT_V1.numerator}/${FOUNDATION_FIXED_DT_V1.denominator}`,
    );
  });

  it("quotes the anti-huddle restart hold minimum (2 ticks)", () => {
    expect(SPEC).toContain(String(RESTART_HOLD_MIN_TICKS));
  });

  it("names the anti-huddle tolerance keys in its value table", () => {
    expect(SPEC).toContain("KICKOFF_FREEZE_HOME_TOLERANCE");
    expect(SPEC).toContain("CHASE_NEAREST_HOME_TOLERANCE");
  });

  it("declares the match-rules-v1 provisional keys it owns", () => {
    for (const key of [
      "default_throw_in_countdown",
      "default_goal_kick_countdown",
      "default_corner_kick_countdown",
      "default_goal_reset_ticks",
      "default_halftime_countdown",
      "goal_area_half_width",
      "goal_area_depth",
      "throw_in_speed",
      "goal_kick_speed",
      "corner_cross_speed",
    ]) {
      expect(SPEC, `missing match-rules-v1 key ${key}`).toContain(key);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. BLOCKED_MISSING_REFERENCE disclosures
// ---------------------------------------------------------------------------

describe("MATCH_RULES_SPEC declares BLOCKED_MISSING_REFERENCE values", () => {
  it("declares the BLOCKED_MISSING_REFERENCE section and at least one blocked key", () => {
    expect(SPEC).toContain("BLOCKED_MISSING_REFERENCE");
    expect(SPEC).toContain("throw_in_trajectory_ref");
    expect(SPEC).toContain("goal_kick_distribution_ref");
    expect(SPEC).toContain("corner_cross_trajectory_ref");
    expect(SPEC).toContain("restart_serve_latency_ref_ms");
    expect(SPEC).toContain("post_goal_reset_ref_ticks");
    expect(SPEC).toContain("half_time_break_ref_seconds");
    expect(SPEC).toContain("ball_in_play_accounting_ref");
  });

  it("states that blocked references are never converted into invented values", () => {
    expect(SPEC).toContain("must not be converted into invented envelope");
    expect(SPEC).toContain("never invented");
  });
});

// ---------------------------------------------------------------------------
// 5. Deferred regulation behaviors
// ---------------------------------------------------------------------------

describe("MATCH_RULES_SPEC lists deferred regulation behaviors", () => {
  it("lists fouls / cards / free kicks as deferred", () => {
    expect(SPEC).toContain("Fouls, cards, and free kicks");
    expect(SPEC).toContain("deferred");
  });

  it("lists offside as deferred", () => {
    expect(SPEC).toContain("Offside");
  });

  it("lists penalty kicks as deferred", () => {
    expect(SPEC).toContain("Penalty kicks");
  });

  it("marks the deferred section as future-with-prerequisites", () => {
    expect(SPEC).toContain("future-with-prerequisites");
  });

  it("states the regulation milestone is gated behind suites", () => {
    expect(SPEC).toContain("MUST NOT be published");
    expect(SPEC).toContain("dedicated goalkeeper and deterministic rules specifications");
  });
});

// ---------------------------------------------------------------------------
// 6. Adjudicating criteria named but NOT registered
// ---------------------------------------------------------------------------

describe("MATCH_RULES_SPEC names adjudicating criteria without registering them", () => {
  it("names representative per-rule criteria", () => {
    for (const criterion of [
      "MATCH-THROW-IN-AWARD",
      "MATCH-GOAL-KICK-AWARD",
      "MATCH-CORNER-KICK-AWARD",
      "MATCH-KICKOFF-FREEZE",
      "MATCH-SCORING-GOAL-DEVENT",
      "MATCH-TIMER-FREEZE",
    ]) {
      expect(SPEC, `missing adjudicating criterion ${criterion}`).toContain(criterion);
    }
  });

  it("explicitly states the criteria are NOT registered in any suite", () => {
    expect(SPEC).toContain("NOT registered");
    expect(SPEC).toContain("no evaluator, oracle, invariant-definition");
  });

  it("does not claim a PASS through this spec", () => {
    // The spec may mention PASS only as a prohibition / for not-yet-registered
    // criteria; it must not assert a rules PASS.
    expect(SPEC).not.toContain("rules PASS");
    expect(SPEC).toContain("No `PASS` may be reported");
  });

  it("makes no PES fidelity claim", () => {
    expect(SPEC).toContain("not a measurement of PES 2017");
    expect(SPEC).toContain("MUST NOT be described as PES");
  });
});

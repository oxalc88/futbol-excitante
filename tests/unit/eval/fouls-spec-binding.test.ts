/**
 * @module tests/unit/eval/fouls-spec-binding
 *
 * Binding tests for specs/FOULS_CARDS_SPEC.md (FOULS-SPEC-DRAFT).
 *
 * The objective is spec-only: no implementation, no evaluator/oracle/catalog/
 * scenario/adapter change.  These tests assert that the spec:
 *  1. declares its owning model id `fouls-v1`;
 *  2. declares the accepted config model ids it references
 *     (`foundation-tackle-v1`, `foundation-cpu-tackle-v1`,
 *     `foundation-player-contact-v1`, `foundation-contact-v1`,
 *     `foundation-config-v1`, `foundation-fixed-dt-v1`, `match-rules-v1`,
 *     `anti-huddle-v1`, `gk-small-sided-v1`);
 *  3. quotes the accepted machine-readable values correctly (tackle reach,
 *     CPU carrier-contest distance, player-contact geometry, anti-huddle
 *     hold, fixed tick, goalkeeper model id);
 *  4. declares the `fouls-v1` provisional keys it owns;
 *  5. declares BLOCKED_MISSING_REFERENCE values rather than inventing them;
 *  6. names the deferred regulation behaviors (offside, penalty kicks) as
 *     future-with-prerequisites and the free-kick set piece as referencing
 *     the accepted restart machinery;
 *  7. names adjudicating criteria (FOUL-DETECT, FOUL-CLEAN-TACKLE,
 *     CARD-ISSUED, ADVANTAGE-PLAYED, FREE-KICK-AWARD) but does NOT register
 *     them in the evaluator registry, and does not claim a PASS through them.
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
  FOUNDATION_TACKLE_V1,
  FOUNDATION_CPU_TACKLE_V1,
  FOUNDATION_PLAYER_CONTACT_V1,
  FOUNDATION_CONTACT_V1,
  FOUNDATION_CONFIG,
  FOUNDATION_FIXED_DT_V1,
} from "../../../src/simulation/config/foundation.js";
import {
  ANTI_HUDDLE_V1_ID,
  RESTART_HOLD_MIN_TICKS,
} from "../../../src/adapters/input-browser/cpu-adapter.js";
import {
  GK_MODEL_ID,
  GK_MODEL_VERSION,
} from "../../../eval/contracts/goalkeeper-config.js";
import { loadRegistrySet } from "../../../eval/contracts/loader.js";

// ---------------------------------------------------------------------------
// Load the spec under test
// ---------------------------------------------------------------------------

function loadSpec(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const specPath = join(__dirname, "../../../specs/FOULS_CARDS_SPEC.md");
  return readFileSync(specPath, "utf-8");
}

const SPEC = loadSpec();

// ---------------------------------------------------------------------------
// 1. Owning model id
// ---------------------------------------------------------------------------

describe("FOULS_CARDS_SPEC declares its owning model id and config model", () => {
  it("declares fouls-v1", () => {
    expect(SPEC).toContain("fouls-v1");
  });

  it("labels the spec's values as versioned provisional config", () => {
    expect(SPEC).toContain("VERSIONED_PROVISIONAL");
    expect(SPEC).toContain("Model version");
  });

  it("states it is a draft spec with no implementation", () => {
    expect(SPEC).toContain("NO foul, card, advantage, or free-kick behavior is implemented");
  });
});

// ---------------------------------------------------------------------------
// 2. Referenced accepted config model ids
// ---------------------------------------------------------------------------

describe("FOULS_CARDS_SPEC references accepted config model ids", () => {
  it("references foundation-tackle-v1", () => {
    expect(SPEC).toContain(FOUNDATION_TACKLE_V1.id);
  });

  it("references foundation-cpu-tackle-v1", () => {
    expect(SPEC).toContain(FOUNDATION_CPU_TACKLE_V1.id);
  });

  it("references foundation-player-contact-v1", () => {
    expect(SPEC).toContain(FOUNDATION_PLAYER_CONTACT_V1.id);
  });

  it("references foundation-contact-v1", () => {
    expect(SPEC).toContain(FOUNDATION_CONTACT_V1.id);
  });

  it("references foundation-config-v1", () => {
    expect(SPEC).toContain(FOUNDATION_CONFIG.id);
  });

  it("references foundation-fixed-dt-v1", () => {
    expect(SPEC).toContain(FOUNDATION_FIXED_DT_V1.id);
  });

  it("references the accepted match-rules-v1 model id", () => {
    expect(SPEC).toContain("match-rules-v1");
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

describe("FOULS_CARDS_SPEC quotes accepted values correctly", () => {
  it("quotes the foundation-tackle-v1 standing reach (1.6 m)", () => {
    expect(SPEC).toContain(String(FOUNDATION_TACKLE_V1.standingReach.value));
  });

  it("quotes the foundation-tackle-v1 slide reach (2.8 m)", () => {
    expect(SPEC).toContain(String(FOUNDATION_TACKLE_V1.slideReach.value));
  });

  it("quotes the foundation-tackle-v1 forward contact cone cosine (0)", () => {
    expect(SPEC).toContain(String(FOUNDATION_TACKLE_V1.contactConeMinCos.value));
  });

  it("quotes the foundation-tackle-v1 carrier impulse speed (1.4 m/s)", () => {
    expect(SPEC).toContain(String(FOUNDATION_TACKLE_V1.carrierImpulseSpeed.value));
  });

  it("quotes the foundation-tackle-v1 slide lunge speed (5.0 m/s)", () => {
    expect(SPEC).toContain(String(FOUNDATION_TACKLE_V1.slideLungeSpeed.value));
  });

  it("quotes the foundation-tackle-v1 ball deflection speed (7.5 m/s)", () => {
    expect(SPEC).toContain(String(FOUNDATION_TACKLE_V1.ballDeflectionSpeed.value));
  });

  it("quotes the foundation-cpu-tackle-v1 carrier contest distance (2.5 m)", () => {
    expect(SPEC).toContain(String(FOUNDATION_CPU_TACKLE_V1.carrierContestDistance.value));
  });

  it("quotes the foundation-player-contact-v1 player radius (0.25 m)", () => {
    expect(SPEC).toContain(String(FOUNDATION_PLAYER_CONTACT_V1.playerRadius.value));
  });

  it("quotes the foundation-player-contact-v1 separation stiffness (0.5)", () => {
    expect(SPEC).toContain(String(FOUNDATION_PLAYER_CONTACT_V1.separationStiffness.value));
  });

  it("quotes the foundation-player-contact-v1 velocity damping normal (0.3)", () => {
    expect(SPEC).toContain(String(FOUNDATION_PLAYER_CONTACT_V1.velocityDampingNormal.value));
  });

  it("quotes the foundation-contact-v1 contact radius (1.2 m)", () => {
    expect(SPEC).toContain(String(FOUNDATION_CONTACT_V1.contactRadius.value));
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

  it("declares the fouls-v1 provisional keys it owns", () => {
    for (const key of [
      "foul_detect_contact_severity_threshold",
      "fouls_yellow_accumulation_count",
      "fouls_red_accumulation_count",
      "foul_card_direct_red_severity_threshold",
      "advantage_window_ticks",
      "foul_caution_pending_ticks",
      "foul_ball_carrier_contest_distance",
    ]) {
      expect(SPEC, `missing fouls-v1 key ${key}`).toContain(key);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. BLOCKED_MISSING_REFERENCE disclosures
// ---------------------------------------------------------------------------

describe("FOULS_CARDS_SPEC declares BLOCKED_MISSING_REFERENCE values", () => {
  it("declares the BLOCKED_MISSING_REFERENCE section and expected blocked keys", () => {
    expect(SPEC).toContain("BLOCKED_MISSING_REFERENCE");
    for (const key of [
      "foul_card_threshold_ref",
      "foul_severity_distribution_ref",
      "foul_ball_carrier_identity_ref",
      "advantage_window_ref_ms",
      "free_kick_trajectory_ref",
      "disciplinary_scale_ref",
      "card_display_visual_ref",
    ]) {
      expect(SPEC, `missing blocked reference ${key}`).toContain(key);
    }
  });

  it("states that blocked references are never converted into invented values", () => {
    expect(SPEC).toContain("must not be converted into invented envelope");
    expect(SPEC).toContain("never invented");
  });
});

// ---------------------------------------------------------------------------
// 5. Deferred regulation behaviors
// ---------------------------------------------------------------------------

describe("FOULS_CARDS_SPEC lists deferred regulation behaviors", () => {
  it("marks the deferred section as future-with-prerequisites", () => {
    expect(SPEC).toContain("future-with-prerequisites");
  });

  it("lists offside as deferred and regulation-only (no existence claim)", () => {
    expect(SPEC).toContain("Offside");
    expect(SPEC).toContain("regulation-only");
    expect(SPEC).toContain("makes no offside existence claim");
  });

  it("lists penalty kicks as deferred and regulation-only (no existence claim)", () => {
    expect(SPEC).toContain("Penalty kicks");
    expect(SPEC).toContain("makes no penalty existence claim");
  });

  it("states the free-kick set piece references the accepted restart machinery", () => {
    expect(SPEC).toContain("free kick");
    expect(SPEC).toContain("accepted restart machinery");
    expect(SPEC).toContain("match-rules-v1");
  });

  it("states the regulation milestone is gated behind suites", () => {
    expect(SPEC).toContain("MUST NOT be published");
    expect(SPEC).toContain("dedicated goalkeeper and deterministic rules specifications");
  });
});

// ---------------------------------------------------------------------------
// 6. Adjudicating criteria named but NOT registered
// ---------------------------------------------------------------------------

const NAMED_CRITERIA = [
  "FOUL-DETECT",
  "FOUL-CLEAN-TACKLE",
  "CARD-ISSUED",
  "ADVANTAGE-PLAYED",
  "FREE-KICK-AWARD",
];

describe("FOULS_CARDS_SPEC names adjudicating criteria", () => {
  it("names each fouls criterion", () => {
    for (const criterion of NAMED_CRITERIA) {
      expect(SPEC, `missing adjudicating criterion ${criterion}`).toContain(criterion);
    }
  });

  it("explicitly states the criteria are NOT registered in any suite", () => {
    expect(SPEC).toContain("NOT registered");
  });

  it("does not claim a PASS through this spec", () => {
    expect(SPEC).toContain("No `PASS` may be reported");
  });

  it("makes no PES fidelity claim", () => {
    expect(SPEC).toContain("not a measurement of PES 2017");
    expect(SPEC).toContain("MUST NOT be described as PES");
  });
});

// ---------------------------------------------------------------------------
// 7. The named criteria are NOT registered in the evaluator registry
// ---------------------------------------------------------------------------

describe("FOULS_CARDS_SPEC named criteria are NOT registered", () => {
  const registry = loadRegistrySet();

  it("has no 'fouls' suite registered", () => {
    expect(registry.suite_definitions["fouls"]).toBeUndefined();
  });

  it("does not register any named criterion in COMMON_CRITERIA", () => {
    for (const criterion of NAMED_CRITERIA) {
      expect(
        registry.common_criteria[criterion],
        `${criterion} must NOT be registered in COMMON_CRITERIA`,
      ).toBeUndefined();
    }
  });

  it("does not reference any named criterion in a test binding", () => {
    const bindings = Object.values(registry.test_bindings);
    for (const criterion of NAMED_CRITERIA) {
      const referenced = bindings.some((b) => criterion in b.criterion_bindings);
      expect(
        referenced,
        `${criterion} must NOT be bound in any test binding`,
      ).toBe(false);
    }
  });

  it("does not reference any named criterion in a suite's criteria lists", () => {
    for (const criterion of NAMED_CRITERIA) {
      for (const suite of Object.values(registry.suite_definitions)) {
        expect(
          suite.common_criterion_ids.includes(criterion) ||
            suite.direct_test_ids.includes(criterion),
          `${criterion} must NOT appear in suite ${suite.suite_id}`,
        ).toBe(false);
      }
    }
  });
});

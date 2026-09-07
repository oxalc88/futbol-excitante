/**
 * Node-side evidence producer for FOULS-SPEC-DRAFT.
 *
 * FOULS-SPEC-DRAFT is spec-only: the deliverable is `specs/FOULS_CARDS_SPEC.md`
 * plus a binding test plus this durable record.  The producer reads the spec
 * and the binding test under test (deterministic facts only — no wall clock),
 * verifies the machine-source constants the spec quotes, and writes a
 * byte-reproducible record to
 * `docs/evidence/FOULS-SPEC-DRAFT/record.json` with a pinned `record_sha256`
 * computed over the record WITHOUT the field itself.
 *
 * Usage:
 *   npx tsx scripts/capture-fouls-spec-record.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

import {
  FOUNDATION_TACKLE_V1,
  FOUNDATION_CPU_TACKLE_V1,
  FOUNDATION_PLAYER_CONTACT_V1,
  FOUNDATION_CONTACT_V1,
  FOUNDATION_CONFIG,
  FOUNDATION_FIXED_DT_V1,
} from "../src/simulation/config/foundation.js";
import {
  ANTI_HUDDLE_V1_ID,
  RESTART_HOLD_MIN_TICKS,
} from "../src/adapters/input-browser/cpu-adapter.js";
import {
  GK_MODEL_ID,
  GK_MODEL_VERSION,
} from "../eval/contracts/goalkeeper-config.js";
import { loadRegistrySet } from "../eval/contracts/loader.js";

const OBJECTIVE_ID = "FOULS-SPEC-DRAFT";
const SPEC_PATH = resolve("specs/FOULS_CARDS_SPEC.md");
const BINDING_TEST_PATH = resolve("tests/unit/eval/fouls-spec-binding.test.ts");
const HEAD = execSync("git rev-parse HEAD").toString().trim();

// Durable evidence is only written when the evidence-mode gate is set.  An
// ordinary-mode run (no WIP_SECTION gate) writes scratch under the gitignored
// test-results/ tree and leaves docs/evidence/ byte-identical.
const EVIDENCE_GATE = `__EVIDENCE__:${OBJECTIVE_ID}`;
const gated = process.env.WIP_SECTION === EVIDENCE_GATE;
const OUTPUT_BASE = gated
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results", OBJECTIVE_ID);
const ARTIFACT_PATH = resolve(OUTPUT_BASE, "record.json");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const spec = readFileSync(SPEC_PATH, "utf-8");
const bindingTest = readFileSync(BINDING_TEST_PATH, "utf-8");

// Number of `it(...)` test cases in the binding test (deterministic).
const bindingTestCount = (bindingTest.match(/^\s*it\(/gm) ?? []).length;

// Reference-check the values the spec quotes against the machine sources.
const quotedConstants: Record<string, string> = {
  standingReach: String(FOUNDATION_TACKLE_V1.standingReach.value),
  slideReach: String(FOUNDATION_TACKLE_V1.slideReach.value),
  contactConeMinCos: String(FOUNDATION_TACKLE_V1.contactConeMinCos.value),
  carrierImpulseSpeed: String(FOUNDATION_TACKLE_V1.carrierImpulseSpeed.value),
  slideLungeSpeed: String(FOUNDATION_TACKLE_V1.slideLungeSpeed.value),
  ballDeflectionSpeed: String(FOUNDATION_TACKLE_V1.ballDeflectionSpeed.value),
  carrierContestDistance: String(FOUNDATION_CPU_TACKLE_V1.carrierContestDistance.value),
  playerRadius: String(FOUNDATION_PLAYER_CONTACT_V1.playerRadius.value),
  separationStiffness: String(FOUNDATION_PLAYER_CONTACT_V1.separationStiffness.value),
  velocityDampingNormal: String(FOUNDATION_PLAYER_CONTACT_V1.velocityDampingNormal.value),
  contactRadius: String(FOUNDATION_CONTACT_V1.contactRadius.value),
  fixedTick: `${FOUNDATION_FIXED_DT_V1.numerator}/${FOUNDATION_FIXED_DT_V1.denominator}`,
  restartHoldMinTicks: String(RESTART_HOLD_MIN_TICKS),
};

// Confirm each quoted constant string is present in the spec prose.
const constantDrift: string[] = [];
for (const [key, value] of Object.entries(quotedConstants)) {
  if (!spec.includes(value)) constantDrift.push(`${key}=${value}`);
}

// The named-but-not-registered criteria.
const namedCriteria = [
  "FOUL-DETECT",
  "FOUL-CLEAN-TACKLE",
  "CARD-ISSUED",
  "ADVANTAGE-PLAYED",
  "FREE-KICK-AWARD",
];

// Confirm the spec references each accepted model id.
const referencedModelIds = [
  FOUNDATION_TACKLE_V1.id,
  FOUNDATION_CPU_TACKLE_V1.id,
  FOUNDATION_PLAYER_CONTACT_V1.id,
  FOUNDATION_CONTACT_V1.id,
  FOUNDATION_CONFIG.id,
  FOUNDATION_FIXED_DT_V1.id,
  "match-rules-v1",
  ANTI_HUDDLE_V1_ID,
  GK_MODEL_ID,
];
const modelDrift = referencedModelIds.filter((id) => !spec.includes(id));

// Confirm the named criteria are NOT registered in the evaluator registry.
const registry = loadRegistrySet();
const registeredCriteria = namedCriteria.filter(
  (c) =>
    c in registry.common_criteria ||
    Object.values(registry.test_bindings).some((b) => c in b.criterion_bindings) ||
    Object.values(registry.suite_definitions).some(
      (s) => s.common_criterion_ids.includes(c) || s.direct_test_ids.includes(c),
    ),
);

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  spec_path: "specs/FOULS_CARDS_SPEC.md",
  spec_model_id: "fouls-v1",
  produced_by: "scripts/capture-fouls-spec-record.ts",
  evidence_class: "HEADLESS",
  candidate_commit: HEAD,
  spec_sections: [
    "1. Purpose and authority",
    "2. Scope and explicit exclusions (2.1 in scope / 2.2 out of scope)",
    "3. Normative vocabulary and configuration model",
    "4. The duel/tackle machinery the foul grounds on (accepted, immutable)",
    "5. What a foul IS in this engine (5.1 foul definition / 5.2 NOT a foul / 5.3 carrier identity)",
    "6. Advantage semantics (named, NOT implemented)",
    "7. Card / disciplinary semantics (named, NOT implemented)",
    "8. Set-piece consequence of a foul (free kick, deferred, references accepted machinery)",
    "9. Versioned provisional configuration (fouls-v1)",
    "10. Adjudicating telemetry / suite criteria (named, NOT registered)",
    "11. BLOCKED_MISSING_REFERENCE values",
    "12. Keeper interaction",
    "13. Declaration of limitations",
    "14. Relation to GAMEPLAY_EVALUATION_SPEC",
    "15. Deferred rule behaviors (future-with-prerequisites)",
  ],
  referenced_accepted_models: referencedModelIds,
  fouls_v1_provisional_keys: [
    "foul_detect_contact_severity_threshold",
    "fouls_yellow_accumulation_count",
    "fouls_red_accumulation_count",
    "foul_card_direct_red_severity_threshold",
    "advantage_window_ticks",
    "foul_caution_pending_ticks",
    "foul_ball_carrier_contest_distance",
  ],
  blocked_references: [
    "foul_card_threshold_ref",
    "foul_severity_distribution_ref",
    "foul_ball_carrier_identity_ref",
    "advantage_window_ref_ms",
    "free_kick_trajectory_ref",
    "disciplinary_scale_ref",
    "card_display_visual_ref",
  ],
  named_criteria: namedCriteria,
  named_criteria_registered: registeredCriteria,
  binding_test: {
    path: "tests/unit/eval/fouls-spec-binding.test.ts",
    test_count: bindingTestCount,
  },
  quoted_constant_drift: constantDrift,
  model_id_drift: modelDrift,
  claims_not_made: [
    "No implementation claim: no foul, card, advantage, or free-kick machinery exists in src/; the spec names future semantics only.",
    "No adjudicating criterion (FOUL-DETECT / FOUL-CLEAN-TACKLE / CARD-ISSUED / ADVANTAGE-PLAYED / FREE-KICK-AWARD) is registered in the evaluator registry.",
    "No fouls behavior exists in the engine.",
    "No PES 2017 fidelity or invented constant: fouls-v1 parameters are VERSIONED_PROVISIONAL, not PES magnitudes; referenced accepted values come from machine sources.",
    "Offside and penalty kicks stay regulation-only with no existence claim.",
    "No PROMOTION claim.",
    "No FOUNDATION_LAB_PASS claim.",
    "Blocked references stay BLOCKED_MISSING_REFERENCE (never converted into invented envelopes or tolerances).",
  ],
};

// Compute the pinned record_sha256 over the JSON WITHOUT the field itself.
const forHashing: Record<string, unknown> = { ...record };
const pinned = sha256(JSON.stringify(forHashing));
record.record_sha256 = pinned;

mkdirSync(OUTPUT_BASE, { recursive: true });
writeFileSync(ARTIFACT_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[fouls-spec-record] wrote ${ARTIFACT_PATH}`);
console.log(`[fouls-spec-record] evidence_gate=${gated ? EVIDENCE_GATE : null}`);
console.log(`[fouls-spec-record] record_sha256=${record.record_sha256}`);
console.log(`[fouls-spec-record] candidate_commit=${HEAD}`);
console.log(`[fouls-spec-record] binding_test_count=${bindingTestCount}`);
console.log(`[fouls-spec-record] constant_drift=${JSON.stringify(constantDrift)}`);
console.log(`[fouls-spec-record] model_drift=${JSON.stringify(modelDrift)}`);
console.log(`[fouls-spec-record] registered_criteria=${JSON.stringify(registeredCriteria)}`);

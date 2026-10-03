/**
 * @module tests/unit/eval/release-0-9-8-product-binding.test.ts
 *
 * Evidence-binding test for RELEASE-0.9.8-PRODUCT (BOOKKEEPING).
 *
 * Locks the PRODUCT consolidation record structure and the headline v34-v37
 * facts:
 *
 *  1. The durable record under `docs/evidence/RELEASE-0.9.8-PRODUCT/` has the
 *     established shape and a stable, byte-reproducible `record_sha256`
 *     (recomputed over the record without the field).
 *  2. The NAME COLLISION against the 0.9.8 SYSTEM release notes
 *     (`gauntlet/RELEASE-0.9.8.md`) is resolved by the `-PRODUCT` suffix and
 *     disclosed; the system notes are untouched.
 *  3. Playable: the referee loop (menu-visible Referee toggle, fouls/free
 *     kicks/cards in normal play) with the 5-frame evidence + exact event
 *     correspondence (REFEREE-SHIPPED-WIRING).
 *  4. Executable/attested: suite-fouls-v1 4-of-5 registered with executed
 *     verdicts; the gk-regression canary; the goalkeepers 10/0/1/1/1 (baseline
 *     9/0/2/1/1); the aggregate-honesty republication; the designation-facts
 *     serialization.
 *  5. Spec'd: the FOULS_CARDS_SPEC card/advantage design contract (§6.1-§6.5),
 *     `advantage_retention_ref` BLOCKED_MISSING_REFERENCE, ADVANTAGE-PLAYED
 *     NAMED-NOT-REGISTERED (ADVANTAGE-WINDOW-SPEC).
 *  6. Deferred: ADVANTAGE-PLAYED machinery, the severity path, second-yellow
 *     -> red, the blocked references, regulation, full-match ecology, PES
 *     fidelity.
 *  7. Every cited record is pinned by its record_sha256 (or the manifest bytes
 *     where an objective produced no producer record), and the live bytes still
 *     match. The immutable 0.9.8-PRODUCT and 0.9.7 release documents still
 *     match their recorded source hashes; the mutable live VERSION.json is
 *     checked through the historical snapshot stored in the record.
 *  8. Discriminating: the record is content-addressed (a mutated value changes
 *     the recomputed sha), and a wrong headline count fails the assertion.
 *  9. No PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS; no
 *     VERSION.json / prompt-gate.ts change.
 *
 * Node I/O is allowed for record and source-file loading.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECORD_REL = "docs/evidence/RELEASE-0.9.8-PRODUCT/release-0-9-8-product.json";

interface VerdictCounts {
  PASS: number;
  FAIL: number;
  NOT_EVALUATED: number;
  BLOCKED_MISSING_REFERENCE: number;
  NEEDS_PERCEPTUAL_REVIEW: number;
}

interface CitedRecord {
  objective_id: string;
  record_sha256: string;
  pin_kind: string;
}

interface ReleaseRecord {
  schema_version: number;
  objective_id: string;
  evidence_class: string;
  produced_by: string;
  product_release_version: string;
  previous_product_release_version: string;
  release_doc: string;
  name_collision_resolution: {
    note: string;
    system_release_notes: string;
    system_release_notes_sha256: string;
    previous_product_release_doc: string;
    previous_product_release_doc_sha256: string;
  };
  version_json: { version: string; schema_version: number; semver: boolean; previous_system_version: string };
  version_snapshot_note: string;
  description: string;
  playable: string[];
  executable_attested: {
    fouls_suite: {
      suite_id: string;
      suite_version: string;
      criteria_named: number;
      criteria_registered: number;
      named_not_registered: string[];
      per_criterion: Record<string, string>;
      verdict_counts_over_registered: VerdictCounts;
      note: string;
      source_records: Record<string, string>;
      power_guard_note: string;
    };
    gk_regression_canary: {
      oracle_id: string;
      oracle_version: string;
      invariant_id: string;
      criteria: number;
      reg_aggregate_before: string;
      reg_aggregate_after: string;
      note: string;
      source_record: string;
      source_record_sha256: string;
    };
    goalkeepers_suite: {
      suite_id: string;
      suite_version: string;
      verdict_counts: VerdictCounts;
      baseline_verdict_counts: VerdictCounts;
      note: string;
      source_record: string;
      source_record_sha256: string;
    };
    driven_gk_closure: { save_chains: number; release_count: number; note: string; source_record: string; source_record_sha256: string };
    aggregate_honesty_republication: {
      goalkeepers_verdict_counts: VerdictCounts;
      goalkeepers_baseline_verdict_counts: VerdictCounts;
      changed: Array<{ criterion: string; from: string; to: string }>;
      fouls_registered_at_republication: number;
      streams_character_identical_to_accepted: boolean;
      note: string;
      source_record: string;
      source_record_sha256: string;
    };
    designation_facts_serialization: { gated_flag: string; default: boolean; note: string; reused_by: string[]; source_record: string; source_record_sha256: string };
    foul_detection_and_human_serve: {
      foul_detection: { source_record: string; source_record_sha256: string };
      human_ball_server_literal: { source_record: string; source_record_sha256: string };
    };
  };
  specd: {
    fouls_cards_spec: {
      path: string;
      model: string;
      exists: boolean;
      advantage_design_contract: { sections: string[]; present: boolean; note: string };
      advantage_window_ticks: number;
      foul_caution_pending_ticks: number;
      both_are_foundation_fixed_dt_tick_budgets: boolean;
      advantage_retention_ref: string;
      advantage_played: string;
      source_record: string;
      source_record_sha256: string;
      source_record_pin_kind: string;
      audit_artifact: string;
      audit_artifact_sha256: string;
      source_record_note: string;
    };
  };
  deferred: string[];
  limitations: string[];
  cited_records: Record<string, CitedRecord>;
  source_hashes: Record<string, string>;
  claims_not_made: string[];
  record_sha256: string;
}

function read(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf-8");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadRecord(): ReleaseRecord {
  return JSON.parse(read(RECORD_REL)) as ReleaseRecord;
}

const PINNED_RECORD_SHAS: Record<string, string> = {
  "docs/evidence/FOUL-DETECTION-MACHINERY/foul-detection-machinery.json": "69104ea10e14aa2607eefbd9e3206e17d025f4cea5206032867e4772bc89a272",
  "docs/evidence/FOULS-SUITE-REGISTRATION/fouls-suite-registration.json": "5e538e5d183ee0c3c79e4981bb447a06c42d3b7be3a3ceb66f320dfb24611794",
  "docs/evidence/HUMAN-BALL-SERVER-LITERAL/human-ball-server-literal.json": "85fc082d30e9120c5c12f9d9e6950dbb332fee8960affdf8852f8feb5c4734ef",
  "docs/evidence/GK-DRIVEN-CLOSURE/gk-driven-closure.json": "21a596277aac626f3612e225ced4145310e1a81631bd28552f9188d223b33d7a",
  "docs/evidence/FOUL-CONSEQUENCE-MACHINERY/foul-consequence-machinery.json": "39da80ad4106546939afeefa34cca2763a113bdfc559eec013a9ee578834da95",
  "docs/evidence/FREE-KICK-SUITE-REGISTRATION/freekick-suite-registration.json": "86a34acb5f7336ac339c91fced93246c52f1f6beadb5407ae916cae7e6b425f2",
  "docs/evidence/GK-REGRESSION-POLICY-REGISTRATION/gk-regression-policy-registration.json": "fc7d1b97b3b1a78613b571610e3bdbc53aa076b5ae42f828555a4110e037e60e",
  "docs/evidence/FOUL-FREEKICK-BROWSER-EVIDENCE/foul-freekick-browser-evidence-state.json": "e65c3618369a1474eb2c094714b41fb85986e68d3a6e6f19011fd7ed4cb6188c",
  "docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/fouls-aggregate-honesty-rerun.json": "c8b3b63edd57f6acd15e91f4daa0bdb8d35e239155ee51b6975cc76f59acaa21",
  "docs/evidence/CARD-MACHINERY/card-machinery.json": "01d731ada16b2451b1a939bf9d20af66da8bdc07445fbcd150cd41062a2cba66",
  "docs/evidence/CARD-ISSUED-SUITE-REGISTRATION/card-issued-suite-registration.json": "3dac8a48cae826d846e58c16ec487cc40187b645b9b17bc385ae2f64dc16bd3c",
  "docs/evidence/CARD-BROWSER-EVIDENCE/card-browser-evidence-state.json": "bc9daf1fff3167eed5e7d14a6c7a739c3210e4fa449268b5bef76de9384069d0",
  "docs/evidence/REFEREE-SHIPPED-WIRING/referee-shipped-wiring-state.json": "b2f5392784b10431fdf1bd689ee29e4a94f6a6c3bb4a3e746e97461320f0a40a",
  "docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/restart-designation-facts-state.json": "271b1526592cc13e3792bee42f2544379e7dea16de9571b43113b32b57e7fc56",
};

const PINNED_FILE_SHAS: Record<string, string> = {
  "docs/evidence/REFEREE-SHIPPED-WIRING/manifest.json": "1219570a04182abadf8ae172a67861e258ac28d18c18b6094ceedfe04a75f4d5",
  "docs/evidence/ADVANTAGE-WINDOW-SPEC/manifest.json": "2febf1302470dc7f7f8d6daf9a3e6d61e67baf277748e35f9f4e55f204b391a9",
  "docs/evidence/ADVANTAGE-WINDOW-SPEC/audit.json": "1608f247fa974049375c89c197725927adbcbed2563291be1fbc79bd0f5b9f5a",
};

describe("RELEASE-0.9.8-PRODUCT release record", () => {
  it("durable record exists with the established shape and a stable record_sha256", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("RELEASE-0.9.8-PRODUCT");
    expect(record.evidence_class).toBe("BOOKKEEPING");
    expect(record.schema_version).toBe(1);
    expect(record.product_release_version).toBe("0.9.8");
    expect(record.previous_product_release_version).toBe("0.9.7");
    expect(record.release_doc).toBe("gauntlet/RELEASE-0.9.8-PRODUCT.md");
    expect(record.produced_by).toBe("scripts/capture-release-0-9-8-product.ts");

    // Recompute record_sha256 over the record without the field itself.
    const copy: Record<string, unknown> = { ...record } as unknown as Record<string, unknown>;
    delete (copy as ReleaseRecord).record_sha256;
    expect(sha256(JSON.stringify(copy))).toBe(record.record_sha256);
    expect(record.record_sha256.length).toBeGreaterThan(0);
  });

  it("resolves the 0.9.8 system-notes name collision with the -PRODUCT suffix", () => {
    const record = loadRecord();
    const collision = record.name_collision_resolution;
    expect(collision.system_release_notes).toBe("gauntlet/RELEASE-0.9.8.md");
    expect(collision.note.toLowerCase()).toContain("collides");
    expect(record.release_doc).not.toBe(collision.system_release_notes);

    // The SYSTEM notes are untouched: still the product-first orchestration doc.
    const systemNotes = read("gauntlet/RELEASE-0.9.8.md");
    expect(systemNotes).toContain("Product-first orchestration");
    expect(collision.system_release_notes_sha256).toMatch(/^[a-f0-9]{64}$/);

    // The previous product release doc is the immutable 0.9.7 consolidation.
    expect(collision.previous_product_release_doc).toBe("gauntlet/RELEASE-0.9.7.md");
    expect(collision.previous_product_release_doc_sha256).toBe(sha256(read("gauntlet/RELEASE-0.9.7.md")));
  });

  it("stores the live system VERSION.json as a historical snapshot (not a live pin)", () => {
    const record = loadRecord();
    // The live VERSION.json is the mutable SYSTEM version; it is recorded as history.
    expect(record.version_json).toEqual({
      version: "0.9.9",
      schema_version: 1,
      semver: true,
      previous_system_version: "0.9.8",
    });
    expect(record.version_snapshot_note.toLowerCase()).toContain("not modified");
    expect(record.source_hashes["gauntlet/VERSION.json"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("playable: the referee loop cites REFEREE-SHIPPED-WIRING with the 5-frame evidence and exact correspondence", () => {
    const record = loadRecord();
    const joined = record.playable.join("\n");
    expect(joined).toContain("REFEREE-SHIPPED-WIRING");
    expect(joined).toContain("Referee toggle");
    expect(joined).toContain("[66, 290]");
    expect(joined).toContain("offset 0");
    expect(record.playable.length).toBeGreaterThanOrEqual(5);
    // The cited record really carries 5 frames and the exact correspondence.
    const referee = JSON.parse(read("docs/evidence/REFEREE-SHIPPED-WIRING/referee-shipped-wiring-state.json")) as {
      frames: unknown[];
      correspondence: { foul_ticks_equal: boolean; free_kick_tick_offset: number; caution_tick_offset: number };
    };
    expect(referee.frames.length).toBe(5);
    expect(referee.correspondence.foul_ticks_equal).toBe(true);
    expect(referee.correspondence.free_kick_tick_offset).toBe(0);
    expect(referee.correspondence.caution_tick_offset).toBe(0);
  });

  it("executable/attested: suite-fouls-v1 is 4-of-5 registered with executed verdicts", () => {
    const record = loadRecord();
    const fouls = record.executable_attested.fouls_suite;
    expect(fouls.suite_id).toBe("fouls");
    expect(fouls.suite_version).toBe("suite-fouls-v1");
    expect(fouls.criteria_named).toBe(5);
    expect(fouls.criteria_registered).toBe(4);
    expect(fouls.named_not_registered).toEqual(["ADVANTAGE-PLAYED"]);
    expect(fouls.per_criterion).toEqual({
      "FOUL-DETECT": "PASS",
      "FOUL-CLEAN-TACKLE": "PASS",
      "FREE-KICK-AWARD": "PASS",
      "CARD-ISSUED": "NOT_EVALUATED",
    });
    expect(fouls.verdict_counts_over_registered).toEqual({
      PASS: 3,
      FAIL: 0,
      NOT_EVALUATED: 1,
      BLOCKED_MISSING_REFERENCE: 0,
      NEEDS_PERCEPTUAL_REVIEW: 0,
    });
    expect(fouls.power_guard_note).toContain("power-guard");
  });

  it("executable/attested: the gk-regression canary, goalkeepers 10/0/1/1/1, republication, designation facts", () => {
    const record = loadRecord();
    const canary = record.executable_attested.gk_regression_canary;
    expect(canary.oracle_id).toBe("gk-regression-canary-v1");
    expect(canary.invariant_id).toBe("gk-regression-evidence");
    expect(canary.criteria).toBe(6);
    expect(canary.reg_aggregate_before).toBe("NOT_EVALUATED");
    expect(canary.reg_aggregate_after).toBe("PASS");

    const gk = record.executable_attested.goalkeepers_suite;
    expect(gk.suite_id).toBe("goalkeepers");
    expect(gk.suite_version).toBe("suite-goalkeepers-v1");
    expect(gk.verdict_counts).toEqual({ PASS: 10, FAIL: 0, NOT_EVALUATED: 1, BLOCKED_MISSING_REFERENCE: 1, NEEDS_PERCEPTUAL_REVIEW: 1 });
    expect(gk.baseline_verdict_counts).toEqual({ PASS: 9, FAIL: 0, NOT_EVALUATED: 2, BLOCKED_MISSING_REFERENCE: 1, NEEDS_PERCEPTUAL_REVIEW: 1 });

    const repub = record.executable_attested.aggregate_honesty_republication;
    expect(repub.changed).toEqual([{ criterion: "reg", from: "NOT_EVALUATED", to: "PASS" }]);
    expect(repub.fouls_registered_at_republication).toBe(3);
    expect(repub.streams_character_identical_to_accepted).toBe(true);

    const desig = record.executable_attested.designation_facts_serialization;
    expect(desig.gated_flag).toBe("serializeRestartFacts");
    expect(desig.default).toBe(false);
    expect(desig.reused_by).toContain("docs/evidence/CARD-MACHINERY/card-machinery.json");
  });

  it("spec'd: the FOULS_CARDS_SPEC card/advantage state cites ADVANTAGE-WINDOW-SPEC", () => {
    const record = loadRecord();
    const spec = record.specd.fouls_cards_spec;
    expect(spec.path).toBe("specs/FOULS_CARDS_SPEC.md");
    expect(spec.model).toBe("fouls-v1");
    expect(spec.exists).toBe(true);
    expect(spec.advantage_design_contract.sections).toEqual(["§6.1", "§6.2", "§6.3", "§6.4", "§6.5"]);
    expect(spec.advantage_design_contract.present).toBe(true);
    expect(spec.advantage_window_ticks).toBe(24);
    expect(spec.foul_caution_pending_ticks).toBe(12);
    expect(spec.both_are_foundation_fixed_dt_tick_budgets).toBe(true);
    expect(spec.advantage_retention_ref).toBe("BLOCKED_MISSING_REFERENCE");
    expect(spec.advantage_played).toBe("NAMED-NOT-REGISTERED");
    expect(spec.source_record).toBe("docs/evidence/ADVANTAGE-WINDOW-SPEC/manifest.json");
    expect(spec.source_record_pin_kind).toBe("file_bytes");
    expect(spec.source_record_sha256).toBe(PINNED_FILE_SHAS["docs/evidence/ADVANTAGE-WINDOW-SPEC/manifest.json"]);
    expect(spec.audit_artifact_sha256).toBe(PINNED_FILE_SHAS["docs/evidence/ADVANTAGE-WINDOW-SPEC/audit.json"]);

    // The advantage design contract really is present in the spec.
    const foulsSpec = read("specs/FOULS_CARDS_SPEC.md");
    for (const section of ["### 6.1 ", "### 6.2 ", "### 6.3 ", "### 6.4 ", "### 6.5 "]) {
      expect(foulsSpec).toContain(section);
    }
    expect(foulsSpec).toContain("NAMED-NOT-REGISTERED");
  });

  it("deferred names ADVANTAGE-PLAYED machinery, the severity path, second-yellow->red, blocked references, regulation, ecology, PES fidelity", () => {
    const record = loadRecord();
    const joined = record.deferred.join("\n");
    expect(joined).toContain("ADVANTAGE-PLAYED");
    expect(joined).toContain("severity");
    expect(joined).toContain("Second-yellow -> red");
    expect(joined).toContain("BLOCKED_MISSING_REFERENCE");
    expect(joined).toContain("advantage_retention_ref");
    expect(joined).toContain("Regulation rules");
    expect(joined).toContain("Full-match ecology");
    expect(joined).toContain("PES fidelity");
  });

  it("every cited record is pinned and the live bytes still match; release docs survive", () => {
    const record = loadRecord();
    for (const [path, sha] of Object.entries(PINNED_RECORD_SHAS)) {
      expect(record.cited_records[path]).toBeDefined();
      expect(record.cited_records[path].record_sha256).toBe(sha);
      expect(record.cited_records[path].pin_kind).toBe("record");
      // The live record still carries exactly that record_sha256.
      const live = JSON.parse(read(path)) as { objective_id: string; record_sha256: string };
      expect(live.record_sha256).toBe(sha);
      expect(record.cited_records[path].objective_id).toBe(live.objective_id);
    }
    for (const [path, sha] of Object.entries(PINNED_FILE_SHAS)) {
      expect(record.cited_records[path]).toBeDefined();
      expect(record.cited_records[path].record_sha256).toBe(sha);
      expect(record.cited_records[path].pin_kind).toBe("file_bytes");
      expect(sha256(read(path))).toBe(sha);
    }

    // The immutable product release document and the historical 0.9.7 doc.
    expect(record.source_hashes["gauntlet/RELEASE-0.9.8-PRODUCT.md"]).toBe(sha256(read("gauntlet/RELEASE-0.9.8-PRODUCT.md")));
    expect(record.source_hashes["gauntlet/RELEASE-0.9.7.md"]).toBe(sha256(read("gauntlet/RELEASE-0.9.7.md")));
    expect(record.source_hashes["gauntlet/RELEASE-0.9.8.md"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("the release document exists, matches the record, and has the established sections", () => {
    const record = loadRecord();
    const doc = read("gauntlet/RELEASE-0.9.8-PRODUCT.md");
    expect(doc).toContain("# Gauntlet 0.9.8");
    for (const heading of ["## Playable", "## Executable / attested", "## Spec'd", "## Deferred", "## Honest limitations"]) {
      expect(doc).toContain(heading);
    }
    expect(doc).toContain("REFEREE-SHIPPED-WIRING");
    expect(doc).toContain("ADVANTAGE-WINDOW-SPEC");
    expect(doc).toContain("No gameplay behavior changes");
    // No circular self-hash: the doc must not embed its own record_sha256.
    expect(doc).not.toContain(record.record_sha256);
  });

  it("limitations / claims_not_made sections are present and honest", () => {
    const record = loadRecord();
    const limitations = record.limitations.join("\n").toLowerCase();
    expect(limitations).toContain("gated");
    expect(limitations).toContain("driven");
    expect(limitations).toContain("not_evaluated");
    const claims = record.claims_not_made.join("\n").toLowerCase();
    expect(claims).toContain("no suite-level pass");
    expect(claims).toContain("no promotion");
    expect(claims).toContain("no foundation_lab_pass");
    expect(claims).toContain("no pes");
    expect(claims).toContain("no invented reference");
    expect(claims).toContain("zero gameplay/source change");
    expect(claims).toContain("no version.json / prompt-gate.ts change");
  });

  it("discriminating: the record is content-addressed and a wrong headline count fails", () => {
    const record = loadRecord();
    // Content-addressed: mutating any field changes the recomputed sha.
    const copy: Record<string, unknown> = { ...record } as unknown as Record<string, unknown>;
    delete (copy as ReleaseRecord).record_sha256;
    const original = sha256(JSON.stringify(copy));
    const mutated = { ...(copy as Record<string, unknown>), product_release_version: "0.9.9" };
    expect(sha256(JSON.stringify(mutated))).not.toBe(original);

    // A wrong headline count must fail the assertion (discriminating).
    const gk = record.executable_attested.goalkeepers_suite.verdict_counts;
    expect(gk.PASS).toBe(10);
    expect(() => expect(gk.PASS).toBe(9)).toThrow();
  });
});

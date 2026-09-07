/**
 * @module tests/unit/eval/release-0-9-7-consolidation-binding.test.ts
 *
 * Evidence-binding test for RELEASE-0.9.7-CONSOLIDATION (BOOKKEEPING).
 *
 * Locks the release record structure and the headline consolidation facts:
 *
 *  1. The durable record under `docs/evidence/RELEASE-0.9.7-CONSOLIDATION/`
 *     has the established shape and a stable, byte-reproducible
 *     `record_sha256` (recomputed over the record without the field).
 *  2. The rules suite is published as 23 PASS / 2 BLOCKED_MISSING_REFERENCE /
 *     0 NOT_EVALUATED / 0 FAIL over 25 MATCH-* criteria, and 24 PASS / 2
 *     BLOCKED with the COMMON-DETERMINISTIC determinism row.
 *  3. The goalkeepers suite is published as 9 PASS / 0 FAIL / 2 NOT_EVALUATED /
 *     1 BLOCKED_MISSING_REFERENCE / 1 NEEDS_PERCEPTUAL_REVIEW (core-owned
 *     baseline 8 PASS / 3 NOT_EVALUATED / 1 BLOCKED / 1 NEEDS_PERCEPTUAL_REVIEW).
 *  4. COMMON-DETERMINISTIC is attested PASS for both suites from two-run
 *     byte-identity.
 *  5. The protected-oracle discipline (8) and the designation-facts
 *     serialization (gated `serializeRestartFacts`, default false) are recorded.
 *  6. FOULS_CARDS_SPEC is recorded as spec'd (exists, model `fouls-v1`).
 *  7. The deferred list names the pass-button DEFER + HUMAN-BALL-SERVER-LITERAL
 *     outline and the blocked references.
 *  8. Every cited record is pinned by its record_sha256, and the record's
 *     `source_hashes` match the actual RELEASE-0.9.7.md / VERSION.json bytes.
 *  9. Discriminating: the record is content-addressed (a mutated value changes
 *     the recomputed sha), and a wrong headline count fails the assertion.
 * 10. No PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS.
 *
 * Node I/O is allowed for record and source-file loading.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECORD_PATH = join(
  projectRoot,
  "docs/evidence/RELEASE-0.9.7-CONSOLIDATION/release-0-9-7-consolidation.json",
);

interface VerdictCounts {
  PASS: number;
  FAIL: number;
  NOT_EVALUATED: number;
  BLOCKED_MISSING_REFERENCE: number;
  NEEDS_PERCEPTUAL_REVIEW: number;
}

interface ReleaseRecord {
  schema_version: number;
  objective_id: string;
  evidence_class: string;
  produced_by: string;
  release_version: string;
  previous_release_version: string;
  release_doc: string;
  version_json: { version: string; schema_version: number; semver: boolean; previous_system_version: string };
  description: string;
  playable: string[];
  executable_attested: {
    rules_suite: { suite_id: string; suite_version: string; criteria: number; verdict_counts: VerdictCounts; source_record: string; source_record_sha256: string };
    rules_suite_with_common_determinism: { verdict_counts: VerdictCounts; source_record: string; source_record_sha256: string };
    goalkeepers_suite: { suite_id: string; suite_version: string; verdict_counts: VerdictCounts; source_record: string; source_record_sha256: string };
    goalkeepers_core_owned_baseline: { verdict_counts: VerdictCounts; source_record: string; source_record_sha256: string };
    common_deterministic_two_run: { rules: string; goalkeepers: string; note: string; source_record: string; source_record_sha256: string };
    protected_oracle_discipline: { count: number; note: string; source_record: string; source_record_sha256: string };
    designation_facts_serialization: { gated_flag: string; default: boolean; note: string; source_record: string; source_record_sha256: string };
  };
  specd: { fouls_cards_spec: { path: string; model: string; exists: boolean; note: string; source_record: string; source_record_sha256: string } };
  deferred: string[];
  limitations: string[];
  cited_records: Record<string, { record_sha256: string; objective_id: string }>;
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
  return JSON.parse(read("docs/evidence/RELEASE-0.9.7-CONSOLIDATION/release-0-9-7-consolidation.json")) as ReleaseRecord;
}

describe("RELEASE-0.9.7-CONSOLIDATION release record", () => {
  it("durable record exists with the established shape and stable record_sha256", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("RELEASE-0.9.7-CONSOLIDATION");
    expect(record.evidence_class).toBe("BOOKKEEPING");
    expect(record.schema_version).toBe(1);
    expect(record.release_version).toBe("0.9.7");
    expect(record.previous_release_version).toBe("0.9.6");
    expect(record.release_doc).toBe("gauntlet/RELEASE-0.9.7.md");
    expect(record.produced_by).toBe("scripts/capture-release-0-9-7-consolidation.ts");

    // Recompute record_sha256 over the record without the field itself.
    const copy: Record<string, unknown> = { ...record } as unknown as Record<string, unknown>;
    delete (copy as ReleaseRecord).record_sha256;
    expect(sha256(JSON.stringify(copy))).toBe(record.record_sha256);
    expect(record.record_sha256.length).toBeGreaterThan(0);
  });

  it("rules suite is published as 23 PASS / 2 BLOCKED / 0 / 0 over 25 criteria, +1 with COMMON-DETERMINISTIC", () => {
    const record = loadRecord();
    const rules = record.executable_attested.rules_suite;
    expect(rules.suite_id).toBe("rules");
    expect(rules.suite_version).toBe("suite-rules-v1");
    expect(rules.criteria).toBe(25);
    expect(rules.verdict_counts).toEqual({
      PASS: 23,
      FAIL: 0,
      NOT_EVALUATED: 0,
      BLOCKED_MISSING_REFERENCE: 2,
      NEEDS_PERCEPTUAL_REVIEW: 0,
    });
    const withCommon = record.executable_attested.rules_suite_with_common_determinism;
    expect(withCommon.verdict_counts).toEqual({
      PASS: 24,
      FAIL: 0,
      NOT_EVALUATED: 0,
      BLOCKED_MISSING_REFERENCE: 2,
      NEEDS_PERCEPTUAL_REVIEW: 0,
    });
    // Source record cited for the rules suite verdicts.
    expect(rules.source_record).toBe("docs/evidence/RULES-SUITE-STATE-RERUN/rules-suite-state-rerun.json");
    expect(rules.source_record_sha256).toBe("36fc77e52909dbaceefa14927b37b8e533c248e451477fc579dc4952434979ef");
  });

  it("goalkeepers suite is published as 9/0/2/1/1 with core-owned baseline 8/0/3/1/1", () => {
    const record = loadRecord();
    const gk = record.executable_attested.goalkeepers_suite;
    expect(gk.suite_id).toBe("goalkeepers");
    expect(gk.suite_version).toBe("suite-goalkeepers-v1");
    expect(gk.verdict_counts).toEqual({
      PASS: 9,
      FAIL: 0,
      NOT_EVALUATED: 2,
      BLOCKED_MISSING_REFERENCE: 1,
      NEEDS_PERCEPTUAL_REVIEW: 1,
    });
    const baseline = record.executable_attested.goalkeepers_core_owned_baseline;
    expect(baseline.verdict_counts).toEqual({
      PASS: 8,
      FAIL: 0,
      NOT_EVALUATED: 3,
      BLOCKED_MISSING_REFERENCE: 1,
      NEEDS_PERCEPTUAL_REVIEW: 1,
    });
    expect(gk.source_record_sha256).toBe("abaf6ccdc8a07643289035e8dbfcc639a525a66955b4738f3735d24fa350a27c");
    expect(baseline.source_record_sha256).toBe("5cd1c80879d400c2dabfc0ba6d9b195447fc9476f7b6ebb5329877dd2a69204a");
  });

  it("COMMON-DETERMINISTIC is attested PASS for both suites from two-run byte-identity", () => {
    const record = loadRecord();
    const det = record.executable_attested.common_deterministic_two_run;
    expect(det.rules).toBe("PASS");
    expect(det.goalkeepers).toBe("PASS");
    expect(det.source_record).toBe("docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json");
    expect(det.note).toContain("run-1/run-2");
  });

  it("protected-oracle discipline and designation-facts serialization are recorded", () => {
    const record = loadRecord();
    const oracle = record.executable_attested.protected_oracle_discipline;
    expect(oracle.count).toBe(8);
    expect(oracle.note).toContain("rules-restart.ts");
    expect(oracle.source_record).toBe("docs/evidence/RULES-SUITE-REGISTRATION/rules-suite-state.json");
    expect(oracle.source_record_sha256).toBe("7503f9fe61b86731d08460dd47651b541abc3672b21ff26d0056ad8fd81029f8");
    const desig = record.executable_attested.designation_facts_serialization;
    expect(desig.gated_flag).toBe("serializeRestartFacts");
    expect(desig.default).toBe(false);
    expect(desig.note).toContain("anti-huddle");
    expect(desig.source_record_sha256).toBe("271b1526592cc13e3792bee42f2544379e7dea16de9571b43113b32b57e7fc56");
  });

  it("FOULS_CARDS_SPEC is recorded as spec'd", () => {
    const record = loadRecord();
    const fouls = record.specd.fouls_cards_spec;
    expect(fouls.path).toBe("specs/FOULS_CARDS_SPEC.md");
    expect(fouls.model).toBe("fouls-v1");
    expect(fouls.exists).toBe(true);
    expect(fouls.source_record_sha256).toBe("e98a1efe08f1c8ec68c5b957a801e9035c70a132e3f5d354e3dd30b8767b0716");
  });

  it("deferred list names the pass-button DEFER + HUMAN-BALL-SERVER-LITERAL outline and the blocked references", () => {
    const record = loadRecord();
    const joined = record.deferred.join("\n");
    expect(joined).toContain("HUMAN-BALL-SERVER-LITERAL");
    expect(joined).toContain("BLOCKED_MISSING_REFERENCE");
    expect(joined).toContain("MATCH-CORNER-KICK-CROSS");
    expect(joined).toContain("MATCH-GOAL-KICK-DISTRIBUTION");
    expect(joined).toContain("Regulation rules");
    expect(joined).toContain("full-match ecology");
  });

  it("every cited record is pinned by its record_sha256 and the source hashes match the actual files", () => {
    const record = loadRecord();
    const pinned: Record<string, string> = {
      "docs/evidence/RULES-SUITE-STATE-RERUN/rules-suite-state-rerun.json": "36fc77e52909dbaceefa14927b37b8e533c248e451477fc579dc4952434979ef",
      "docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json": "abaf6ccdc8a07643289035e8dbfcc639a525a66955b4738f3735d24fa350a27c",
      "docs/evidence/GK-SUITE-CORE-OWNED-STATE/gk-suite-core-owned-state.json": "5cd1c80879d400c2dabfc0ba6d9b195447fc9476f7b6ebb5329877dd2a69204a",
      "docs/evidence/FOULS-SPEC-DRAFT/record.json": "e98a1efe08f1c8ec68c5b957a801e9035c70a132e3f5d354e3dd30b8767b0716",
      "docs/evidence/RULES-SUITE-REGISTRATION/rules-suite-state.json": "7503f9fe61b86731d08460dd47651b541abc3672b21ff26d0056ad8fd81029f8",
      "docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/restart-designation-facts-state.json": "271b1526592cc13e3792bee42f2544379e7dea16de9571b43113b32b57e7fc56",
      "docs/evidence/HUMAN-BALL-SERVER-DECISION/human-ball-server-decision.json": "5b6e391a3d8da585b4e48bfae703ec9d57b78b1ecc1e4a10cbcfeeef5891b489",
    };
    for (const [path, sha] of Object.entries(pinned)) {
      expect(record.cited_records[path].record_sha256).toBe(sha);
    }
    // Source hashes must match the actual bytes of the two files the release touches.
    expect(record.source_hashes["gauntlet/RELEASE-0.9.7.md"]).toBe(sha256(read("gauntlet/RELEASE-0.9.7.md")));
    expect(record.source_hashes["gauntlet/VERSION.json"]).toBe(sha256(read("gauntlet/VERSION.json")));
  });

  it("playable / limitations / claims_not_made sections are present and honest", () => {
    const record = loadRecord();
    expect(record.playable.length).toBeGreaterThanOrEqual(5);
    expect(record.playable.join("\n")).toContain("fulltime");
    expect(record.limitations.join("\n").toLowerCase()).toContain("fixture-driven");
    const joined = record.claims_not_made.join("\n").toLowerCase();
    expect(joined).toContain("no suite-level pass");
    expect(joined).toContain("no promotion");
    expect(joined).toContain("no pes");
    expect(joined).toContain("no foundation_lab_pass");
    expect(joined).toContain("no invented reference");
    expect(joined).toContain("zero gameplay/source change");
  });

  it("discriminating: the record is content-addressed and a wrong headline count fails", () => {
    const record = loadRecord();
    // Content-addressed: mutating any field changes the recomputed sha.
    const copy: Record<string, unknown> = { ...record } as unknown as Record<string, unknown>;
    delete (copy as ReleaseRecord).record_sha256;
    const original = sha256(JSON.stringify(copy));
    const mutated = { ...(copy as Record<string, unknown>), release_version: "0.9.8" };
    expect(sha256(JSON.stringify(mutated))).not.toBe(original);

    // A wrong rules count must fail the assertion (discriminating).
    const bad = record.executable_attested.rules_suite.verdict_counts;
    expect(bad.PASS).toBe(23);
    expect(() => expect(bad.PASS).toBe(22)).toThrow();
  });
});

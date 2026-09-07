/**
 * @module tests/unit/eval/SUITE-DETERMINISTIC-TWO-RUN-binding.test.ts
 *
 * Evidence-binding test for SUITE-DETERMINISTIC-TWO-RUN.
 *
 * Locks the two-run deterministic attestation and the honest updated verdict
 * tables for the `goalkeepers` (suite-goalkeepers-v1) and `rules`
 * (suite-rules-v1) suites:
 *
 *  1. The durable record under `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/`
 *     has the established shape and a stable, byte-reproducible
 *     `record_sha256` (recomputed over the record without the field).
 *  2. The goalkeepers suite resolves COMMON-DETERMINISTIC from NOT_EVALUATED
 *     (single-run) to PASS (two-run byte-identity); all GK behavior / other
 *     common / catalog verdicts are unchanged (the only delta is
 *     COMMON-DETERMINISTIC), and the blocked reference stays blocked.
 *  3. The rules suite resolves COMMON-DETERMINISTIC to PASS (added as a
 *     determinism attestation row); the 25 §15 MATCH-* verdicts are unchanged
 *     (23 PASS / 2 BLOCKED_MISSING_REFERENCE / 0 NOT_EVALUATED / 0 FAIL), no
 *     §15 criterion regressed on any attested stream, and the blocked
 *     references stay blocked.
 *  4. Every attested stream is byte-identical run-1 vs run-2
 *     (state_hash_chain_identical).
 *  5. Discriminating check: the same pinned run contract is byte-identical,
 *     while a deliberately different config diverges (a non-identical second
 *     run would fail COMMON-DETERMINISTIC).
 *  6. No PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS.
 *
 * Node I/O is allowed for artifact and scenario loading.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECORD_PATH = join(
  projectRoot,
  "docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json",
);

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

interface ReachableStream {
  determinism: {
    run_a_state_hash_of_hashes: string;
    run_b_state_hash_of_hashes: string;
    state_hash_count: number;
    identical: boolean;
    state_hash_chain_identical: boolean;
    observations_byte_identical: boolean;
    earliest_divergence_tick: number | null;
  };
}

interface RecordType {
  schema_version: number;
  objective_id: string;
  evidence_class: string;
  record_sha256: string;
  suites: {
    goalkeepers: {
      suite_version: string;
      accepted_baseline: { record_sha256: string; verdict_counts: Record<string, number> };
      deterministic_change: string[];
      verdicts: { common: Record<string, string>; gk_behavior: Record<string, string>; catalog: Record<string, string> };
      verdict_counts: Record<string, number>;
      verified_unchanged: string[];
      attested_runs: Array<ReachableStream & { run_id: string }>;
    };
    rules: {
      suite_version: string;
      accepted_baseline: { record_sha256: string; verdict_counts: Record<string, number> };
      attested_streams: Array<ReachableStream & { stream_id: string }>;
      match_criteria_verdicts: Record<string, string>;
      common_determinism: string;
      verdict_counts_match_criteria: Record<string, number>;
      verdict_counts_with_common_determinism: Record<string, number>;
      attested_per_criterion_regressions: string[];
      attested_per_criterion_match: boolean;
      delta_vs_baseline: { changed: string[] };
    };
  };
  claims_not_made: string[];
}

function loadRecord(): RecordType {
  return JSON.parse(readFileSync(RECORD_PATH, "utf-8")) as RecordType;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashOfStateHashes(hashes: string[]): string {
  return sha256(JSON.stringify(hashes));
}

const cornerScenarioPath = "eval/scenarios/5v5-corner-driven.v1.json";

describe("SUITE-DETERMINISTIC-TWO-RUN two-run attestation", () => {
  it("durable record exists with the established shape and stable record_sha256", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("SUITE-DETERMINISTIC-TWO-RUN");
    expect(record.evidence_class).toBe("BOOKKEEPING");
    expect(record.schema_version).toBe(1);

    // Recompute record_sha256 over the record without the field itself.
    const forHashing: Record<string, unknown> = { ...record } as unknown as Record<string, unknown>;
    delete (forHashing as RecordType).record_sha256;
    expect(sha256(JSON.stringify(forHashing))).toBe(record.record_sha256);
    expect(record.record_sha256.length).toBeGreaterThan(0);
  });

  it("goalkeepers suite: COMMON-DETERMINISTIC resolves NOT_EVALUATED -> PASS, everything else unchanged", () => {
    const record = loadRecord();
    const gk = record.suites.goalkeepers;
    expect(gk.suite_version).toBe("suite-goalkeepers-v1");
    expect(gk.accepted_baseline.record_sha256).toBe(
      "5cd1c80879d400c2dabfc0ba6d9b195447fc9476f7b6ebb5329877dd2a69204a",
    );
    expect(gk.verdicts.common["COMMON-DETERMINISTIC"]).toBe("PASS");
    expect(gk.verdict_counts).toEqual({
      PASS: 9,
      FAIL: 0,
      NOT_EVALUATED: 2,
      BLOCKED_MISSING_REFERENCE: 1,
      NEEDS_PERCEPTUAL_REVIEW: 1,
    });
    // Only COMMON-DETERMINISTIC changed (accepted baseline was 8 PASS / 3 NOT_EVALUATED / 1 BLOCKED / 1 NEEDS_PERCEPTUAL_REVIEW).
    expect(gk.verdict_counts.PASS).toBe(gk.accepted_baseline.verdict_counts.PASS + 1);
    expect(gk.verdict_counts.NOT_EVALUATED).toBe(gk.accepted_baseline.verdict_counts.NOT_EVALUATED - 1);
    expect(gk.deterministic_change).toEqual(["COMMON-DETERMINISTIC"]);
    // Blocked reference stays blocked.
    expect(gk.verdicts.catalog.ref).toBe("BLOCKED_MISSING_REFERENCE");
    expect(gk.verdicts.catalog.vis).toBe("NEEDS_PERCEPTUAL_REVIEW");
  });

  it("goalkeepers suite: both attested runs are byte-identical run-1 vs run-2", () => {
    const record = loadRecord();
    for (const run of record.suites.goalkeepers.attested_runs) {
      expect(run.run_id).toBeTruthy();
      expect(run.determinism.state_hash_chain_identical).toBe(true);
      expect(run.determinism.identical).toBe(true);
      expect(run.determinism.observations_byte_identical).toBe(true);
      expect(run.determinism.run_a_state_hash_of_hashes).toBe(run.determinism.run_b_state_hash_of_hashes);
      expect(run.determinism.earliest_divergence_tick).toBeNull();
    }
  });

  it("rules suite: COMMON-DETERMINISTIC evaluates to PASS and the 25 MATCH-* verdicts are unchanged", () => {
    const record = loadRecord();
    const rules = record.suites.rules;
    expect(rules.suite_version).toBe("suite-rules-v1");
    expect(rules.accepted_baseline.record_sha256).toBe(
      "36fc77e52909dbaceefa14927b37b8e533c248e451477fc579dc4952434979ef",
    );
    expect(rules.common_determinism).toBe("PASS");
    expect(rules.verdict_counts_match_criteria).toEqual({
      PASS: 23,
      FAIL: 0,
      NOT_EVALUATED: 0,
      BLOCKED_MISSING_REFERENCE: 2,
      NEEDS_PERCEPTUAL_REVIEW: 0,
    });
    // Adding the COMMON-DETERMINISTIC attestation row moves the row count by +1 PASS.
    expect(rules.verdict_counts_with_common_determinism).toEqual({
      PASS: 24,
      FAIL: 0,
      NOT_EVALUATED: 0,
      BLOCKED_MISSING_REFERENCE: 2,
      NEEDS_PERCEPTUAL_REVIEW: 0,
    });
    // Blocked references stay blocked.
    expect(rules.match_criteria_verdicts["MATCH-CORNER-KICK-CROSS"]).toBe("BLOCKED_MISSING_REFERENCE");
    expect(rules.match_criteria_verdicts["MATCH-GOAL-KICK-DISTRIBUTION"]).toBe("BLOCKED_MISSING_REFERENCE");
    // No §15 criterion regressed on any attested stream.
    expect(rules.attested_per_criterion_regressions).toEqual([]);
    expect(rules.attested_per_criterion_match).toBe(true);
  });

  it("rules suite: every attested stream is byte-identical run-1 vs run-2", () => {
    const record = loadRecord();
    for (const run of record.suites.rules.attested_streams) {
      expect(run.stream_id).toBeTruthy();
      expect(run.determinism.state_hash_chain_identical).toBe(true);
      expect(run.determinism.identical).toBe(true);
      expect(run.determinism.observations_byte_identical).toBe(true);
      expect(run.determinism.run_a_state_hash_of_hashes).toBe(run.determinism.run_b_state_hash_of_hashes);
      expect(run.determinism.earliest_divergence_tick).toBeNull();
    }
  });

  it("record does not claim PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS", () => {
    const record = loadRecord();
    const joined = record.claims_not_made.join("\n").toLowerCase();
    expect(joined).toContain("no promotion");
    expect(joined).toContain("no pes");
    expect(joined).toContain("no foundation_lab_pass");
    expect(joined).toContain("no suite-level pass");
    expect(joined).toContain("no gameplay");
  });

  it("discriminating: same pinned run contract is byte-identical; a different config diverges", () => {
    const scenario = loadScenario(cornerScenarioPath);
    const run = (cfg: Record<string, unknown>) => {
      const m = runHeadlessMatch({
        scenario,
        maxTicks: 200,
        cpuAntiHuddle: true,
        lifecyclePhaseSync: "core-owned",
        serializeRestartFacts: true,
        ...cfg,
      });
      return hashOfStateHashes(m.stateHashes);
    };
    const a = run({});
    const b = run({});
    const c = run({ cpuAntiHuddle: false });
    // Same config -> identical state-hash chain.
    expect(a).toBe(b);
    // A different config must diverge (a non-identical second run fails COMMON-DETERMINISTIC).
    expect(a).not.toBe(c);
  });
});

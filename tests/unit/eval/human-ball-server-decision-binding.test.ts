/**
 * @module tests/unit/eval/human-ball-server-decision-binding.test.ts
 *
 * Evidence-binding test for HUMAN-BALL-SERVER-DECISION (BOOKKEEPING).
 *
 * Locks the recorded decision on the deferred literal pass-button ball-server:
 *
 *  1. The durable record under
 *     `docs/evidence/HUMAN-BALL-SERVER-DECISION/` has the established shape
 *     and a stable, byte-reproducible `record_sha256` (recomputed over the
 *     record without the field).
 *  2. The verdict is a clear recorded DECISION (`DEFER`), and it is
 *     DISCRIMINATING: a changed verdict (e.g. `IMPLEMENT_NOW` or an empty/
 *     hedged verdict) fails the test.
 *  3. The core-machinery analysis is present and records the countdown-zero
 *     auto-serve branches (throw-in / goal-kick / corner-kick), the
 *     pass-requires-contact constraint, and the pass-gated serve path.
 *  4. The determinism/pin and conformance implications are present, including
 *     the criteria that would need re-evaluation on a human-served stream.
 *  5. The alternatives are enumerated (receiver-steering / human-gated wait /
 *     pass-reception path / do-nothing) and the future objective outline
 *     (HUMAN-BALL-SERVER-LITERAL) is recorded, so the deferred item is not an
 *     open thread.
 *  6. The source-level facts asserted by the producer are true (the
 *     countdown-zero branches exist; passRadius is 1.2 m; a pass requires
 *     player-ball proximity).
 *  7. No PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS /
 *     implementation claim is recorded.
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
  "docs/evidence/HUMAN-BALL-SERVER-DECISION/human-ball-server-decision.json",
);

interface DecisionRecord {
  schema_version: number;
  objective_id: string;
  evidence_class: string;
  produced_by: string;
  description: string;
  decision: {
    verdict: string;
    reasons: string[];
    not_a_hedge: string;
  };
  core_machinery_analysis: {
    countdown_zero_auto_serve: {
      branches: Array<{ phase: string; apply_fn: string }>;
      facts_checked: Record<string, boolean>;
    };
    pass_requires_contact: {
      facts_checked: { passRadiusValue: string; passActionRequiresContact: boolean; contactDistCheck: boolean };
    };
    pass_gated_serve_path: { shape: string; needed_state: string; needed_phase: string };
    determinism_implications: Record<string, string>;
    conformance_implications: {
      criteria_to_reevaluate: string[];
      current_coverage: string;
    };
  };
  alternatives: Array<{ id: string; status: string; covers: string; does_not_cover: string; cost: string }>;
  future_objective_outline: { id: string; scope: string; determinism: string; conformance: string; evidence_class: string; claims_not_made: string };
  source_hashes: Record<string, string>;
  claims_not_made: string[];
  record_sha256: string;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(projectRoot, relativePath), "utf-8")) as T;
}

function read(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf-8");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadRecord(): DecisionRecord {
  return readJson<DecisionRecord>(
    "docs/evidence/HUMAN-BALL-SERVER-DECISION/human-ball-server-decision.json",
  );
}

describe("HUMAN-BALL-SERVER-DECISION decision record", () => {
  it("durable record exists with the established shape and stable record_sha256", () => {
    const record = loadRecord();
    expect(record.objective_id).toBe("HUMAN-BALL-SERVER-DECISION");
    expect(record.evidence_class).toBe("BOOKKEEPING");
    expect(record.schema_version).toBe(1);
    expect(record.produced_by).toBe("scripts/capture-human-ball-server-decision.ts");
    expect(typeof record.record_sha256).toBe("string");
    expect(record.record_sha256.length).toBeGreaterThan(0);

    // Recompute record_sha256 over the record without the field itself.
    const copy: Record<string, unknown> = { ...record } as unknown as Record<string, unknown>;
    delete (copy as DecisionRecord).record_sha256;
    expect(sha256(JSON.stringify(copy))).toBe(record.record_sha256);
  });

  it("the verdict is a clear recorded DECISION (DEFER) and is discriminating", () => {
    const record = loadRecord();
    expect(record.decision.verdict).toBe("DEFER");
    expect(record.decision.reasons.length).toBeGreaterThanOrEqual(4);
    // Discriminating: the verdict must be an explicit, non-hedged decision.
    expect(record.decision.not_a_hedge).toContain("DEFER");
  });

  it("core-machinery analysis covers the countdown-zero auto-serve, pass contact constraint, and pass-gated path", () => {
    const record = loadRecord();
    const branches = record.core_machinery_analysis.countdown_zero_auto_serve.branches;
    const phases = branches.map((b) => b.phase);
    expect(phases).toContain("throw-in");
    expect(phases).toContain("goal-kick");
    expect(phases).toContain("corner-kick");
    expect(record.core_machinery_analysis.pass_requires_contact.facts_checked.passRadiusValue).toBe("1.2");
    expect(record.core_machinery_analysis.pass_requires_contact.facts_checked.passActionRequiresContact).toBe(true);
    expect(record.core_machinery_analysis.pass_gated_serve_path.shape.length).toBeGreaterThan(0);
  });

  it("determinism/pin and conformance implications are recorded, incl. criteria needing re-evaluation", () => {
    const record = loadRecord();
    const det = record.core_machinery_analysis.determinism_implications;
    expect(det.human_gated_serve_wait.length).toBeGreaterThan(0);
    expect(det.two_run_attestation.length).toBeGreaterThan(0);
    expect(det.restart_window_machinery.length).toBeGreaterThan(0);
    const criteria = record.core_machinery_analysis.conformance_implications.criteria_to_reevaluate;
    expect(criteria.join(" ")).toContain("MATCH-THROW-IN-SERVE");
    expect(criteria.join(" ")).toContain("MATCH-THROW-IN-TIMER-FREEZE");
    expect(record.core_machinery_analysis.conformance_implications.current_coverage).toContain("No human-served stream");
  });

  it("alternatives are enumerated and the future objective outline is recorded (no open thread)", () => {
    const record = loadRecord();
    const ids = record.alternatives.map((a) => a.id);
    expect(ids).toContain("receiver-steering-destination-control");
    expect(ids).toContain("human-gated-serve-wait");
    expect(ids).toContain("pass-reception-serving-path");
    expect(ids).toContain("do-nothing");
    expect(record.future_objective_outline.id).toBe("HUMAN-BALL-SERVER-LITERAL");
    expect(record.future_objective_outline.scope.length).toBeGreaterThan(0);
  });

  it("source-level facts asserted by the producer are true", () => {
    const sim = read("src/simulation/loop/simulation.ts");
    const contact = read("src/simulation/contacts/contact-system.ts");
    const foundation = read("src/simulation/config/foundation.ts");
    expect(sim).toContain("if (state.throwInCountdown <= 0) {");
    expect(sim).toContain("applyThrowIn();");
    expect(sim).toContain("if (state.goalKickCountdown <= 0) {");
    expect(sim).toContain("applyGoalKick();");
    expect(sim).toContain("if (state.cornerKickCountdown <= 0) {");
    expect(sim).toContain("applyCornerKick();");
    expect(contact).toContain("action === \"pass\"");
    expect(contact).toContain("if (dist <= effectiveRadius) {");
    expect(foundation).toMatch(/passRadius:\s*\{\s*value:\s*1\.2/);
  });

  it("record does not claim PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS / implementation", () => {
    const record = loadRecord();
    const joined = record.claims_not_made.join("\n").toLowerCase();
    expect(joined).toContain("no implementation");
    expect(joined).toContain("no suite-level pass");
    expect(joined).toContain("no promotion");
    expect(joined).toContain("no pes");
    expect(joined).toContain("no foundation_lab_pass");
    expect(joined).toContain("no invented reference");
  });
});

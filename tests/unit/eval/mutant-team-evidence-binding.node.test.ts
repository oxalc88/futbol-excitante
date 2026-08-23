/**
 * @module tests/unit/eval/mutant-team-evidence-binding.node.test
 *
 * Evidence-binding tests for the MUTANT_TEAM_PASS eval.json.
 *
 * Proves that:
 *  1. eval.json exists at docs/evidence/MUTANT_TEAM_PASS/eval.json
 *  2. Structure is valid: overall, milestoneVerdict, outcomes, perMutant
 *  3. overall === milestoneVerdict
 *  4. Re-running runMutantTeam produces the same verdict
 *  5. Per-mutant outcomes are present and all implemented mutants are accounted for
 *  6. No PES fidelity or invented reference envelope claims in outcome descriptions
 *
 * Node I/O is allowed in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runMutantTeam } from "../../../eval/runners/mutant-team.js";
import { runMutantTeamEval } from "../../../eval/runners/mutant-team-eval-runner.js";
import type { MutantTeamEvalResult } from "../../../eval/runners/mutant-team-eval-runner.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveEvidenceDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, "../../..", "docs/evidence/MUTANT_TEAM_PASS");
}

function readEvalJson(): MutantTeamEvalResult {
  const dir = resolveEvidenceDir();
  const path = join(dir, "eval.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as MutantTeamEvalResult;
}

// Valid outcomes accepted by the evidence contract.
const VALID_OUTCOMES = new Set([
  "PASS",
  "FAIL",
  "NOT_EVALUATED",
  "BLOCKED_MISSING_REFERENCE",
  "NEEDS_PERCEPTUAL_REVIEW",
  "INVALID_RUN",
]);

// ---------------------------------------------------------------------------
// 1. eval.json exists on disk
// ---------------------------------------------------------------------------

describe("MUTANT_TEAM_PASS evidence binding: eval.json exists", () => {
  it("eval.json is a valid JSON file at the expected path", () => {
    const doc = readEvalJson();
    expect(doc).toBeDefined();
    expect(typeof doc).toBe("object");
  });

  it("eval.json has required top-level keys", () => {
    const doc = readEvalJson();
    expect(doc).toHaveProperty("registryVersion");
    expect(doc).toHaveProperty("overall");
    expect(doc).toHaveProperty("milestoneVerdict");
    expect(doc).toHaveProperty("outcomes");
    expect(doc).toHaveProperty("perMutant");
  });
});

// ---------------------------------------------------------------------------
// 2. Structure validation
// ---------------------------------------------------------------------------

describe("MUTANT_TEAM_PASS evidence binding: structure", () => {
  it("registryVersion is a non-empty string", () => {
    const doc = readEvalJson();
    expect(typeof doc.registryVersion).toBe("string");
    expect(doc.registryVersion.length).toBeGreaterThan(0);
  });

  it("outcomes is a non-empty array", () => {
    const doc = readEvalJson();
    expect(Array.isArray(doc.outcomes)).toBe(true);
    expect(doc.outcomes.length).toBeGreaterThan(0);
  });

  it("perMutant is a non-empty array with matching length to outcomes", () => {
    const doc = readEvalJson();
    expect(Array.isArray(doc.perMutant)).toBe(true);
    expect(doc.perMutant.length).toBeGreaterThan(0);
    expect(doc.perMutant.length).toBe(doc.outcomes.length);
  });

  it("each outcome has required fields", () => {
    const doc = readEvalJson();
    for (const o of doc.outcomes) {
      expect(typeof o.mutationId).toBe("string");
      expect(o.mutationId.length).toBeGreaterThan(0);
      expect(VALID_OUTCOMES.has(o.outcome)).toBe(true);
      expect(typeof o.executed).toBe("boolean");
      expect(typeof o.deferred).toBe("boolean");
    }
  });

  it("each perMutant entry has required fields", () => {
    const doc = readEvalJson();
    for (const pm of doc.perMutant) {
      expect(typeof pm.mutationId).toBe("string");
      expect(pm.mutationId.length).toBeGreaterThan(0);
      expect(VALID_OUTCOMES.has(pm.outcome)).toBe(true);
      expect(typeof pm.executed).toBe("boolean");
      expect(typeof pm.deferred).toBe("boolean");
    }
  });

  it("overall and milestoneVerdict are valid outcomes", () => {
    const doc = readEvalJson();
    expect(VALID_OUTCOMES.has(doc.overall)).toBe(true);
    expect(VALID_OUTCOMES.has(doc.milestoneVerdict)).toBe(true);
  });

  it("overall equals milestoneVerdict", () => {
    const doc = readEvalJson();
    expect(doc.overall).toBe(doc.milestoneVerdict);
  });

  it("allImplementedDetected is a boolean", () => {
    const doc = readEvalJson();
    expect(typeof doc.allImplementedDetected).toBe("boolean");
  });

  it("anyInvalidRun is a boolean", () => {
    const doc = readEvalJson();
    expect(typeof doc.anyInvalidRun).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// 3. Live re-run consistency
// ---------------------------------------------------------------------------

describe("MUTANT_TEAM_PASS evidence binding: live re-run", () => {
  it("re-running the evaluator produces the same verdict", () => {
    const persisted = readEvalJson();
    const live = runMutantTeamEval();
    expect(live.milestoneVerdict).toBe(persisted.milestoneVerdict);
    expect(live.overall).toBe(persisted.overall);
  });

  it("per-mutant outcomes match between persisted and live", () => {
    const persisted = readEvalJson();
    const live = runMutantTeamEval();

    for (let i = 0; i < persisted.perMutant.length; i++) {
      expect(live.perMutant[i].mutationId).toBe(persisted.perMutant[i].mutationId);
      expect(live.perMutant[i].outcome).toBe(persisted.perMutant[i].outcome);
      expect(live.perMutant[i].executed).toBe(persisted.perMutant[i].executed);
    }
  });

  it("runMutantTeam raw result agrees on verdict", () => {
    const persisted = readEvalJson();
    const rawResult = runMutantTeam();
    expect(rawResult.verdict).toBe(persisted.overall);
  });

  it("implementable count is non-zero", () => {
    const doc = readEvalJson();
    expect(doc.implementableCount).toBeGreaterThan(0);
  });

  it("deferred count is non-zero", () => {
    const doc = readEvalJson();
    expect(doc.deferredCount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Per-mutant coverage
// ---------------------------------------------------------------------------

describe("MUTANT_TEAM_PASS evidence binding: per-mutant coverage", () => {
  it("deferred-summary is present with NOT_EVALUATED", () => {
    const doc = readEvalJson();
    const deferredSummary = doc.outcomes.find(
      (o) => o.mutationId === "deferred-summary",
    );
    expect(deferredSummary).toBeDefined();
    expect(deferredSummary?.outcome).toBe("NOT_EVALUATED");
    expect(deferredSummary?.deferred).toBe(true);
  });

  it("all implementable mutants have executed: true", () => {
    const doc = readEvalJson();
    for (const pm of doc.perMutant) {
      if (pm.mutationId === "deferred-summary") continue;
      expect(pm.executed).toBe(true);
    }
  });

  it("allImplementedDetected is true in persisted eval.json", () => {
    const doc = readEvalJson();
    expect(doc.allImplementedDetected).toBe(true);
  });

  it("no implementable mutant is INVALID_RUN", () => {
    const doc = readEvalJson();
    for (const pm of doc.perMutant) {
      if (pm.mutationId === "deferred-summary") continue;
      expect(pm.outcome).not.toBe("INVALID_RUN");
    }
  });
});

// ---------------------------------------------------------------------------
// 5. No forbidden claims
// ---------------------------------------------------------------------------

describe("MUTANT_TEAM_PASS evidence binding: no forbidden claims", () => {
  it("no outcome description references PES fidelity", () => {
    const doc = readEvalJson();
    for (const o of doc.outcomes) {
      if (o.cleanResult) {
        expect(o.cleanResult.description.toLowerCase()).not.toContain("pes 2017 fidelity");
      }
      if (o.poisonedResult) {
        expect(o.poisonedResult.description.toLowerCase()).not.toContain("pes 2017 fidelity");
      }
    }
  });

  it("no outcome description invents reference envelopes", () => {
    const doc = readEvalJson();
    for (const o of doc.outcomes) {
      if (o.cleanResult) {
        expect(o.cleanResult.description.toLowerCase()).not.toContain("reference envelope");
      }
      if (o.poisonedResult) {
        expect(o.poisonedResult.description.toLowerCase()).not.toContain("reference envelope");
      }
    }
  });
});
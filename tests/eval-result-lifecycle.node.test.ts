import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeEvalResult } from "../gauntlet/evals/src/write-result.js";

const previous = process.env.GAUNTLET_EVAL_DURABLE;
afterEach(() => {
  if (previous === undefined) delete process.env.GAUNTLET_EVAL_DURABLE;
  else process.env.GAUNTLET_EVAL_DURABLE = previous;
});

describe("STATE-AUDIT-EPHEMERAL-LIFECYCLE", () => {
  it("writes routine state-audit outputs only under ignored test-results by default", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "eval-result-"));
    delete process.env.GAUNTLET_EVAL_DURABLE;
    const first = await writeEvalResult(repoRoot, { evaluator: "state_audit", passed: 1, failed: 0, results: [] }, new Date("2026-08-17T10:00:00Z"));
    const second = await writeEvalResult(repoRoot, { evaluator: "state_audit", passed: 1, failed: 0, results: [] }, new Date("2026-08-17T10:01:00Z"));

    expect(first).toMatch(/^test-results\/gauntlet-evals\//);
    expect(second).toMatch(/^test-results\/gauntlet-evals\//);
    expect(existsSync(join(repoRoot, "gauntlet/evals/results"))).toBe(false);
  });

  it("requires explicit promotion mode for a durable eval result", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "eval-result-"));
    process.env.GAUNTLET_EVAL_DURABLE = "1";
    const result = await writeEvalResult(repoRoot, { evaluator: "state_audit", passed: 1, failed: 0, results: [] }, new Date("2026-08-17T10:02:00Z"));
    expect(result).toMatch(/^gauntlet\/evals\/results\//);
  });
});

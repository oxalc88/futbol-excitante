import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const maintenance = readFileSync(".github/workflows/pr-validation.yml", "utf8");
const runtime = readFileSync(".github/workflows/main-regression-monitor.yml", "utf8");

describe("Gauntlet CI responsibility boundary", () => {
  it("keeps maintenance validation PR-only", () => {
    expect(maintenance).toContain("name: Gauntlet Maintenance PR CI");
    expect(maintenance).toContain("pull_request:");
    expect(maintenance).not.toMatch(/^\s*push:\s*$/m);
    expect(maintenance).toContain("Classify base vs PR failures");
  });

  it("keeps runtime regression detection main-push-only", () => {
    expect(runtime).toContain("name: Gauntlet Runtime CI");
    expect(runtime).toMatch(/push:\s*\n\s*branches: \[main\]/);
    expect(runtime).not.toContain("pull_request:");
    expect(runtime).toContain("ref: gauntlet-regressions");
  });

  it("keeps runtime CI observational instead of a Gauntlet blocker", () => {
    expect(runtime).toContain("continue-on-error: true");
    expect(runtime).not.toContain("Mark validation result");
    expect(runtime).not.toMatch(/run:\s*exit 1/);
    expect(runtime).toContain("Update deterministic regression inbox");
  });
});

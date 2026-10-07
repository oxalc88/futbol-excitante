/**
 * Release-continuity regression: main must never silently downgrade the
 * Gauntlet version or lose the current-verification-authority capabilities
 * introduced in 0.14.0 (content-addressed current verification, bureaucracy
 * regression contract, execution provenance).
 *
 * A downgrade or capability removal would silently re-open the published
 * repository/full deadlock (observation and repair slots consumed) that
 * 0.14.0 resolved.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(__dirname, "../..");
const version = JSON.parse(
  readFileSync(join(repoRoot, "gauntlet/VERSION.json"), "utf8"),
) as { version: string; semver: boolean; schema_version: number };

function read(...parts: string[]): string {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

describe("release continuity: Gauntlet version and capability floor", () => {
  it("main is on Gauntlet 0.14.0 or later", () => {
    const [major, minor] = version.version.split(".").map(Number);
    expect(major).toBeGreaterThanOrEqual(0);
    expect(minor).toBeGreaterThanOrEqual(14);
    expect(version.semver).toBe(true);
  });

  it("the current-verification-v2 policy remains the canonical observation path", () => {
    const incidents = read("gauntlet/runtime/incidents.ts");
    expect(incidents).toContain("'current-verification-v2'");
    // The content-addressed permission check must stay wired into the
    // observation flow (0.14.0 current-verification authority).
    const recovery = read("gauntlet/runtime/incident-recovery.ts");
    expect(recovery).toContain("currentEvidenceAvailable");
    expect(recovery).toContain("current-verification-v2");
  });

  it("the bureaucracy contract remains in force", () => {
    const bureaucracy = read("gauntlet/runtime/bureaucracy.ts");
    // Content-addressed permission, not rewards: the anti-pattern the
    // 0.14.0 contract was written to prevent.
    expect(bureaucracy).toContain("content-addressed");
    expect(bureaucracy).toContain("ZERO_BURDEN");
  });

  it("execution provenance recovery remains available", () => {
    expect(read("gauntlet/runtime/execution-provenance.ts")).toContain(
      "export function",
    );
    const continuation = read("gauntlet/runtime/continuation.ts");
    expect(continuation).toContain("repairExecutionProvenance");
    expect(continuation).toContain("CERTIFY_CURRENT");
  });

  it("the release notes documenting the restored capabilities stay published", () => {
    const notes = read("gauntlet/RELEASE-0.14.0.md");
    expect(notes).toContain("current-state authority");
    expect(notes).toContain("bureaucracy regression evals");
  });
});

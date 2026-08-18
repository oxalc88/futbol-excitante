import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const gate = fileURLToPath(new URL("../scripts/ci/verify-candidate-scope.mjs", import.meta.url));

function git(cwd: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

describe("CANDIDATE-SCOPE-ISOLATION", () => {
  it("rejects residual staged artifacts outside the declared candidate scope", () => {
    const cwd = mkdtempSync(join(tmpdir(), "candidate-scope-"));
    git(cwd, "init");
    git(cwd, "config", "user.email", "test@example.com");
    git(cwd, "config", "user.name", "Test");

    writeFileSync(join(cwd, "candidate.ts"), "export const candidate = 1;\n");
    const residual = join(cwd, "docs/screenshots/OLD-OBJECTIVE/frame-000.png");
    mkdirSync(dirname(residual), { recursive: true });
    writeFileSync(residual, "old-evidence");
    git(cwd, "add", ".");

    const result = spawnSync("node", [gate, "--allow", "candidate.ts"], { cwd, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("CANDIDATE-SCOPE-ISOLATION");
    expect(result.stdout).toContain("docs/screenshots/OLD-OBJECTIVE/frame-000.png");
  });

  it("passes when every staged path is explicitly allowed", () => {
    const cwd = mkdtempSync(join(tmpdir(), "candidate-scope-"));
    git(cwd, "init");
    writeFileSync(join(cwd, "candidate.ts"), "export const candidate = 1;\n");
    git(cwd, "add", "candidate.ts");

    const result = spawnSync("node", [gate, "--allow", "candidate.ts"], { cwd, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"pass": true');
  });
});

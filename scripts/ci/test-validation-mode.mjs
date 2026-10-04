import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const selector = fileURLToPath(new URL("./select-validation-mode.mjs", import.meta.url));
const pkg = { scripts: { test: "vitest run --project node" }, devDependencies: { vitest: "existing" } };
const config = { compilerOptions: { types: ["node"] }, include: ["src/**/*.ts", "gauntlet/runtime/**/*.ts"], exclude: ["tests/**/*"] };
const json = value => JSON.stringify(value);
const cases = [
  ["Gauntlet contracts", "fast", { "gauntlet/product-quality-contract.md": "policy" }],
  ["Gauntlet runtime", "fast", { "gauntlet/runtime/product-quality.ts": "policy" }],
  ["Gauntlet scenarios", "fast", { "gauntlet/evals/scenarios/impact.json": "{}" }],
  ["Gauntlet unit tests", "fast", { "tests/unit/gauntlet-0.11.0-product.test.ts": "test" }],
  ["Gauntlet manual preflight", "fast", { ".github/workflows/gauntlet-preflight.yml": "workflow" }],
  ["Gauntlet script additions", "fast", { "package.json": json({ ...pkg, scripts: { ...pkg.scripts, "gauntlet:quality": "node scripts/gauntlet/product-quality.ts", "gauntlet:trajectory": "node scripts/gauntlet/trajectory.ts", "gauntlet:product:test": "vitest run tests/unit/gauntlet-0.11.0-product.test.ts" } }) }],
  ["Gauntlet node include additions", "fast", { "tsconfig.node.json": json({ ...config, include: [...config.include, "scripts/gauntlet/trajectory.ts"] }) }],
  ["Application edits", "full", { "src/simulation/ball/ball-system.ts": "gameplay" }],
  ["Gameplay eval edits", "full", { "eval/contracts/suites.ts": "oracle" }],
  ["Gameplay test edits", "full", { "tests/unit/ball/ball-system.test.ts": "test" }],
  ["Unknown paths", "full", { "misc/unknown.ts": "unknown" }],
  ["Other compiler config", "full", { "tsconfig.core.json": "{}" }],
  ["Dependency edits", "full", { "package.json": json({ ...pkg, devDependencies: { vitest: "changed" } }) }],
  ["Regression script edits", "full", { "package.json": json({ ...pkg, scripts: { test: "echo skip" } }) }],
  ["Compiler option edits", "full", { "tsconfig.node.json": json({ ...config, compilerOptions: { types: [] } }) }],
  ["Removed application checking", "full", { "tsconfig.node.json": json({ ...config, include: ["gauntlet/runtime/**/*.ts"] }) }],
  ["Expanded application checking", "full", { "tsconfig.node.json": json({ ...config, include: [...config.include, "src/adapters/**/*.ts"] }) }],
  ["Excluded application checking", "full", { "tsconfig.node.json": json({ ...config, exclude: [...config.exclude, "src/**/*"] }) }],
  ["Mixed application and Gauntlet edits", "full", { "gauntlet/PROMPT.md": "policy", "src/apps/browser/main.ts": "application" }],
];

for (const [name, expected, files] of cases) {
  const dir = mkdtempSync(join(tmpdir(), "gauntlet-ci-mode-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const write = (path, content) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), content); };
  try {
    git("init", "-b", "main"); git("config", "user.name", "CI test"); git("config", "user.email", "ci@example.invalid");
    write("package.json", json(pkg)); write("tsconfig.node.json", json(config)); git("add", "."); git("commit", "-m", "base");
    const base = git("rev-parse", "HEAD");
    for (const [path, content] of Object.entries(files)) write(path, content);
    git("add", "."); git("commit", "-m", name);
    const output = execFileSync(process.execPath, [selector, base, git("rev-parse", "HEAD")], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(output.trim(), `mode=${expected}`, name);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
console.log(`PASS ${cases.length} CI scope cases: Gauntlet-only Node checks; application/unknown impact remains full`);

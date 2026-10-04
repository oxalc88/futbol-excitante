import { execFileSync } from "node:child_process";

const [base, head] = process.argv.slice(2);
if (!base || !head) throw new Error("usage: select-validation-mode.mjs <base-sha> <head-sha>");

const changed = execFileSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const exact = new Set([
  "AGENTS.md",
  "opencode.json",
  ".github/workflows/pr-validation.yml",
  ".github/workflows/gauntlet-preflight.yml",
  "scripts/ci/run-validation.mjs",
  "scripts/ci/classify-pr-validation.mjs",
  "scripts/ci/select-validation-mode.mjs",
  "gauntlet/PROMPT.md",
  "gauntlet/README.md",
  "gauntlet/VERSION.json",
  "gauntlet/models.json",
  "gauntlet/objectives.md",
  "gauntlet/principles.md",
  "gauntlet/product-flow-contract.md",
  "gauntlet/harness-contract.md",
  "gauntlet/parallel-issue-contract.md",
  "gauntlet/parallel-plan.example.json",
  "scripts/ci/test-parallel-issue-policy.mjs",
  "scripts/ci/test-omp-parallel-gate.mjs",
  "scripts/ci/test-gauntlet-telemetry.mjs",
  "scripts/ci/test-validation-mode.mjs",
  "gauntlet/evals/src/prompt-gate.ts",
  "tests/unit/eval/release-0-9-7-consolidation-binding.test.ts",
]);


const FAST_PACKAGE_SCRIPTS = new Set([
  "gauntlet:parallel:sync",
  "gauntlet:parallel:state",
  "gauntlet:parallel:complete",
  "gauntlet:parallel:status",
  "gauntlet:parallel:test",
  "gauntlet:quality",
  "gauntlet:trajectory",
  "gauntlet:product:test",
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function packageJsonIsFastSafe() {
  try {
    const readAt = (ref) =>
      JSON.parse(execFileSync("git", ["show", `${ref}:package.json`], { encoding: "utf8" }));
    const stripAllowedScripts = (pkg) => ({
      ...pkg,
      scripts: Object.fromEntries(
        Object.entries(pkg.scripts ?? {}).filter(([name]) => !FAST_PACKAGE_SCRIPTS.has(name)),
      ),
    });
    return JSON.stringify(stable(stripAllowedScripts(readAt(base)))) ===
      JSON.stringify(stable(stripAllowedScripts(readAt(head))));
  } catch {
    return false;
  }
}

// Gauntlet CLI additions may extend node checking, but must not remove or
// alter application checking, compiler settings or exclusions.
function nodeConfigIsFastSafe() {
  try {
    const readAt = (ref) => JSON.parse(execFileSync("git", ["show", `${ref}:tsconfig.node.json`], { encoding: "utf8" }));
    const before = readAt(base), after = readAt(head);
    const withoutInclude = ({ include, ...rest }) => rest;
    if (JSON.stringify(stable(withoutInclude(before))) !== JSON.stringify(stable(withoutInclude(after)))) return false;
    if (!Array.isArray(before.include) || !Array.isArray(after.include)) return false;
    if (before.include.some(path => !after.include.includes(path))) return false;
    return after.include.filter(path => !before.include.includes(path)).every(path =>
      typeof path === "string" && !path.includes("..") && /^(?:gauntlet\/|scripts\/gauntlet\/|\.omp\/)/.test(path));
  } catch { return false; }
}

const prefixes = [
  "gauntlet/",
  "scripts/gauntlet/",
  ".grok/",
  ".omp/",
  ".opencode/",
];

function isFastPath(path) {
  if (path === "package.json") return packageJsonIsFastSafe();
  if (path === "tsconfig.node.json") return nodeConfigIsFastSafe();
  if (exact.has(path)) return true;
  if (prefixes.some((prefix) => path.startsWith(prefix))) return true;
  if (/^tests\/unit\/gauntlet-[^/]+\.test\.ts$/.test(path)) return true;
  return false;
}

const unsafe = changed.filter((path) => !isFastPath(path));
const mode = changed.length > 0 && unsafe.length === 0 ? "fast" : "full";

console.error(`CI validation mode: ${mode}`);
console.error(`Changed files: ${changed.length}`);
if (unsafe.length > 0) console.error(`Full-suite triggers: ${unsafe.join(", ")}`);
console.log(`mode=${mode}`);

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
  "gauntlet/evals/src/prompt-gate.ts",
  "tests/unit/eval/release-0-9-7-consolidation-binding.test.ts",
]);

const prefixes = [
  "scripts/gauntlet/",
  ".grok/",
  ".omp/",
  ".opencode/",
];

function isFastPath(path) {
  if (exact.has(path)) return true;
  if (prefixes.some((prefix) => path.startsWith(prefix))) return true;
  if (/^gauntlet\/RELEASE-[^/]+\.md$/.test(path)) return true;
  return false;
}

const unsafe = changed.filter((path) => !isFastPath(path));
const mode = changed.length > 0 && unsafe.length === 0 ? "fast" : "full";

console.error(`CI validation mode: ${mode}`);
console.error(`Changed files: ${changed.length}`);
if (unsafe.length > 0) console.error(`Full-suite triggers: ${unsafe.join(", ")}`);
console.log(`mode=${mode}`);

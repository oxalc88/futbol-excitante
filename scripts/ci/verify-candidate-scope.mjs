import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const exact = new Set();
const prefixes = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--allow" && args[i + 1]) exact.add(args[++i]);
  else if (args[i] === "--allow-prefix" && args[i + 1]) prefixes.push(args[++i].replace(/\/+$/, "") + "/");
}

if (exact.size === 0 && prefixes.length === 0) {
  console.error("Candidate scope gate requires at least one --allow or --allow-prefix path");
  process.exit(2);
}

const staged = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
  cwd: process.cwd(),
  encoding: "utf8",
});
if (staged.status !== 0) {
  process.stderr.write(staged.stderr ?? "");
  process.exit(staged.status ?? 1);
}

const paths = (staged.stdout ?? "").split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
if (paths.length === 0) {
  console.error("Candidate scope gate: no staged candidate paths");
  process.exit(1);
}

const forbidden = [
  /^gauntlet\/state\//,
  /^gauntlet\/evals\/results\//,
  /^docs\/screenshots\/capture(?:\/|$)/,
  /^docs\/incidents\//,
];

const violations = paths.filter((candidate) => {
  if (forbidden.some((pattern) => pattern.test(candidate))) return true;
  if (exact.has(candidate)) return false;
  return !prefixes.some((prefix) => candidate.startsWith(prefix));
});

const result = {
  gate: "CANDIDATE-SCOPE-ISOLATION",
  staged: paths,
  allowed_exact: [...exact],
  allowed_prefixes: prefixes,
  violations,
  pass: violations.length === 0,
};
console.log(JSON.stringify(result, null, 2));
if (violations.length > 0) process.exitCode = 1;
